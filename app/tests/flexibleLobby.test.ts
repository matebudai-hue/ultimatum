import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('', {url: 'http://localhost/'});
for (const key of ['window','document','localStorage','sessionStorage','CustomEvent','StorageEvent'] as const) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
const { localSessionStore: store } = await import('../src/sessionStore.ts');
for (const n of [2, 3, 26, 97, 99, 100]) {
  const game = store.create(100000, 100, true);
  assert.throws(() => store.startGame(game.code), /Legalább két/);
  for (let i=0;i<n;i++) store.join(game.code,`p${i}`,`Játékos ${i}`);
  const started = store.startGame(game.code);
  assert.equal(started.expectedPlayerCount,n);
  assert.equal(started.players.length,n);
  for (const round of ['1a','1b','2a','2b','3a','3b']) {
    const pairs = started.pairings.filter(p=>p.roundKey===round);
    assert.equal(pairs.length,Math.ceil(n/2));
    assert.equal(pairs.filter(p=>p.playerA==='BOT'||p.playerB==='BOT').length,n%2);
  }
  assert.throws(() => store.join(game.code,'late','Késő'), /elindult/);
}
const legacy = store.create(100000, 3); store.join(legacy.code,'a','A'); store.join(legacy.code,'b','B');
assert.throws(() => store.startGame(legacy.code),/Még nincs bent mindenki/);
console.log('FLEXIBLE LOBBY AND LEGACY COMPATIBILITY OK');
process.exit(0);
