import {
  Bytes,
  collection,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { GameSession, StrategicRound } from './gameTypes';
import { STRATEGIC_ROUNDS } from './pairingEngine';
import { ensureFirebaseUser, firebaseAuth, firestore } from './firebaseClient';
import { localSessionStore } from './sessionStore';
import { buildParticipantProjection } from './firebaseProjection';

type CommandType =
  | 'ackStrategicTaskVisible'
  | 'markStrategicSubmitIntent'
  | 'submitStrategicDecision'
  | 'submitPublicGoods'
  | 'submitReflection';

type PlayerCommand = {
  id: string;
  nonce: string;
  type: CommandType;
  payload?: Record<string, unknown>;
  createdAt: string;
};

type RemotePlayer = {
  playerId: string;
  authUid: string;
  name: string;
  joinedAt?: string;
  lastSeenAt?: unknown;
  admission?: 'pending' | 'accepted' | 'rejected';
  joinError?: string;
  commands?: Record<string, PlayerCommand>;
  view?: GameSession;
};

type RemoteGame = {
  trainerUid: string;
  roundKey?: GameSession['roundKey'];
  status?: GameSession['status'];
  encoding?: 'gzip-json-v1';
  sessionGzip?: Bytes;
  session?: GameSession | { roundKey: GameSession['roundKey'] };
};

type PublicGame = {
  status: GameSession['status'];
  roundKey: GameSession['roundKey'];
  expectedPlayerCount: number;
  joinedCount: number;
  createdAt: string;
  trainerUid: string;
};

type Listener = (session: GameSession | null) => void;

const playerProjectionPrefix = 'kreditjatek_firebase_player_';
const publicGameCache = new Map<string, PublicGame>();
const remotePlayers = new Map<string, Map<string, RemotePlayer>>();
const queues = new Map<string, Promise<void>>();
const creationPromises = new Map<string, Promise<void>>();
const joinPromises = new Map<string, Promise<void>>();

const role = () => {
  if (typeof window === 'undefined') return 'trainer';
  return new URLSearchParams(window.location.search).get('role') === 'player' ? 'player' : 'trainer';
};

const currentLocalPlayerId = () => {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('testPlayer');
  return forced || localStorage.getItem('kreditjatek_player_id') || '';
};

const gameRef = (code: string) => doc(firestore, 'games', code.toUpperCase());
const publicGameRef = (code: string) => doc(firestore, 'publicGames', code.toUpperCase());
const playersRef = (code: string) => collection(firestore, 'games', code.toUpperCase(), 'players');
const playerRef = (code: string, playerId: string) =>
  doc(firestore, 'games', code.toUpperCase(), 'players', playerId);

const timestampToIso = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const encodeSession = async (session: GameSession): Promise<Bytes> => {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('Ez a böngésző nem támogatja a biztonságos Firebase állapottömörítést.');
  }
  const input = new Blob([JSON.stringify(session)]).stream();
  const compressed = input.pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(compressed).arrayBuffer();
  return Bytes.fromUint8Array(new Uint8Array(buffer));
};

const decodeSession = async (data: RemoteGame): Promise<GameSession | null> => {
  if (!data.sessionGzip) {
    const legacy = data.session;
    return legacy && 'code' in legacy ? legacy : null;
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Ez a böngésző nem támogatja a Firebase állapot kibontását.');
  }
  const bytes = data.sessionGzip.toUint8Array();
  const safeBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(safeBuffer).set(bytes);
  const input = new Blob([safeBuffer]).stream();
  const decompressed = input.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(decompressed).text();
  return JSON.parse(text) as GameSession;
};

const playerCacheKey = (code: string, playerId: string) =>
  playerProjectionPrefix + code.toUpperCase() + '_' + playerId;

const cachePlayerProjection = (code: string, playerId: string, session: GameSession) => {
  localStorage.setItem(playerCacheKey(code, playerId), JSON.stringify(session));
};

const readPlayerProjection = (code: string, playerId: string): GameSession | null => {
  const raw = localStorage.getItem(playerCacheKey(code, playerId));
  return raw ? JSON.parse(raw) as GameSession : null;
};

