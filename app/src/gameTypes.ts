export type GameId = 'ultimatum' | 'dictator' | 'trust' | 'publicGoods';
export type RoundKey = 'lobby' | '1a' | '1b' | '2a' | '2b' | '3a' | '3b' | '4' | 'report';
export type StrategicRound = Exclude<RoundKey, 'lobby' | '4' | 'report'>;
export type MinimumMode = 'none' | '80' | '90' | '95' | 'custom';
export type PublicGoodsPhase = 'setup' | 'open' | 'locked';

export const MAX_PLAYERS = 100;
export const PUBLIC_GOODS_SECONDS = 90;
export const STRATEGIC_DECISION_SECONDS = 60;
export const ULTIMATUM_PROPOSER_SECONDS = STRATEGIC_DECISION_SECONDS;
export const ULTIMATUM_RECEIVER_SECONDS = STRATEGIC_DECISION_SECONDS;
export const STRATEGIC_TECHNICAL_GRACE_SECONDS = 5;
export const SUBMISSION_TRANSPORT_GRACE_SECONDS = 5;
export const ULTIMATUM_TECHNICAL_GRACE_SECONDS = STRATEGIC_TECHNICAL_GRACE_SECONDS;

export type Player = {
  id: string;
  name: string;
  currentBalance: number;
  active: boolean;
  joinedAt?: string;
  online?: boolean;
  lastSeenAt?: string;
  isBot?: boolean;
  botControlled?: boolean;
};

export type Pairing = {
  id: string;
  gameId: Exclude<GameId, 'publicGoods'>;
  roundKey: StrategicRound;
  playerA: string | 'BOT';
  playerB: string | 'BOT';
  roleA: 'proposer' | 'dictator' | 'sender';
  roleB: 'receiver' | 'returner';
  playerAIsBot: boolean;
  playerBIsBot: boolean;
};

export type Decision = {
  id: string;
  pairingId?: string;
  playerId: string | 'BOT';
  roundKey: RoundKey;
  type:
    | 'ultimatum_offer'
    | 'ultimatum_response'
    | 'ultimatum_timeout'
    | 'dictator_give'
    | 'trust_send'
    | 'trust_return'
    | 'public_goods_contribution';
  amount?: number;
  accepted?: boolean;
  timedOutRole?: 'proposer' | 'receiver' | 'dictator' | 'sender' | 'returner';
  isBotDecision?: boolean;
  publicGoodsRound?: number;
  groupId?: string;
  submissionSource?: 'participant' | 'bot' | 'missing_default' | 'manual_correction';
  submittedAt: string;
  submitIntentAt?: string;
  submissionHistory?: Array<{
    amount: number;
    submittedAt: string;
  }>;
};

export type StrategicTechnicalIssue = {
  pairingId: string;
  playerId: string | 'BOT';
  roundKey: StrategicRound;
  role: 'proposer' | 'receiver' | 'dictator' | 'sender' | 'returner';
  detectedAt: string;
  resolvedAt?: string;
  resolution?: 'decision_received' | 'reopened';
};

export type ManualCorrection = {
  id: string;
  kind: 'balance' | 'strategic_decision' | 'public_goods_contribution';
  playerId: string;
  roundKey: RoundKey;
  pairingId?: string;
  publicGoodsRound?: number;
  field: string;
  beforeValue: number | boolean | null;
  afterValue: number | boolean | null;
  note: string;
  createdAt: string;
};

export type Transaction = {
  id: string;
  playerId: string;
  roundKey: RoundKey;
  amount: number;
  reason: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
};

export type PublicGoodsGroup = {
  id: string;
  name: string;
  memberIds: string[];
  nextMinimumMode: MinimumMode;
  nextCustomMinimum?: number;
};

export type PublicGoodsRound = {
  id: string;
  roundNumber: number;
  groupId: string;
  memberIds: string[];
  startingGroupWealth: number;
  startingPlayerWealth?: Record<string, number>;
  minimumMode: MinimumMode;
  minimumAmount?: number;
  contributions: Record<string, number>;
  totalContribution: number;
  status: 'open' | 'locked' | 'settled';
  success?: boolean;
  payoutPerPlayer?: number;
  settledAt?: string;
};

export type ParticipantSelfReportItem = {
  id: string;
  game: 'ultimatum' | 'dictator' | 'trust' | 'publicGoods';
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
  isBotDecision?: boolean;
  timedOutRole?: 'proposer' | 'receiver' | 'dictator' | 'sender' | 'returner';
};

export type ParticipantReflection = {
  playerId: string;
  decisionId: string;
  comment: string;
  submittedAt: string;
};

export type PublicGoodsContinuation = {
  startedAt: string;
  firstContinuationRoundNumber: number;
  baselineFinalBalance: Record<string, number>;
  restartBalance: Record<string, number>;
};

export type GameSession = {
  code: string;
  status: 'lobby' | 'active' | 'finished';
  roundKey: RoundKey;
  startingCredit: number;
  expectedPlayerCount: number;
  createdAt: string;
  roundStartedAt?: string;
  publicGoodsDeadlineAt?: string;
  players: Player[];
  pairings: Pairing[];
  decisions: Decision[];
  strategicTaskSeenAt: Record<string, string>;
  strategicSubmitIntentAt: Record<string, string>;
  strategicTechnicalIssues: StrategicTechnicalIssue[];
  manualCorrections: ManualCorrection[];
  transactions: Transaction[];
  closedRounds: StrategicRound[];
  groups: PublicGoodsGroup[];
  firstStageFinalBalance: Record<string, number>;
  publicGoodsRoundNumber: number;
  publicGoodsPhase: PublicGoodsPhase;
  publicGoodsRounds: PublicGoodsRound[];
  publicGoodsContinuation?: PublicGoodsContinuation;
  pinnedDebriefEventIds?: string[];
  debriefPhase?: 'reflection' | 'complete';
  reflections?: ParticipantReflection[];
  selfReport?: ParticipantSelfReportItem[];
};

export const ROUND_ORDER: RoundKey[] = ['lobby', '1a', '1b', '2a', '2b', '3a', '3b', '4', 'report'];

export const ROUND_LABELS: Record<RoundKey, string> = {
  lobby: 'Belépés',
  '1a': '1a Ultimátum',
  '1b': '1b Ultimátum',
  '2a': '2a Diktátor',
  '2b': '2b Diktátor',
  '3a': '3a Bizalom',
  '3b': '3b Bizalom',
  '4': 'Közös kassza',
  report: 'Riport',
};
