import { ParticipantReflection, ParticipantSelfReportItem } from './gameTypes';

const formatNumber = (value: number) =>
  new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 })
    .format(Math.round(value))
    .replace(/[\u00A0\u202F]/g, ' ');

const credits = (value: number) => formatNumber(value) + ' kredit';

const signedCredits = (value: number) =>
  (value > 0 ? '+' : '') + formatNumber(value) + ' kredit';

export const selfReportItemText = (item: ParticipantSelfReportItem): string[] => {
  if (item.game === 'ultimatum') {
    const main = item.role === 'proposer'
      ? `${credits(item.amount ?? 0)} ajánlat`
      : `${credits(item.amount ?? 0)} ajánlat érkezett`;
    const result = item.accepted
      ? (item.role === 'proposer' ? 'Elfogadták' : 'Elfogadtad')
      : (item.role === 'proposer' ? 'Elutasították' : 'Elutasítottad');
    return [item.roundLabel, main, result];
  }

  if (item.game === 'dictator') {
    return [
      item.roundLabel,
      `${credits(item.amount ?? 0)} átadva`,
      `${credits(item.keptAmount ?? 0)} maradt nálad`,
    ];
  }

  if (item.game === 'trust') {
    if (item.role === 'sender') {
      return [
        item.roundLabel,
        `${credits(item.sentAmount ?? 0)} elküldve → ${credits(item.multipliedAmount ?? 0)} a bank után`,
        `${credits(item.returnedAmount ?? 0)} érkezett vissza`,
      ];
    }
    return [
      item.roundLabel,
      `${credits(item.multipliedAmount ?? 0)} került hozzád`,
      `${credits(item.returnedAmount ?? 0)} visszaadva · ${credits(item.keptAmount ?? 0)} maradt nálad`,
    ];
  }

  return [
    item.roundLabel,
    `${credits(item.contributionAmount ?? 0)} befizetés`,
    `saját vagyon ${item.ownWealthPercent ?? '–'}% · közös kassza ${item.potPercent ?? '–'}% · nettó ${signedCredits(item.netAmount ?? 0)}`,
  ];
};

export const buildSelfReportShareText = (
  playerName: string,
  report: ParticipantSelfReportItem[],
  reflections: ParticipantReflection[],
  summary?: { firstStage: number; publicGoodsResult: number; finalWealth: number },
): string => {
  const reflectionByDecision = new Map(reflections.map((item) => [item.decisionId, item]));
  const lines = [
    'KREDITJÁTÉK – SAJÁT RIPORT',
    playerName ? playerName : '',
    '',
  ].filter((line, index) => line || index !== 1);

  if (summary) {
    lines.push(
      'ÖSSZESÍTÉS',
      `Az első három játék után: ${credits(summary.firstStage)}`,
      `Közös kassza eredménye: ${signedCredits(summary.publicGoodsResult)}`,
      `Végső vagyon: ${credits(summary.finalWealth)}`,
      '',
    );
  }

  for (const item of report) {
    lines.push(...selfReportItemText(item));
    const reflection = reflectionByDecision.get(item.id);
    if (reflection) {
      lines.push(`Mi célból döntöttél így? ${reflection.comment}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
};
