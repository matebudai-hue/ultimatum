import { Pairing, Player, RoundKey, Transaction } from './gameTypes';

const average = (values: number[]): number =>
  values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const botUltimatumOffer = (humanOffers: number[], startingCredit: number, previousMedian?: number): number =>
  humanOffers.length > 0 ? average(humanOffers) : previousMedian ?? Math.round(startingCredit * 0.5);

export const botUltimatumAccepts = (offer: number, startingCredit: number, humanOffers: number[]): boolean => {
  const baseMedian = humanOffers.length > 0 ? average(humanOffers) : Math.round(startingCredit * 0.5);
  const threshold = clamp(Math.round(baseMedian * 0.8), Math.round(startingCredit * 0.25), Math.round(startingCredit * 0.45));
  return offer >= threshold;
};

export const botGiveAmount = (humanGives: number[], startingCredit: number, previousMedian?: number): number =>
  humanGives.length > 0 ? average(humanGives) : previousMedian ?? Math.round(startingCredit * 0.4);

export const botTrustSend = (humanSends: number[], startingCredit: number, previousMedian?: number): number =>
  humanSends.length > 0 ? average(humanSends) : previousMedian ?? Math.round(startingCredit * 0.5);

export const botTrustReturn = (tripledAmount: number, humanReturnRatios: number[]): number => {
  const ratio = humanReturnRatios.length > 0 ? average(humanReturnRatios) / 100 : 0.5;
  return Math.round(tripledAmount * ratio);
};

export const settleUltimatum = (
  players: Player[],
  pairing: Pairing,
  offer: number,
  accepted: boolean,
  startingCredit: number,
): Transaction[] => {
  const rows = [
    { playerId: pairing.playerA, amount: accepted ? startingCredit - offer : 0, reason: accepted ? 'ultimatum_proposer_paid' : 'ultimatum_rejected' },
    { playerId: pairing.playerB, amount: accepted ? offer : 0, reason: accepted ? 'ultimatum_receiver_paid' : 'ultimatum_rejected' },
  ];
  return makeTransactions(players, pairing.roundKey, rows);
};

export const settleOneWayGive = (
  players: Player[],
  pairing: Pairing,
  givenAmount: number,
  startingCredit: number,
): Transaction[] => {
  const rows = [
    { playerId: pairing.playerA, amount: startingCredit - givenAmount, reason: 'dictator_keep' },
    { playerId: pairing.playerB, amount: givenAmount, reason: 'dictator_receive' },
  ];
  return makeTransactions(players, pairing.roundKey, rows);
};

export const settleTrust = (
  players: Player[],
  pairing: Pairing,
  sentAmount: number,
  returnedAmount: number,
  startingCredit: number,
): Transaction[] => {
  const rows = [
    { playerId: pairing.playerA, amount: startingCredit - sentAmount + returnedAmount, reason: 'trust_sender_result' },
    { playerId: pairing.playerB, amount: sentAmount * 3 - returnedAmount, reason: 'trust_receiver_result' },
  ];
  return makeTransactions(players, pairing.roundKey, rows);
};

export const settlePublicGoods = (
  players: Player[],
  contributions: Record<string, number>,
  roundKey: RoundKey,
  minimumAmount?: number,
) => {
  const humans = players.filter((player) => !player.isBot);
  const totalContribution = Object.values(contributions).reduce((sum, value) => sum + value, 0);
  const success = minimumAmount === undefined || totalContribution >= minimumAmount;
  const payoutPerPlayer = success && humans.length > 0 ? Math.round((totalContribution * 2) / humans.length) : 0;
  const transactions = humans.map((player) =>
    makeTransaction(player, roundKey, -(contributions[player.id] ?? 0) + payoutPerPlayer, success ? 'public_goods_payout' : 'public_goods_failed_loss'),
  );
  return { success, totalContribution, payoutPerPlayer, transactions };
};

export const applyTransactions = (players: Player[], transactions: Transaction[]): Player[] => {
  const amountByPlayer = new Map<string, number>();
  for (const transaction of transactions) amountByPlayer.set(transaction.playerId, (amountByPlayer.get(transaction.playerId) ?? 0) + transaction.amount);
  return players.map((player) => ({ ...player, currentBalance: player.currentBalance + (amountByPlayer.get(player.id) ?? 0) }));
};

const makeTransactions = (
  players: Player[],
  roundKey: RoundKey,
  rows: { playerId: string; amount: number; reason: string }[],
): Transaction[] => rows
  .filter((row) => row.playerId !== 'BOT')
  .map((row) => {
    const player = players.find((item) => item.id === row.playerId);
    if (!player) throw new Error(`Unknown player: ${row.playerId}`);
    return makeTransaction(player, roundKey, row.amount, row.reason);
  });

const makeTransaction = (player: Player, roundKey: RoundKey, amount: number, reason: string): Transaction => ({
  id: crypto.randomUUID(),
  playerId: player.id,
  roundKey,
  amount,
  reason,
  balanceBefore: player.currentBalance,
  balanceAfter: player.currentBalance + amount,
  createdAt: new Date().toISOString(),
});
