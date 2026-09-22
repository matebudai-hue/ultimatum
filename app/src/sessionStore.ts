import {
  Decision,
  GameSession,
  MAX_PLAYERS,
  MinimumMode,
  PUBLIC_GOODS_SECONDS,
  STRATEGIC_DECISION_SECONDS,
  STRATEGIC_TECHNICAL_GRACE_SECONDS,
  SUBMISSION_TRANSPORT_GRACE_SECONDS,
  PublicGoodsGroup,
  Pairing,
  RoundKey,
  StrategicRound,
} from './gameTypes';
import {
  applyTransactions,
  botGiveAmount,
  botTrustReturn,
  botTrustSend,
  botUltimatumAccepts,
  botUltimatumOffer,
  settleOneWayGive,
  settlePublicGoods,
  settleTrust,
  settleUltimatum,
} from './gameEngine';
import { buildSixRoundPairingSchedule, STRATEGIC_ROUNDS } from './pairingEngine';
import { buildSelfReport } from './debriefEngine';

type Listener = (session: GameSession | null) => void;

export const canFinishGame = (session: GameSession) =>
  session.status === 'active' && session.roundKey !== 'lobby' && session.roundKey !== 'report';

const PREFIX = 'kreditjatek_session_';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kreditjatek_dev') : null;

const makeCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};

const read = (code: string): GameSession | null => {
  const raw = localStorage.getItem(PREFIX + code);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as GameSession;
  return {
    ...parsed,
    strategicTaskSeenAt: parsed.strategicTaskSeenAt ?? {},
    strategicSubmitIntentAt: parsed.strategicSubmitIntentAt ?? {},
    strategicTechnicalIssues: parsed.strategicTechnicalIssues ?? [],
    manualCorrections: parsed.manualCorrections ?? [],
    firstStageFinalBalance: parsed.firstStageFinalBalance ?? {},
    publicGoodsRounds: parsed.publicGoodsRounds ?? [],
    groups: parsed.groups ?? [],
    pinnedDebriefEventIds: parsed.pinnedDebriefEventIds ?? [],
    debriefPhase: parsed.debriefPhase,
    reflections: parsed.reflections ?? [],
    selfReport: parsed.selfReport ?? [],
  };
};

const write = (session: GameSession) => {
  localStorage.setItem(PREFIX + session.code, JSON.stringify(session));
  channel?.postMessage({ code: session.code });
  window.dispatchEvent(new CustomEvent('kreditjatek-store', { detail: session.code }));
};

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const decisionsForPair = (session: GameSession, pairingId: string) =>
  session.decisions.filter((decision) => decision.pairingId === pairingId);

const strategicWindowKey = (pairingId: string, playerId: string | 'BOT') => `${pairingId}:${playerId}`;

type StrategicTimedRole = 'proposer' | 'receiver' | 'dictator' | 'sender' | 'returner';

const pendingStrategicActor = (session: GameSession, pairingId: string): {
  playerId: string | 'BOT';
  role: StrategicTimedRole;
  type: Decision['type'];
} | null => {
  const pairing = session.pairings.find((item) => item.id === pairingId);
  if (!pairing) return null;
  const decisions = decisionsForPair(session, pairingId);

  if (pairing.gameId === 'ultimatum') {
    if (decisions.some((d) => d.type === 'ultimatum_timeout')) return null;
    if (!decisions.some((d) => d.type === 'ultimatum_offer')) {
      return { playerId: pairing.playerA, role: 'proposer', type: 'ultimatum_offer' };
    }
    if (!decisions.some((d) => d.type === 'ultimatum_response')) {
      return { playerId: pairing.playerB, role: 'receiver', type: 'ultimatum_response' };
    }
    return null;
  }

  if (pairing.gameId === 'dictator') {
    if (!decisions.some((d) => d.type === 'dictator_give')) {
      return { playerId: pairing.playerA, role: 'dictator', type: 'dictator_give' };
    }
    return null;
  }

  if (!decisions.some((d) => d.type === 'trust_send')) {
    return { playerId: pairing.playerA, role: 'sender', type: 'trust_send' };
  }
  if (!decisions.some((d) => d.type === 'trust_return')) {
    return { playerId: pairing.playerB, role: 'returner', type: 'trust_return' };
  }
  return null;
};

const strategicDeadlineAt = (
  session: GameSession,
  pairingId: string,
  playerId: string | 'BOT',
): string | undefined => {
  const pending = pendingStrategicActor(session, pairingId);
  if (!pending || pending.playerId !== playerId) return undefined;
  const seenAt = session.strategicTaskSeenAt[strategicWindowKey(pairingId, playerId)];
  if (!seenAt) return undefined;
  return new Date(new Date(seenAt).getTime() + STRATEGIC_DECISION_SECONDS * 1000).toISOString();
};

const addDecision = (session: GameSession, decision: Omit<Decision, 'id' | 'submittedAt'>) => {
  const exists = session.decisions.some((item) =>
    item.roundKey === decision.roundKey &&
    item.pairingId === decision.pairingId &&
    item.playerId === decision.playerId &&
    item.type === decision.type &&
    item.publicGoodsRound === decision.publicGoodsRound
  );
  if (exists) throw new Error('Ezt a döntést már beküldted.');
  session.decisions.push({
    ...decision,
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  });
};

const upsertPublicGoodsDecision = (
  session: GameSession,
  playerId: string,
  groupId: string,
  roundNumber: number,
  amount: number,
  isBotDecision = false,
  submittedAt?: string,
) => {
  const eventAt = submittedAt ?? new Date().toISOString();
  const existing = session.decisions.find((item) =>
    item.type === 'public_goods_contribution' &&
    item.playerId === playerId &&
    item.groupId === groupId &&
    item.publicGoodsRound === roundNumber
  );

  if (existing) {
    existing.amount = amount;
    existing.isBotDecision = isBotDecision;
    existing.submittedAt = eventAt;
    existing.submissionHistory = [
      ...(existing.submissionHistory ?? []),
      { amount, submittedAt: eventAt },
    ].slice(-50);
  } else {
    session.decisions.push({
      id: crypto.randomUUID(),
      playerId,
      roundKey: '4',
      type: 'public_goods_contribution',
      amount,
      publicGoodsRound: roundNumber,
      groupId,
      isBotDecision,
      submittedAt: eventAt,
      submissionHistory: [{ amount, submittedAt: eventAt }],
    });
  }
};

const pairReady = (session: GameSession, pairingId: string) => {
  const pairing = session.pairings.find((item) => item.id === pairingId);
  if (!pairing) return false;
  const decisions = decisionsForPair(session, pairing.id);
  if (decisions.some((d) => d.type === 'ultimatum_timeout')) return true;
  if (pairing.gameId === 'ultimatum') {
    return decisions.some((d) => d.type === 'ultimatum_offer') &&
      decisions.some((d) => d.type === 'ultimatum_response');
  }
  if (pairing.gameId === 'dictator') return decisions.some((d) => d.type === 'dictator_give');
  return decisions.some((d) => d.type === 'trust_send') &&
    decisions.some((d) => d.type === 'trust_return');
};

