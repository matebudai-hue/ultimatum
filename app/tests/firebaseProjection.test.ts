import assert from 'node:assert/strict';
import { buildParticipantProjection } from '../src/firebaseProjection.ts';
import { GameSession } from '../src/gameTypes.ts';

const session: GameSession = {
  code: 'ABC123',
  status: 'active',
  roundKey: '4',
  startingCredit: 100_000,
  expectedPlayerCount: 3,
  createdAt: new Date().toISOString(),
  players: [
    { id: 'p1', name: 'Anna', currentBalance: 120_000, active: true },
    { id: 'p2', name: 'Béla', currentBalance: 90_000, active: true },
    { id: 'p3', name: 'Csilla', currentBalance: 110_000, active: true },
  ],
  pairings: [
    {
      id: 'pair-own',
      gameId: 'ultimatum',
      roundKey: '1a',
      playerA: 'p1',
      playerB: 'p2',
      roleA: 'proposer',
      roleB: 'receiver',
      playerAIsBot: false,
      playerBIsBot: false,
    },
    {
      id: 'pair-other',
      gameId: 'ultimatum',
      roundKey: '1a',
      playerA: 'p2',
      playerB: 'p3',
      roleA: 'proposer',
      roleB: 'receiver',
      playerAIsBot: false,
      playerBIsBot: false,
    },
  ],
  decisions: [
    {
      id: 'd1',
      pairingId: 'pair-own',
      playerId: 'p1',
      roundKey: '1a',
      type: 'ultimatum_offer',
      amount: 40_000,
      submittedAt: new Date().toISOString(),
    },
    {
      id: 'd2',
      pairingId: 'pair-own',
      playerId: 'p2',
      roundKey: '1a',
      type: 'ultimatum_response',
      accepted: true,
      submittedAt: new Date().toISOString(),
    },
    {
      id: 'd3',
      pairingId: 'pair-other',
      playerId: 'p3',
      roundKey: '1a',
      type: 'ultimatum_response',
      accepted: false,
      submittedAt: new Date().toISOString(),
    },
  ],
  strategicTaskSeenAt: {
    'pair-own:p1': new Date().toISOString(),
    'pair-own:p2': new Date().toISOString(),
  },
  strategicSubmitIntentAt: {
    'pair-own:p1': new Date().toISOString(),
  },
  strategicTechnicalIssues: [],
  manualCorrections: [
    {
      id: 'm1',
      kind: 'balance',
      playerId: 'p1',
      roundKey: '4',
      field: 'currentBalance',
      beforeValue: 100_000,
      afterValue: 120_000,
      note: 'teszt',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'm2',
      kind: 'balance',
      playerId: 'p2',
      roundKey: '4',
      field: 'currentBalance',
      beforeValue: 80_000,
      afterValue: 90_000,
      note: 'másik',
      createdAt: new Date().toISOString(),
    },
  ],
  transactions: [
    {
      id: 't1',
      playerId: 'p1',
      roundKey: '1a',
      amount: 60_000,
      reason: 'test',
      balanceBefore: 0,
      balanceAfter: 60_000,
      createdAt: new Date().toISOString(),
    },
    {
      id: 't2',
      playerId: 'p2',
      roundKey: '1a',
      amount: 40_000,
      reason: 'test',
      balanceBefore: 0,
      balanceAfter: 40_000,
      createdAt: new Date().toISOString(),
    },
  ],
  closedRounds: ['1a'],
  groups: [{
    id: 'g1',
    name: 'Balaton',
    memberIds: ['p1', 'p2', 'p3'],
    nextMinimumMode: '90',
  }],
  firstStageFinalBalance: {
    p1: 100_000,
    p2: 80_000,
    p3: 100_000,
  },
  publicGoodsRoundNumber: 2,
  publicGoodsPhase: 'setup',
  pinnedDebriefEventIds: ['debrief:ultimatum_rejection:pair-own'],
  publicGoodsRounds: [
    {
      id: 'pg1',
      roundNumber: 1,
      groupId: 'g1',
      memberIds: ['p1', 'p2', 'p3'],
      startingGroupWealth: 280_000,
      startingPlayerWealth: { p1: 100_000, p2: 80_000, p3: 100_000 },
      minimumMode: '90',
      minimumAmount: 252_000,
      contributions: { p1: 50_000, p2: 20_000, p3: 30_000 },
      totalContribution: 100_000,
      status: 'settled',
      success: false,
      payoutPerPlayer: 0,
    },
    {
      id: 'pg2',
      roundNumber: 2,
      groupId: 'g1',
      memberIds: ['p1', 'p2', 'p3'],
      startingGroupWealth: 180_000,
      startingPlayerWealth: { p1: 50_000, p2: 60_000, p3: 70_000 },
      minimumMode: 'none',
      contributions: { p1: 10_000, p2: 10_000, p3: 10_000 },
      totalContribution: 30_000,
      status: 'settled',
      success: true,
      payoutPerPlayer: 20_000,
    },
  ],
};

const strategicSession: GameSession = { ...session, roundKey: '1a' };
const strategicView = buildParticipantProjection(strategicSession, 'p1');

assert.deepEqual(strategicView.players.map((player) => player.id), ['p1']);
assert.deepEqual(strategicView.pairings.map((pairing) => pairing.id), ['pair-own']);
assert.deepEqual(strategicView.decisions.map((decision) => decision.id).sort(), ['d1', 'd2']);
assert.equal(
  strategicView.pairings.some((pairing) => pairing.id === 'pair-other'),
  false,
  'A résztvevő ne kapja meg mások vagy jövőbeli párosításait.',
);

const view = buildParticipantProjection(session, 'p1');

assert.deepEqual(view.players.map((player) => player.id), ['p1']);
assert.deepEqual(view.pairings, [], 'Közös kasszánál stratégiai párosítás ne kerüljön a klienshez.');
assert.deepEqual(view.transactions.map((transaction) => transaction.id), ['t1']);
assert.deepEqual(view.manualCorrections.map((correction) => correction.id), ['m1']);
assert.deepEqual(view.firstStageFinalBalance, { p1: 100_000 });
assert.deepEqual(
  view.pinnedDebriefEventIds,
  [],
  'A tréner félretett kivezetési eseményei ne kerüljenek ki a résztvevői klienshez.',
);

assert.equal(view.groups.length, 1);
assert.equal(view.groups[0].name, 'Balaton');
assert.equal(view.groups[0].memberIds.length, 3);
assert.equal(view.groups[0].memberIds.includes('p2'), false);
assert.equal(view.groups[0].nextMinimumMode, 'none');

const failed = view.publicGoodsRounds.find((round) => round.roundNumber === 1)!;
assert.equal(failed.minimumMode, 'custom', 'A résztvevő ne lássa, hogy 90%-os gyorsminimum volt.');
assert.equal(failed.minimumAmount, 252_000);
assert.equal(failed.startingGroupWealth, 0);
assert.deepEqual(failed.startingPlayerWealth, { p1: 100_000 });
assert.deepEqual(failed.contributions, { p1: 50_000 });
assert.equal(failed.totalContribution, 0, 'Sikertelen kör tényleges kasszája maradjon rejtve.');
assert.equal(failed.memberIds.includes('p2'), false);

const success = view.publicGoodsRounds.find((round) => round.roundNumber === 2)!;
assert.equal(success.totalContribution, 30_000, 'Sikeres körben a teljes kassza látható.');
assert.deepEqual(success.contributions, { p1: 10_000 });

console.log('PARTICIPANT FIREBASE PROJECTION PRIVACY OK');
