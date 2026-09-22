import { GameSession, Player } from './gameTypes';

const esc = (value: string | number | boolean | undefined | null) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

const playerName = (players: Player[], id: string) => players.find((player) => player.id === id)?.name ?? id;

export function reportSummary(session: GameSession) {
  const offers = session.decisions.filter((d) => d.type === 'ultimatum_offer');
  const responses = session.decisions.filter((d) => d.type === 'ultimatum_response');
  const acceptedPairings = new Set(responses.filter((d) => d.accepted).map((d) => d.pairingId));
  const rejectedPairings = new Set(responses.filter((d) => d.accepted === false).map((d) => d.pairingId));
  const acceptedOffers = offers.filter((d) => acceptedPairings.has(d.pairingId));
  const rejectedOffers = offers.filter((d) => rejectedPairings.has(d.pairingId));
  const timeouts = session.decisions.filter((d) => d.type === 'ultimatum_timeout');
  const dictator = session.decisions.filter((d) => d.type === 'dictator_give');
  const trustSend = session.decisions.filter((d) => d.type === 'trust_send');
  const trustReturn = session.decisions.filter((d) => d.type === 'trust_return');
  const dictatorTimeouts = dictator.filter((d) => d.timedOutRole === 'dictator');
  const trustSendTimeouts = trustSend.filter((d) => d.timedOutRole === 'sender');
  const trustReturnTimeouts = trustReturn.filter((d) => d.timedOutRole === 'returner');

  return {
    ultimatum: {
      offers: offers.length,
      accepted: acceptedOffers.length,
      rejected: rejectedOffers.length,
      acceptedAmount: acceptedOffers.reduce((sum, d) => sum + (d.amount ?? 0), 0),
      rejectedAmount: rejectedOffers.reduce((sum, d) => sum + (d.amount ?? 0), 0),
      timeouts: timeouts.length,
      proposerTimeouts: timeouts.filter((d) => d.timedOutRole === 'proposer').length,
      receiverTimeouts: timeouts.filter((d) => d.timedOutRole === 'receiver').length,
    },
    dictator: {
      decisions: dictator.length,
      givenAmount: dictator.reduce((sum, d) => sum + (d.amount ?? 0), 0),
      timeouts: dictatorTimeouts.length,
    },
    trust: {
      decisions: trustSend.length,
      sentAmount: trustSend.reduce((sum, d) => sum + (d.amount ?? 0), 0),
      tripledAmount: trustSend.reduce((sum, d) => sum + (d.amount ?? 0) * 3, 0),
      returnedAmount: trustReturn.reduce((sum, d) => sum + (d.amount ?? 0), 0),
      senderTimeouts: trustSendTimeouts.length,
      returnerTimeouts: trustReturnTimeouts.length,
    },
  };
}