const reconcileStrategicTimeouts = (session: GameSession, nowMs = Date.now()) => {
  if (!STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) return false;
  let changed = false;

  for (const pairing of session.pairings.filter((item) => item.roundKey === session.roundKey)) {
    const pending = pendingStrategicActor(session, pairing.id);
    if (!pending || pending.playerId === 'BOT') continue;

    const deadline = strategicDeadlineAt(session, pairing.id, pending.playerId);
    if (!deadline) continue;

    const key = strategicWindowKey(pairing.id, pending.playerId);
    const submitIntentAt = session.strategicSubmitIntentAt[key];
    const deadlineMs = new Date(deadline).getTime();

    if (submitIntentAt && new Date(submitIntentAt).getTime() <= deadlineMs) {
      const alreadyIssue = session.strategicTechnicalIssues.some(
        (issue) => issue.pairingId === pairing.id && issue.playerId === pending.playerId && !issue.resolvedAt,
      );
      const technicalDeadline = new Date(submitIntentAt).getTime() + STRATEGIC_TECHNICAL_GRACE_SECONDS * 1000;
      if (!alreadyIssue && nowMs > technicalDeadline) {
        session.strategicTechnicalIssues.push({
          pairingId: pairing.id,
          playerId: pending.playerId,
          roundKey: pairing.roundKey,
          role: pending.role,
          detectedAt: new Date(nowMs).toISOString(),
        });
        changed = true;
      }
      continue;
    }

    if (nowMs < deadlineMs + SUBMISSION_TRANSPORT_GRACE_SECONDS * 1000) continue;

    if (pending.type === 'ultimatum_offer' || pending.type === 'ultimatum_response') {
      addDecision(session, {
        pairingId: pairing.id,
        playerId: pending.playerId,
        roundKey: pairing.roundKey,
        type: 'ultimatum_timeout',
        timedOutRole: pending.role,
        isBotDecision: false,
      });
    } else {
      addDecision(session, {
        pairingId: pairing.id,
        playerId: pending.playerId,
        roundKey: pairing.roundKey,
        type: pending.type,
        amount: 0,
        timedOutRole: pending.role,
        isBotDecision: false,
      });
      autoBotDecisions(session, pairing.id);
    }
    delete session.strategicSubmitIntentAt[key];
    changed = true;
  }

  return changed;
};

const isBotControlledActor = (session: GameSession, playerId: string | 'BOT') =>
  playerId === 'BOT' || Boolean(session.players.find((player) => player.id === playerId)?.botControlled);

const botPublicGoodsContribution = (session: GameSession, playerId: string) => {
  const round = currentPublicGoodsRounds(session).find((item) => item.memberIds.includes(playerId));
  if (!round || round.status !== 'open') return;

  const startingWealth = round.startingPlayerWealth?.[playerId] ?? 0;
  if (startingWealth <= 0) {
    round.contributions[playerId] = 0;
    upsertPublicGoodsDecision(session, playerId, round.groupId, round.roundNumber, 0, true);
    return;
  }

  const currentHumanRatios = round.memberIds
    .filter((id) => id !== playerId && !session.players.find((player) => player.id === id)?.botControlled)
    .map((id) => {
      const contribution = round.contributions[id];
      const wealth = round.startingPlayerWealth?.[id] ?? 0;
      return contribution !== undefined && wealth > 0 ? contribution / wealth : null;
    })
    .filter((value): value is number => value !== null);

  const historicalHumanRatios = session.publicGoodsRounds
    .filter((item) => item.status === 'settled' && item.roundNumber < round.roundNumber)
    .flatMap((item) =>
      Object.entries(item.contributions).map(([id, contribution]) => {
        const decision = session.decisions.find((candidate) =>
          candidate.type === 'public_goods_contribution' &&
          candidate.playerId === id &&
          candidate.groupId === item.groupId &&
          candidate.publicGoodsRound === item.roundNumber
        );
        const wealth = item.startingPlayerWealth?.[id] ?? 0;
        return decision?.isBotDecision || wealth <= 0 ? null : contribution / wealth;
      })
    )
    .filter((value): value is number => value !== null);

  const source = currentHumanRatios.length ? currentHumanRatios : historicalHumanRatios;
  const ratio = source.length
    ? source.reduce((sum, value) => sum + value, 0) / source.length
    : 0.5;
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const amount = Math.min(startingWealth, Math.round(startingWealth * safeRatio));

  round.contributions[playerId] = amount;
  round.totalContribution = Object.values(round.contributions).reduce((sum, value) => sum + value, 0);
  upsertPublicGoodsDecision(session, playerId, round.groupId, round.roundNumber, amount, true);
};

const autoBotDecisions = (session: GameSession, pairingId: string) => {
  const pairing = session.pairings.find((item) => item.id === pairingId);
  if (!pairing) return;
  const pairDecisions = () => decisionsForPair(session, pairing.id);

  const humanAmounts = (type: Decision['type']) =>
    session.decisions
      .filter((decision) => decision.type === type && decision.playerId !== 'BOT' && !decision.isBotDecision && decision.amount !== undefined)
      .map((decision) => decision.amount as number);

  const humanTrustReturnRatios = () =>
    session.decisions
      .filter((decision) => decision.type === 'trust_return' && decision.playerId !== 'BOT' && !decision.isBotDecision && decision.amount !== undefined)
      .map((decision) => {
        const sent = session.decisions.find(
          (candidate) => candidate.pairingId === decision.pairingId && candidate.type === 'trust_send',
        )?.amount ?? 0;
        return sent > 0 ? Math.round(((decision.amount ?? 0) / (sent * 3)) * 100) : 0;
      });

  if (isBotControlledActor(session, pairing.playerA)) {
    if (pairing.gameId === 'ultimatum' && !pairDecisions().some((d) => d.type === 'ultimatum_offer')) {
      addDecision(session, {
        pairingId: pairing.id,
        playerId: pairing.playerA,
        roundKey: pairing.roundKey,
        type: 'ultimatum_offer',
        amount: botUltimatumOffer(humanAmounts('ultimatum_offer'), session.startingCredit),
        isBotDecision: true,
      });
    }
    if (pairing.gameId === 'dictator' && !pairDecisions().some((d) => d.type === 'dictator_give')) {
      addDecision(session, {
        pairingId: pairing.id,
        playerId: pairing.playerA,
        roundKey: pairing.roundKey,
        type: 'dictator_give',
        amount: botGiveAmount(humanAmounts('dictator_give'), session.startingCredit),
        isBotDecision: true,
      });
    }
    if (pairing.gameId === 'trust' && !pairDecisions().some((d) => d.type === 'trust_send')) {
      addDecision(session, {
        pairingId: pairing.id,
        playerId: pairing.playerA,
        roundKey: pairing.roundKey,
        type: 'trust_send',
        amount: botTrustSend(humanAmounts('trust_send'), session.startingCredit),
        isBotDecision: true,
      });
    }
  }

  const current = pairDecisions();

  if (isBotControlledActor(session, pairing.playerB)) {
    if (pairing.gameId === 'ultimatum' && !current.some((d) => d.type === 'ultimatum_response')) {
      const offer = current.find((d) => d.type === 'ultimatum_offer')?.amount;
      if (offer !== undefined) {
        addDecision(session, {
          pairingId: pairing.id,
          playerId: pairing.playerB,
          roundKey: pairing.roundKey,
          type: 'ultimatum_response',
          accepted: botUltimatumAccepts(offer, session.startingCredit, humanAmounts('ultimatum_offer')),
          isBotDecision: true,
        });
      }
    }
    if (pairing.gameId === 'trust' && !current.some((d) => d.type === 'trust_return')) {
      const sent = current.find((d) => d.type === 'trust_send')?.amount;
      if (sent !== undefined) {
        addDecision(session, {
          pairingId: pairing.id,
          playerId: pairing.playerB,
          roundKey: pairing.roundKey,
          type: 'trust_return',
          amount: botTrustReturn(sent * 3, humanTrustReturnRatios()),
          isBotDecision: true,
        });
      }
    }
  }
};

