import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { publicGoodsPayouts, publicGoodsPlayerPayout, settlePublicGoods } from '../src/gameEngine';
import { createTechnicalAudit, reportSummary } from '../src/report';
import { buildParticipantProjection } from '../src/firebaseProjection';
import { buildSelfReport } from '../src/debriefEngine';
import type { Player, PublicGoodsRound } from '../src/gameTypes';

const dom = new JSDOM('', { url: 'http://localhost' });
for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', 'StorageEvent'] as const)
  Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : dom.window[key], configurable: true });
const { localSessionStore } = await import('../src/sessionStore');
const ids = ['d', 'a', 'c', 'b'];
for (const total of [0, 1, 409389, 11000001, 116727820]) {
  const payouts = publicGoodsPayouts(ids, total, true);
  assert.equal(Object.values(payouts).reduce((a, b) => a + b, 0), total * 2);
  assert.ok(Math.max(...Object.values(payouts)) - Math.min(...Object.values(payouts)) <= 1);
  assert.deepEqual(payouts, publicGoodsPayouts([...ids].reverse(), total, true));
}
assert.deepEqual(Object.values(publicGoodsPayouts(ids, 1, false)), [0, 0, 0, 0]);
const players = ids.map(id => ({ id, currentBalance: 1000000, name: id, active: true })) as Player[];
const settled = settlePublicGoods(players, { a: 409389 }, '4');
assert.equal(settled.transactions.reduce((sum, t) => sum + t.amount, 0), 409389);
const legacy = { success: true, payoutPerPlayer: 204695 } as PublicGoodsRound;
assert.equal(publicGoodsPlayerPayout(legacy, 'a'), 204695);

const game = localSessionStore.create(100000, 3);
for (const id of ['a', 'b', 'c']) localSessionStore.join(game.code, id, id);
let session = localSessionStore.startGame(game.code);
const pair = session.pairings.find(p => p.roundKey === '1a' && p.playerA !== 'BOT')!;
const eventAt = new Date(Date.now() + 2000).toISOString();
localSessionStore.ackStrategicTaskVisible(game.code, pair.playerA);
localSessionStore.markStrategicSubmitIntentAt(game.code, pair.playerA, eventAt);
session = localSessionStore.submitStrategicDecision(game.code, pair.playerA, { type: 'ultimatum_offer', amount: 40000 }, eventAt);
const decision = session.decisions.find(d => d.playerId === pair.playerA && d.type === 'ultimatum_offer')!;
assert.equal(decision.submittedAt, eventAt);
assert.equal(decision.submitIntentAt, eventAt);
assert.equal(decision.timestampSource, 'command_event');
assert.ok(decision.processedAt);

session.publicGoodsRounds = [1, 2].flatMap(roundNumber => ['x', 'y'].map(groupId => ({
  id: groupId + roundNumber, roundNumber, groupId, memberIds: ['a', 'b'],
  startingGroupWealth: 200, minimumMode: 'none' as const, contributions: { a: 1 },
  totalContribution: 1, status: 'settled' as const, success: true,
  payoutPerPlayer: 1, payoutByPlayer: { a: 1, b: 1 },
})));
const audit = createTechnicalAudit(session);
assert.equal(audit.summary.publicGoodsRounds, 2);
assert.equal(audit.summary.publicGoodsGroupSettlements, 4);
assert.equal(audit.auditVersion, 3);
const projection = buildParticipantProjection(session, 'a');
assert.deepEqual(Object.keys(projection.publicGoodsRounds[0].payoutByPlayer!), ['a']);
const botPair = session.pairings.find(p => p.roundKey === '1a' && (p.playerA === 'BOT' || p.playerB === 'BOT'))!;
session.decisions.push({ id: 'bot-offer', roundKey: '1a', pairingId: botPair.id, playerId: 'BOT', type: 'ultimatum_offer', amount: 10000, isBotDecision: true, submittedAt: eventAt });
assert.ok(reportSummary(session, true).ultimatum.offers > reportSummary(session, false).ultimatum.offers);
session.publicGoodsRounds = [{ ...session.publicGoodsRounds[0], settledAt: eventAt }];
session.transactions.push({ id: 'original-pg', playerId: 'a', roundKey: '4', amount: 0, createdAt: eventAt, reason: 'public_goods' } as any);
localSessionStore.replaceFromRemote(session);
const beforeBalances = Object.fromEntries(session.players.map(p => [p.id, p.currentBalance]));
const corrected = localSessionStore.correctPublicGoodsContribution(game.code, 1, 'b', 5, 'Test correction');
assert.equal(corrected.players.find(p => p.id === 'a')!.currentBalance - beforeBalances.a, 5);
assert.equal(corrected.players.find(p => p.id === 'b')!.currentBalance - beforeBalances.b, 0);
assert.equal(buildSelfReport(corrected, 'a').find(item => item.game === 'publicGoods')!.netAmount, 5);
console.log('AUDIT FIXES: exact distribution, legacy compatibility, timestamps, counts, bot filter, privacy and corrected self-report PASS');
process.exit(0);
