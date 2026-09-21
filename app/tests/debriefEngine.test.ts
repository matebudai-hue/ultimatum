import assert from 'node:assert/strict';
import {
  buildGroupPicture,
  buildHighlightedEvents,
  buildInterestingEvents,
  buildSelfReport,
} from '../src/debriefEngine.ts';
import { GameSession, Pairing, PublicGoodsRound } from '../src/gameTypes.ts';

const now = '2026-09-21T20:00:00.000Z';

const pair = (
  id: string,
  gameId: Pairing['gameId'],
  roundKey: Pairing['roundKey'],
  playerA: string,
  playerB: string,
): Pairing => ({
  id,
  gameId,
  roundKey,
  playerA,
  playerB,
  roleA: gameId === 'ultimatum' ? 'proposer' : gameId === 'dictator' ? 'dictator' : 'sender',
  roleB: gameId === 'trust' ? 'returner' : 'receiver',
  playerAIsBot: false,
  playerBIsBot: false,
});

const settledPoolRound = (
  base: number,
  roundNumber: number,
  groupId: string,
  memberIds: string[],
  startingPlayerWealth: Record<string, number>,
  contributions: Record<string, number>,
  minimumAmount?: number,
): PublicGoodsRound => {
  const totalContribution = Object.values(contributions).reduce((sum, value) => sum + value, 0);
  const success = minimumAmount === undefined || totalContribution >= minimumAmount;
  const payoutPerPlayer = success ? Math.round((totalContribution * 2) / memberIds.length) : 0;
  return {
    id: `pg-${groupId}-${roundNumber}`,
    roundNumber,
    groupId,
    memberIds,
    startingGroupWealth: Object.values(startingPlayerWealth).reduce((sum, value) => sum + value, 0),
    startingPlayerWealth,
    minimumMode: minimumAmount === undefined ? 'none' : 'custom',
    minimumAmount,
    contributions,
    totalContribution,
    status: 'settled',
    success,
    payoutPerPlayer,
    settledAt: `2026-09-21T20:${String(roundNumber).padStart(2, '0')}:00.000Z`,
  };
};

function makeSession(base: number): GameSession {
  const players = ['p1', 'p2', 'p3', 'p4'].map((id, index) => ({
    id,
    name: ['Anna', 'Béla', 'Csilla', 'Dávid'][index],
    currentBalance: base,
    active: true,
  }));

  const pairings: Pairing[] = [
    pair('u1', 'ultimatum', '1a', 'p1', 'p2'),
    pair('u2', 'ultimatum', '1b', 'p3', 'p1'),
    pair('d1', 'dictator', '2a', 'p1', 'p2'),
    pair('d2', 'dictator', '2b', 'p3', 'p4'),
    pair('t1', 'trust', '3a', 'p1', 'p2'),
    pair('t2', 'trust', '3b', 'p3', 'p1'),
  ];

  const amount = (ratio: number) => Math.round(base * ratio);
  const decisions: GameSession['decisions'] = [
    { id: 'u1-offer', pairingId: 'u1', playerId: 'p1', roundKey: '1a', type: 'ultimatum_offer', amount: amount(0.10), submittedAt: now },
    { id: 'u1-response', pairingId: 'u1', playerId: 'p2', roundKey: '1a', type: 'ultimatum_response', accepted: false, submittedAt: now },
    { id: 'u2-offer', pairingId: 'u2', playerId: 'p3', roundKey: '1b', type: 'ultimatum_offer', amount: amount(0.30), submittedAt: now },
    { id: 'u2-response', pairingId: 'u2', playerId: 'p1', roundKey: '1b', type: 'ultimatum_response', accepted: true, submittedAt: now },
    { id: 'd1-give', pairingId: 'd1', playerId: 'p1', roundKey: '2a', type: 'dictator_give', amount: amount(0.40), submittedAt: now },
    { id: 'd2-give', pairingId: 'd2', playerId: 'p3', roundKey: '2b', type: 'dictator_give', amount: amount(0.60), submittedAt: now },
    { id: 't1-send', pairingId: 't1', playerId: 'p1', roundKey: '3a', type: 'trust_send', amount: amount(1.00), submittedAt: now },
    { id: 't1-return', pairingId: 't1', playerId: 'p2', roundKey: '3a', type: 'trust_return', amount: amount(1.50), submittedAt: now },
    { id: 't2-send', pairingId: 't2', playerId: 'p3', roundKey: '3b', type: 'trust_send', amount: amount(0.20), submittedAt: now },
    { id: 't2-return', pairingId: 't2', playerId: 'p1', roundKey: '3b', type: 'trust_return', amount: amount(0.30), submittedAt: now },
  ];

  const r1 = settledPoolRound(
    base,
    1,
    'g1',
    ['p1', 'p2', 'p3', 'p4'],
    { p1: base, p2: base, p3: base, p4: base },
    { p1: amount(0.80), p2: amount(0.10), p3: amount(0.10), p4: 0 },
    amount(0.90),
  );

  const r2 = settledPoolRound(
    base,
    2,
    'g1',
    ['p1', 'p2', 'p3', 'p4'],
    { p1: base, p2: base, p3: base, p4: base },
    { p1: amount(0.10), p2: amount(0.40), p3: amount(0.40), p4: amount(0.10) },
  );

  const r3 = settledPoolRound(
    base,
    3,
    'g1',
    ['p1', 'p2', 'p3', 'p4'],
    { p1: amount(0.625), p2: amount(3), p3: amount(3), p4: amount(3) },
    { p1: amount(0.50), p2: amount(1.20), p3: amount(1.20), p4: amount(1.20) },
  );

  const r4 = settledPoolRound(
    base,
    4,
    'g2',
    ['p1', 'p2'],
    { p1: base, p2: base },
    { p1: amount(0.40), p2: amount(0.40) },
    amount(1.00),
  );

  const r5 = settledPoolRound(
    base,
    5,
    'g2',
    ['p1', 'p2'],
    { p1: base, p2: base },
    { p1: amount(0.55), p2: amount(0.55) },
    amount(1.00),
  );

  return {
    code: 'DBRF01',
    status: 'finished',
    roundKey: 'report',
    startingCredit: base,
    expectedPlayerCount: 4,
    createdAt: now,
    players,
    pairings,
    decisions,
    strategicTaskSeenAt: {},
    strategicSubmitIntentAt: {},
    strategicTechnicalIssues: [],
    manualCorrections: [],
    transactions: [],
    closedRounds: ['1a', '1b', '2a', '2b', '3a', '3b'],
    groups: [
      { id: 'g1', name: 'Balaton', memberIds: ['p1', 'p2', 'p3', 'p4'], nextMinimumMode: 'none' },
      { id: 'g2', name: 'Badacsony', memberIds: ['p1', 'p2'], nextMinimumMode: 'none' },
    ],
    firstStageFinalBalance: { p1: base, p2: base, p3: base, p4: base },
    publicGoodsRoundNumber: 5,
    publicGoodsPhase: 'setup',
    publicGoodsRounds: [r1, r2, r3, r4, r5],
  };
}