const prepareStrategicRound = (session: GameSession, roundKey: StrategicRound) => {
  session.roundKey = roundKey;
  session.status = 'active';
  session.roundStartedAt = new Date().toISOString();
  for (const pairing of session.pairings.filter((item) => item.roundKey === roundKey)) {
    autoBotDecisions(session, pairing.id);
  }
};

const HUNGARIAN_GROUP_NAMES = [
  'Balaton', 'Badacsony', 'Hortobágy', 'Dunakanyar', 'Tokaj',
  'Tihany', 'Pannonhalma', 'Aggtelek', 'Hollókő', 'Bükk',
  'Mátra', 'Bakony', 'Őrség', 'Gemenc', 'Szigetköz',
  'Kékes', 'Fertő', 'Visegrád', 'Esztergom', 'Pécs',
  'Sopron', 'Szeged', 'Eger', 'Debrecen', 'Gyula',
  'Kőszeg', 'Szentendre', 'Hévíz', 'Tapolca', 'Lillafüred',
  'Villány', 'Etyek', 'Somló', 'Zemplén', 'Mecsek',
  'Pilis', 'Börzsöny', 'Tisza-tó', 'Szalajka', 'Füzér',
  'Boldogkő', 'Sümeg', 'Szigliget', 'Fonyód', 'Keszthely',
  'Balatonfüred', 'Veszprém', 'Tata', 'Szarvas', 'Makó',
  'Kalocsa', 'Szekszárd', 'Kaposvár', 'Pápa', 'Sárvár',
  'Bük', 'Mátrafüred', 'Parád', 'Noszvaj', 'Egerszalók',
  'Tiszafüred', 'Poroszló', 'Sárospatak', 'Regéc', 'Telkibánya',
  'Jósvafő', 'Bánkút', 'Szilvásvárad', 'Felsőtárkány', 'Orfű',
  'Abaliget', 'Harkány', 'Siklós', 'Mohács', 'Ópusztaszer',
  'Bugac', 'Kiskunság', 'Fertőd', 'Nagycenk', 'Pannonhalmi-dombság',
  'Velencei-tó', 'Tiszakécske', 'Vácrátót', 'Alcsút', 'Martonvásár',
  'Csopak', 'Révfülöp', 'Balatonboglár', 'Balatonföldvár', 'Zebegény',
  'Nagymaros', 'Dobogókő', 'Prédikálószék', 'Rám-szakadék', 'Normafa',
  'Gerecse', 'Cserhát', 'Körös-Maros', 'Dráva', 'Szent György-hegy',
] as const;

const makeGroups = (session: GameSession, count: number): PublicGoodsGroup[] => {
  const players = shuffle(session.players.filter((player) => !player.isBot && player.active).map((player) => player.id));
  const safeCount = Math.max(1, Math.min(count, players.length || 1, 25, HUNGARIAN_GROUP_NAMES.length));
  const groups = Array.from({ length: safeCount }, (_, index) => ({
    id: crypto.randomUUID(),
    name: HUNGARIAN_GROUP_NAMES[index],
    memberIds: [] as string[],
    nextMinimumMode: 'none' as MinimumMode,
  }));
  players.forEach((playerId, index) => groups[index % safeCount].memberIds.push(playerId));
  return groups;
};

const makeManualGroups = (session: GameSession, count: number): PublicGoodsGroup[] => {
  const players = session.players
    .filter((player) => !player.isBot && player.active)
    .map((player) => player.id);
  const safeCount = Math.max(1, Math.min(count, players.length || 1, 25, HUNGARIAN_GROUP_NAMES.length));
  const groups = Array.from({ length: safeCount }, (_, index) => ({
    id: crypto.randomUUID(),
    name: HUNGARIAN_GROUP_NAMES[index],
    memberIds: [] as string[],
    nextMinimumMode: 'none' as MinimumMode,
  }));
  if (groups[0]) groups[0].memberIds = [...players];
  return groups;
};

const groupWealth = (session: GameSession, group: PublicGoodsGroup) =>
  group.memberIds.reduce((sum, id) => sum + (session.players.find((player) => player.id === id)?.currentBalance ?? 0), 0);

const minimumForGroup = (session: GameSession, group: PublicGoodsGroup) => {
  const wealth = groupWealth(session, group);
  if (group.nextMinimumMode === 'none') return undefined;
  if (group.nextMinimumMode === '80') return Math.round(wealth * 0.8);
  if (group.nextMinimumMode === '90') return Math.round(wealth * 0.9);
  if (group.nextMinimumMode === '95') return Math.round(wealth * 0.95);
  return Math.max(0, Math.round(group.nextCustomMinimum ?? 0));
};

const currentPublicGoodsRounds = (session: GameSession) =>
  session.publicGoodsRounds.filter((round) => round.roundNumber === session.publicGoodsRoundNumber);

const strategicOutcome = (session: GameSession, pairing: Pairing): Record<string, number> => {
  const decisions = decisionsForPair(session, pairing.id);
  let rows;
  if (pairing.gameId === 'ultimatum') {
    const timedOut = decisions.some((d) => d.type === 'ultimatum_timeout');
    const offer = decisions.find((d) => d.type === 'ultimatum_offer')?.amount ?? 0;
    const accepted = timedOut ? false : decisions.find((d) => d.type === 'ultimatum_response')?.accepted ?? false;
    rows = settleUltimatum(session.players, pairing, offer, accepted, session.startingCredit);
  } else if (pairing.gameId === 'dictator') {
    const amount = decisions.find((d) => d.type === 'dictator_give')?.amount ?? 0;
    rows = settleOneWayGive(session.players, pairing, amount, session.startingCredit);
  } else {
    const sent = decisions.find((d) => d.type === 'trust_send')?.amount ?? 0;
    const returned = decisions.find((d) => d.type === 'trust_return')?.amount ?? 0;
    rows = settleTrust(session.players, pairing, sent, returned, session.startingCredit);
  }
  return Object.fromEntries(rows.map((row) => [row.playerId, row.amount]));
};

const applyManualDelta = (
  session: GameSession,
  playerId: string,
  delta: number,
  reason: string,
  roundKey: RoundKey,
) => {
  if (delta === 0) return;
  const player = session.players.find((item) => item.id === playerId);
  if (!player) return;
  const before = player.currentBalance;
  player.currentBalance += delta;
  session.transactions.push({
    id: crypto.randomUUID(),
    playerId,
    roundKey,
    amount: delta,
    reason,
    balanceBefore: before,
    balanceAfter: player.currentBalance,
    createdAt: new Date().toISOString(),
  });
};

const requireCorrectionNote = (note: string) => {
  const clean = note.trim();
  if (!clean) throw new Error('A kézi korrekcióhoz rövid indoklás szükséges.');
  return clean;
};

const publicGoodsDeadlinePassed = (session: GameSession) =>
  session.publicGoodsDeadlineAt ? Date.now() >= new Date(session.publicGoodsDeadlineAt).getTime() : false;

