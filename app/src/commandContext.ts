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
export const assertCommandContext = (session: GameSession, playerId: string, type: string, context?: CommandContext, legacyCreatedAt?: string) => {
  if (type === 'submitReflection') return;
  const current = commandContext(session, playerId);
  // Already-open participant pages predate the context envelope. Preserve their
  // queued decisions in the current task, but never carry a pre-round command
  // or a pre-reopening acknowledgement into a fresh decision window.
  if (!context && legacyCreatedAt) {
    const sent = Date.parse(legacyCreatedAt);
    const started = Date.parse(session.roundStartedAt ?? '');
    const windowStart = Math.max(started, Date.parse(current.reopenedAt ?? session.roundStartedAt ?? ''));
    if (Number.isFinite(sent) && Number.isFinite(windowStart) && sent >= windowStart && sent <= Date.now() + 5000 &&
        (type === 'submitPublicGoods' ? session.roundKey === '4' : Boolean(current.pairingId))) return;
  }
  if (!context || context.roundKey !== current.roundKey ||
      (type === 'submitPublicGoods'
        ? context.publicGoodsRoundNumber !== current.publicGoodsRoundNumber
        : !current.pairingId || context.pairingId !== current.pairingId || context.reopenedAt !== current.reopenedAt)) {
    throw new Error('Ez a döntés egy korábbi feladathoz tartozik. Frissítsd az aktuális feladatot.');
  }
};
