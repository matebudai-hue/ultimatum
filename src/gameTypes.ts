export type GameId = 'ultimatum' | 'dictator' | 'trust' | 'publicGoods';

export type Player = {
  id: string;
  name: string;
  currentBalance: number;
  active: boolean;
};

export type Pairing = {
  id: string;
  gameId: Exclude<GameId, 'publicGoods'>;
  roundNumber: number;
  playerA: string;
  playerB: string | 'BOT';
  roleA: 'proposer' | 'dictator' | 'sender' | 'receiver' | 'returner';
  roleB: 'receiver' | 'returner' | 'BOT';
  playerBIsBot: boolean;
};

export type Decision = {
  id: string;
  pairingId: string;
  playerId: string | 'BOT';
  type:
    | 'ultimatum_offer'
    | 'ultimatum_response'
    | 'dictator_give'
    | 'trust_send'
    | 'trust_return'
    | 'public_goods_contribution';
  amount?: number;
  accepted?: boolean;
  isBotDecision?: boolean;
};

export type Transaction = {
  id: string;
  playerId: string;
  amount: number;
  reason: string;
  balanceBefore: number;
  balanceAfter: number;
};

export type PublicGoodsRound = {
  roundNumber: number;
  minimumAmount?: number;
  trainerMessage: string;
  contributions: Record<string, number>;
  totalContribution: number;
  success?: boolean;
  payoutPerPlayer?: number;
};

export const STARTING_ROUND_BANK = 1_000_000;
