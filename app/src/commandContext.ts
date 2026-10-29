import type { GameSession } from './gameTypes';

export type CommandContext = {
  roundKey: GameSession['roundKey'];
  pairingId?: string;
  reopenedAt?: string;
  publicGoodsRoundNumber: number;
};

export const commandContext = (session: GameSession, playerId: string): CommandContext => ({
  roundKey: session.roundKey,
  pairingId: session.pairings.find(pair => pair.roundKey === session.roundKey && (pair.playerA === playerId || pair.playerB === playerId))?.id,
  publicGoodsRoundNumber: session.publicGoodsRoundNumber,
  reopenedAt: session.strategicTechnicalIssues
    .filter(issue => issue.roundKey === session.roundKey && issue.playerId === playerId && issue.resolution === 'reopened')
    .map(issue => issue.resolvedAt ?? '').sort().slice(-1)[0],
});

// Never interpret a delayed decision or visibility acknowledgement as a new task.
export const assertCommandContext = (session: GameSession, playerId: string, type: string, context?: CommandContext) => {
  if (type === 'submitReflection') return;
  const current = commandContext(session, playerId);
  if (!context || context.roundKey !== current.roundKey ||
      (type === 'submitPublicGoods'
        ? context.publicGoodsRoundNumber !== current.publicGoodsRoundNumber
        : !current.pairingId || context.pairingId !== current.pairingId || context.reopenedAt !== current.reopenedAt)) {
    throw new Error('Ez a döntés egy korábbi feladathoz tartozik. Frissítsd az aktuális feladatot.');
  }
};
