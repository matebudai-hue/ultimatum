import { GameSession, Pairing, PublicGoodsRound, StrategicRound } from './gameTypes';

export type DebriefGame = 'ultimatum' | 'dictator' | 'trust' | 'publicGoods';

export type SelfReportItem = {
  id: string;
  game: DebriefGame;
  roundKey: StrategicRound | '4';
  roundLabel: string;
  role: 'proposer' | 'receiver' | 'dictator' | 'sender' | 'returner' | 'contributor';
  playerId: string;
  pairingId?: string;
  publicGoodsRound?: number;
  groupId?: string;
  amount?: number;
  accepted?: boolean;
  sentAmount?: number;
  multipliedAmount?: number;
  returnedAmount?: number;
  keptAmount?: number;
  startingWealth?: number;
  contributionAmount?: number;
  ownWealthPercent?: number;
  potPercent?: number;
  payout?: number;
  netAmount?: number;
};

export type GroupPicture = {
  ultimatum: {
    averageOffer: number | null;
    rejectedCount: number;
    offers: Array<{ amount: number; accepted: boolean; roundKey: StrategicRound }>;
  };
  dictator: {
    averageGiven: number | null;
    amounts: Array<{ amount: number; roundKey: StrategicRound }>;
  };
  trust: {
    averageSent: number | null;
    averageReturned: number | null;
    pairs: Array<{
      sent: number;
      multiplied: number;
      returned: number;
      roundKey: StrategicRound;
    }>;
  };
  publicGoods: Array<{
    roundNumber: number;
    groupId: string;
    totalContribution: number;
    doubledPot: number;
    minimumAmount?: number;
    success: boolean;
    contributions: Array<{
      amount: number;
      ownWealthPercent: number | null;
      potPercent: number | null;
      netAmount: number;
    }>;
  }>;
};

export type InterestingEventKind =
  | 'ultimatum_rejection'
  | 'ultimatum_acceptance_boundary'
  | 'ultimatum_extreme_offer'
  | 'dictator_extreme_give'
  | 'ultimatum_dictator_shift'
  | 'trust_high_high'
  | 'trust_high_low'
  | 'trust_low_high'
  | 'trust_near_equal_outcome'
  | 'trust_extreme'
  | 'pool_personal_vs_group_share'
  | 'pool_high_contribution_net_loss'
  | 'pool_low_contribution_net_gain'
  | 'pool_pivotal_minimum'
  | 'pool_large_shift'
  | 'pool_group_minimum_transition';

export type InterestingEvent = {
  id: string;
  game: DebriefGame;
  kind: InterestingEventKind;
  title: string;
  roundKey: StrategicRound | '4';
  publicGoodsRound?: number;
  groupId?: string;
  playerIds: string[];
  selfDecisionIds: string[];
  priority: 1 | 2 | 3;
  facts: Record<string, number | string | boolean | null>;
};

const average = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const percent = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

const roundedPercent = (part: number, whole: number): number | null => {
  const value = percent(part, whole);
  return value === null ? null : Math.round(value * 10) / 10;
};

const humanPairings = (session: GameSession, gameId?: Pairing['gameId']) =>
  session.pairings.filter((pairing) =>
    (!gameId || pairing.gameId === gameId) &&
    pairing.playerA !== 'BOT' &&
    pairing.playerB !== 'BOT' &&
    session.closedRounds.includes(pairing.roundKey),
  );

const decisionsForPair = (session: GameSession, pairingId: string) =>
  session.decisions.filter((decision) => decision.pairingId === pairingId);

const selfDecisionId = (
  game: Exclude<DebriefGame, 'publicGoods'>,
  role: 'proposer' | 'receiver' | 'dictator' | 'sender' | 'returner',
  pairingId: string,
) => `decision:${game}:${role}:${pairingId}`;

const publicGoodsDecisionId = (round: PublicGoodsRound, playerId: string) =>
  `decision:publicGoods:r${round.roundNumber}:${round.groupId}:${playerId}`;