const placeholderSession = (
  code: string,
  playerId: string,
  name: string,
  info?: PublicGame,
): GameSession => ({
  code: code.toUpperCase(),
  status: info?.status ?? 'lobby',
  roundKey: info?.roundKey ?? 'lobby',
  startingCredit: 0,
  expectedPlayerCount: info?.expectedPlayerCount ?? 2,
  createdAt: info?.createdAt ?? new Date().toISOString(),
  players: [{
    id: playerId,
    name,
    currentBalance: 0,
    active: true,
    online: true,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  }],
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
});

const emitSyncStatus = (status: 'ok' | 'error', message?: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('kreditjatek-sync-status', {
    detail: { status, message },
  }));
};

const enqueue = (code: string, task: () => Promise<void>) => {
  const key = code.toUpperCase();
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  next.then(
    () => emitSyncStatus('ok'),
    (error) => emitSyncStatus('error', error instanceof Error ? error.message : 'Firebase szinkronhiba.'),
  );
  queues.set(key, next);
  return next;
};

const publicPayload = (session: GameSession, uid: string): PublicGame => ({
  status: session.status,
  roundKey: session.roundKey,
  expectedPlayerCount: session.expectedPlayerCount,
  joinedCount: session.players.length,
  createdAt: session.createdAt,
  trainerUid: uid,
});

type CommandClear = { playerId: string; commandKey: string };

