import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('', { url: 'http://localhost' });
for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', 'StorageEvent'] as const)
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
const { localSessionStore: store } = await import('../src/sessionStore');
const game = store.create(100000, 2);
store.join(game.code, 'a', 'A'); store.join(game.code, 'b', 'B');
let session = store.startGame(game.code);
const pair = session.pairings.find(p => p.roundKey === '1a')!;
const unchanged = () => JSON.stringify(store.get(game.code));
for (const payload of [
  {type:'ultimatum_offer' as const},
  {type:'ultimatum_offer' as const, amount:1.5},
  {type:'ultimatum_offer' as const, amount:NaN},
  {type:'ultimatum_offer' as const, amount:Infinity},
  {type:'ultimatum_offer' as const, amount:-1},
  {type:'ultimatum_offer' as const, amount:100001},
]) {
  const before = unchanged();
  assert.throws(() => store.submitStrategicDecision(game.code, pair.playerA, payload), 'Invalid money must not become a decision');
  assert.equal(unchanged(), before);
}
store.submitStrategicDecision(game.code, pair.playerA, {type:'ultimatum_offer',amount:40000});
assert.throws(() => store.submitStrategicDecision(game.code, pair.playerB, {type:'ultimatum_response'}));
assert.throws(() => store.submitStrategicDecision(game.code, pair.playerB, {type:'ultimatum_response',accepted:'true' as unknown as boolean}));
store.submitStrategicDecision(game.code, pair.playerB, {type:'ultimatum_response',accepted:false});
session = store.closeStrategicRound(game.code);
assert.deepEqual(session.players.map(p => p.currentBalance), [0,0]);
const beforeRestart = unchanged();
assert.throws(() => store.startGame(game.code), 'Double start must not recreate pairings or reopen settled rounds');
assert.equal(unchanged(), beforeRestart);
assert.throws(() => store.submitStrategicDecision(game.code, pair.playerA, {type:'ultimatum_offer',amount:0}));
console.log('SESSION GUARDS: invalid payloads, exact boolean, closed round and duplicate start PASS');
process.exit(0);
