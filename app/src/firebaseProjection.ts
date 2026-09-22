import { GameSession } from './gameTypes';
import { buildSelfReport } from './debriefEngine';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const buildParticipantProjection = (session: GameSession, playerId: string): GameSession => {
  const player = session.players.find((item) => item.id === playerId);
  const pairings = session.pairings.filter(
    (pairing) =>
      pairing.roundKey === session.roundKey &&
      (pairing.playerA === playerId || pairing.playerB === playerId),
  );
  const pairingIds = new Set(pairings.map((pairing) => pairing.id));
  const groupIds = new Set(
    session.groups.filter((group) => group.memberIds.includes(playerId)).map((group) => group.id),
  );

  const publicGoodsRounds = session.publicGoodsRounds
    .filter((round) => round.memberIds.includes(playerId))
    .map((round) => {
      const ownContribution = round.contributions[playerId];
      const contributions: Record<string, number> = {};
      if (ownContribution !== undefined) contributions[playerId] = ownContribution;
      return {
        ...clone(round),
        memberIds: [
          playerId,
          ...Array(Math.max(0, round.memberIds.length - 1)).fill('GROUP_MEMBER'),
        ],
        startingGroupWealth: 0,
        startingPlayerWealth:
          round.startingPlayerWealth?.[playerId] === undefined
            ? undefined
            : { [playerId]: round.startingPlayerWealth[playerId] },
        minimumMode: round.minimumAmount === undefined ? 'none' as const : 'custom' as const,
        contributions,
        totalContribution: round.status === 'settled' && round.success ? round.totalContribution : 0,
      };
    });

  const ownTaskSeen = Object.fromEntries(
    Object.entries(session.strategicTaskSeenAt).filter(([key]) => key.endsWith(':' + playerId)),
  );
  const ownIntent = Object.fromEntries(
    Object.entries(session.strategicSubmitIntentAt).filter(([key]) => key.endsWith(':' + playerId)),
  );

  return {
    ...clone(session),
    players: player ? [clone(player)] : [],
    pairings: clone(pairings),
    decisions: clone(session.decisions.filter((decision) =>
      (decision.pairingId && pairingIds.has(decision.pairingId)) ||
      decision.playerId === playerId
    )),
    strategicTaskSeenAt: ownTaskSeen,
    strategicSubmitIntentAt: ownIntent,
    strategicTechnicalIssues: clone(
      session.strategicTechnicalIssues.filter((issue) => issue.playerId === playerId && !issue.resolvedAt),
    ),
    manualCorrections: clone(
      session.manualCorrections.filter((correction) => correction.playerId === playerId),
    ),
    transactions: clone(session.transactions.filter((transaction) => transaction.playerId === playerId)),
    groups: session.groups
      .filter((group) => groupIds.has(group.id))
      .map((group) => ({
        ...clone(group),
        memberIds: [
          playerId,
          ...Array(Math.max(0, group.memberIds.length - 1)).fill('GROUP_MEMBER'),
        ],
        nextMinimumMode: 'none' as const,
        nextCustomMinimum: undefined,
      })),
    firstStageFinalBalance:
      session.firstStageFinalBalance[playerId] === undefined
        ? {}
        : { [playerId]: session.firstStageFinalBalance[playerId] },
    publicGoodsRounds,
    publicGoodsContinuation: session.publicGoodsContinuation
      ? {
          ...clone(session.publicGoodsContinuation),
          baselineFinalBalance:
            session.publicGoodsContinuation.baselineFinalBalance[playerId] === undefined
              ? {}
              : { [playerId]: session.publicGoodsContinuation.baselineFinalBalance[playerId] },
          restartBalance:
            session.publicGoodsContinuation.restartBalance[playerId] === undefined
              ? {}
              : { [playerId]: session.publicGoodsContinuation.restartBalance[playerId] },
        }
      : undefined,
    pinnedDebriefEventIds: [],
    reflections: clone((session.reflections ?? []).filter((item) => item.playerId === playerId)),
    selfReport: session.roundKey === 'report' ? clone(buildSelfReport(session, playerId)) : [],
  };
};
