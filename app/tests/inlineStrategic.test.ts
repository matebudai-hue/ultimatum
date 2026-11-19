import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { GameSession, Pairing } from '../src/gameTypes';
import { inlineStrategicTarget } from '../src/inlineStrategic';
const dom = new JSDOM('', {url:'http://localhost/?test=1'});
for (const key of ['window','document','localStorage','sessionStorage','CustomEvent','StorageEvent'] as const) {
  Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
}
const {localSessionStore: store}=await import('../src/sessionStore');
function game(kind: Pairing['gameId']) {
  const start=store.create(100000,2);
  store.join(start.code,'a','A'); store.join(start.code,'b','B');
  const s=store.startGame(start.code);
  const p=s.pairings.find(p=>p.gameId===kind)!;
  s.roundKey=p.roundKey;
  store.replaceFromRemote(s);
  return {s,p};
}
function expired(s:GameSession,p:Pairing,id:string) {
  store.ackStrategicTaskVisible(s.code,id);
  const deadline=store.ultimatumDeadlineAt(store.get(s.code)!,p.id,id)!;
  return store.reconcileStrategicTimeouts(s.code,Date.parse(deadline)+6000);
}
function save(s:GameSession,p:Pairing,id:string,value:number|boolean) {
  const t=inlineStrategicTarget(s,p.id,id)!;
  assert.ok(t);
  return store.saveInlineStrategicDecision(s.code,p.id,id,value,t.note,t.snapshot);
}
{
  let {s,p}=game('ultimatum');
  s=expired(s,p,p.playerA);
  assert.equal(inlineStrategicTarget(s,p.id,p.playerB),null,'receiver waits for a real offer');
  const t=inlineStrategicTarget(s,p.id,p.playerA)!;
  assert.throws(()=>store.saveInlineStrategicDecision(s.code,p.id,p.playerA,100001,t.note,t.snapshot));
  assert.equal(store.get(s.code)!.manualCorrections.length,0);
  s=save(s,p,p.playerA,40000);
  assert.equal(s.decisions.some(d=>d.type==='ultimatum_timeout'),false);
  assert.equal(store.roundProgress(s).complete,false);
  assert.equal(store.ultimatumDeadlineAt(s,p.id,p.playerB),undefined);
  s=store.ackStrategicTaskVisible(s.code,p.playerB);
  s=expired(s,p,p.playerB);
  s=save(s,p,p.playerB,true);
  assert.equal(store.roundProgress(s).complete,true);
  s=store.closeStrategicRound(s.code);
  assert.deepEqual(s.players.map(pl=>pl.currentBalance).sort((a,b)=>a-b),[40000,60000]);
  assert.equal(inlineStrategicTarget(s,p.id,p.playerA),null);
  assert.throws(()=>store.saveInlineStrategicDecision(s.code,p.id,p.playerA,20000,t.note,t.snapshot));
}
{
  let {s,p}=game('dictator');
  s=expired(s,p,p.playerA);
  assert.equal(inlineStrategicTarget(s,p.id,p.playerB),null);
  s=save(s,p,p.playerA,25000);
  s=store.closeStrategicRound(s.code);
  assert.deepEqual(s.players.map(pl=>pl.currentBalance).sort((a,b)=>a-b),[25000,75000]);
}
{
  let {s,p}=game('trust');
  s=expired(s,p,p.playerA);
  s=store.submitStrategicDecision(s.code,p.playerB,{type:'trust_return',amount:0});
  s=save(s,p,p.playerA,50000);
  assert.equal(s.decisions.some(d=>d.type==='trust_return'),false,'response to zero is reopened');
  assert.ok(s.manualCorrections.some(c=>c.playerId===p.playerB && c.afterValue===null));
  assert.equal(store.ultimatumDeadlineAt(s,p.id,p.playerB),undefined);
  s=expired(s,p,p.playerB);
  const t=inlineStrategicTarget(s,p.id,p.playerB)!;
  assert.equal(t.max,150000);
  assert.throws(()=>store.saveInlineStrategicDecision(s.code,p.id,p.playerB,150001,t.note,t.snapshot));
  s=save(s,p,p.playerB,80000);
  s=store.closeStrategicRound(s.code);
  assert.deepEqual(s.players.map(pl=>pl.currentBalance).sort((a,b)=>a-b),[70000,130000]);
}
{
  let {s,p}=game('trust');
  s.strategicTechnicalIssues.push({pairingId:p.id,playerId:p.playerA,roundKey:p.roundKey,role:'sender',detectedAt:new Date().toISOString()});
  store.replaceFromRemote(s);
  const t=inlineStrategicTarget(s,p.id,p.playerA)!;
  s=store.submitStrategicDecision(s.code,p.playerA,{type:'trust_send',amount:30000});
  assert.throws(()=>store.saveInlineStrategicDecision(s.code,p.id,p.playerA,50000,t.note,t.snapshot));
  assert.equal(store.get(s.code)!.decisions.find(d=>d.type==='trust_send')!.amount,30000);
}
console.log('INLINE STRATEGIC PASS — timeouts, dependent reopening, audit, bounds, closed rounds and concurrent decisions');
process.exit(0);
