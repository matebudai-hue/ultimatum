import assert from 'node:assert/strict';
import { buildSelfReportShareText, selfReportItemText } from '../src/selfReportExport.ts';
import { ParticipantReflection, ParticipantSelfReportItem } from '../src/gameTypes.ts';

const report: ParticipantSelfReportItem[] = [
  {
    id: 'decision:ultimatum:proposer:p1',
    game: 'ultimatum',
    roundKey: '1a',
    roundLabel: '1a',
    role: 'proposer',
    playerId: 'p1',
    amount: 40_000,
    accepted: true,
  },
  {
    id: 'decision:trust:sender:p2',
    game: 'trust',
    roundKey: '3a',
    roundLabel: '3a',
    role: 'sender',
    playerId: 'p1',
    sentAmount: 50_000,
    multipliedAmount: 150_000,
    returnedAmount: 70_000,
  },
  {
    id: 'decision:publicGoods:r1:g1:p1',
    game: 'publicGoods',
    roundKey: '4',
    roundLabel: 'Kassza 1. kör',
    role: 'contributor',
    playerId: 'p1',
    contributionAmount: 80_000,
    ownWealthPercent: 80,
    potPercent: 12,
    netAmount: -10_000,
  },
];

const reflections: ParticipantReflection[] = [
  {
    playerId: 'p1',
    decisionId: 'decision:publicGoods:r1:g1:p1',
    comment: 'Szinte minden pénzemet betettem, hogy segítsük a csoportot.',
    submittedAt: '2026-09-22T10:00:00.000Z',
  },
];

const text = buildSelfReportShareText('Teszt Elek', report, reflections);

assert.ok(text.includes('KREDITJÁTÉK – SAJÁT RIPORT'));
assert.ok(text.includes('Teszt Elek'));
assert.ok(text.includes('40 000 kredit ajánlat'));
assert.ok(text.includes('50 000 kredit elküldve → 150 000 kredit a bank után'));
assert.ok(text.includes('saját vagyon 80% · közös kassza 12% · nettó -10 000 kredit'));
assert.ok(text.includes('Mi célból döntöttél így? Szinte minden pénzemet betettem'));
assert.equal(text.includes('p1'), false, 'A megosztott riport ne tartalmazzon belső játékosazonosítót.');

const dictator = selfReportItemText({
  id: 'd1',
  game: 'dictator',
  roundKey: '2a',
  roundLabel: '2a',
  role: 'dictator',
  playerId: 'p1',
  amount: 30_000,
  keptAmount: 70_000,
});
assert.deepEqual(dictator, ['2a', '30 000 kredit átadva', '70 000 kredit maradt nálad']);

console.log('SELF REPORT EXPORT TESTS OK');
