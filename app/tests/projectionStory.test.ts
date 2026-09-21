import assert from 'node:assert/strict';
import { buildProjectionStory } from '../src/projectionStory.ts';
import { GameSession } from '../src/gameTypes.ts';
import { InterestingEvent } from '../src/debriefEngine.ts';

const baseSession = {
  code: 'ABC123',
  status: 'finished',
  roundKey: 'report',
  startingCredit: 100_000,
  expectedPlayerCount: 2,
  createdAt: '2026-09-22T00:00:00.000Z',
  players: [
    { id: 'p1', name: 'Anna', currentBalance: 100_000, active: true },
    { id: 'p2', name: 'Béla', currentBalance: 100_000, active: true },
  ],
  pairings: [],
  decisions: [],
  strategicTaskSeenAt: {},
  strategicSubmitIntentAt: {},
  strategicTechnicalIssues: [],
  manualCorrections: [],
  transactions: [],
  closedRounds: [],
  groups: [],
  firstStageFinalBalance: {},
  publicGoodsRoundNumber: 0,
  publicGoodsPhase: 'setup',
  publicGoodsRounds: [],
  pinnedDebriefEventIds: [],
  reflections: [
    {
      playerId: 'p1',
      decisionId: 'decision:publicGoods:r1:g1:p1',
      comment: 'Szinte minden pénzemet betettem.',
      submittedAt: '2026-09-22T00:01:00.000Z',
    },
  ],
} satisfies GameSession;

const poolEvent: InterestingEvent = {
  id: 'debrief:pool_personal_vs_group_share:1:g1:p1',
  game: 'publicGoods',
  kind: 'pool_personal_vs_group_share',
  title: 'Más súly személyesen és a közös kasszában',
  roundKey: '4',
  publicGoodsRound: 1,
  groupId: 'g1',
  playerIds: ['p1'],
  selfDecisionIds: ['decision:publicGoods:r1:g1:p1'],
  priority: 3,
  facts: {
    contribution: 50_000,
    ownWealthPercent: 80,
    potPercent: 12,
    payout: 40_000,
    netAmount: -10_000,
  },
};

const pool = buildProjectionStory(baseSession, poolEvent);
assert.deepEqual(pool.steps, [
  '50 000 kredit befizetés · a közös kassza 12%-a',
  'A saját vagyonának 80%-a',
  'Visszaosztás: 40 000 kredit',
  'Saját nettó eredmény: -10 000 kredit',
]);
assert.deepEqual(pool.comments, ['Szinte minden pénzemet betettem.']);
assert.equal(JSON.stringify(pool).includes('Anna'), false, 'A kivetített történet ne tartalmazzon nevet.');
assert.equal(JSON.stringify(pool).includes('p1'), false, 'A kivetített történet ne tartalmazzon belső játékosazonosítót.');

const trustEvent: InterestingEvent = {
  id: 'debrief:trust_near_equal_outcome:t1',
  game: 'trust',
  kind: 'trust_near_equal_outcome',
  title: 'Közel azonos végeredmény',
  roundKey: '3a',
  playerIds: ['p1', 'p2'],
  selfDecisionIds: [],
  priority: 2,
  facts: {
    sent: 1_000_000,
    multiplied: 3_000_000,
    returned: 1_500_000,
    senderOutcome: 1_500_000,
    returnerOutcome: 1_500_000,
  },
};
const trust = buildProjectionStory(baseSession, trustEvent);
assert.deepEqual(trust.steps, [
  '1 000 000 kredit ment oda',
  'Bank után: 3 000 000 kredit',
  '1 500 000 kredit jött vissza',
  'Végeredmény: 1 500 000 kredit · 1 500 000 kredit',
]);

const rejectionEvent: InterestingEvent = {
  id: 'debrief:ultimatum_rejection:u1',
  game: 'ultimatum',
  kind: 'ultimatum_rejection',
  title: 'Elutasított ajánlat',
  roundKey: '1a',
  playerIds: ['p1', 'p2'],
  selfDecisionIds: [],
  priority: 1,
  facts: { offer: 15_000, offerPercent: 15 },
};
const rejection = buildProjectionStory(baseSession, rejectionEvent);
assert.deepEqual(rejection.steps, [
  'Ajánlat: 15 000 kredit',
  'ELUTASÍTVA',
  'Ajánlattevő: 0 kredit · Fogadó: 0 kredit',
]);

console.log('PROJECTION STORY TESTS OK');
