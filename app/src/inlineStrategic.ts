import { Decision, GameSession, StrategicRound } from './gameTypes';
import { STRATEGIC_ROUNDS } from './pairingEngine';

// The same eligibility and snapshot guard serve the tile and the save operation.
export function inlineStrategicTarget(session: GameSession, pairingId: string, playerId: string) {
  if (session.status !== 'active' || !STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound) ||
      session.closedRounds.includes(session.roundKey as StrategicRound)) return null;
  const pair = session.pairings.find(p => p.id === pairingId && p.roundKey === session.roundKey);
  const player = session.players.find(p => p.id === playerId);
  if (!pair || !player || player.isBot || player.botControlled ||
      ![pair.playerA, pair.playerB].includes(playerId)) return null;
  const isA = pair.playerA === playerId;
  if (pair.gameId === 'dictator' && !isA) return null;
  const type: Decision['type'] = pair.gameId === 'ultimatum'
    ? (isA ? 'ultimatum_offer' : 'ultimatum_response')
    : pair.gameId === 'dictator' ? 'dictator_give' : (isA ? 'trust_send' : 'trust_return');
  const decisions = session.decisions.filter(d => d.pairingId === pairingId);
  const predecessor = decisions.find(d => d.type === (type === 'trust_return' ? 'trust_send' : 'ultimatum_offer'));
  if (!isA && (!predecessor || predecessor.timedOutRole)) return null;
  const existing = decisions.find(d => d.playerId === playerId &&
    (d.type === type || d.type === 'ultimatum_timeout'));
  const issue = session.strategicTechnicalIssues.find(i =>
    i.pairingId === pairingId && i.playerId === playerId && !i.resolvedAt);
  const timed = decisions.some(d => d.timedOutRole || d.type === 'ultimatum_timeout');
  if (existing && !existing.timedOutRole && existing.type !== 'ultimatum_timeout') return null;
  if (!issue && !timed) return null;
  return {
    type,
    max: type === 'trust_return' ? (predecessor?.amount ?? 0) * 3 : session.startingCredit,
    before: existing?.type === 'ultimatum_timeout' ? null : existing?.amount ?? null,
    note: issue ? 'Technikai elakadás utáni tréneri rögzítés' : 'Időtúllépés utáni tréneri rögzítés',
    reopensPartner: isA && pair.gameId !== 'dictator',
    snapshot: JSON.stringify([session.roundKey, decisions, issue?.detectedAt]),
  };
}