export function createCsv(session: GameSession): string {
  const summary = reportSummary(session);
  const rows: (string | number | boolean | undefined | null)[][] = [
    ['Kreditjáték riport'],
    ['Játékkód', session.code],
    ['Induló kredit', session.startingCredit],
    ['Résztvevők', session.players.filter((p) => !p.isBot).length],
    [],
    ['ULTIMÁTUM ÖSSZESÍTŐ'],
    ['Ajánlatok', summary.ultimatum.offers],
    ['Elfogadott', summary.ultimatum.accepted],
    ['Elutasított', summary.ultimatum.rejected],
    ['Elfogadott ajánlatok összege', summary.ultimatum.acceptedAmount],
    ['Elutasított ajánlatok összege', summary.ultimatum.rejectedAmount],
    ['Időtúllépés', summary.ultimatum.timeouts],
    ['Felajánló időtúllépés', summary.ultimatum.proposerTimeouts],
    ['Fogadó időtúllépés', summary.ultimatum.receiverTimeouts],
    [],
    ['DIKTÁTOR ÖSSZESÍTŐ'],
    ['Döntések', summary.dictator.decisions],
    ['Átadott összeg', summary.dictator.givenAmount],
    ['Időtúllépés → 0 átadás', summary.dictator.timeouts],
    [],
    ['BIZALOM ÖSSZESÍTŐ'],
    ['Küldések', summary.trust.decisions],
    ['Elküldött összeg', summary.trust.sentAmount],
    ['Bank által háromszorozott összeg', summary.trust.tripledAmount],
    ['Visszaadott összeg', summary.trust.returnedAmount],
    ['Küldő időtúllépés → 0 küldés', summary.trust.senderTimeouts],
    ['Visszaadó időtúllépés → 0 visszaadás', summary.trust.returnerTimeouts],
    [],
    ['VAGYON'],
    ['Név', 'Első szakasz végi vagyon', 'Végső vagyon'],
    ...session.players.filter((player) => !player.isBot).map((player) => [
      player.name,
      session.firstStageFinalBalance[player.id],
      player.currentBalance,
    ]),
    [],
    ['PÁROSÍTÁSOK'],
    ['Kör', 'Játék', 'A', 'A szerep', 'B', 'B szerep'],
    ...session.pairings.map((pairing) => [
      pairing.roundKey,
      pairing.gameId,
      pairing.playerA === 'BOT' ? 'Rendszerjátékos' : playerName(session.players, pairing.playerA),
      pairing.roleA,
      pairing.playerB === 'BOT' ? 'Rendszerjátékos' : playerName(session.players, pairing.playerB),
      pairing.roleB,
    ]),
    [],
    ['DÖNTÉSEK'],
    ['Kör', 'Játékos', 'Típus', 'Összeg', 'Elfogadva', 'Időtúllépő szerep', 'Gép'],
    ...session.decisions.map((decision) => [
      decision.roundKey,
      decision.playerId === 'BOT' ? 'Rendszerjátékos' : playerName(session.players, decision.playerId),
      decision.type,
      decision.amount,
      decision.accepted,
      decision.timedOutRole,
      decision.isBotDecision,
    ]),
    [],
    ['TRANZAKCIÓK'],
    ['Kör', 'Játékos', 'Összeg', 'Előtte', 'Utána', 'Ok'],
    ...session.transactions.map((transaction) => [
      transaction.roundKey,
      playerName(session.players, transaction.playerId),
      transaction.amount,
      transaction.balanceBefore,
      transaction.balanceAfter,
      transaction.reason,
    ]),
    [],
    ['KÖZÖS KASSZA'],
    ['Kör', 'Csoport', 'Minimum mód', 'Minimum', 'Befizetés', 'Státusz', 'Siker', 'Visszaosztás/fő'],
    ...session.publicGoodsRounds.map((round) => [
      round.roundNumber,
      session.groups.find((g) => g.id === round.groupId)?.name ?? round.groupId,
      round.minimumMode,
      round.minimumAmount,
      round.totalContribution,
      round.status,
      round.success,
      round.payoutPerPlayer,
    ]),
    [],
    [],
    ['KÉZI KORREKCIÓK'],
    ['Időpont', 'Típus', 'Játékos', 'Kör', 'Mező', 'Előtte', 'Utána', 'Indoklás'],
    ...session.manualCorrections.map((correction) => [
      correction.createdAt,
      correction.kind,
      playerName(session.players, correction.playerId),
      correction.publicGoodsRound !== undefined ? `Közös kassza ${correction.publicGoodsRound}` : correction.roundKey,
      correction.field,
      correction.beforeValue,
      correction.afterValue,
      correction.note,
    ]),
    ['KÖZÖS KASSZA – EGYÉNI BEFIZETÉSEK'],
    ['Kör', 'Csoport', 'Játékos', 'Befizetés'],
    ...session.publicGoodsRounds.flatMap((round) =>
      Object.entries(round.contributions).map(([playerId, amount]) => [
        round.roundNumber,
        session.groups.find((g) => g.id === round.groupId)?.name ?? round.groupId,
        playerName(session.players, playerId),
        amount,
      ])
    ),
  ];

  return '\uFEFF' + rows.map((row) => row.map(esc).join(';')).join('\n');
}

