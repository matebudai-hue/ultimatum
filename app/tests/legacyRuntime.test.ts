import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('', { url: 'http://localhost' });
for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', 'StorageEvent'] as const)
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
const nativeCrypto = globalThis.crypto;
Object.defineProperty(globalThis, 'crypto', { configurable:true, value:{getRandomValues:nativeCrypto.getRandomValues.bind(nativeCrypto)} });
const { localSessionStore: store } = await import('../src/sessionStore');
const game = store.create(100000, 3);
for (const id of ['a','b','c']) store.join(game.code, id, id.toUpperCase());
let session = store.startGame(game.code);
for (let n=0;n<6;n++) {
  for (const pair of session.pairings.filter(p => p.roundKey === session.roundKey)) {
    for (const id of [pair.playerA,pair.playerB]) {
      if (id === 'BOT') continue;
      // The passive dictator receiver has no decision.
      if (pair.gameId === 'dictator' && id === pair.playerB) continue;
      store.trainerSubmitStrategicDecision(game.code,id,pair.gameId === 'ultimatum' && id === pair.playerB ? true : 10000);
    }
  }
  store.closeStrategicRound(game.code); session=store.nextRound(game.code);
}
assert.equal(session.roundKey,'4');
store.randomizeGroups(game.code,1); store.startPublicGoodsRound(game.code);
for (const id of ['a','b','c']) store.trainerSubmitPublicGoods(game.code,id,1000);
store.lockPublicGoodsRound(game.code); session=store.settlePublicGoodsRound(game.code);
assert.ok(session.players.every(p => Number.isSafeInteger(p.currentBalance)));
session=store.finish(game.code);
assert.equal(session.roundKey,'report');
const ids = [...session.pairings,...session.decisions,...session.transactions,...session.publicGoodsRounds].map(row => row.id);
assert.equal(new Set(ids).size,ids.length);
console.log('LEGACY RUNTIME: 3 players, 6 rounds, BOT, manual decisions, pool and report without crypto.randomUUID PASS');
process.exit(0);