function eventKinds(session: GameSession) {
  return new Set(buildInterestingEvents(session).map((item) => item.kind));
}

function testPercentageBasedDetection() {
  const scales = [1_000, 100_000, 1_000_000];
  const requiredKinds = [
    'ultimatum_rejection',
    'ultimatum_acceptance_boundary',
    'ultimatum_dictator_shift',
    'trust_high_high',
    'trust_near_equal_outcome',
    'pool_high_contribution_net_loss',
    'pool_low_contribution_net_gain',
    'pool_pivotal_minimum',
    'pool_large_shift',
    'pool_personal_vs_group_share',
    'pool_group_minimum_transition',
  ] as const;

  let reference: Set<string> | undefined;
  for (const scale of scales) {
    const kinds = eventKinds(makeSession(scale));
    for (const kind of requiredKinds) {
      assert.ok(kinds.has(kind), `${kind} hiányzik ${scale} induló kreditnél`);
    }

    if (reference) {
      for (const kind of requiredKinds) {
        assert.equal(kinds.has(kind), reference.has(kind), `A detektálás skálafüggő lett: ${kind}`);
      }
    } else {
      reference = kinds;
    }
  }

  console.log('DEBRIEF PERCENTAGE-BASED DETECTION OK');
}

function testTrustSymmetryAndReciprocity() {
  const session = makeSession(100_000);
  const events = buildInterestingEvents(session);
  const highHigh = events.find((item) => item.kind === 'trust_high_high' && item.facts.sent === 100_000);
  const symmetric = events.find((item) => item.kind === 'trust_near_equal_outcome' && item.facts.sent === 100_000);

  assert.ok(highHigh, 'Az erős pozitív viszonzás legyen érdekes esemény.');
  assert.ok(symmetric, 'A közel azonos végeredmény legyen külön érdekes esemény.');
  assert.equal(symmetric?.facts.senderOutcome, 150_000);
  assert.equal(symmetric?.facts.returnerOutcome, 150_000);

  console.log('DEBRIEF TRUST POSITIVE STORIES OK');
}

