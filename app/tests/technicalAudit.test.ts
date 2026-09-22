import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: dom.window.sessionStorage, configurable: true });
Object.defineProperty(globalThis, 'CustomEvent', { value: dom.window.CustomEvent, configurable: true });
Object.defineProperty(globalThis, 'StorageEvent', { value: dom.window.StorageEvent, configurable: true });

const { localSessionStore } = await import('../src/sessionStore.ts');
const { createTechnicalAudit } = await import('../src/report.ts');

const game = localSessionStore.create(100_000, 2);
localSessionStore.join(game.code, 'audit-a', 'Audit A');
localSessionStore.join(game.code, 'audit-b', 'Audit B');
let session = localSessionStore.startGame(game.code);
const pairing = session.pairings.find((item) => item.roundKey === '1a')!;
const proposer = pairing.playerA as string;

localSessionStore.ackStrategicTaskVisible(game.code, proposer);
localSessionStore.markStrategicSubmitIntent(game.code, proposer);
session = localSessionStore.get(game.code)!;
const key = pairing.id + ':' + proposer;
const intentAt = session.strategicSubmitIntentAt[key];
assert.ok(intentAt);

localSessionStore.submitStrategicDecision(game.code, proposer, {
  type: 'ultimatum_offer',
  amount: 40_000,
});

session = localSessionStore.get(game.code)!;
const offer = session.decisions.find(
  (decision) => decision.pairingId === pairing.id && decision.type === 'ultimatum_offer',
)!;
assert.equal(
  offer.submitIntentAt,
  intentAt,
  'A sikeres döntésen maradjon meg a beküldési szándék időpontja.',
);
assert.equal(
  session.strategicSubmitIntentAt[key],
  undefined,
  'Az aktív submit-intent állapot kitakarítható a döntés után.',
);

session.decisions.push({
  id: 'audit-public-goods',
  playerId: proposer,
  roundKey: '4',
  type: 'public_goods_contribution',
  amount: 40_000,
  publicGoodsRound: 1,
  groupId: 'audit-group',
  submittedAt: '2026-09-22T10:00:05.000Z',
  submissionHistory: [
    { amount: 20_000, submittedAt: '2026-09-22T10:00:00.000Z' },
    { amount: 40_000, submittedAt: '2026-09-22T10:00:05.000Z' },
  ],
});

session.strategicTechnicalIssues.push({
  pairingId: pairing.id,
  playerId: proposer,
  roundKey: '1a',
  role: 'proposer',
  detectedAt: '2026-09-22T10:00:06.000Z',
  resolvedAt: '2026-09-22T10:00:08.000Z',
  resolution: 'decision_received',
});

const audit = createTechnicalAudit(session);
const events = audit.timeline.map((item) => item.event);

assert.ok(
  events.includes('strategic_submit_intent'),
  'Az auditban maradjon meg a sikeres beküldési szándék.',
);
assert.equal(
  audit.timeline.filter((item) => item.event === 'public_goods_submission').length,
  2,
  'A módosított tét történetének minden rögzített lépése kerüljön az auditba.',
);
assert.ok(events.includes('strategic_technical_issue'));
assert.ok(events.includes('strategic_technical_issue_resolved'));
assert.equal(audit.summary.resolvedStrategicTechnicalIssues, 1);

console.log('TECHNICAL AUDIT HISTORY TEST OK');
process.exit(0);