const persistState = async (
  session: GameSession,
  playerIds?: Iterable<string>,
  commandsToClear: CommandClear[] = [],
) => {
  const user = await ensureFirebaseUser();
  const sessionGzip = await encodeSession(session);
  const payload = publicPayload(session, user.uid);
  const known = remotePlayers.get(session.code) ?? new Map<string, RemotePlayer>();
  const ids = new Set(playerIds ? Array.from(playerIds) : []);
  const clearByPlayer = new Map<string, string[]>();

  for (const item of commandsToClear) {
    const list = clearByPlayer.get(item.playerId) ?? [];
    list.push(item.commandKey);
    clearByPlayer.set(item.playerId, list);
  }

  const batch = writeBatch(firestore);
  batch.set(gameRef(session.code), {
    trainerUid: user.uid,
    roundKey: session.roundKey,
    status: session.status,
    session: { roundKey: session.roundKey },
    encoding: 'gzip-json-v1',
    sessionGzip,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(publicGameRef(session.code), payload, { merge: true });

  for (const playerId of new Set([...ids, ...clearByPlayer.keys()])) {
    if (!known.has(playerId)) continue;
    const updates: Record<string, unknown> = {};

    if (ids.has(playerId)) {
      updates.view = buildParticipantProjection(session, playerId);
    }

    for (const commandKey of clearByPlayer.get(playerId) ?? []) {
      updates[`commands.${commandKey}`] = deleteField();
    }

    if (Object.keys(updates).length > 0) {
      batch.update(playerRef(session.code, playerId), updates);
    }
  }

  await batch.commit();
  publicGameCache.set(session.code, payload);
};

const affectedPairPlayers = (session: GameSession, playerId: string) => {
  const pairing = localSessionStore.getPairingForPlayer(session, playerId);
  if (!pairing) return [playerId];
  return [pairing.playerA, pairing.playerB].filter((id): id is string => id !== 'BOT');
};

const applyCommand = (
  code: string,
  playerId: string,
  command: PlayerCommand,
): { session: GameSession; affected: string[] } => {
  const before = localSessionStore.get(code);
  if (!before) throw new Error('A játék nem található.');

  if (command.type === 'ackStrategicTaskVisible') {
    const session = localSessionStore.ackStrategicTaskVisible(code, playerId);
    return { session, affected: [playerId] };
  }

  if (command.type === 'markStrategicSubmitIntent') {
    const session = localSessionStore.markStrategicSubmitIntentAt(code, playerId, command.createdAt);
    return { session, affected: [playerId] };
  }

  if (command.type === 'submitStrategicDecision') {
    try {
      localSessionStore.markStrategicSubmitIntentAt(code, playerId, command.createdAt);
    } catch {
      // A tényleges submit hívás alább a timeout-állapot alapján elutasítja a késői döntést.
    }
    const affected = affectedPairPlayers(localSessionStore.get(code) ?? before, playerId);
    const payload = command.payload ?? {};
    const session = localSessionStore.submitStrategicDecision(code, playerId, {
      type: payload.type as GameSession['decisions'][number]['type'],
      amount: typeof payload.amount === 'number' ? payload.amount : undefined,
      accepted: typeof payload.accepted === 'boolean' ? payload.accepted : undefined,
    });
    return { session, affected };
  }

  if (command.type === 'submitPublicGoods') {
    const amount = Number(command.payload?.amount ?? 0);
    const session = localSessionStore.submitPublicGoods(code, playerId, amount);
    return { session, affected: [playerId] };
  }

  const rawItems = Array.isArray(command.payload?.items) ? command.payload.items : [];
  const items = rawItems.map((item) => {
    const value = item as Record<string, unknown>;
    return {
      decisionId: String(value.decisionId ?? ''),
      comment: String(value.comment ?? ''),
    };
  });
  const session = localSessionStore.submitReflection(code, playerId, items);
  return { session, affected: [playerId] };
};

const processRemotePlayers = async (code: string) => {
  let session = localSessionStore.get(code);
  if (!session) return;

  const players = remotePlayers.get(code) ?? new Map<string, RemotePlayer>();
  let masterChanged = false;
  let localPresenceChanged = false;
  const affected = new Set<string>();
  const commandsToClear: { playerId: string; commandKey: string }[] = [];

  for (const [playerId, remote] of players) {
    let current = session.players.find((player) => player.id === playerId);

    if (!current && session.roundKey === 'lobby' && session.players.length < session.expectedPlayerCount) {
      session = localSessionStore.join(code, playerId, remote.name || 'Résztvevő');
      current = session.players.find((player) => player.id === playerId);
      masterChanged = true;
      affected.add(playerId);
    }

    if (!current) continue;

    if (!remote.view) {
      affected.add(playerId);
      masterChanged = true;
    }

    const seen = timestampToIso(remote.lastSeenAt);
    if (seen && current.lastSeenAt !== seen) {
      current.lastSeenAt = seen;
      current.online = Date.now() - new Date(seen).getTime() < 45_000;
      localPresenceChanged = true;
    }

    const commands = Object.entries(remote.commands ?? {})
      .sort(([, a], [, b]) => a.createdAt.localeCompare(b.createdAt));

    for (const [commandKey, command] of commands) {
      try {
        const result = applyCommand(code, playerId, command);
        session = result.session;
        result.affected.forEach((id) => affected.add(id));
      } catch {
        // Duplikált, elavult vagy érvénytelen parancs: állapotot nem módosít.
      }

      masterChanged = true;
      commandsToClear.push({ playerId, commandKey });
    }
  }

  if (localPresenceChanged && !masterChanged) {
    localSessionStore.replaceFromRemote(session);
  }

  if (masterChanged) {
    await persistState(session, affected, commandsToClear);
  }
};

const appendCommand = async (
  code: string,
  type: CommandType,
  payload?: Record<string, unknown>,
) => {
  const user = await ensureFirebaseUser();
  const playerId = currentLocalPlayerId();
  if (!playerId) throw new Error('A résztvevő azonosítója hiányzik.');

  const key = crypto.randomUUID().replace(/-/g, '');
  const command: PlayerCommand = {
    id: key,
    nonce: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };

  try {
    await updateDoc(
      playerRef(code, playerId),
      new FieldPath('commands', key),
      command,
      'lastSeenAt',
      serverTimestamp(),
    );
    emitSyncStatus('ok');
  } catch (error) {
    emitSyncStatus('error', error instanceof Error ? error.message : 'A döntést nem sikerült elküldeni.');
    return;
  }

  if (!user.uid) throw new Error('Nincs Firebase azonosító.');
};

const trainerMutation = (
  code: string,
  mutate: () => GameSession,
  playerIds?: Iterable<string>,
) => {
  const session = mutate();
  void enqueue(code, () => persistState(session, playerIds));
  return session;
};

const allPlayers = (session: GameSession) => session.players.map((player) => player.id);

const subscribeTrainer = (code: string, listener: Listener) => {
  let unsubscribeMaster: () => void = () => {};
  let unsubscribePlayers: () => void = () => {};
  const unsubscribeLocal = localSessionStore.subscribe(code, listener);
  let disposed = false;
  let playersStarted = false;

  const startPlayersListener = () => {
    if (disposed || playersStarted) return;
    playersStarted = true;
    unsubscribePlayers = onSnapshot(
      playersRef(code),
      (snapshot) => {
        const map = new Map<string, RemotePlayer>();
        snapshot.docs.forEach((item) => map.set(item.id, item.data() as RemotePlayer));
        remotePlayers.set(code, map);
        void enqueue(code, () => processRemotePlayers(code));
      },
      () => {
        playersStarted = false;
        window.setTimeout(startPlayersListener, 750);
      },
    );
  };

  void ensureFirebaseUser().then((user) => {
    if (disposed) return;

    let snapshotSequence = 0;
    unsubscribeMaster = onSnapshot(
      gameRef(code),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as RemoteGame;
        if (data.trainerUid !== user.uid) return;
        const sequence = ++snapshotSequence;
        void decodeSession(data).then((session) => {
          if (disposed || sequence !== snapshotSequence || !session) return;
          localSessionStore.replaceFromRemote(session);

          // Régi játékoknál a production rules még a legacy session.roundKey mezőt nézik.
          // Egyszeri önjavítás: a tréner megnyitásakor pótoljuk, ha hiányzik vagy eltér.
          if (data.session?.roundKey !== session.roundKey) {
            void enqueue(code, () => persistState(session));
          }

          startPlayersListener();
        });
      },
      () => {
        // Az új játék létrehozásának rövid versenyhelyzetét az afterCreate is kivédi.
      },
    );
  });

  return () => {
    disposed = true;
    unsubscribeMaster();
    unsubscribePlayers();
    unsubscribeLocal();
  };
};

const subscribePlayer = (code: string, listener: Listener) => {
  let unsubscribe: () => void = () => {};
  let disposed = false;
  const playerId = currentLocalPlayerId();
  const cached = playerId ? readPlayerProjection(code, playerId) : null;
  listener(cached);

  void ensureFirebaseUser().then(() => {
    if (disposed || !playerId) return;
    unsubscribe = onSnapshot(playerRef(code, playerId), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as RemotePlayer;
      if (!data.view) return;
      cachePlayerProjection(code, playerId, data.view);
      listener(data.view);
    });
  });

  return () => {
    disposed = true;
    unsubscribe();
  };
};

