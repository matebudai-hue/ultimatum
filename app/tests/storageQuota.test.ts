import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('',{url:'http://localhost'});
for(const key of ['window','document','localStorage','sessionStorage','CustomEvent','StorageEvent'] as const)
  Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
const {readStorage,writeStorage,storageKeys}=await import('../src/browserCompat');
const nativeLocal=dom.window.localStorage;
const nativeSession=dom.window.sessionStorage;
const full={getItem:(key:string)=>nativeLocal.getItem(key),setItem:()=>{throw new dom.window.DOMException('Quota exceeded','QuotaExceededError');}};
nativeLocal.setItem('versioned','old-local');
Object.defineProperty(dom.window,'localStorage',{value:full,configurable:true});
writeStorage('versioned','new-spill');
assert.equal(readStorage('versioned'),'new-spill','Never read the stale local version after spilling to sessionStorage');
assert.equal(nativeSession.getItem('versioned'),'new-spill','Spilled state survives a page reload');
const fresh=await import('../src/browserCompat?quota-reload');
assert.equal(fresh.readStorage('versioned'),'new-spill');
Object.defineProperty(dom.window,'sessionStorage',{value:{getItem:(key:string)=>nativeSession.getItem(key),setItem:full.setItem},configurable:true});
writeStorage('versioned','latest-memory');
assert.equal(readStorage('versioned'),'latest-memory','Both quotas full must preserve the latest state in memory');
const {localSessionStore:store}=await import('../src/sessionStore');
const game=store.create(100000,2);
store.join(game.code,'a','A');store.join(game.code,'b','B');
let session=store.startGame(game.code);
for(let n=0;n<6;n++) {
  const pair=session.pairings.find(p=>p.roundKey===session.roundKey)!;
  store.trainerSubmitStrategicDecision(game.code,pair.playerA,10000);
  if(pair.gameId!=='dictator') store.trainerSubmitStrategicDecision(game.code,pair.playerB,pair.gameId==='ultimatum'?true:5000);
  store.closeStrategicRound(game.code);session=store.nextRound(game.code);
}
store.startPublicGoodsRound(game.code);
store.submitPublicGoods(game.code,'a',10000);store.submitPublicGoods(game.code,'b',20000);
store.lockPublicGoodsRound(game.code);session=store.settlePublicGoodsRound(game.code);
assert.equal(session.publicGoodsRounds[0].totalContribution,30000);
assert.equal(store.get(game.code)!.publicGoodsRounds[0].status,'settled');
assert.equal(store.finish(game.code).roundKey,'report');
assert.ok(storageKeys('kreditjatek_session_').includes('kreditjatek_session_'+game.code),'The game must remain in the recent-games list when only memory storage is writable');
// Once storage is available again, remove only the obsolete spill for this key.
Object.defineProperty(dom.window,'localStorage',{value:nativeLocal,configurable:true});
Object.defineProperty(dom.window,'sessionStorage',{value:nativeSession,configurable:true});
writeStorage('versioned','recovered-local');
assert.equal(nativeSession.getItem('versioned'),null);
assert.equal(readStorage('versioned'),'recovered-local');
console.log('STORAGE QUOTA: stale-cache protection, reload spill, both quotas full, 6 strategic rounds, pool, report and recovery PASS');
process.exit(0);
