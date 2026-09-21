import assert from 'node:assert/strict';
import { buildDebriefEventGroups } from '../src/debriefGrouping.ts';
import { InterestingEvent } from '../src/debriefEngine.ts';

const base = {
  roundKey: '4',
  playerIds: [],
  selfDecisionIds: [],
  facts: {},
} as const;

const events: InterestingEvent[] = [
  {
    ...base,
    id: 'u-reject',
    game: 'ultimatum',
    kind: 'ultimatum_rejection',
    title: 'Elutasított ajánlat',
    roundKey: '1a',
    priority: 1,
  },
  {
    ...base,
    id: 'u-extreme',
    game: 'ultimatum',
    kind: 'ultimatum_extreme_offer',
    title: 'Szélső ajánlat',
    roundKey: '1b',
    priority: 3,
  },
  {
    ...base,
    id: 'd-shift',
    game: 'dictator',
    kind: 'ultimatum_dictator_shift',
    title: 'Változás',
    roundKey: '2a',
    priority: 3,
  },
  {
    ...base,
    id: 't-good',
    game: 'trust',
    kind: 'trust_high_high',
    title: 'Erős viszonzás',
    roundKey: '3a',
    priority: 2,
  },
  {
    ...base,
    id: 'p-loss',
    game: 'publicGoods',
    kind: 'pool_high_contribution_net_loss',
    title: 'Nettó veszteség',
    publicGoodsRound: 2,
    priority: 1,
  },
  {
    ...base,
    id: 'p-gain',
    game: 'publicGoods',
    kind: 'pool_low_contribution_net_gain',
    title: 'Nettó nyereség',
    publicGoodsRound: 3,
    priority: 1,
  },
  {
    ...base,
    id: 'p-share-weak',
    game: 'publicGoods',
    kind: 'pool_personal_vs_group_share',
    title: 'Saját vs közös',
    publicGoodsRound: 4,
    priority: 3,
  },
  {
    ...base,
    id: 'p-share-strong',
    game: 'publicGoods',
    kind: 'pool_personal_vs_group_share',
    title: 'Saját vs közös',
    publicGoodsRound: 1,
    priority: 1,
  },
];

const groups = buildDebriefEventGroups(events);
assert.deepEqual(groups.map((group) => group.label), ['Ultimátum', 'Diktátor', 'Bizalom', 'Közös kassza']);
assert.equal(groups.reduce((sum, group) => sum + group.count, 0), events.length);

const pool = groups.find((group) => group.game === 'publicGoods')!;
const net = pool.stories.find((story) => story.id === 'pool-net-effect')!;
assert.equal(net.label, 'Nettó veszteség / nettó nyereség');
assert.deepEqual(net.events.map((event) => event.id), ['p-gain', 'p-loss']);

const personalVsGroup = pool.stories.find((story) => story.id === 'pool-personal-vs-group')!;
assert.equal(personalVsGroup.events[0].id, 'p-share-strong', 'A legerősebb prioritású esemény kerüljön előre.');

assert.equal(
  new Set(pool.stories.flatMap((story) => story.events.map((event) => event.id))).size,
  pool.count,
  'Minden esemény pontosan egy történetcsoportban szerepeljen.',
);

console.log('DEBRIEF EVENT GROUPING TESTS OK');
