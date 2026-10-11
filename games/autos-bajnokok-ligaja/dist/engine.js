(function(root){
 'use strict';
 const SPEC=[['league','Alapszakasz',1],['playoff','Playoff',1],['r16','Nyolcaddöntő',1],['qf','Negyeddöntő',2],['sf','Elődöntő',3],['final','Döntő',5]];
 function rng(seed){let n=seed>>>0;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 function shuffle(a,r){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function create(names,seed){
  if(!Array.isArray(names)||names.length!==4||names.some(p=>!Array.isArray(p)||p.length!==8))throw Error('Mind a négy kalapba pontosan 8 autó kell.');
  const cars=names.flatMap((pot,p)=>pot.map((name,i)=>({id:'c'+(p*8+i+1),name:String(name).trim(),pot:p+1})));
  if(cars.some(c=>!c.name||c.name.length>80))throw Error('Az autó neve 1–80 karakter lehet.');
  if(new Set(cars.map(c=>c.name.toLocaleLowerCase('hu'))).size!==32)throw Error('Minden autónak különböző nevet adj. A szín vagy egy sorszám segíthet.');
  return {version:1,seed:seed>>>0,createdAt:new Date().toISOString(),cars,events:[]};
 }
 function schedule(state){
  const r=rng(state.seed),pots=[1,2,3,4].map(p=>shuffle(state.cars.filter(c=>c.pot===p).map(c=>c.id),r));
  const rounds=[[],[],[],[],[],[],[],[]];
  for(const original of pots){let list=original.slice();for(let k=0;k<2;k++){
   for(let i=0;i<4;i++)rounds[k].push([list[i],list[7-i]]);
   list=[list[0],list[7],...list.slice(1,7)];
  }}
  const pairings=[[[0,3],[1,2]],[[0,2],[3,1]],[[0,1],[2,3]]];
  for(let k=0;k<3;k++)for(const [a,b] of pairings[k]){
   const left=shuffle(pots[a],r),right=shuffle(pots[b],r),offset=Math.floor(r()*8);
   for(let leg=0;leg<2;leg++)for(let i=0;i<8;i++)rounds[2+k*2+leg].push([left[i],right[(i+offset+leg)%8]]);
  }
  return shuffle(rounds,r).flatMap((matches,round)=>shuffle(matches,r).map(([a,b],i)=>({id:'l'+(round*16+i),a,b,round:round+1,number:i+1,wins:[]})));
 }
 function winner(t,need){const a=t.wins.filter(w=>w===t.a).length,b=t.wins.length-a;return a>=need?t.a:b>=need?t.b:null;}
 function complete(stage){return stage.ties.every(t=>winner(t,stage.need));}
 function active(stage){return stage.ties.find(t=>!winner(t,stage.need))||null;}
 function standings(state,league){
  const order=shuffle(state.cars.map(c=>c.id),rng(state.seed^0x4f8c9871));
  const rows=state.cars.map(c=>({...c,played:0,won:0,lost:0,points:0,opponents:[],beaten:[],sos:0,sov:0,lot:order.indexOf(c.id)}));
  const by=Object.fromEntries(rows.map(x=>[x.id,x]));
  for(const t of league.ties){by[t.a].opponents.push(t.b);by[t.b].opponents.push(t.a);if(t.wins.length){const win=t.wins[0],lose=win===t.a?t.b:t.a;by[win].won++;by[lose].lost++;by[win].played++;by[lose].played++;by[win].points+=2;by[win].beaten.push(lose);}}
  for(const x of rows){x.sos=x.opponents.reduce((n,id)=>n+by[id].points,0);x.sov=x.beaten.reduce((n,id)=>n+by[id].points,0);}
  return rows.sort((a,b)=>b.points-a.points||b.sos-a.sos||b.sov-a.sov||a.lot-b.lot).map((x,i)=>({...x,rank:i+1}));
 }
 function nextStage(state,stages){
  const prev=stages[stages.length-1],i=stages.length;
  if(!complete(prev)||i>=SPEC.length)throw Error('Ez a szakasz még nincs kész.');
  let pairs=[];
  if(i===1){const table=standings(state,stages[0]);pairs=Array.from({length:8},(_,j)=>[table[8+j].id,table[23-j].id]);}
  else if(i===2){const top=standings(state,stages[0]).slice(0,8).map(c=>c.id),qual=prev.ties.map(t=>winner(t,prev.need));const drawn=shuffle([...top,...qual],rng(state.seed^0xa1784589));pairs=Array.from({length:8},(_,j)=>drawn.slice(j*2,j*2+2));}
  else {const ids=prev.ties.map(t=>winner(t,prev.need));pairs=Array.from({length:ids.length/2},(_,j)=>ids.slice(j*2,j*2+2));}
  const [id,name,need]=SPEC[i];return {id,name,need,ties:pairs.map(([a,b],j)=>({id:id+j,a,b,wins:[]}))};
 }
 function derive(state){
  const stages=[{id:'league',name:'Alapszakasz',need:1,ties:schedule(state)}];
  for(const event of state.events){const stage=stages[stages.length-1];
   if(event.type==='advance')stages.push(nextStage(state,stages));
   else if(event.type==='win'){
    const t=active(stage);if(!t||event.stage!==stage.id||event.tie!==t.id||![t.a,t.b].includes(event.winner))throw Error('Érvénytelen mérkőzéseredmény a mentésben.');
    t.wins.push(event.winner);
   }else throw Error('Ismeretlen esemény a mentésben.');
  }
  const current=stages[stages.length-1];return {stages,current,match:active(current),table:standings(state,stages[0]),champion:current.id==='final'&&complete(current)?winner(current.ties[0],5):null};
 }
 function validate(value){
  if(!value||value.version!==1||!Number.isInteger(value.seed)||value.seed<0||value.seed>4294967295||!Array.isArray(value.cars)||value.cars.length!==32||!Array.isArray(value.events)||value.events.length>180)throw Error('Ez nem érvényes bajnokságmentés.');
  const names=[1,2,3,4].map(p=>value.cars.filter(c=>c.pot===p).map(c=>c.name));
  const s=create(names,value.seed);
  if(value.cars.some((c,i)=>c.id!==s.cars[i].id||c.name!==s.cars[i].name||c.pot!==s.cars[i].pot))throw Error('Sérült autólista.');
  s.events=value.events;s.createdAt=value.createdAt;derive(s);return s;
 }
 const api={SPEC,rng,shuffle,create,schedule,winner,complete,active,standings,derive,validate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Tournament=api;
})(typeof globalThis!=='undefined'?globalThis:this);
