import { Pairing, StrategicRound } from './gameTypes';

export const STRATEGIC_ROUNDS: StrategicRound[] = ['1a', '1b', '2a', '2b', '3a', '3b'];

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const gameForRound = (roundKey: StrategicRound): Pairing['gameId'] => {
  if (roundKey.startsWith('1')) return 'ultimatum';
  if (roundKey.startsWith('2')) return 'dictator';
  return 'trust';
};

const rolesFor = (gameId: Pairing['gameId']) => {
  if (gameId === 'ultimatum') return { roleA: 'proposer' as const, roleB: 'receiver' as const };
  if (gameId === 'dictator') return { roleA: 'dictator' as const, roleB: 'receiver' as const };
  return { roleA: 'sender' as const, roleB: 'returner' as const };
};

type Edge = [string, string];

export function roundRobinMatchings(playerIds: string[]): Edge[][] {
  const nodes = shuffle(playerIds.length % 2 === 1 ? [...playerIds, 'BOT'] : [...playerIds]);
  if (nodes.length < 2) return [];

  const schedule: Edge[][] = [];
  let ring = [...nodes];

  for (let round = 0; round < nodes.length - 1; round += 1) {
    const edges: Edge[] = [];
    for (let i = 0; i < ring.length / 2; i += 1) {
      edges.push([ring[i], ring[ring.length - 1 - i]]);
    }
    schedule.push(edges);
    ring = [ring[0], ring[ring.length - 1], ...ring.slice(1, ring.length - 1)];
  }

  return schedule;
}

function twoColor(matchA: Edge[], matchB: Edge[]): Map<string, 0 | 1> {
  const adjacency = new Map<string, string[]>();
  for (const [a, b] of [...matchA, ...matchB]) {
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  }

  const color = new Map<string, 0 | 1>();
  for (const node of adjacency.keys()) {
    if (color.has(node)) continue;
    color.set(node, 0);
    const queue = [node];

    while (queue.length) {
      const current = queue.shift()!;
      const currentColor = color.get(current)!;
      for (const next of adjacency.get(current) ?? []) {
        if (!color.has(next)) {
          color.set(next, currentColor === 0 ? 1 : 0);
          queue.push(next);
        }
      }
    }
  }
  return color;
}

function orientedPairings(matchA: Edge[], matchB: Edge[], roundA: StrategicRound, roundB: StrategicRound): Pairing[] {
  const gameId = gameForRound(roundA);
  const roles = rolesFor(gameId);
  const color = twoColor(matchA, matchB);

  const orient = (edges: Edge[], roundKey: StrategicRound, senderColor: 0 | 1) =>
    edges.map(([x, y]) => {
      const playerA = color.get(x) === senderColor ? x : y;
      const playerB = playerA === x ? y : x;
      return {
        id: crypto.randomUUID(),
        gameId,
        roundKey,
        playerA,
        playerB,
        roleA: roles.roleA,
        roleB: roles.roleB,
        playerAIsBot: playerA === 'BOT',
        playerBIsBot: playerB === 'BOT',
      } satisfies Pairing;
    });

  return [...orient(matchA, roundA, 0), ...orient(matchB, roundB, 1)];
}

export function buildSixRoundPairingSchedule(playerIds: string[]): Pairing[] {
  if (playerIds.length < 2) throw new Error('Legalább 2 játékos kell.');
  const matchings = roundRobinMatchings(playerIds);
  if (matchings.length === 0) return [];

  const pick = (index: number) => matchings[index % matchings.length];
  return [
    ...orientedPairings(pick(0), pick(1), '1a', '1b'),
    ...orientedPairings(pick(2), pick(3), '2a', '2b'),
    ...orientedPairings(pick(4), pick(5), '3a', '3b'),
  ];
}

export function pairingRepeatStats(pairings: Pairing[]) {
  const counts = new Map<string, number>();
  for (const pairing of pairings) {
    const key = [pairing.playerA, pairing.playerB].sort().join('|');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeatedPairs = [...counts.values()].filter((count) => count > 1);
  return {
    repeatedPairCount: repeatedPairs.length,
    maximumRepeat: repeatedPairs.length ? Math.max(...repeatedPairs) : 1,
  };
}