export const firebaseSessionStore = {
  ready() {
    return ensureFirebaseUser().then(() => undefined);
  },

  async afterCreate(session: GameSession) {
    const pending = creationPromises.get(session.code);
    if (pending) await pending;
    return session;
  },

  async afterJoin(code: string, playerId: string) {
    const key = code.toUpperCase() + ':' + playerId;
    const pending = joinPromises.get(key);
    if (pending) await pending;
    return readPlayerProjection(code, playerId);
  },

  async resumePlayer(code: string, playerId: string) {
    const user = await ensureFirebaseUser();
    const normalized = code.toUpperCase();
    const snapshot = await getDoc(playerRef(normalized, playerId));
    if (!snapshot.exists()) return null;

    const data = snapshot.data() as RemotePlayer;
    if (data.authUid !== user.uid || data.playerId !== playerId) return null;

    const view = data.view ?? readPlayerProjection(normalized, playerId);
    if (!view) return null;

    cachePlayerProjection(normalized, playerId, view);
    await updateDoc(playerRef(normalized, playerId), {
      lastSeenAt: serverTimestamp(),
    });
    emitSyncStatus('ok');

    const ownPlayer = view.players.find((player) => player.id === playerId);
    return {
      session: view,
      name: ownPlayer?.name ?? data.name ?? '',
    };
  },

  resolvePlayerId(playerId: string) {
    if (!firebaseAuth.currentUser) throw new Error('A Firebase kapcsolat még nem áll készen.');
    return playerId;
  },

  async prepareJoin(code: string) {
    await ensureFirebaseUser();
    const normalized = code.toUpperCase();
    const snapshot = await getDoc(publicGameRef(normalized));
    if (!snapshot.exists()) throw new Error('Nincs ilyen játék.');
    const info = snapshot.data() as PublicGame;
    publicGameCache.set(normalized, info);
    if (info.status !== 'lobby' || info.roundKey !== 'lobby') throw new Error('Ez a játék már elindult.');
    if (info.joinedCount >= info.expectedPlayerCount) throw new Error('A játék létszáma betelt.');
  },

  replaceFromRemote(session: GameSession) {
    return localSessionStore.replaceFromRemote(session);
  },

  create(startingCredit: number, expectedPlayerCount = 2) {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('A Firebase kapcsolat még nem áll készen.');
    const session = localSessionStore.create(startingCredit, expectedPlayerCount);
    const creation = enqueue(session.code, () => persistState(session));
    creationPromises.set(session.code, creation);
    void creation.finally(() => creationPromises.delete(session.code));
    return session;
  },

  get(code: string) {
    if (role() === 'player') {
      const playerId = currentLocalPlayerId();
      return playerId ? readPlayerProjection(code, playerId) : null;
    }
    return localSessionStore.get(code);
  },

  setExpectedPlayerCount(code: string, count: number) {
    const session = localSessionStore.setExpectedPlayerCount(code, count);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  join(code: string, playerId: string, name: string) {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('A Firebase kapcsolat még nem áll készen.');
    const normalized = code.toUpperCase();
    const info = publicGameCache.get(normalized);
    const placeholder = placeholderSession(normalized, playerId, name, info);
    cachePlayerProjection(normalized, playerId, placeholder);
    const key = normalized + ':' + playerId;
    const joining = setDoc(playerRef(normalized, playerId), {
      playerId,
      authUid: user.uid,
      name,
      joinedAt: new Date().toISOString(),
      lastSeenAt: serverTimestamp(),
      commands: {},
    }, { merge: true }).then(() => undefined);
    joinPromises.set(key, joining);
    void joining.finally(() => joinPromises.delete(key));
    return placeholder;
  },

  touchPlayer(code: string, playerId: string) {
    if (role() === 'player') {
      void updateDoc(playerRef(code, playerId), { lastSeenAt: serverTimestamp() }).catch(() => undefined);
      return this.get(code);
    }
    return localSessionStore.touchPlayer(code, playerId);
  },

  touchPlayers(code: string, playerIds: string[]) {
    return localSessionStore.touchPlayers(code, playerIds);
  },

  isPlayerOnline: localSessionStore.isPlayerOnline,

  startGame(code: string) {
    const session = localSessionStore.startGame(code);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  nextRound(code: string) {
    const session = localSessionStore.nextRound(code);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  getPairingForPlayer: localSessionStore.getPairingForPlayer,

  setPlayerBotControl(code: string, playerId: string, enabled: boolean) {
    const session = localSessionStore.setPlayerBotControl(code, playerId, enabled);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  ackStrategicTaskVisible(code: string, playerId: string) {
    if (role() === 'player') {
      void appendCommand(code, 'ackStrategicTaskVisible');
      return this.get(code) as GameSession;
    }
    const session = localSessionStore.ackStrategicTaskVisible(code, playerId);
    return trainerMutation(code, () => session, [playerId]);
  },

  markStrategicSubmitIntent(code: string, playerId: string) {
    if (role() === 'player') {
      void appendCommand(code, 'markStrategicSubmitIntent');
      return this.get(code) as GameSession;
    }
    const session = localSessionStore.markStrategicSubmitIntent(code, playerId);
    return trainerMutation(code, () => session, [playerId]);
  },

  reopenTechnicalDecision(code: string, pairingId: string, playerId: string) {
    const session = localSessionStore.reopenTechnicalDecision(code, pairingId, playerId);
    return trainerMutation(code, () => session, [playerId]);
  },

  submitStrategicDecision(
    code: string,
    playerId: string,
    payload: { type: GameSession['decisions'][number]['type']; amount?: number; accepted?: boolean },
  ) {
    if (role() === 'player') {
      void appendCommand(code, 'submitStrategicDecision', payload);
      return this.get(code) as GameSession;
    }
    const before = localSessionStore.get(code);
    const affected = before ? affectedPairPlayers(before, playerId) : [playerId];
    const session = localSessionStore.submitStrategicDecision(code, playerId, payload);
    return trainerMutation(code, () => session, affected);
  },

  strategicDeadlineAt: localSessionStore.strategicDeadlineAt,
  ultimatumDeadlineAt: localSessionStore.ultimatumDeadlineAt,

  reconcileStrategicTimeouts(code: string, nowMs = Date.now()) {
    if (role() === 'player') return this.get(code) as GameSession;
    const before = localSessionStore.get(code);
    if (!before) throw new Error('A játék nem található.');
    const decisionCount = before.decisions.length;
    const issueCount = before.strategicTechnicalIssues.length;
    const session = localSessionStore.reconcileStrategicTimeouts(code, nowMs);
    if (session.decisions.length !== decisionCount || session.strategicTechnicalIssues.length !== issueCount) {
      return trainerMutation(code, () => session, allPlayers(session));
    }
    return session;
  },

  roundProgress: localSessionStore.roundProgress,

  closeStrategicRound(code: string) {
    const session = localSessionStore.closeStrategicRound(code);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  correctPlayerBalance(code: string, playerId: string, newBalance: number, note: string) {
    const session = localSessionStore.correctPlayerBalance(code, playerId, newBalance, note);
    return trainerMutation(code, () => session, [playerId]);
  },

  correctStrategicDecision(code: string, roundKey: StrategicRound, playerId: string, value: number | boolean, note: string) {
    const before = localSessionStore.get(code);
    const affected = before ? affectedPairPlayers(before, playerId) : [playerId];
    const session = localSessionStore.correctStrategicDecision(code, roundKey, playerId, value, note);
    return trainerMutation(code, () => session, affected);
  },

  correctPublicGoodsContribution(code: string, roundNumber: number, playerId: string, newAmount: number, note: string) {
    const session = localSessionStore.correctPublicGoodsContribution(code, roundNumber, playerId, newAmount, note);
    const group = session.groups.find((item) => item.memberIds.includes(playerId));
    return trainerMutation(code, () => session, group?.memberIds ?? [playerId]);
  },

  randomizeGroups(code: string, count: number) {
    const session = localSessionStore.randomizeGroups(code, count);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  createManualGroups(code: string, count: number) {
    const session = localSessionStore.createManualGroups(code, count);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  setPlayerGroup(code: string, playerId: string, groupId: string) {
    const session = localSessionStore.setPlayerGroup(code, playerId, groupId);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  togglePinnedDebriefEvent(code: string, eventId: string) {
    const session = localSessionStore.togglePinnedDebriefEvent(code, eventId);
    return trainerMutation(code, () => session);
  },

  setGroupMinimum(code: string, groupId: string, mode: Parameters<typeof localSessionStore.setGroupMinimum>[2], customMinimum?: number) {
    const session = localSessionStore.setGroupMinimum(code, groupId, mode, customMinimum);
    const group = session.groups.find((item) => item.id === groupId);
    return trainerMutation(code, () => session, group?.memberIds ?? []);
  },

  groupWealth: localSessionStore.groupWealth,
  minimumForGroup: localSessionStore.minimumForGroup,

  startPublicGoodsRound(code: string) {
    const session = localSessionStore.startPublicGoodsRound(code);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  submitPublicGoods(code: string, playerId: string, amount: number) {
    if (role() === 'player') {
      void appendCommand(code, 'submitPublicGoods', { amount });
      return this.get(code) as GameSession;
    }
    const session = localSessionStore.submitPublicGoods(code, playerId, amount);
    return trainerMutation(code, () => session, [playerId]);
  },

  publicGoodsProgress: localSessionStore.publicGoodsProgress,
  publicGoodsSecondsLeft: localSessionStore.publicGoodsSecondsLeft,
  canEditPublicGoods: localSessionStore.canEditPublicGoods,

  lockPublicGoodsRound(code: string) {
    const session = localSessionStore.lockPublicGoodsRound(code);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  settlePublicGoodsRound(code: string) {
    const session = localSessionStore.settlePublicGoodsRound(code);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  resumePublicGoodsAfterReport(code: string) {
    const session = localSessionStore.resumePublicGoodsAfterReport(code);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  finish(code: string) {
    const session = localSessionStore.finish(code);
    return trainerMutation(code, () => session, allPlayers(session));
  },

  submitReflection(code: string, playerId: string, items: Array<{ decisionId: string; comment: string }>) {
    if (role() === 'player') {
      void appendCommand(code, 'submitReflection', { items });
      return this.get(code) as GameSession;
    }
    const session = localSessionStore.submitReflection(code, playerId, items);
    return trainerMutation(code, () => session, [playerId]);
  },

  subscribe(code: string, listener: Listener) {
    return role() === 'player'
      ? subscribePlayer(code.toUpperCase(), listener)
      : subscribeTrainer(code.toUpperCase(), listener);
  },
};