export const localSessionStore = {
  ready() {
    return Promise.resolve();
  },

  afterCreate(session: GameSession) {
    return Promise.resolve(session);
  },

  afterJoin(code: string) {
    return Promise.resolve(read(code.toUpperCase()));
  },

  resumePlayer(code: string, playerId: string) {
    const session = read(code.toUpperCase());
    if (!session) return Promise.resolve(null);
    const player = session.players.find((item) => item.id === playerId);
    if (!player) return Promise.resolve(null);
    return Promise.resolve({ session, name: player.name });
  },

  resolvePlayerId(playerId: string) {
    return playerId;
  },

  prepareJoin(code: string) {
    const session = read(code.toUpperCase());
    if (!session) return Promise.reject(new Error('Nincs ilyen játék.'));
    if (session.roundKey !== 'lobby') return Promise.reject(new Error('Ez a játék már elindult.'));
    if (session.players.length >= session.expectedPlayerCount) return Promise.reject(new Error('A játék létszáma betelt.'));
    return Promise.resolve();
  },

  replaceFromRemote(session: GameSession) {
    write(session);
    return session;
  },

  create(startingCredit: number, expectedPlayerCount = 2): GameSession {
    let code = makeCode();
    while (read(code)) code = makeCode();
    const safeCount = Math.max(2, Math.min(MAX_PLAYERS, Math.round(expectedPlayerCount)));
    const safeStartingCredit = Math.max(1_000, Math.min(1_000_000, Math.round(startingCredit / 100) * 100));
    const session: GameSession = {
      code,
      status: 'lobby',
      roundKey: 'lobby',
      startingCredit: safeStartingCredit,
      expectedPlayerCount: safeCount,
      createdAt: new Date().toISOString(),
      players: [],
      pairings: [],
      decisions: [],
      strategicTaskSeenAt: {},
      strategicSubmitIntentAt: {},
      strategicTechnicalIssues: [],
      manualCorrections: [],
      transactions: [],
      closedRounds: [],
      groups: [],
      firstStageFinalBalance: {},
      publicGoodsRoundNumber: 0,
      publicGoodsPhase: 'setup',
      publicGoodsRounds: [],
      pinnedDebriefEventIds: [],
      reflections: [],
      selfReport: [],
    };
    write(session);
    return session;
  },

  get(code: string) {
    return read(code.toUpperCase());
  },

  setExpectedPlayerCount(code: string, count: number): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.roundKey !== 'lobby') throw new Error('A létszám csak indulás előtt módosítható.');
    const safe = Math.max(2, Math.min(MAX_PLAYERS, Math.round(count)));
    if (safe < session.players.length) throw new Error('A beállított létszám nem lehet kisebb a már belépettek számánál.');
    session.expectedPlayerCount = safe;
    write(session);
    return session;
  },

  join(code: string, playerId: string, name: string): GameSession {
    const session = read(code.toUpperCase());
    if (!session) throw new Error('Nincs ilyen játék.');
    if (session.roundKey !== 'lobby') throw new Error('Ez a játék már elindult.');
    const existing = session.players.find((player) => player.id === playerId);
    if (!existing && session.players.length >= session.expectedPlayerCount) throw new Error('A játék létszáma betelt.');

    const now = new Date().toISOString();
    if (existing) {
      existing.name = name;
      existing.active = true;
      existing.online = true;
      existing.lastSeenAt = now;
    } else {
      session.players.push({
        id: playerId,
        name,
        currentBalance: 0,
        active: true,
        online: true,
        joinedAt: now,
        lastSeenAt: now,
      });
    }
    write(session);
    return session;
  },

  touchPlayer(code: string, playerId: string): GameSession | null {
    const session = read(code);
    if (!session) return null;
    const player = session.players.find((item) => item.id === playerId);
    if (!player) return session;
    player.online = true;
    player.lastSeenAt = new Date().toISOString();
    write(session);
    return session;
  },

  touchPlayers(code: string, playerIds: string[]): GameSession | null {
    const session = read(code);
    if (!session) return null;
    const ids = new Set(playerIds);
    const now = new Date().toISOString();
    let changed = false;
    for (const player of session.players) {
      if (!ids.has(player.id)) continue;
      player.online = true;
      player.lastSeenAt = now;
      changed = true;
    }
    if (changed) write(session);
    return session;
  },

  setPlayerBotControl(code: string, playerId: string, enabled: boolean): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.roundKey === 'lobby' || session.roundKey === 'report') {
      throw new Error('BOT-átvétel csak futó játék közben állítható.');
    }
    const player = session.players.find((item) => item.id === playerId && !item.isBot);
    if (!player) throw new Error('A résztvevő nem található.');

    player.botControlled = enabled;
    if (enabled) player.online = false;

    if (STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) {
      const pairing = this.getPairingForPlayer(session, playerId);
      if (pairing) autoBotDecisions(session, pairing.id);
    } else if (session.roundKey === '4' && session.publicGoodsPhase === 'open' && enabled) {
      botPublicGoodsContribution(session, playerId);
    }

    write(session);
    return session;
  },

  isPlayerOnline(player: GameSession['players'][number]) {
    if (!player.lastSeenAt) return false;
    return Date.now() - new Date(player.lastSeenAt).getTime() < 45_000;
  },

  startGame(code: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.players.length !== session.expectedPlayerCount) {
      throw new Error(`Még nincs bent mindenki: ${session.players.length}/${session.expectedPlayerCount}.`);
    }
    session.pairings = buildSixRoundPairingSchedule(session.players.map((player) => player.id));
    prepareStrategicRound(session, '1a');
    write(session);
    return session;
  },

  nextRound(code: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.roundKey === 'lobby') return this.startGame(code);

    if (STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) {
      const current = session.roundKey as StrategicRound;
      if (!session.closedRounds.includes(current)) throw new Error('Előbb zárd le az aktuális kört.');
      const index = STRATEGIC_ROUNDS.indexOf(current);
      if (index < STRATEGIC_ROUNDS.length - 1) {
        prepareStrategicRound(session, STRATEGIC_ROUNDS[index + 1]);
      } else {
        session.roundKey = '4';
        session.status = 'active';
        session.roundStartedAt = undefined;
        session.publicGoodsDeadlineAt = undefined;
        session.firstStageFinalBalance = Object.fromEntries(
          session.players.map((player) => [player.id, player.currentBalance]),
        );
        session.publicGoodsPhase = 'setup';
        if (session.groups.length === 0) session.groups = makeGroups(session, 1);
      }
      write(session);
      return session;
    }

    return session;
  },

  getPairingForPlayer(session: GameSession, playerId: string) {
    if (!STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) return undefined;
    return session.pairings.find((pairing) =>
      pairing.roundKey === session.roundKey &&
      (pairing.playerA === playerId || pairing.playerB === playerId)
    );
  },

  ackStrategicTaskVisible(code: string, playerId: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (!STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) return session;
    const pairing = this.getPairingForPlayer(session, playerId);
    if (!pairing) return session;
    const pending = pendingStrategicActor(session, pairing.id);
    if (!pending || pending.playerId !== playerId) return session;

    const key = strategicWindowKey(pairing.id, playerId);
    if (!session.strategicTaskSeenAt[key]) {
      session.strategicTaskSeenAt[key] = new Date().toISOString();
      write(session);
    }
    return session;
  },

  markStrategicSubmitIntent(code: string, playerId: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (!STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) return session;
    const pairing = this.getPairingForPlayer(session, playerId);
    if (!pairing) return session;

    const deadline = strategicDeadlineAt(session, pairing.id, playerId);
    if (!deadline) return session;
    const now = Date.now();
    if (now > new Date(deadline).getTime()) {
      if (reconcileStrategicTimeouts(session, now)) write(session);
      throw new Error('Lejárt a 60 másodperces döntési idő.');
    }

    session.strategicSubmitIntentAt[strategicWindowKey(pairing.id, playerId)] = new Date(now).toISOString();
    write(session);
    return session;
  },

  markStrategicSubmitIntentAt(code: string, playerId: string, submittedAt: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (!STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) return session;
    const pairing = this.getPairingForPlayer(session, playerId);
    if (!pairing) return session;

    const deadline = strategicDeadlineAt(session, pairing.id, playerId);
    if (!deadline) return session;
    const submittedMs = new Date(submittedAt).getTime();
    if (!Number.isFinite(submittedMs)) throw new Error('Érvénytelen döntési időbélyeg.');
    const deadlineMs = new Date(deadline).getTime();

    if (submittedMs > deadlineMs) {
      if (reconcileStrategicTimeouts(session, submittedMs)) write(session);
      throw new Error('Lejárt a 60 másodperces döntési idő.');
    }

    session.strategicSubmitIntentAt[strategicWindowKey(pairing.id, playerId)] = new Date(submittedMs).toISOString();
    write(session);
    return session;
  },

  reopenTechnicalDecision(code: string, pairingId: string, playerId: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    const issueIndex = session.strategicTechnicalIssues.findIndex(
      (issue) => issue.pairingId === pairingId && issue.playerId === playerId && !issue.resolvedAt,
    );
    if (issueIndex < 0) throw new Error('Nincs újranyitható technikai hiba.');
    session.strategicTechnicalIssues[issueIndex].resolvedAt = new Date().toISOString();
    session.strategicTechnicalIssues[issueIndex].resolution = 'reopened';
    const key = strategicWindowKey(pairingId, playerId);
    delete session.strategicSubmitIntentAt[key];
    session.strategicTaskSeenAt[key] = new Date().toISOString();
    write(session);
    return session;
  },

  submitStrategicDecision(
    code: string,
    playerId: string,
    payload: { type: Decision['type']; amount?: number; accepted?: boolean },
  ): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (!STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) throw new Error('Most nincs egyéni döntési kör.');

    if (reconcileStrategicTimeouts(session)) {
      write(session);
    }

    const player = session.players.find((item) => item.id === playerId);
    if (player?.botControlled) throw new Error('A játékost jelenleg BOT irányítja.');

    const pairing = this.getPairingForPlayer(session, playerId);
    if (!pairing) throw new Error('Nincs párosításod ebben a körben.');

    const isA = pairing.playerA === playerId;
    const pairDecisions = decisionsForPair(session, pairing.id);

    if (pairDecisions.some((decision) => decision.type === 'ultimatum_timeout')) {
      throw new Error('Lejárt a döntési idő. Ebből a párból senki nem kap kreditet.');
    }

    if (pairing.gameId === 'ultimatum') {
      if (isA && payload.type !== 'ultimatum_offer') throw new Error('Most ajánlatot kell tenned.');
      if (!isA && payload.type !== 'ultimatum_response') throw new Error('Most az ajánlatról kell döntened.');
      if (!isA && !pairDecisions.some((d) => d.type === 'ultimatum_offer')) throw new Error('Várj az ajánlatra.');
    } else if (pairing.gameId === 'dictator') {
      if (!isA) throw new Error('Ebben a körben a partnered dönt.');
      if (payload.type !== 'dictator_give') throw new Error('Most az átadott összegről kell döntened.');
    } else {
      if (isA && payload.type !== 'trust_send') throw new Error('Most az elküldött összegről kell döntened.');
      if (!isA && payload.type !== 'trust_return') throw new Error('Most a visszaadott összegről kell döntened.');
      if (!isA && !pairDecisions.some((d) => d.type === 'trust_send')) throw new Error('Várj a partnered döntésére.');
    }

    if (payload.amount !== undefined) {
      const max = payload.type === 'trust_return'
        ? (pairDecisions.find((d) => d.type === 'trust_send')?.amount ?? 0) * 3
        : session.startingCredit;
      if (!Number.isFinite(payload.amount) || payload.amount < 0 || payload.amount > max) {
        throw new Error(`0 és ${max} közötti összeget adj meg.`);
      }
    }

    const decisionKey = strategicWindowKey(pairing.id, playerId);
    const submitIntentAt = session.strategicSubmitIntentAt[decisionKey];
    addDecision(session, {
      pairingId: pairing.id,
      playerId,
      roundKey: session.roundKey,
      type: payload.type,
      amount: payload.amount,
      accepted: payload.accepted,
      submitIntentAt,
    });
    const resolvedAt = new Date().toISOString();
    for (const issue of session.strategicTechnicalIssues) {
      if (issue.pairingId === pairing.id && issue.playerId === playerId && !issue.resolvedAt) {
        issue.resolvedAt = resolvedAt;
        issue.resolution = 'decision_received';
      }
    }
    delete session.strategicSubmitIntentAt[decisionKey];
    autoBotDecisions(session, pairing.id);
    write(session);
    return session;
  },

  strategicDeadlineAt(session: GameSession, pairingId: string, playerId: string | 'BOT') {
    return strategicDeadlineAt(session, pairingId, playerId);
  },

  ultimatumDeadlineAt(session: GameSession, pairingId: string, playerId: string | 'BOT') {
    return strategicDeadlineAt(session, pairingId, playerId);
  },

  reconcileStrategicTimeouts(code: string, nowMs = Date.now()): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (reconcileStrategicTimeouts(session, nowMs)) write(session);
    return session;
  },

  roundProgress(session: GameSession) {
    if (!STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) return { ready: 0, total: 0, complete: false };
    const pairs = session.pairings.filter((pairing) => pairing.roundKey === session.roundKey);
    const ready = pairs.filter((pairing) => pairReady(session, pairing.id)).length;
    return { ready, total: pairs.length, complete: pairs.length > 0 && ready === pairs.length };
  },

  closeStrategicRound(code: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (!STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) throw new Error('Ez nem lezárható egyéni kör.');
    const roundKey = session.roundKey as StrategicRound;
    if (session.closedRounds.includes(roundKey)) return session;

    const pairs = session.pairings.filter((pairing) => pairing.roundKey === roundKey);
    if (!pairs.every((pairing) => pairReady(session, pairing.id))) throw new Error('Még nincs kész minden pár.');

    let players = session.players;
    const transactions = [];

    for (const pairing of pairs) {
      const decisions = decisionsForPair(session, pairing.id);
      if (pairing.gameId === 'ultimatum') {
        const timedOut = decisions.some((d) => d.type === 'ultimatum_timeout');
        const offer = decisions.find((d) => d.type === 'ultimatum_offer')?.amount ?? 0;
        const accepted = timedOut ? false : decisions.find((d) => d.type === 'ultimatum_response')?.accepted ?? false;
        const rows = settleUltimatum(players, pairing, offer, accepted, session.startingCredit);
        transactions.push(...rows);
        players = applyTransactions(players, rows);
      } else if (pairing.gameId === 'dictator') {
        const amount = decisions.find((d) => d.type === 'dictator_give')?.amount ?? 0;
        const rows = settleOneWayGive(players, pairing, amount, session.startingCredit);
        transactions.push(...rows);
        players = applyTransactions(players, rows);
      } else {
        const sent = decisions.find((d) => d.type === 'trust_send')?.amount ?? 0;
        const returned = decisions.find((d) => d.type === 'trust_return')?.amount ?? 0;
        const rows = settleTrust(players, pairing, sent, returned, session.startingCredit);
        transactions.push(...rows);
        players = applyTransactions(players, rows);
      }
    }

    session.players = players;
    session.transactions.push(...transactions);
    session.closedRounds.push(roundKey);
    write(session);
    return session;
  },

  correctPlayerBalance(code: string, playerId: string, newBalance: number, note: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    const player = session.players.find((item) => item.id === playerId);
    if (!player) throw new Error('A résztvevő nem található.');
    if (!Number.isFinite(newBalance) || newBalance < 0) throw new Error('Érvényes, nem negatív vagyont adj meg.');

    const cleanNote = requireCorrectionNote(note);
    const before = player.currentBalance;
    const after = Math.round(newBalance);
    applyManualDelta(session, playerId, after - before, 'manual_balance_correction', session.roundKey);
    session.manualCorrections.push({
      id: crypto.randomUUID(),
      kind: 'balance',
      playerId,
      roundKey: session.roundKey,
      field: 'currentBalance',
      beforeValue: before,
      afterValue: after,
      note: cleanNote,
      createdAt: new Date().toISOString(),
    });
    write(session);
    return session;
  },

  correctStrategicDecision(
    code: string,
    roundKey: StrategicRound,
    playerId: string,
    value: number | boolean,
    note: string,
  ): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    const pairing = session.pairings.find(
      (item) => item.roundKey === roundKey && (item.playerA === playerId || item.playerB === playerId),
    );
    if (!pairing) throw new Error('Ehhez a játékoshoz nincs párosítás ebben a körben.');

    const isA = pairing.playerA === playerId;
    const type: Decision['type'] =
      pairing.gameId === 'ultimatum'
        ? (isA ? 'ultimatum_offer' : 'ultimatum_response')
        : pairing.gameId === 'dictator'
          ? 'dictator_give'
          : (isA ? 'trust_send' : 'trust_return');

    if (pairing.gameId === 'dictator' && !isA) {
      throw new Error('A Diktátor fogadójának nincs korrigálható döntése.');
    }

    const decision = session.decisions.find(
      (item) => item.pairingId === pairing.id && item.playerId === playerId && item.type === type,
    );
    if (!decision) throw new Error('Nincs meglévő döntés, amit korrigálni lehet.');

    const cleanNote = requireCorrectionNote(note);
    const closed = session.closedRounds.includes(roundKey);
    const oldOutcome = closed ? strategicOutcome(session, pairing) : {};
    const beforeValue = type === 'ultimatum_response' ? (decision.accepted ?? false) : (decision.amount ?? 0);

    if (type === 'ultimatum_response') {
      if (typeof value !== 'boolean') throw new Error('Elfogadásnál igen/nem érték szükséges.');
      decision.accepted = value;
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Érvényes összeget adj meg.');
      const max = type === 'trust_return'
        ? (session.decisions.find((d) => d.pairingId === pairing.id && d.type === 'trust_send')?.amount ?? 0) * 3
        : session.startingCredit;
      if (value > max) throw new Error(`A maximális korrigálható összeg ${max}.`);
      decision.amount = Math.round(value);
    }
    decision.timedOutRole = undefined;
    decision.submittedAt = new Date().toISOString();

    if (closed) {
      const newOutcome = strategicOutcome(session, pairing);
      for (const id of [pairing.playerA, pairing.playerB]) {
        if (id === 'BOT') continue;
        const delta = (newOutcome[id] ?? 0) - (oldOutcome[id] ?? 0);
        applyManualDelta(session, id, delta, 'manual_decision_correction', roundKey);
        if (session.firstStageFinalBalance[id] !== undefined) {
          session.firstStageFinalBalance[id] += delta;
        }
      }
    }

    const afterValue = type === 'ultimatum_response' ? (decision.accepted ?? false) : (decision.amount ?? 0);
    session.manualCorrections.push({
      id: crypto.randomUUID(),
      kind: 'strategic_decision',
      playerId,
      roundKey,
      pairingId: pairing.id,
      field: type,
      beforeValue,
      afterValue,
      note: cleanNote,
      createdAt: new Date().toISOString(),
    });
    write(session);
    return session;
  },

  correctPublicGoodsContribution(
    code: string,
    roundNumber: number,
    playerId: string,
    newAmount: number,
    note: string,
  ): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    const round = session.publicGoodsRounds.find(
      (item) => item.roundNumber === roundNumber && item.memberIds.includes(playerId),
    );
    if (!round) throw new Error('A kasszakör nem található ehhez a játékoshoz.');
    if (!Number.isFinite(newAmount) || newAmount < 0) throw new Error('Érvényes, nem negatív összeget adj meg.');
    const maxContribution = round.startingPlayerWealth?.[playerId];
    if (maxContribution !== undefined && newAmount > maxContribution) {
      throw new Error(`A kör eleji vagyon legfeljebb ${maxContribution} kredit volt.`);
    }
    const cleanNote = requireCorrectionNote(note);

    const before = round.contributions[playerId] ?? 0;
    const oldContributions = { ...round.contributions };
    const oldTotal = Object.values(oldContributions).reduce((sum, value) => sum + value, 0);
    const oldSuccess = round.minimumAmount === undefined || oldTotal >= round.minimumAmount;
    const oldPayout = oldSuccess && round.memberIds.length > 0 ? Math.round((oldTotal * 2) / round.memberIds.length) : 0;

    round.contributions[playerId] = Math.round(newAmount);
    round.totalContribution = Object.values(round.contributions).reduce((sum, value) => sum + value, 0);
    upsertPublicGoodsDecision(session, playerId, round.groupId, round.roundNumber, Math.round(newAmount));

    if (round.status === 'settled') {
      const newSuccess = round.minimumAmount === undefined || round.totalContribution >= round.minimumAmount;
      const newPayout = newSuccess && round.memberIds.length > 0
        ? Math.round((round.totalContribution * 2) / round.memberIds.length)
        : 0;

      for (const memberId of round.memberIds) {
        const oldNet = -(oldContributions[memberId] ?? 0) + oldPayout;
        const newNet = -(round.contributions[memberId] ?? 0) + newPayout;
        applyManualDelta(session, memberId, newNet - oldNet, 'manual_public_goods_correction', '4');
      }
      round.success = newSuccess;
      round.payoutPerPlayer = newPayout;
    }

    session.manualCorrections.push({
      id: crypto.randomUUID(),
      kind: 'public_goods_contribution',
      playerId,
      roundKey: '4',
      publicGoodsRound: roundNumber,
      field: 'contribution',
      beforeValue: before,
      afterValue: Math.round(newAmount),
      note: cleanNote,
      createdAt: new Date().toISOString(),
    });
    write(session);
    return session;
  },

  randomizeGroups(code: string, count: number): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.roundKey !== '4') throw new Error('Csoportokat a Közös kasszánál lehet beállítani.');
    if (session.publicGoodsRoundNumber > 0 || session.publicGoodsPhase !== 'setup') {
      throw new Error('A csoportok csak az első kasszakör előtt módosíthatók.');
    }
    session.groups = makeGroups(session, count);
    write(session);
    return session;
  },

  createManualGroups(code: string, count: number): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.roundKey !== '4') throw new Error('Csoportokat a Közös kasszánál lehet beállítani.');
    if (session.publicGoodsRoundNumber > 0 || session.publicGoodsPhase !== 'setup') {
      throw new Error('A csoportok csak az első kasszakör előtt módosíthatók.');
    }
    session.groups = makeManualGroups(session, count);
    write(session);
    return session;
  },

  setPlayerGroup(code: string, playerId: string, groupId: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.publicGoodsRoundNumber > 0 || session.publicGoodsPhase !== 'setup') {
      throw new Error('A csoportok csak az első kasszakör előtt módosíthatók.');
    }
    for (const group of session.groups) group.memberIds = group.memberIds.filter((id) => id !== playerId);
    const target = session.groups.find((group) => group.id === groupId);
    if (!target) throw new Error('Nincs ilyen csoport.');
    target.memberIds.push(playerId);
    write(session);
    return session;
  },

  togglePinnedDebriefEvent(code: string, eventId: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    const cleanId = eventId.trim();
    if (!cleanId.startsWith('debrief:') || cleanId.length > 300) {
      throw new Error('Érvénytelen kivezetési esemény.');
    }
    const pinned = new Set(session.pinnedDebriefEventIds ?? []);
    if (pinned.has(cleanId)) pinned.delete(cleanId);
    else pinned.add(cleanId);
    session.pinnedDebriefEventIds = [...pinned];
    write(session);
    return session;
  },

  setGroupMinimum(code: string, groupId: string, mode: MinimumMode, customMinimum?: number): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.roundKey !== '4') throw new Error('Minimumot a Közös kasszánál lehet beállítani.');
    if (session.publicGoodsPhase !== 'setup') throw new Error('Aktív vagy lezárt kör közben a minimum nem módosítható.');
    const group = session.groups.find((item) => item.id === groupId);
    if (!group) throw new Error('Nincs ilyen csoport.');
    group.nextMinimumMode = mode;
    group.nextCustomMinimum = mode === 'custom' ? Math.max(0, Math.round(customMinimum ?? 0)) : undefined;
    write(session);
    return session;
  },

  groupWealth,
  minimumForGroup,

  startPublicGoodsRound(code: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.roundKey !== '4') throw new Error('Most nem a Közös kassza fut.');
    if (session.publicGoodsPhase !== 'setup') throw new Error('Az előző kört előbb el kell számolni.');
    if (session.groups.length === 0 || session.groups.some((group) => group.memberIds.length === 0)) {
      throw new Error('Előbb készíts érvényes csapatokat.');
    }

    const nextRound = session.publicGoodsRoundNumber + 1;
    session.publicGoodsRoundNumber = nextRound;
    session.publicGoodsPhase = 'open';
    const now = Date.now();
    session.roundStartedAt = new Date(now).toISOString();
    session.publicGoodsDeadlineAt = new Date(now + PUBLIC_GOODS_SECONDS * 1000).toISOString();

    for (const group of session.groups) {
      const wealth = groupWealth(session, group);
      session.publicGoodsRounds.push({
        id: crypto.randomUUID(),
        roundNumber: nextRound,
        groupId: group.id,
        memberIds: [...group.memberIds],
        startingGroupWealth: wealth,
        startingPlayerWealth: Object.fromEntries(
          group.memberIds.map((playerId) => [
            playerId,
            session.players.find((player) => player.id === playerId)?.currentBalance ?? 0,
          ]),
        ),
        minimumMode: group.nextMinimumMode,
        minimumAmount: minimumForGroup(session, group),
        contributions: {},
        totalContribution: 0,
        status: 'open',
      });
    }

    for (const player of session.players.filter((item) => item.botControlled)) {
      botPublicGoodsContribution(session, player.id);
    }

    write(session);
    return session;
  },

  submitPublicGoods(code: string, playerId: string, amount: number, submittedAt?: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.publicGoodsPhase !== 'open') throw new Error('A tét most nem módosítható.');

    const submittedMs = submittedAt ? new Date(submittedAt).getTime() : Date.now();
    if (!Number.isFinite(submittedMs)) throw new Error('Érvénytelen beküldési időbélyeg.');
    if (session.publicGoodsDeadlineAt && submittedMs > new Date(session.publicGoodsDeadlineAt).getTime()) {
      throw new Error('Lejárt a 90 másodperces döntési idő.');
    }

    const player = session.players.find((item) => item.id === playerId);
    if (!player) throw new Error('A résztvevő nem található.');
    if (player.botControlled) throw new Error('A játékost jelenleg BOT irányítja.');
    if (!Number.isFinite(amount) || amount < 0 || amount > player.currentBalance) {
      throw new Error('A saját vagyonodon belüli összeget adj meg.');
    }

    const round = currentPublicGoodsRounds(session).find((item) => item.memberIds.includes(playerId));
    if (!round || round.status !== 'open') throw new Error('Nem található az aktuális csoportkör.');

    round.contributions[playerId] = Math.round(amount);
    round.totalContribution = Object.values(round.contributions).reduce((sum, value) => sum + value, 0);
    upsertPublicGoodsDecision(
      session,
      playerId,
      round.groupId,
      round.roundNumber,
      Math.round(amount),
      false,
      new Date(submittedMs).toISOString(),
    );
    write(session);
    return session;
  },

  publicGoodsProgress(session: GameSession) {
    if (session.publicGoodsRoundNumber === 0) return { ready: 0, total: session.players.length, complete: false };
    const rounds = currentPublicGoodsRounds(session);
    const ready = rounds.reduce((sum, round) => sum + Object.keys(round.contributions).length, 0);
    const total = rounds.reduce((sum, round) => sum + round.memberIds.length, 0);
    return { ready, total, complete: total > 0 && ready === total };
  },

  publicGoodsSecondsLeft(session: GameSession) {
    if (!session.publicGoodsDeadlineAt) return 0;
    return Math.max(0, Math.ceil((new Date(session.publicGoodsDeadlineAt).getTime() - Date.now()) / 1000));
  },

  canEditPublicGoods(session: GameSession) {
    return session.publicGoodsPhase === 'open' && !publicGoodsDeadlinePassed(session);
  },

  lockPublicGoodsRound(code: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.publicGoodsPhase !== 'open') throw new Error('Nincs lezárható aktív kasszakör.');

    if (session.publicGoodsDeadlineAt) {
      const deadlineMs = new Date(session.publicGoodsDeadlineAt).getTime();
      const nowMs = Date.now();
      const progress = this.publicGoodsProgress(session);
      if (
        !progress.complete &&
        nowMs >= deadlineMs &&
        nowMs < deadlineMs + SUBMISSION_TRANSPORT_GRACE_SECONDS * 1000
      ) {
        throw new Error('A lejárt idő után még rövid technikai szinkronizálás folyik. Várj néhány másodpercet.');
      }
    }

    const rounds = currentPublicGoodsRounds(session);
    for (const round of rounds) {
      for (const playerId of round.memberIds) {
        if (round.contributions[playerId] !== undefined) continue;
        if (session.players.find((player) => player.id === playerId)?.botControlled) {
          botPublicGoodsContribution(session, playerId);
        } else {
          round.contributions[playerId] = 0;
          upsertPublicGoodsDecision(session, playerId, round.groupId, round.roundNumber, 0);
        }
      }
      round.totalContribution = Object.values(round.contributions).reduce((sum, value) => sum + value, 0);
      round.status = 'locked';
    }

    session.publicGoodsPhase = 'locked';
    session.publicGoodsDeadlineAt = undefined;
    write(session);
    return session;
  },

  settlePublicGoodsRound(code: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.publicGoodsPhase !== 'locked') throw new Error('Előbb zárd le a téteket.');

    const rounds = currentPublicGoodsRounds(session);
    let players = session.players;

    for (const round of rounds) {
      const groupPlayers = players.filter((player) => round.memberIds.includes(player.id));
      const result = settlePublicGoods(groupPlayers, round.contributions, '4', round.minimumAmount);
      round.totalContribution = result.totalContribution;
      round.success = result.success;
      round.payoutPerPlayer = result.payoutPerPlayer;
      round.status = 'settled';
      round.settledAt = new Date().toISOString();
      session.transactions.push(...result.transactions);
      players = applyTransactions(players, result.transactions);
    }

    session.players = players;
    for (const group of session.groups) {
      group.nextMinimumMode = 'none';
      group.nextCustomMinimum = undefined;
    }
    session.publicGoodsPhase = 'setup';
    session.roundStartedAt = undefined;
    session.publicGoodsDeadlineAt = undefined;
    write(session);
    return session;
  },

  resumePublicGoodsAfterReport(code: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.roundKey !== 'report' || session.status !== 'finished') {
      throw new Error('Tanulókört csak a lezárt riport után lehet indítani.');
    }
    if (session.publicGoodsContinuation) {
      throw new Error('Ehhez a játékhoz már indult riport utáni tanulókör.');
    }
    if (!session.publicGoodsRounds.some((round) => round.status === 'settled')) {
      throw new Error('Tanulókörhöz legalább egy lezárt Közös kassza kör szükséges.');
    }

    const baselineFinalBalance: Record<string, number> = {};
    const restartBalance: Record<string, number> = {};
    const startedAt = new Date().toISOString();

    for (const player of session.players) {
      baselineFinalBalance[player.id] = player.currentBalance;
      const before = player.currentBalance;
      const after = Math.max(before, session.startingCredit);
      restartBalance[player.id] = after;
      player.currentBalance = after;

      if (after > before) {
        session.transactions.push({
          id: crypto.randomUUID(),
          playerId: player.id,
          roundKey: '4',
          amount: after - before,
          reason: 'post_report_restart_floor',
          balanceBefore: before,
          balanceAfter: after,
          createdAt: startedAt,
        });
      }
    }

    session.publicGoodsContinuation = {
      startedAt,
      firstContinuationRoundNumber: session.publicGoodsRoundNumber + 1,
      baselineFinalBalance,
      restartBalance,
    };
    session.status = 'active';
    session.roundKey = '4';
    session.publicGoodsPhase = 'setup';
    session.roundStartedAt = undefined;
    session.publicGoodsDeadlineAt = undefined;
    for (const group of session.groups) {
      group.nextMinimumMode = 'none';
      group.nextCustomMinimum = undefined;
    }

    write(session);
    return session;
  },

  finish(code: string): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (!canFinishGame(session)) throw new Error('A játék most nem zárható le.');

    if (STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) {
      const completedRounds = new Set(session.closedRounds);
      session.decisions = session.decisions.filter((decision) =>
        !STRATEGIC_ROUNDS.includes(decision.roundKey as StrategicRound) ||
        completedRounds.has(decision.roundKey as StrategicRound)
      );
      session.pairings = session.pairings.filter((pairing) => completedRounds.has(pairing.roundKey));
      // A technikai audit miatt a feladat-megjelenési, beküldési és hibatörténetet megőrizzük.
    }

    if (session.roundKey === '4' && session.publicGoodsPhase !== 'setup') {
      const unfinishedRound = session.publicGoodsRoundNumber;
      session.publicGoodsRounds = session.publicGoodsRounds.filter(
        (round) => round.roundNumber !== unfinishedRound || round.status === 'settled',
      );
      session.decisions = session.decisions.filter(
        (decision) =>
          decision.type !== 'public_goods_contribution' ||
          decision.publicGoodsRound !== unfinishedRound,
      );
      const settledRoundNumbers = session.publicGoodsRounds
        .filter((round) => round.status === 'settled')
        .map((round) => round.roundNumber);
      session.publicGoodsRoundNumber = settledRoundNumbers.length
        ? Math.max(...settledRoundNumbers)
        : 0;
    }

    session.publicGoodsPhase = 'setup';
    session.roundStartedAt = undefined;
    session.publicGoodsDeadlineAt = undefined;
    session.roundKey = 'report';
    session.status = 'finished';
    session.reflections = session.reflections ?? [];
    const eligibleForReflection = session.players
      .filter((player) => !player.isBot && !player.botControlled)
      .some((player) => buildSelfReport(session, player.id).length > 0);
    session.debriefPhase = eligibleForReflection ? 'reflection' : 'complete';
    write(session);
    return session;
  },

  submitReflection(
    code: string,
    playerId: string,
    items: Array<{ decisionId: string; comment: string }>,
  ): GameSession {
    const session = read(code);
    if (!session) throw new Error('A játék nem található.');
    if (session.roundKey !== 'report' || session.status !== 'finished') {
      throw new Error('Reflexiót csak a játék lezárása után lehet beküldeni.');
    }
    const player = session.players.find((item) => item.id === playerId && !item.isBot);
    if (!player) throw new Error('A résztvevő nem található.');

    if (!Array.isArray(items) || items.length < 1 || items.length > 3) {
      throw new Error('Legalább 1, legfeljebb 3 döntést válassz.');
    }

    const reportIds = new Set(buildSelfReport(session, playerId).map((item) => item.id));
    const seen = new Set<string>();
    const now = new Date().toISOString();
    const reflections = items.map((item) => {
      const decisionId = String(item.decisionId ?? '').trim();
      const comment = String(item.comment ?? '').trim();
      if (!reportIds.has(decisionId)) throw new Error('Csak a saját döntéseid közül választhatsz.');
      if (seen.has(decisionId)) throw new Error('Ugyanazt a döntést csak egyszer választhatod.');
      seen.add(decisionId);
      if (!comment) throw new Error('Minden kiválasztott döntéshez írd le, mi célból döntöttél így.');
      if (comment.length > 300) throw new Error('A válasz legfeljebb 300 karakter lehet.');
      return { playerId, decisionId, comment, submittedAt: now };
    });

    session.reflections = [
      ...(session.reflections ?? []).filter((item) => item.playerId !== playerId),
      ...reflections,
    ];

    const eligiblePlayerIds = session.players
      .filter((item) => !item.isBot && !item.botControlled && buildSelfReport(session, item.id).length > 0)
      .map((item) => item.id);
    const completed = new Set((session.reflections ?? []).map((item) => item.playerId));
    session.debriefPhase = eligiblePlayerIds.every((id) => completed.has(id)) ? 'complete' : 'reflection';
    write(session);
    return session;
  },

  subscribe(code: string, listener: Listener) {
    const emit = () => listener(read(code));
    const localHandler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === code) emit();
    };
    const storageHandler = (event: StorageEvent) => {
      if (event.key === PREFIX + code) emit();
    };
    const channelHandler = (event: MessageEvent<{ code: string }>) => {
      if (event.data?.code === code) emit();
    };
    window.addEventListener('kreditjatek-store', localHandler);
    window.addEventListener('storage', storageHandler);
    channel?.addEventListener('message', channelHandler);
    emit();
    return () => {
      window.removeEventListener('kreditjatek-store', localHandler);
      window.removeEventListener('storage', storageHandler);
      channel?.removeEventListener('message', channelHandler);
    };
  },
};