const publicGoodsNet = (session: GameSession, round: PublicGoodsRound, playerId: string) => {
  const transaction = session.transactions.find((item) =>
    item.playerId === playerId &&
    item.roundKey === '4' &&
    item.createdAt === round.settledAt,
  );
  if (transaction) return transaction.amount;
  const contribution = round.contributions[playerId] ?? 0;
  return round.success ? (round.payoutPerPlayer ?? 0) - contribution : -contribution;
};

const publicGoodsFacts = (session: GameSession, round: PublicGoodsRound, playerId: string) => {
  const contribution = round.contributions[playerId] ?? 0;
  const startingWealth = round.startingPlayerWealth?.[playerId] ?? 0;
  const total = round.totalContribution || Object.values(round.contributions).reduce((sum, value) => sum + value, 0);
  return {
    contribution,
    startingWealth,
    ownWealthPercent: roundedPercent(contribution, startingWealth),
    potPercent: roundedPercent(contribution, total),
    payout: round.success ? round.payoutPerPlayer ?? 0 : 0,
    netAmount: publicGoodsNet(session, round, playerId),
  };
};

export const buildSelfReport = (session: GameSession, playerId: string): SelfReportItem[] => {
  const items: SelfReportItem[] = [];

  for (const pairing of session.pairings.filter((item) => session.closedRounds.includes(item.roundKey))) {
    if (pairing.playerA !== playerId && pairing.playerB !== playerId) continue;
    const decisions = decisionsForPair(session, pairing.id);
    const isA = pairing.playerA === playerId;

    if (pairing.gameId === 'ultimatum') {
      const offer = decisions.find((item) => item.type === 'ultimatum_offer')?.amount ?? 0;
      const timedOut = decisions.some((item) => item.type === 'ultimatum_timeout');
      const accepted = timedOut ? false : decisions.find((item) => item.type === 'ultimatum_response')?.accepted ?? false;
      items.push({
        id: selfDecisionId('ultimatum', isA ? 'proposer' : 'receiver', pairing.id),
        game: 'ultimatum',
        roundKey: pairing.roundKey,
        roundLabel: pairing.roundKey,
        role: isA ? 'proposer' : 'receiver',
        playerId,
        pairingId: pairing.id,
        amount: offer,
        accepted,
      });
      continue;
    }

    if (pairing.gameId === 'dictator') {
      if (!isA) continue;
      const amount = decisions.find((item) => item.type === 'dictator_give')?.amount ?? 0;
      items.push({
        id: selfDecisionId('dictator', 'dictator', pairing.id),
        game: 'dictator',
        roundKey: pairing.roundKey,
        roundLabel: pairing.roundKey,
        role: 'dictator',
        playerId,
        pairingId: pairing.id,
        amount,
        keptAmount: Math.max(0, session.startingCredit - amount),
      });
      continue;
    }

    const sentAmount = decisions.find((item) => item.type === 'trust_send')?.amount ?? 0;
    const returnedAmount = decisions.find((item) => item.type === 'trust_return')?.amount ?? 0;
    const multipliedAmount = sentAmount * 3;
    items.push({
      id: selfDecisionId('trust', isA ? 'sender' : 'returner', pairing.id),
      game: 'trust',
      roundKey: pairing.roundKey,
      roundLabel: pairing.roundKey,
      role: isA ? 'sender' : 'returner',
      playerId,
      pairingId: pairing.id,
      sentAmount,
      multipliedAmount,
      returnedAmount,
      keptAmount: isA ? undefined : Math.max(0, multipliedAmount - returnedAmount),
    });
  }

  for (const round of session.publicGoodsRounds.filter((item) => item.status === 'settled' && item.memberIds.includes(playerId))) {
    const facts = publicGoodsFacts(session, round, playerId);
    items.push({
      id: publicGoodsDecisionId(round, playerId),
      game: 'publicGoods',
      roundKey: '4',
      roundLabel: `Kassza ${round.roundNumber}. kör`,
      role: 'contributor',
      playerId,
      publicGoodsRound: round.roundNumber,
      groupId: round.groupId,
      startingWealth: facts.startingWealth,
      contributionAmount: facts.contribution,
      ownWealthPercent: facts.ownWealthPercent ?? undefined,
      potPercent: facts.potPercent ?? undefined,
      payout: facts.payout,
      netAmount: facts.netAmount,
    });
  }

  return items.sort((a, b) => {
    const order: Record<string, number> = { '1a': 1, '1b': 2, '2a': 3, '2b': 4, '3a': 5, '3b': 6, '4': 7 };
    if (order[a.roundKey] !== order[b.roundKey]) return order[a.roundKey] - order[b.roundKey];
    return (a.publicGoodsRound ?? 0) - (b.publicGoodsRound ?? 0);
  });
};

