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
