import { DebriefGame, InterestingEvent, InterestingEventKind } from './debriefEngine';

export type DebriefStoryGroup = {
  id: string;
  label: string;
  events: InterestingEvent[];
};

export type DebriefGameGroup = {
  game: DebriefGame;
  label: string;
  count: number;
  stories: DebriefStoryGroup[];
};

const gameOrder: DebriefGame[] = ['ultimatum', 'dictator', 'trust', 'publicGoods'];

const gameLabels: Record<DebriefGame, string> = {
  ultimatum: 'Ultimátum',
  dictator: 'Diktátor',
  trust: 'Bizalom',
  publicGoods: 'Közös kassza',
};

const storyByKind: Record<InterestingEventKind, { id: string; label: string }> = {
  ultimatum_rejection: { id: 'ultimatum-rejections', label: 'Elutasított ajánlatok' },
  ultimatum_acceptance_boundary: { id: 'ultimatum-boundary', label: 'Elfogadási határ' },
  ultimatum_extreme_offer: { id: 'ultimatum-extremes', label: 'Szélső ajánlatok' },

  dictator_extreme_give: { id: 'dictator-extremes', label: 'Szélső átadások' },
  ultimatum_dictator_shift: { id: 'dictator-shifts', label: 'Nagy változás az Ultimátumhoz képest' },

  trust_high_high: { id: 'trust-high-high', label: 'Nagy bizalom + erős viszonzás' },
  trust_high_low: { id: 'trust-high-low', label: 'Nagy bizalom + gyenge viszonzás' },
  trust_low_high: { id: 'trust-low-high', label: 'Kis bizalom + erős viszonzás' },
  trust_near_equal_outcome: { id: 'trust-near-equal', label: 'Közel azonos végeredmény' },
  trust_extreme: { id: 'trust-extremes', label: 'Szélső bizalmi döntések' },

  pool_personal_vs_group_share: { id: 'pool-personal-vs-group', label: 'Saját áldozat vs. közös súly' },
  pool_high_contribution_net_loss: { id: 'pool-net-effect', label: 'Nettó veszteség / nettó nyereség' },
  pool_low_contribution_net_gain: { id: 'pool-net-effect', label: 'Nettó veszteség / nettó nyereség' },
  pool_pivotal_minimum: { id: 'pool-pivotal', label: 'Minimumhoz döntő hozzájárulás' },
  pool_large_shift: { id: 'pool-shifts', label: 'Nagy változás két kör között' },
  pool_group_minimum_transition: { id: 'pool-group-transition', label: 'Csoportszintű fordulat' },
};

const roundWeight = (event: InterestingEvent) => {
  if (event.game === 'publicGoods') return 100 + (event.publicGoodsRound ?? 0);
  const round = String(event.roundKey);
  const number = Number(round.replace(/\D/g, '')) || 0;
  const suffix = round.endsWith('b') ? 1 : 0;
  return number * 2 + suffix;
};

const sortStrongestFirst = (a: InterestingEvent, b: InterestingEvent) =>
  a.priority - b.priority ||
  roundWeight(b) - roundWeight(a) ||
  a.id.localeCompare(b.id);

export const buildDebriefEventGroups = (events: InterestingEvent[]): DebriefGameGroup[] =>
  gameOrder.flatMap((game) => {
    const gameEvents = events.filter((event) => event.game === game);
    if (gameEvents.length === 0) return [];

    const storyMap = new Map<string, DebriefStoryGroup>();
    for (const event of gameEvents) {
      const config = storyByKind[event.kind];
      const existing = storyMap.get(config.id);
      if (existing) {
        existing.events.push(event);
      } else {
        storyMap.set(config.id, {
          id: config.id,
          label: config.label,
          events: [event],
        });
      }
    }

    const stories = [...storyMap.values()]
      .map((story) => ({
        ...story,
        events: [...story.events].sort(sortStrongestFirst),
      }))
      .sort((a, b) => {
        const aPriority = Math.min(...a.events.map((event) => event.priority));
        const bPriority = Math.min(...b.events.map((event) => event.priority));
        return aPriority - bPriority || b.events.length - a.events.length || a.label.localeCompare(b.label, 'hu');
      });

    return [{
      game,
      label: gameLabels[game],
      count: gameEvents.length,
      stories,
    }];
  });