export const buildGroupPicture = (session: GameSession): GroupPicture => {
  const ultimatumOffers = humanPairings(session, 'ultimatum').map((pairing) => {
    const decisions = decisionsForPair(session, pairing.id);
    const timedOut = decisions.some((item) => item.type === 'ultimatum_timeout');
    return {
      amount: decisions.find((item) => item.type === 'ultimatum_offer')?.amount ?? 0,
      accepted: timedOut ? false : decisions.find((item) => item.type === 'ultimatum_response')?.accepted ?? false,
      roundKey: pairing.roundKey,
    };
  });

  const dictatorAmounts = humanPairings(session, 'dictator').map((pairing) => ({
    amount: decisionsForPair(session, pairing.id).find((item) => item.type === 'dictator_give')?.amount ?? 0,
    roundKey: pairing.roundKey,
  }));

  const trustPairs = humanPairings(session, 'trust').map((pairing) => {
    const decisions = decisionsForPair(session, pairing.id);
    const sent = decisions.find((item) => item.type === 'trust_send')?.amount ?? 0;
    const returned = decisions.find((item) => item.type === 'trust_return')?.amount ?? 0;
    return { sent, multiplied: sent * 3, returned, roundKey: pairing.roundKey };
  });

  const publicGoods = session.publicGoodsRounds
    .filter((round) => round.status === 'settled')
    .map((round) => ({
      roundNumber: round.roundNumber,
      groupId: round.groupId,
      totalContribution: round.totalContribution,
      doubledPot: round.success ? round.totalContribution * 2 : 0,
      minimumAmount: round.minimumAmount,
      success: round.success ?? false,
      contributions: round.memberIds.map((playerId) => {
        const facts = publicGoodsFacts(session, round, playerId);
        return {
          amount: facts.contribution,
          ownWealthPercent: facts.ownWealthPercent,
          potPercent: facts.potPercent,
          netAmount: facts.netAmount,
        };
      }),
    }));

  return {
    ultimatum: {
      averageOffer: average(ultimatumOffers.map((item) => item.amount)),
      rejectedCount: ultimatumOffers.filter((item) => !item.accepted).length,
      offers: ultimatumOffers,
    },
    dictator: {
      averageGiven: average(dictatorAmounts.map((item) => item.amount)),
      amounts: dictatorAmounts,
    },
    trust: {
      averageSent: average(trustPairs.map((item) => item.sent)),
      averageReturned: average(trustPairs.map((item) => item.returned)),
      pairs: trustPairs,
    },
    publicGoods,
  };
};

const event = (
  value: Omit<InterestingEvent, 'id'> & { idParts: Array<string | number> },
): InterestingEvent => {
  const { idParts, ...rest } = value;
  return { ...rest, id: ['debrief', rest.kind, ...idParts].join(':') };
};

const pushUnique = (events: InterestingEvent[], candidate: InterestingEvent) => {
  if (!events.some((item) => item.id === candidate.id)) events.push(candidate);
};

const playerStrategicDecision = (
  session: GameSession,
  gameId: Pairing['gameId'],
  playerId: string,
) => {
  const pairing = humanPairings(session, gameId).find((item) => item.playerA === playerId);
  if (!pairing) return undefined;
  const decisions = decisionsForPair(session, pairing.id);
  const amount =
    gameId === 'ultimatum'
      ? decisions.find((item) => item.type === 'ultimatum_offer')?.amount
      : gameId === 'dictator'
        ? decisions.find((item) => item.type === 'dictator_give')?.amount
        : decisions.find((item) => item.type === 'trust_send')?.amount;
  return amount === undefined ? undefined : { pairing, amount };
};

