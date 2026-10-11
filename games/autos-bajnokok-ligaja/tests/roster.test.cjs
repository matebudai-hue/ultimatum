const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../dist/roster.js'),E=require('../dist/engine.js');
const pots=Array.from({length:4},(_,p)=>Array.from({length:8},(_,i)=>'Autó '+p+'-'+i));
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('Az autók és kalapok megmaradnak két külön bajnokság között, eredmények nélkül',()=>{
 const store=storage(),first=E.create(pots,12);store.setItem('autos-bl-v1',JSON.stringify(first));R.save(store,R.fromTournament(first).pots);store.removeItem('autos-bl-v1');
 const saved=R.load(store);assert.deepEqual(saved.pots,pots);const next=E.create(saved.pots,34);assert.deepEqual(next.cars,first.cars);assert.equal(next.events.length,0);assert.notDeepEqual(E.schedule(first),E.schedule(next));assert.equal(saved.events,undefined);
});
test('Autólista fájlból visszatöltése; hiányos, duplikált vagy sérült lista elutasítása',()=>{
 const exported=JSON.parse(JSON.stringify(R.pack(pots)));assert.deepEqual(R.validate(exported).pots,pots);assert.throws(()=>R.validate({version:1,pots}));assert.throws(()=>R.pack(pots.slice(1)));const invalid=pots.map(p=>p.slice());invalid[3][7]=invalid[0][0];assert.throws(()=>R.pack(invalid));assert.equal(R.load(storage()),null);
});
