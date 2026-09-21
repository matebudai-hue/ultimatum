import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { gzipSync } from 'node:zlib';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: dom.window.sessionStorage, configurable: true });
Object.defineProperty(globalThis, 'CustomEvent', { value: dom.window.CustomEvent, configurable: true });
Object.defineProperty(globalThis, 'StorageEvent', { value: dom.window.StorageEvent, configurable: true });

const { localSessionStore } = await import('../src/sessionStore.ts');
const { STRATEGIC_ROUNDS } = await import('../src/pairingEngine.ts');
const { buildParticipantProjection } = await import('../src/firebaseProjection.ts');
const { buildSelfReport } = await import('../src/debriefEngine.ts');

const game = localSessionStore.create(100_000, 100);
for (let i = 1; i <= 100; i += 1) {
  localSessionStore.join(game.code, `stress-${i}`, `Játékos ${i}`);
}
localSessionStore.startGame(game.code);

for (const round of STRATEGIC_ROUNDS) {
  let session = localSessionStore.get(game.code)!;
  assert.equal(session.roundKey, round);
  const pairings = session.pairings.filter((pairing) => pairing.roundKey === round);

  for (const pairing of pairings) {
    session = localSessionStore.get(game.code)!;
    if (pairing.playerA !== 'BOT') {
      if (pairing.gameId === 'ultimatum') {
        localSessionStore.submitStrategicDecision(game.code, pairing.playerA, {
          type: 'ultimatum_offer',
          amount: 40_000,
        });
      } else if (pairing.gameId === 'dictator') {
        localSessionStore.submitStrategicDecision(game.code, pairing.playerA, {
          type: 'dictator_give',
          amount: 30_000,
        });
      } else {
        localSessionStore.submitStrategicDecision(game.code, pairing.playerA, {
          type: 'trust_send',
          amount: 50_000,
        });
      }
    }

    session = localSessionStore.get(game.code)!;
    if (pairing.playerB !== 'BOT') {
      if (pairing.gameId === 'ultimatum') {
        localSessionStore.submitStrategicDecision(game.code, pairing.playerB, {
          type: 'ultimatum_response',
          accepted: true,
        });
      } else if (pairing.gameId === 'trust') {
        localSessionStore.submitStrategicDecision(game.code, pairing.playerB, {
          type: 'trust_return',
          amount: 75_000,
        });
      }
    }
  }

  localSessionStore.closeStrategicRound(game.code);
  if (round !== '3b') localSessionStore.nextRound(game.code);
}

localSessionStore.nextRound(game.code);
localSessionStore.randomizeGroups(game.code, 25);

const measurements: Record<number, number> = {};
for (let poolRound = 1; poolRound <= 25; poolRound += 1) {
  let session = localSessionStore.get(game.code)!;
  session.groups.forEach((group) => localSessionStore.setGroupMinimum(game.code, group.id, 'none'));
  localSessionStore.startPublicGoodsRound(game.code);
  session = localSessionStore.get(game.code)!;

  for (const player of session.players) {
    const amount = Math.min(player.currentBalance, Math.round(player.currentBalance * 0.1));
    localSessionStore.submitPublicGoods(game.code, player.id, amount);
  }
  localSessionStore.lockPublicGoodsRound(game.code);
  localSessionStore.settlePublicGoodsRound(game.code);

  if ([1, 5, 10, 25].includes(poolRound)) {
    const state = localSessionStore.get(game.code)!;
    measurements[poolRound] = Buffer.byteLength(JSON.stringify(state), 'utf8');
  }
}

localSessionStore.finish(game.code);
let session = localSessionStore.get(game.code)!;
for (const player of session.players) {
  const report = buildSelfReport(session, player.id);
  const selected = report.slice(0, Math.min(3, report.length));
  if (selected.length > 0) {
    localSessionStore.submitReflection(
      game.code,
      player.id,
      selected.map((item, index) => ({
        decisionId: item.id,
        comment: ('R' + index + ' ').padEnd(300, 'x'),
      })),
    );
  }
}
session = localSessionStore.get(game.code)!;
const rawBytes = Buffer.byteLength(JSON.stringify(session), 'utf8');
const compressedBytes = gzipSync(JSON.stringify(session)).byteLength;
const participantProjectionBytes = Math.max(
  ...session.players.map((player) =>
    Buffer.byteLength(JSON.stringify(buildParticipantProjection(session, player.id)), 'utf8')
  ),
);

console.log('FIRESTORE MASTER STATE SIZE', {
  after1PoolRoundRaw: measurements[1],
  after5PoolRoundsRaw: measurements[5],
  after10PoolRoundsRaw: measurements[10],
  after25PoolRoundsRaw: measurements[25],
  after25PoolRoundsGzip: compressedBytes,
  compressionRatio: Number((compressedBytes / rawBytes).toFixed(3)),
  largestParticipantProjection: participantProjectionBytes,
  reflections: session.reflections?.length ?? 0,
});

assert.ok(
  compressedBytes < 750_000,
  `A 100 fős / 25 kasszakörös tömörített master állapot túl nagy: ${compressedBytes} byte.`,
);

assert.ok(
  participantProjectionBytes < 750_000,
  `A résztvevői Firestore nézet túl nagy: ${participantProjectionBytes} byte.`,
);

console.log('100-PLAYER COMPRESSED FIRESTORE STATE BUDGET OK');
console.log('100-PLAYER PARTICIPANT PROJECTION BUDGET OK');
process.exit(0);
