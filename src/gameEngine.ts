import { Pairing, Player, STARTING_ROUND_BANK, Transaction } from './gameTypes';

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const botUltimatumOffer = (humanOffers: number[], previousMedian?: number): number => {
  if (humanOffers.length > 0) return median(humanOffers);
  return previousMedian ?? 500_000;
};

export const botUltimatumAccepts = (offer: number, humanOffers: number[]): boolean => {
  const baseMedian = humanOffers.length > 0 ? median(humanOffers) : 500_000;
  const threshold = clamp(Math.round(baseMedian * 0.8), 250_000, 450_000);
  return offer >= threshold;
};

export const botGiveAmount = (humanGives: number[], previousMedian?: number): number => {
  if (humanGives.length > 0) return median(humanGives);
  return previousMedian ?? 400_000;
};

export const botTrustSend = (humanSends: number[], previousMedian?: number): number => {
  if (humanSends.length > 0) return median(humanSends);
  return previousMedian ?? 500_000;
};

export const botTrustReturn = (tripledAmount: number, humanReturnRatios: number[]): number => {
  const ratio = humanReturnRatios.length > 0 ? median(humanReturnRatios) / 100 : 0.5;
  return Math.round(tripledAmount * ratio);
};

export const settleUltimatum = (players: Player[], pairing: Pairing, offer: number, accepted: boolean): Transaction[] => {
  const proposerAmount = accepted ? STARTING_ROUND_BANK - offer : 0;
  const rows = [{ playerId: pairing.playerA, amount: proposerAmount, reason: accepted ? 'ultimatum_proposer_paid' : 'ultimatum_rejected' }];
  if (pairing.playerB !== 'BOT') rows.push({ playerId: pairing.playerB, amount: accepted ? offer : 0, reason: accepted ? 'ultimatum_receiver_paid' : 'ultimatum_rejected' });
  return makeTransactions(players, rows);
};

export const settleOneWayGive = (players: Player[], pairing: Pairing, givenAmount: number): Transaction[] => {
  const rows = [{ playerId: pairing.playerA, amount: STARTING_ROUND_BANK - givenAmount, reason: 'one_way_keep' }];
  if (pairing.playerB !== 'BOT') rows.push({ playerId: pairing.playerB, amount: givenAmount, reason: 'one_way_receive' });
  return makeTransactions(players, rows);
};

export const settleTrust = (players: Player[], pairing: Pairing, sentAmount: number, returnedAmount: number): Transaction[] => {
  const senderAmount = STARTING_ROUND_BANK - sentAmount + returnedAmount;
  const receiverAmount = sentAmount * 3 - returnedAmount;
  const rows = [{ playerId: pairing.playerA, amount: senderAmount, reason: 'trust_sender_result' }];
  if (pairing.playerB !== 'BOT') rows.push({ playerId: pairing.playerB, amount: receiverAmount, reason: 'trust_receiver_result' });
  return makeTransactions(players, rows);
};

export const settlePublicGoods = (players: Player[], contributions: Record<string, number>, minimumAmount?: number) => {
  const totalContribution = Object.values(contributions).reduce((sum, value) => sum + value, 0);
  const success = minimumAmount === undefined || totalContribution >= minimumAmount;
  const payoutPerPlayer = success ? Math.round((totalContribution * 2) / players.length) : 0;
  const transactions = players.map((player) => makeTransaction(player, -(contributions[player.id] ?? 0) + payoutPerPlayer, success ? 'public_goods_payout' : 'public_goods_failed_loss'));
  return { success, totalContribution, payoutPerPlayer, transactions };
};

export const applyTransactions = (players: Player[], transactions: Transaction[]): Player[] => {
  const amountByPlayer = new Map<string, number>();
  for (const transaction of transactions) amountByPlayer.set(transaction.playerId, (amountByPlayer.get(transaction.playerId) ?? 0) + transaction.amount);
  return players.map((player) => ({ ...player, currentBalance: player.currentBalance + (amountByPlayer.get(player.id) ?? 0) }));
};

const makeTransactions = (players: Player[], rows: { playerId: string; amount: number; reason: string }[]): Transaction[] => rows.map((row) => {
  const player = players.find((item) => item.id === row.playerId);
  if (!player) throw new Error(`Unknown player: ${row.playerId}`);
  return makeTransaction(player, row.amount, row.reason);
});

const makeTransaction = (player: Player, amount: number, reason: string): Transaction => ({
  id: crypto.randomUUID(),
  playerId: player.id,
  amount,
  reason,
  balanceBefore: player.currentBalance,
  balanceAfter: player.currentBalance + amount,
});
