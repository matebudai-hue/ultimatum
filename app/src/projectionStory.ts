import { GameSession } from './gameTypes';
import { InterestingEvent } from './debriefEngine';

export type ProjectionStory = {
  eventId: string;
  roundLabel: string;
  title: string;
  steps: string[];
  comments: string[];
};

const credits = (value: number) =>
  new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 })
    .format(Math.round(value))
    .replace(/[\u00A0\u202F]/g, ' ') + ' kredit';

const signedCredits = (value: number) =>
  (value > 0 ? '+' : '') + credits(value);

const factNumber = (event: InterestingEvent, key: string) => {
  const value = event.facts[key];
  return typeof value === 'number' ? value : undefined;
};

const roundLabel = (event: InterestingEvent) =>
  event.game === 'publicGoods'
    ? `Közös kassza · ${event.publicGoodsRound ?? ''}. kör`
    : event.roundKey.toUpperCase();

export const buildProjectionStory = (
  session: GameSession,
  event: InterestingEvent,
): ProjectionStory => {
  const steps: string[] = [];

  if (event.kind === 'ultimatum_rejection' || event.kind === 'ultimatum_extreme_offer') {
    const offer = factNumber(event, 'offer') ?? 0;
    steps.push(`Ajánlat: ${credits(offer)}`);
    if (event.kind === 'ultimatum_rejection') {
      steps.push('ELUTASÍTVA');
      steps.push('Ajánlattevő: 0 kredit · Fogadó: 0 kredit');
    } else if (typeof event.facts.accepted === 'boolean') {
      steps.push(event.facts.accepted ? 'ELFOGADVA' : 'ELUTASÍTVA');
    }
  } else if (event.kind === 'ultimatum_acceptance_boundary') {
    const rejected = factNumber(event, 'highestRejected');
    const accepted = factNumber(event, 'lowestAccepted');
    if (rejected !== undefined) steps.push(`Legmagasabb elutasított ajánlat: ${credits(rejected)}`);
    if (accepted !== undefined) steps.push(`Legalacsonyabb elfogadott ajánlat: ${credits(accepted)}`);
  } else if (event.kind === 'dictator_extreme_give') {
    const amount = factNumber(event, 'amount') ?? 0;
    steps.push(`Átadott összeg: ${credits(amount)}`);
  } else if (event.kind === 'ultimatum_dictator_shift') {
    const ultimatum = factNumber(event, 'ultimatumAmount');
    const dictator = factNumber(event, 'dictatorAmount');
    const shift = factNumber(event, 'shiftPercentagePoints');
    if (ultimatum !== undefined) steps.push(`Ultimátum: ${credits(ultimatum)}`);
    if (dictator !== undefined) steps.push(`Diktátor: ${credits(dictator)}`);
    if (shift !== undefined) steps.push(`Változás: ${shift > 0 ? '+' : ''}${shift} százalékpont`);
  } else if (
    event.kind === 'trust_high_high' ||
    event.kind === 'trust_high_low' ||
    event.kind === 'trust_low_high' ||
    event.kind === 'trust_near_equal_outcome'
  ) {
    const sent = factNumber(event, 'sent');
    const multiplied = factNumber(event, 'multiplied');
    const returned = factNumber(event, 'returned');
    if (sent !== undefined) steps.push(`${credits(sent)} ment oda`);
    if (multiplied !== undefined) steps.push(`Bank után: ${credits(multiplied)}`);
    if (returned !== undefined) steps.push(`${credits(returned)} jött vissza`);

    const senderOutcome = factNumber(event, 'senderOutcome');
    const returnerOutcome = factNumber(event, 'returnerOutcome');
    if (senderOutcome !== undefined && returnerOutcome !== undefined) {
      steps.push(`Végeredmény: ${credits(senderOutcome)} · ${credits(returnerOutcome)}`);
    }
  } else if (
    event.kind === 'pool_personal_vs_group_share' ||
    event.kind === 'pool_high_contribution_net_loss' ||
    event.kind === 'pool_low_contribution_net_gain'
  ) {
    const contribution = factNumber(event, 'contribution') ?? 0;
    const potPercent = factNumber(event, 'potPercent');
    const ownPercent = factNumber(event, 'ownWealthPercent');
    const payout = factNumber(event, 'payout');
    const net = factNumber(event, 'netAmount');

    steps.push(
      `${credits(contribution)} befizetés${potPercent !== undefined ? ' · a közös kassza ' + potPercent + '%-a' : ''}`,
    );
    if (ownPercent !== undefined) steps.push(`A saját vagyonának ${ownPercent}%-a`);
    if (payout !== undefined) steps.push(`Visszaosztás: ${credits(payout)}`);
    if (net !== undefined) steps.push(`Saját nettó eredmény: ${signedCredits(net)}`);
  } else if (event.kind === 'pool_pivotal_minimum') {
    const contribution = factNumber(event, 'contribution');
    const total = factNumber(event, 'totalContribution');
    const minimum = factNumber(event, 'minimumAmount');
    if (contribution !== undefined) steps.push(`Befizetés: ${credits(contribution)}`);
    if (total !== undefined && minimum !== undefined) {
      steps.push(`Közös kassza: ${credits(total)} · minimum: ${credits(minimum)}`);
    }
    steps.push('E befizetés nélkül a minimum nem teljesült volna.');
  } else if (event.kind === 'pool_large_shift') {
    const previous = factNumber(event, 'previousPercent');
    const current = factNumber(event, 'currentPercent');
    if (previous !== undefined) steps.push(`Előző kör: a saját vagyon ${previous}%-a`);
    if (current !== undefined) steps.push(`Következő kör: a saját vagyon ${current}%-a`);
  } else if (event.kind === 'pool_group_minimum_transition') {
    const previousTotal = factNumber(event, 'previousTotal');
    const previousMinimum = factNumber(event, 'previousMinimum');
    const currentTotal = factNumber(event, 'currentTotal');
    const currentMinimum = factNumber(event, 'currentMinimum');
    if (previousTotal !== undefined && previousMinimum !== undefined) {
      steps.push(`Előző kör: ${credits(previousTotal)} / minimum ${credits(previousMinimum)}`);
    }
    if (currentTotal !== undefined && currentMinimum !== undefined) {
      steps.push(`Következő kör: ${credits(currentTotal)} / minimum ${credits(currentMinimum)}`);
    }
  }

  const comments = (session.reflections ?? [])
    .filter((reflection) => event.selfDecisionIds.includes(reflection.decisionId))
    .map((reflection) => reflection.comment.trim())
    .filter(Boolean);

  return {
    eventId: event.id,
    roundLabel: roundLabel(event),
    title: event.title,
    steps: steps.length ? steps : ['Érdekes esemény'],
    comments,
  };
};