export const buildInterestingEvents = (session: GameSession): InterestingEvent[] => {
  const events: InterestingEvent[] = [];

  const ultimatumPairs = humanPairings(session, 'ultimatum');
  const ultimatumRows = ultimatumPairs.map((pairing) => {
    const decisions = decisionsForPair(session, pairing.id);
    const offer = decisions.find((item) => item.type === 'ultimatum_offer')?.amount ?? 0;
    const timedOut = decisions.some((item) => item.type === 'ultimatum_timeout');
    const accepted = timedOut ? false : decisions.find((item) => item.type === 'ultimatum_response')?.accepted ?? false;
    return { pairing, offer, accepted };
  });

  for (const row of ultimatumRows.filter((item) => !item.accepted)) {
    pushUnique(events, event({
      idParts: [row.pairing.id],
      game: 'ultimatum',
      kind: 'ultimatum_rejection',
      title: 'Elutasított ajánlat',
      roundKey: row.pairing.roundKey,
      playerIds: [row.pairing.playerA as string, row.pairing.playerB as string],
      selfDecisionIds: [
        selfDecisionId('ultimatum', 'proposer', row.pairing.id),
        selfDecisionId('ultimatum', 'receiver', row.pairing.id),
      ],
      priority: 1,
      facts: {
        offer: row.offer,
        offerPercent: roundedPercent(row.offer, session.startingCredit),
      },
    }));
  }

  const acceptedOffers = ultimatumRows.filter((item) => item.accepted).map((item) => item.offer);
  const rejectedOffers = ultimatumRows.filter((item) => !item.accepted).map((item) => item.offer);
  if (acceptedOffers.length && rejectedOffers.length) {
    const lowestAccepted = Math.min(...acceptedOffers);
    const highestRejected = Math.max(...rejectedOffers);
    if (highestRejected <= lowestAccepted) {
      pushUnique(events, event({
        idParts: [highestRejected, lowestAccepted],
        game: 'ultimatum',
        kind: 'ultimatum_acceptance_boundary',
        title: 'Elfogadási határ',
        roundKey: '1b',
        playerIds: [],
        selfDecisionIds: [],
        priority: 2,
        facts: { highestRejected, lowestAccepted },
      }));
    }
  }

  if (ultimatumRows.length >= 2) {
    const sorted = [...ultimatumRows].sort((a, b) => a.offer - b.offer);
    const extremes = [sorted[0], sorted[sorted.length - 1]];
    for (const row of extremes) {
      pushUnique(events, event({
        idParts: [row.pairing.id],
        game: 'ultimatum',
        kind: 'ultimatum_extreme_offer',
        title: row === sorted[0] ? 'Legalacsonyabb ajánlat' : 'Legmagasabb ajánlat',
        roundKey: row.pairing.roundKey,
        playerIds: [row.pairing.playerA as string],
        selfDecisionIds: [selfDecisionId('ultimatum', 'proposer', row.pairing.id)],
        priority: 3,
        facts: {
          offer: row.offer,
          offerPercent: roundedPercent(row.offer, session.startingCredit),
          accepted: row.accepted,
        },
      }));
    }
  }

  const dictatorPairs = humanPairings(session, 'dictator');
  const dictatorRows = dictatorPairs.map((pairing) => ({
    pairing,
    amount: decisionsForPair(session, pairing.id).find((item) => item.type === 'dictator_give')?.amount ?? 0,
  }));
  if (dictatorRows.length >= 2) {
    const sorted = [...dictatorRows].sort((a, b) => a.amount - b.amount);
    for (const row of [sorted[0], sorted[sorted.length - 1]]) {
      pushUnique(events, event({
        idParts: [row.pairing.id],
        game: 'dictator',
        kind: 'dictator_extreme_give',
        title: row === sorted[0] ? 'Legalacsonyabb átadás' : 'Legmagasabb átadás',
        roundKey: row.pairing.roundKey,
        playerIds: [row.pairing.playerA as string],
        selfDecisionIds: [selfDecisionId('dictator', 'dictator', row.pairing.id)],
        priority: 3,
        facts: {
          amount: row.amount,
          amountPercent: roundedPercent(row.amount, session.startingCredit),
        },
      }));
    }
  }

  for (const player of session.players.filter((item) => !item.isBot)) {
    const ultimatum = playerStrategicDecision(session, 'ultimatum', player.id);
    const dictator = playerStrategicDecision(session, 'dictator', player.id);
    if (!ultimatum || !dictator || session.startingCredit <= 0) continue;
    const shiftPercentagePoints = ((dictator.amount - ultimatum.amount) / session.startingCredit) * 100;
    if (Math.abs(shiftPercentagePoints) < 25) continue;
    pushUnique(events, event({
      idParts: [player.id, ultimatum.pairing.id, dictator.pairing.id],
      game: 'dictator',
      kind: 'ultimatum_dictator_shift',
      title: 'Nagy változás az Ultimátumhoz képest',
      roundKey: dictator.pairing.roundKey,
      playerIds: [player.id],
      selfDecisionIds: [
        selfDecisionId('ultimatum', 'proposer', ultimatum.pairing.id),
        selfDecisionId('dictator', 'dictator', dictator.pairing.id),
      ],
      priority: 3,
      facts: {
        ultimatumAmount: ultimatum.amount,
        dictatorAmount: dictator.amount,
        shiftPercentagePoints: Math.round(shiftPercentagePoints * 10) / 10,
      },
    }));
  }

  for (const pairing of humanPairings(session, 'trust')) {
    const decisions = decisionsForPair(session, pairing.id);
    const sent = decisions.find((item) => item.type === 'trust_send')?.amount ?? 0;
    const returned = decisions.find((item) => item.type === 'trust_return')?.amount ?? 0;
    const multiplied = sent * 3;
    const sendPercent = percent(sent, session.startingCredit) ?? 0;
    const returnPercent = percent(returned, multiplied) ?? 0;
    const senderOutcome = session.startingCredit - sent + returned;
    const returnerOutcome = multiplied - returned;
    const largerOutcome = Math.max(senderOutcome, returnerOutcome, 1);
    const outcomeGapPercent = (Math.abs(senderOutcome - returnerOutcome) / largerOutcome) * 100;
    const senderId = pairing.playerA as string;
    const returnerId = pairing.playerB as string;
    const decisionIds = [
      selfDecisionId('trust', 'sender', pairing.id),
      selfDecisionId('trust', 'returner', pairing.id),
    ];

    if (sendPercent >= 60 && returnPercent >= 40) {
      pushUnique(events, event({
        idParts: [pairing.id],
        game: 'trust',
        kind: 'trust_high_high',
        title: 'Nagy bizalom, erős viszonzás',
        roundKey: pairing.roundKey,
        playerIds: [senderId, returnerId],
        selfDecisionIds: decisionIds,
        priority: 2,
        facts: { sent, multiplied, returned, sendPercent: Math.round(sendPercent), returnPercent: Math.round(returnPercent) },
      }));
    }
    if (sendPercent >= 60 && returnPercent <= 10) {
      pushUnique(events, event({
        idParts: [pairing.id],
        game: 'trust',
        kind: 'trust_high_low',
        title: 'Nagy bizalom, alacsony viszonzás',
        roundKey: pairing.roundKey,
        playerIds: [senderId, returnerId],
        selfDecisionIds: decisionIds,
        priority: 2,
        facts: { sent, multiplied, returned, sendPercent: Math.round(sendPercent), returnPercent: Math.round(returnPercent) },
      }));
    }
    if (sendPercent <= 20 && multiplied > 0 && returnPercent >= 40) {
      pushUnique(events, event({
        idParts: [pairing.id],
        game: 'trust',
        kind: 'trust_low_high',
        title: 'Kis bizalom, erős viszonzás',
        roundKey: pairing.roundKey,
        playerIds: [senderId, returnerId],
        selfDecisionIds: decisionIds,
        priority: 2,
        facts: { sent, multiplied, returned, sendPercent: Math.round(sendPercent), returnPercent: Math.round(returnPercent) },
      }));
    }
    if (multiplied > 0 && outcomeGapPercent <= 10) {
      pushUnique(events, event({
        idParts: [pairing.id],
        game: 'trust',
        kind: 'trust_near_equal_outcome',
        title: 'Közel azonos végeredmény',
        roundKey: pairing.roundKey,
        playerIds: [senderId, returnerId],
        selfDecisionIds: decisionIds,
        priority: 2,
        facts: {
          sent,
          multiplied,
          returned,
          senderOutcome,
          returnerOutcome,
          outcomeGapPercent: Math.round(outcomeGapPercent * 10) / 10,
        },
      }));
    }
  }

  const settledPoolRounds = session.publicGoodsRounds.filter((round) => round.status === 'settled');
  for (const round of settledPoolRounds) {
    const rows = round.memberIds.map((playerId) => ({ playerId, ...publicGoodsFacts(session, round, playerId) }));
    const ownRatios = rows.map((row) => row.ownWealthPercent ?? 0);
    const minOwnRatio = ownRatios.length ? Math.min(...ownRatios) : 0;
    const maxOwnRatio = ownRatios.length ? Math.max(...ownRatios) : 0;

    for (const row of rows) {
      const own = row.ownWealthPercent ?? 0;
      const pot = row.potPercent ?? 0;
      const decisionId = publicGoodsDecisionId(round, row.playerId);

      if (Math.abs(own - pot) >= 30) {
        pushUnique(events, event({
          idParts: [round.roundNumber, round.groupId, row.playerId],
          game: 'publicGoods',
          kind: 'pool_personal_vs_group_share',
          title: 'Más súly személyesen és a közös kasszában',
          roundKey: '4',
          publicGoodsRound: round.roundNumber,
          groupId: round.groupId,
          playerIds: [row.playerId],
          selfDecisionIds: [decisionId],
          priority: 3,
          facts: {
            contribution: row.contribution,
            ownWealthPercent: own,
            potPercent: pot,
            netAmount: row.netAmount,
          },
        }));
      }

      const highRelativeContribution = own >= 50 || (own === maxOwnRatio && maxOwnRatio - minOwnRatio >= 20);
      const lowRelativeContribution = own <= 20 || (own === minOwnRatio && maxOwnRatio - minOwnRatio >= 20);

      if (highRelativeContribution && row.netAmount < 0) {
        pushUnique(events, event({
          idParts: [round.roundNumber, round.groupId, row.playerId],
          game: 'publicGoods',
          kind: 'pool_high_contribution_net_loss',
          title: 'Nagy személyes hozzájárulás, nettó veszteség',
          roundKey: '4',
          publicGoodsRound: round.roundNumber,
          groupId: round.groupId,
          playerIds: [row.playerId],
          selfDecisionIds: [decisionId],
          priority: 1,
          facts: {
            contribution: row.contribution,
            ownWealthPercent: own,
            potPercent: pot,
            payout: row.payout,
            netAmount: row.netAmount,
            netPercentOfStartingWealth: roundedPercent(row.netAmount, row.startingWealth),
          },
        }));
      }

      if (lowRelativeContribution && row.netAmount > 0) {
        pushUnique(events, event({
          idParts: [round.roundNumber, round.groupId, row.playerId],
          game: 'publicGoods',
          kind: 'pool_low_contribution_net_gain',
          title: 'Kis személyes hozzájárulás, nettó nyereség',
          roundKey: '4',
          publicGoodsRound: round.roundNumber,
          groupId: round.groupId,
          playerIds: [row.playerId],
          selfDecisionIds: [decisionId],
          priority: 1,
          facts: {
            contribution: row.contribution,
            ownWealthPercent: own,
            potPercent: pot,
            payout: row.payout,
            netAmount: row.netAmount,
            netPercentOfStartingWealth: roundedPercent(row.netAmount, row.startingWealth),
          },
        }));
      }

      if (
        round.success &&
        round.minimumAmount !== undefined &&
        round.totalContribution >= round.minimumAmount &&
        round.totalContribution - row.contribution < round.minimumAmount
      ) {
        pushUnique(events, event({
          idParts: [round.roundNumber, round.groupId, row.playerId],
          game: 'publicGoods',
          kind: 'pool_pivotal_minimum',
          title: 'Döntő hozzájárulás a minimumhoz',
          roundKey: '4',
          publicGoodsRound: round.roundNumber,
          groupId: round.groupId,
          playerIds: [row.playerId],
          selfDecisionIds: [decisionId],
          priority: 1,
          facts: {
            contribution: row.contribution,
            totalContribution: round.totalContribution,
            minimumAmount: round.minimumAmount,
          },
        }));
      }
    }
  }

  const poolByGroup = new Map<string, PublicGoodsRound[]>();
  for (const round of settledPoolRounds) {
    const list = poolByGroup.get(round.groupId) ?? [];
    list.push(round);
    poolByGroup.set(round.groupId, list);
  }

  for (const [groupId, rounds] of poolByGroup) {
    const sorted = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];

      for (const playerId of current.memberIds.filter((id) => previous.memberIds.includes(id))) {
        const before = publicGoodsFacts(session, previous, playerId).ownWealthPercent ?? 0;
        const after = publicGoodsFacts(session, current, playerId).ownWealthPercent ?? 0;
        const shift = after - before;
        if (Math.abs(shift) < 25) continue;
        pushUnique(events, event({
          idParts: [groupId, previous.roundNumber, current.roundNumber, playerId],
          game: 'publicGoods',
          kind: 'pool_large_shift',
          title: 'Nagy változás két kasszakör között',
          roundKey: '4',
          publicGoodsRound: current.roundNumber,
          groupId,
          playerIds: [playerId],
          selfDecisionIds: [
            publicGoodsDecisionId(previous, playerId),
            publicGoodsDecisionId(current, playerId),
          ],
          priority: 3,
          facts: {
            previousPercent: before,
            currentPercent: after,
            shiftPercentagePoints: Math.round(shift * 10) / 10,
          },
        }));
      }

      if (previous.minimumAmount !== undefined && current.minimumAmount !== undefined) {
        const previousSuccess = previous.success ?? false;
        const currentSuccess = current.success ?? false;
        if (!previousSuccess && currentSuccess) {
          pushUnique(events, event({
            idParts: [groupId, previous.roundNumber, current.roundNumber],
            game: 'publicGoods',
            kind: 'pool_group_minimum_transition',
            title: 'A csoport a következő körben elérte a minimumot',
            roundKey: '4',
            publicGoodsRound: current.roundNumber,
            groupId,
            playerIds: [],
            selfDecisionIds: [],
            priority: 1,
            facts: {
              previousRound: previous.roundNumber,
              currentRound: current.roundNumber,
              previousTotal: previous.totalContribution,
              currentTotal: current.totalContribution,
              previousMinimum: previous.minimumAmount,
              currentMinimum: current.minimumAmount,
            },
          }));
        }
      }
    }
  }

  return events.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aRound = a.publicGoodsRound ?? Number(a.roundKey.replace(/\D/g, '') || 0);
    const bRound = b.publicGoodsRound ?? Number(b.roundKey.replace(/\D/g, '') || 0);
    return aRound - bRound || a.id.localeCompare(b.id);
  });
};

export const buildHighlightedEvents = (session: GameSession): InterestingEvent[] => {
  const events = buildInterestingEvents(session);
  const buckets = new Map<string, InterestingEvent[]>();
  for (const item of events) {
    const key = item.game === 'publicGoods'
      ? `4:${item.publicGoodsRound ?? 0}:${item.groupId ?? ''}`
      : item.roundKey;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }

  return [...buckets.values()].flatMap((items) => {
    const selected: InterestingEvent[] = [];
    const usedKinds = new Set<InterestingEventKind>();

    for (const item of items) {
      if (selected.length >= 3) break;
      if (usedKinds.has(item.kind)) continue;
      selected.push(item);
      usedKinds.add(item.kind);
    }

    for (const item of items) {
      if (selected.length >= 3) break;
      if (!selected.includes(item)) selected.push(item);
    }
    return selected;
  });
};
