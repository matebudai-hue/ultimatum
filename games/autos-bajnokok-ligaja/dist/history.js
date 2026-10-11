(function(root){
 'use strict';
 const E=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.Tournament;
 const KEY='autos-bl-history-v1',KIND='autos-bl-tornaelozmenyek';
 const resultLabels=['Alapszakasz','Playoff','Nyolcaddöntő','Negyeddöntő','Elődöntő','Döntős','Bajnok'];
 const empty=()=>({kind:KIND,version:1,tournaments:[]});
 const carKey=name=>String(name).normalize('NFKC').trim().toLocaleLowerCase('hu');
 const identity=state=>JSON.stringify([state.seed,state.createdAt,state.cars]);
 function validateEntry(entry){
  if(!entry||typeof entry.id!=='string'||!/^t[a-z0-9-]{1,100}$/i.test(entry.id)||typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>80||typeof entry.savedAt!=='string'||!Number.isFinite(Date.parse(entry.savedAt)))throw Error('Sérült torna az előzményekben.');
  const state=E.validate(entry.state);if(!E.derive(state).champion)throw Error('Az előzményekbe csak befejezett torna menthető.');
  return {id:entry.id,title:entry.title.trim(),savedAt:entry.savedAt,state};
 }
 function validate(value){
  if(!value||value.kind!==KIND||value.version!==1||!Array.isArray(value.tournaments)||value.tournaments.length>1000)throw Error('Ez nem érvényes tornaelőzmény-mentés.');
  const tournaments=value.tournaments.map(validateEntry);if(new Set(tournaments.map(e=>e.id)).size!==tournaments.length||new Set(tournaments.map(e=>identity(e.state))).size!==tournaments.length)throw Error('Ismétlődő torna a mentésben.');
  return {kind:KIND,version:1,tournaments};
 }
 function load(storage){const raw=storage.getItem(KEY);return raw?validate(JSON.parse(raw)):empty();}
 function save(storage,state,title){
  state=E.validate(state);if(!E.derive(state).champion)throw Error('Előbb fejezzétek be a döntőt.');
  const library=load(storage),existing=library.tournaments.find(e=>identity(e.state)===identity(state));
  const entry=validateEntry({id:existing?.id||'t'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),title:title?.trim()||existing?.title||'Bajnokság '+(library.tournaments.length+1),savedAt:new Date().toISOString(),state});
  if(existing)library.tournaments[library.tournaments.indexOf(existing)]=entry;else library.tournaments.push(entry);
  storage.setItem(KEY,JSON.stringify(library));return entry;
 }
 function merge(storage,value){
  const incoming=validate(value),library=load(storage);let added=0;
  for(const entry of incoming.tournaments){const old=library.tournaments.find(e=>identity(e.state)===identity(entry.state));if(old){if(Date.parse(entry.savedAt)>=Date.parse(old.savedAt))library.tournaments[library.tournaments.indexOf(old)]={...entry,id:old.id};}else{library.tournaments.push({...entry,id:library.tournaments.some(e=>e.id===entry.id)?'t'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10):entry.id});added++;}}
  validate(library);storage.setItem(KEY,JSON.stringify(library));return added;
 }
 function summary(entry){
  const data=E.derive(entry.state),rows=data.table.map(c=>({...c,level:0,result:'Alapszakasz',wins:0,losses:0})),by=Object.fromEntries(rows.map(c=>[c.id,c]));
  data.stages.forEach((s,i)=>{for(const t of s.ties){by[t.a].level=Math.max(by[t.a].level,i);by[t.b].level=Math.max(by[t.b].level,i);for(const w of t.wins){by[w].wins++;by[w===t.a?t.b:t.a].losses++;}}});
  by[data.champion].level=6;for(const row of rows)row.result=resultLabels[row.level];
  const final=data.current.ties[0];return {...entry,champion:data.champion,championName:by[data.champion].name,runnerUp:final.a===data.champion?final.b:final.a,score:final.wins.filter(w=>w===data.champion).length+'–'+final.wins.filter(w=>w!==data.champion).length,games:entry.state.events.filter(e=>e.type==='win').length,rows,data};
 }
 function aggregate(library){
  const all=new Map();
  for(const entry of library.tournaments){const tournament=summary(entry);for(const row of tournament.rows){const key=carKey(row.name);if(!all.has(key))all.set(key,{key,name:row.name,tournaments:0,titles:0,finals:0,roundOf16:0,wins:0,losses:0,best:0,appearances:[]});
   const car=all.get(key);car.tournaments++;car.titles+=row.level===6?1:0;car.finals+=row.level>=5?1:0;car.roundOf16+=row.level>=2?1:0;car.wins+=row.wins;car.losses+=row.losses;car.best=Math.max(car.best,row.level);car.appearances.push({entryId:entry.id,title:entry.title,date:entry.savedAt,carId:row.id,pot:row.pot,rank:row.rank,points:row.points,result:row.result,level:row.level,wins:row.wins,losses:row.losses});
  }}
  return [...all.values()].map(car=>({...car,played:car.wins+car.losses,winRate:Math.round(100*car.wins/(car.wins+car.losses)),bestResult:resultLabels[car.best],appearances:car.appearances.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))})).sort((a,b)=>b.titles-a.titles||b.finals-a.finals||b.wins-a.wins||b.winRate-a.winRate||a.name.localeCompare(b.name,'hu'));
 }
 const api={KEY,KIND,empty,carKey,identity,validate,load,save,merge,summary,aggregate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TournamentHistory=api;
})(typeof globalThis!=='undefined'?globalThis:this);