function testPublicGoodsNarratives() {
  const session = makeSession(100_000);
  const events = buildInterestingEvents(session);

  const highLoss = events.find((item) => item.kind === 'pool_high_contribution_net_loss' && item.publicGoodsRound === 1 && item.playerIds.includes('p1'));
  assert.ok(highLoss);
  assert.equal(highLoss?.facts.ownWealthPercent, 80);
  assert.equal(highLoss?.facts.netAmount, -30_000);

  const lowGain = events.find((item) => item.kind === 'pool_low_contribution_net_gain' && item.publicGoodsRound === 1 && item.playerIds.includes('p4'));
  assert.ok(lowGain);
  assert.equal(lowGain?.facts.netAmount, 50_000);

  const personalVsGroup = events.find((item) =>
    item.kind === 'pool_personal_vs_group_share' &&
    item.publicGoodsRound === 3 &&
    item.playerIds.includes('p1')
  );
  assert.ok(personalVsGroup);
  assert.equal(personalVsGroup?.facts.ownWealthPercent, 80);
  assert.ok(Number(personalVsGroup?.facts.potPercent) > 12 && Number(personalVsGroup?.facts.potPercent) < 13);

  const pivotal = events.find((item) => item.kind === 'pool_pivotal_minimum' && item.publicGoodsRound === 1 && item.playerIds.includes('p1'));
  assert.ok(pivotal);

  const shift = events.find((item) => item.kind === 'pool_large_shift' && item.playerIds.includes('p1') && item.publicGoodsRound === 2);
  assert.ok(shift);
  assert.equal(shift?.facts.previousPercent, 80);
  assert.equal(shift?.facts.currentPercent, 10);

  const transition = events.find((item) => item.kind === 'pool_group_minimum_transition' && item.groupId === 'g2');
  assert.ok(transition);

  console.log('DEBRIEF PUBLIC GOODS STORIES OK');
}

function testSelfReportAndAnonymousGroupPicture() {
  const session = makeSession(100_000);
  const report = buildSelfReport(session, 'p1');
  const strategic = report.filter((item) => item.game !== 'publicGoods');

  assert.equal(strategic.length, 5, 'A p1 saját riportjában pontosan öt stratégiai döntés legyen.');
  assert.ok(strategic.some((item) => item.game === 'ultimatum' && item.role === 'proposer' && item.amount === 10_000 && item.accepted === false));
  assert.ok(strategic.some((item) => item.game === 'ultimatum' && item.role === 'receiver' && item.amount === 30_000 && item.accepted === true));
  assert.ok(strategic.some((item) => item.game === 'dictator' && item.role === 'dictator' && item.amount === 40_000));
  assert.ok(strategic.some((item) => item.game === 'trust' && item.role === 'sender' && item.returnedAmount === 150_000));
  assert.ok(strategic.some((item) => item.game === 'trust' && item.role === 'returner' && item.returnedAmount === 30_000));

  const pool1 = report.find((item) => item.game === 'publicGoods' && item.publicGoodsRound === 1);
  assert.equal(pool1?.ownWealthPercent, 80);
  assert.equal(pool1?.potPercent, 80);
  assert.equal(pool1?.netAmount, -30_000);

  const pool3 = report.find((item) => item.game === 'publicGoods' && item.publicGoodsRound === 3);
  assert.equal(pool3?.ownWealthPercent, 80);
  assert.ok((pool3?.potPercent ?? 0) > 12 && (pool3?.potPercent ?? 0) < 13);

  const picture = buildGroupPicture(session);
  assert.equal(picture.ultimatum.averageOffer, 20_000);
  assert.equal(picture.ultimatum.rejectedCount, 1);
  assert.equal(picture.dictator.averageGiven, 50_000);
  assert.equal(picture.trust.pairs[0].multiplied, 300_000);
  assert.equal(picture.publicGoods[0].contributions[0].ownWealthPercent, 80);
  assert.equal(
    JSON.stringify(picture).includes('Anna'),
    false,
    'A csoportkép kimenete ne tartalmazzon résztvevőnevet.',
  );

  console.log('DEBRIEF SELF REPORT / GROUP PICTURE OK');
}

function testHighlightsCap() {
  const session = makeSession(100_000);
  const highlighted = buildHighlightedEvents(session);
  const counts = new Map<string, number>();

  for (const item of highlighted) {
    const key = item.game === 'publicGoods'
      ? `4:${item.publicGoodsRound ?? 0}:${item.groupId ?? ''}`
      : item.roundKey;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of counts) {
    assert.ok(count <= 3, `Túl sok kiemelt esemény egy körből: ${key} = ${count}`);
  }

  console.log('DEBRIEF HIGHLIGHT CAP OK');
}

testPercentageBasedDetection();
testTrustSymmetryAndReciprocity();
testPublicGoodsNarratives();
testSelfReportAndAnonymousGroupPicture();
testHighlightsCap();

console.log('DEBRIEF ENGINE TESTS OK');
