const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js'),H=require('../dist/history.js');
const names=Array.from({length:4},(_,p)=>Array.from({length:8},(_,i)=>`Autó ${p+1}-${i+1}`));
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function finished(seed,pots=names){const s=E.create(pots,seed);while(true){const d=E.derive(s);if(d.champion)return s;if(d.match)s.events.push({type:'win',stage:d.current.id,tie:d.match.id,winner:d.match.a});else s.events.push({type:'advance'});}}
test('Befejezett tornák mentése: ismételt mentés frissít, az új bajnokság megtartja az előzményt',()=>{
 const store=storage(),s=finished(11);const first=H.save(store,s,'Vasárnapi kupa');const again=H.save(store,s,'Vasárnapi kupa javítva');assert.equal(again.id,first.id);assert.equal(H.load(store).tournaments.length,1);assert.equal(H.load(store).tournaments[0].title,'Vasárnapi kupa javítva');
 store.setItem('autos-bl-v1',JSON.stringify(E.create(names,22)));store.removeItem('autos-bl-v1');assert.equal(H.load(store).tournaments.length,1);assert.throws(()=>H.save(store,E.create(names,3),'Félkész torna'));
});
test('Tornaeredmények és összesítés minden meccset és minden elért szakaszt helyesen számolnak',()=>{
 const store=storage(),s=finished(14),entry=H.save(store,s,'Első');const summary=H.summary(entry),stats=H.aggregate(H.load(store));
 assert.equal(summary.rows.length,32);assert.equal(summary.games,163);assert.equal(summary.rows.reduce((n,c)=>n+c.wins,0),163);assert.equal(summary.rows.reduce((n,c)=>n+c.losses,0),163);
 const counts={};summary.rows.forEach(c=>counts[c.level]=(counts[c.level]||0)+1);assert.deepEqual(counts,{0:8,1:8,2:8,3:4,4:2,5:1,6:1});
 assert.equal(stats.length,32);assert.equal(stats.reduce((n,c)=>n+c.titles,0),1);assert.equal(stats.reduce((n,c)=>n+c.finals,0),2);assert.equal(stats.reduce((n,c)=>n+c.roundOf16,0),16);assert.equal(stats.reduce((n,c)=>n+c.played,0),326);assert.equal(summary.score,'5–0');
});
test('Ugyanazt az autót kalap- és helycsere után is összeköti a történet',()=>{
 const store=storage();H.save(store,finished(55),'Első');const rearranged=[names[2].slice().reverse(),names[0],names[3],names[1]];H.save(store,finished(56,rearranged),'Második');const stats=H.aggregate(H.load(store));assert.equal(stats.length,32);assert(stats.every(c=>c.tournaments===2));assert.equal(stats.reduce((n,c)=>n+c.titles,0),2);assert(stats.every(c=>c.appearances.length===2));
});
test('Előzménymentés másik böngészőben visszatölthető; ismételt import nem dupláz',()=>{
 const source=storage(),destination=storage();H.save(source,finished(71),'Kupa');const backup=JSON.parse(JSON.stringify(H.load(source)));assert.equal(H.merge(destination,backup),1);assert.equal(H.merge(destination,backup),0);assert.equal(H.load(destination).tournaments.length,1);assert.deepEqual(H.aggregate(H.load(destination)),H.aggregate(H.load(source)));
 const broken=JSON.parse(JSON.stringify(backup));broken.tournaments[0].state.events.pop();assert.throws(()=>H.merge(destination,broken));assert.equal(H.load(destination).tournaments.length,1);
});
test('Javított döntő újramentése a meglévő tornában frissíti a bajnokot és a statisztikát',()=>{
 const store=storage(),s=finished(93),before=H.save(store,s,'Kupa');const final=E.derive(s).current.ties[0];const changed=JSON.parse(JSON.stringify(s));changed.events.forEach(e=>{if(e.type==='win'&&e.stage==='final')e.winner=final.b;});H.save(store,changed,'Kupa javítva');const library=H.load(store);assert.equal(library.tournaments.length,1);assert.equal(library.tournaments[0].id,before.id);assert.equal(H.summary(library.tournaments[0]).champion,final.b);const stats=H.aggregate(library);assert.equal(stats.reduce((n,c)=>n+c.titles,0),1);assert.equal(stats.find(c=>c.key===H.carKey(s.cars.find(c=>c.id===final.b).name)).titles,1);
});
