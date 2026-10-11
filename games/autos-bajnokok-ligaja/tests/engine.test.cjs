const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const names=Array.from({length:4},(_,p)=>Array.from({length:8},(_,i)=>`Kalap ${p+1} autó ${i+1}`));
const make=seed=>E.create(names,seed);
function record(s,win){const d=E.derive(s);s.events.push({type:'win',stage:d.current.id,tie:d.match.id,winner:win||d.match.a});}
function full(seed,long=false){const s=make(seed);let games=0;while(true){const d=E.derive(s);if(d.champion)return {s,d,games};if(d.match){const t=d.match;const win=long&&d.current.need>1?(t.wins.length<2*(d.current.need-1)?(t.wins.length%2?t.b:t.a):t.a):t.a;record(s,win);games++;}else s.events.push({type:'advance'});if(games>175)throw Error('Nem ér véget a bajnokság.');}}
test('2000 sorsolás: 8 forduló, 16 meccs, autónként 2 ellenfél minden kalapból, ismétlés nélkül',()=>{
 for(let seed=0;seed<2000;seed++){
  const s=make(seed),draw=E.schedule(s),by=Object.fromEntries(s.cars.map(c=>[c.id,c])),seen=new Set();
  assert.equal(draw.length,128);
  for(let r=1;r<=8;r++){const matches=draw.filter(t=>t.round===r);assert.equal(matches.length,16);assert.equal(new Set(matches.flatMap(t=>[t.a,t.b])).size,32);}
  for(const t of draw){assert.notEqual(t.a,t.b);const key=[t.a,t.b].sort().join(':');assert(!seen.has(key));seen.add(key);}
  for(const c of s.cars){const opponents=draw.filter(t=>t.a===c.id||t.b===c.id).map(t=>t.a===c.id?t.b:t.a);assert.equal(opponents.length,8);assert.equal(new Set(opponents).size,8);for(let p=1;p<=4;p++)assert.equal(opponents.filter(id=>by[id].pot===p).length,2);}
  assert.deepEqual(E.schedule(s),draw);
 }
});
test('Pontszámítás és ellenfélpontok helyesek; összesen 256 kiosztott pont',()=>{
 const s=make(127);for(let i=0;i<128;i++)record(s);
 const d=E.derive(s);assert.equal(d.table.reduce((n,c)=>n+c.points,0),256);assert.equal(d.table.reduce((n,c)=>n+c.won,0),128);assert.equal(d.table.reduce((n,c)=>n+c.lost,0),128);
 for(const c of d.table){assert.equal(c.played,8);assert.equal(c.points,c.won*2);assert.equal(c.sos,c.opponents.reduce((n,id)=>n+d.table.find(x=>x.id===id).points,0));assert.equal(c.sov,c.beaten.reduce((n,id)=>n+d.table.find(x=>x.id===id).points,0));}
 const table=d.table;s.events.push({type:'advance'});const playoff=E.derive(s).current;
 for(let i=0;i<8;i++){assert.equal(playoff.ties[i].a,table[8+i].id);assert.equal(playoff.ties[i].b,table[23-i].id);}
});
test('Teljes torna minimum 163 és maximum 175 meccs, helyes továbbjutás és párharcgyőzelem',()=>{
 for(let seed=0;seed<10;seed++)for(const long of [false,true]){const {s,d,games}=full(seed,long);assert.equal(games,long?175:163);assert.equal(d.stages.length,6);assert.equal(s.events.length,games+5);assert(d.champion);
  const expected=[128,8,8,4,2,1];d.stages.forEach((st,i)=>{assert.equal(st.ties.length,expected[i]);assert(E.complete(st));for(const t of st.ties){const winner=E.winner(t,st.need);assert.equal(t.wins.filter(w=>w===winner).length,st.need);assert(t.wins.length<=st.need*2-1);}});
  const r16=d.stages[2];const participants=r16.ties.flatMap(t=>[t.a,t.b]);assert.equal(new Set(participants).size,16);for(const top of d.table.slice(0,8))assert(participants.includes(top.id));for(const t of d.stages[1].ties)assert(participants.includes(E.winner(t,1)));
  for(let i=3;i<6;i++){const previous=d.stages[i-1],next=d.stages[i];assert.deepEqual(next.ties.flatMap(t=>[t.a,t.b]),previous.ties.map(t=>E.winner(t,previous.need)));}
 }
});
test('Mentés, betöltés és determinisztikus kieséses sorsolás',()=>{
 const {s,d}=full(123,true);const imported=E.validate(JSON.parse(JSON.stringify(s)));assert.deepEqual(E.derive(imported),d);
 assert.throws(()=>E.validate({...s,seed:-1}));assert.throws(()=>E.validate({...s,events:[{type:'win',stage:'league',tie:'l0',winner:'c99'}]}));assert.throws(()=>E.validate({...s,events:[{type:'advance'}]}));assert.throws(()=>E.validate({...s,events:[...s.events,{type:'advance'}]}));
});
test('Visszavonás szakaszhatáron és döntő végén; korábbi eredmény javítása újraszámol',()=>{
 const {s}=full(777,true);const last=s.events.findLastIndex(e=>e.type==='win');s.events=s.events.slice(0,last);const d=E.derive(s);assert.equal(d.champion,null);assert.equal(d.current.id,'final');assert.equal(d.match.wins.length,8);record(s,d.match.b);assert(E.derive(s).champion);
 const l=make(45);for(let i=0;i<128;i++)record(l);l.events.push({type:'advance'});const idx=l.events.findLastIndex(e=>e.type==='win');l.events=l.events.slice(0,idx);const restored=E.derive(l);assert.equal(restored.stages.length,1);assert.equal(restored.match.id,'l127');assert.equal(restored.table.reduce((n,c)=>n+c.points,0),254);
 l.events=l.events.slice(0,20);assert.equal(E.derive(l).match.id,'l20');assert.equal(E.derive(l).table.reduce((n,c)=>n+c.played,0),40);
});
test('Egy eredmény nem ismételhető; kalap és név validálás',()=>{
 const s=make(1);record(s);s.events.push(s.events[0]);assert.throws(()=>E.derive(s));assert.throws(()=>E.create([[],[],[],[]],1));const n=names.map(p=>p.slice());n[3][7]=n[0][0].toLowerCase();assert.throws(()=>E.create(n,1));n[3][7]=' ';assert.throws(()=>E.create(n,1));
});