export function downloadCsv(session: GameSession) {
  const blob = new Blob([createCsv(session)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kreditjatek-${session.code}-riport.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}


export function createTechnicalAudit(session: GameSession) {
  const playerNameById = new Map(session.players.map((player) => [player.id, player.name]));
  const playerNameFor = (playerId: string | 'BOT') =>
    playerId === 'BOT' ? 'Rendszerjátékos' : playerNameById.get(playerId) ?? playerId;

  const timeline: Array<Record<string, unknown> & { at: string; event: string }> = [];

  timeline.push({
    at: session.createdAt,
    event: 'session_created',
    code: session.code,
    startingCredit: session.startingCredit,
    expectedPlayerCount: session.expectedPlayerCount,
  });

  for (const player of session.players) {
    if (player.joinedAt) {
      timeline.push({
        at: player.joinedAt,
        event: 'player_joined',
        playerId: player.id,
        playerName: player.name,
      });
    }
    if (player.lastSeenAt) {
      timeline.push({
        at: player.lastSeenAt,
        event: 'player_last_seen',
        playerId: player.id,
        playerName: player.name,
      });
    }
  }

  for (const [key, at] of Object.entries(session.strategicTaskSeenAt)) {
    const separator = key.lastIndexOf(':');
    const pairingId = separator >= 0 ? key.slice(0, separator) : key;
    const playerId = separator >= 0 ? key.slice(separator + 1) : '';
    timeline.push({
      at,
      event: 'strategic_task_seen',
      pairingId,
      playerId,
      playerName: playerNameFor(playerId),
    });
  }

  for (const [key, at] of Object.entries(session.strategicSubmitIntentAt)) {
    const separator = key.lastIndexOf(':');
    const pairingId = separator >= 0 ? key.slice(0, separator) : key;
    const playerId = separator >= 0 ? key.slice(separator + 1) : '';
    timeline.push({
      at,
      event: 'strategic_submit_intent',
      pairingId,
      playerId,
      playerName: playerNameFor(playerId),
    });
  }

  for (const decision of session.decisions) {
    timeline.push({
      at: decision.submittedAt,
      event: 'decision_submitted',
      roundKey: decision.roundKey,
      pairingId: decision.pairingId,
      playerId: decision.playerId,
      playerName: playerNameFor(decision.playerId),
      decisionType: decision.type,
      amount: decision.amount,
      accepted: decision.accepted,
      timedOutRole: decision.timedOutRole,
      isBotDecision: decision.isBotDecision ?? false,
      publicGoodsRound: decision.publicGoodsRound,
      groupId: decision.groupId,
    });
  }

  for (const issue of session.strategicTechnicalIssues) {
    timeline.push({
      at: issue.detectedAt,
      event: 'strategic_technical_issue',
      roundKey: issue.roundKey,
      pairingId: issue.pairingId,
      playerId: issue.playerId,
      playerName: playerNameFor(issue.playerId),
      role: issue.role,
    });
  }

  for (const transaction of session.transactions) {
    timeline.push({
      at: transaction.createdAt,
      event: 'transaction',
      roundKey: transaction.roundKey,
      playerId: transaction.playerId,
      playerName: playerNameFor(transaction.playerId),
      amount: transaction.amount,
      reason: transaction.reason,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
    });
  }

  for (const correction of session.manualCorrections) {
    timeline.push({
      at: correction.createdAt,
      event: 'manual_correction',
      kind: correction.kind,
      roundKey: correction.roundKey,
      pairingId: correction.pairingId,
      publicGoodsRound: correction.publicGoodsRound,
      playerId: correction.playerId,
      playerName: playerNameFor(correction.playerId),
      field: correction.field,
      beforeValue: correction.beforeValue,
      afterValue: correction.afterValue,
      note: correction.note,
    });
  }

  for (const round of session.publicGoodsRounds) {
    if (!round.settledAt) continue;
    timeline.push({
      at: round.settledAt,
      event: 'public_goods_settled',
      roundNumber: round.roundNumber,
      groupId: round.groupId,
      status: round.status,
      success: round.success,
      totalContribution: round.totalContribution,
      minimumMode: round.minimumMode,
      minimumAmount: round.minimumAmount,
      payoutPerPlayer: round.payoutPerPlayer,
    });
  }

  if (session.publicGoodsContinuation) {
    timeline.push({
      at: session.publicGoodsContinuation.startedAt,
      event: 'post_report_public_goods_restart',
      firstContinuationRoundNumber: session.publicGoodsContinuation.firstContinuationRoundNumber,
    });
  }

  timeline.sort((a, b) => a.at.localeCompare(b.at));

  return {
    auditVersion: 2,
    exportedAt: new Date().toISOString(),
    purpose: 'Kreditjáték technikai audit – teljes tréneri session állapot és időrendi eseménynapló',
    summary: {
      code: session.code,
      status: session.status,
      roundKey: session.roundKey,
      startingCredit: session.startingCredit,
      players: session.players.filter((player) => !player.isBot).length,
      decisions: session.decisions.length,
      strategicTechnicalIssues: session.strategicTechnicalIssues.length,
      manualCorrections: session.manualCorrections.length,
      transactions: session.transactions.length,
      publicGoodsRounds: session.publicGoodsRounds.length,
      botDecisions: session.decisions.filter((decision) => decision.isBotDecision).length,
      timedOutDecisions: session.decisions.filter((decision) => decision.timedOutRole).length,
    },
    timeline,
    session: {
      ...session,
      players: session.players.map((player) => ({
        ...player,
        onlineComputedAtExport: player.lastSeenAt
          ? Date.now() - new Date(player.lastSeenAt).getTime() < 45_000
          : false,
      })),
    },
  };
}

export function downloadTechnicalAudit(session: GameSession) {
  const json = JSON.stringify(createTechnicalAudit(session), null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kreditjatek-${session.code}-technikai-audit.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
