# DATA_MODEL v0.1

Első Firestore adatmodell-váz. A cél: a játék állapota, a döntések, a vagyonmozgások és a tréneri kontroll egyértelműen követhető legyen.

## Alapelv

A résztvevő telefonja döntést küld be, de végleges vagyont nem számol és nem ír. A vagyonfrissítés központi logika alapján történik lezárt fordulónál.

A pénzmozgások legyenek tranzakcióként is követhetők, hogy később visszakereshető legyen, miért van valakinek annyi pénze, amennyi.

## `sessions`

Mezők:

- `sessionId`
- `name`
- `status`
- `anonymousMode`
- `currentGame`
- `currentRound`
- `createdAt`
- `updatedAt`

Lehetséges `status` értékek:

- `created`
- `lobby_open`
- `lobby_closed`
- `game_active`
- `finished`

## `players`

Mezők:

- `playerId`
- `sessionId`
- `name`
- `currentBalance`
- `active`
- `joinedAt`
- `lastSeenAt`

Megjegyzés: a `currentBalance` csak lezárt forduló vagy közös kassza eredménykiküldése után frissülhet.

## `pairings`

Mezők:

- `pairingId`
- `sessionId`
- `gameId`
- `roundId`
- `playerA`
- `playerB`
- `playerBIsBot`
- `roleA`
- `roleB`
- `createdAt`

Szerepek például:

- `proposer`
- `receiver`
- `dictator`
- `sender`
- `returner`

## `rounds`

Mezők:

- `roundId`
- `sessionId`
- `gameId`
- `roundNumber`
- `status`
- `createdAt`
- `openedAt`
- `closedAt`
- `resultsReleasedAt`

Lehetséges `status` értékek az első három játékban:

- `round_prepared`
- `round_open`
- `waiting_for_responses`
- `round_ready_to_close`
- `round_closed`
- `results_released`

## `decisions`

Mezők:

- `decisionId`
- `sessionId`
- `gameId`
- `roundId`
- `pairingId`
- `playerId`
- `decisionType`
- `amount`
- `accepted`
- `isBotDecision`
- `submittedAt`

`decisionType` példák:

- `ultimatum_offer`
- `ultimatum_response`
- `dictator_give`
- `trust_send`
- `trust_return`
- `public_goods_contribution`

## `transactions`

Mezők:

- `transactionId`
- `sessionId`
- `playerId`
- `gameId`
- `roundId`
- `amount`
- `balanceBefore`
- `balanceAfter`
- `reason`
- `createdAt`

`reason` példák:

- `ultimatum_accepted_proposer`
- `ultimatum_accepted_receiver`
- `ultimatum_rejected`
- `dictator_keep`
- `dictator_receive`
- `trust_sender_result`
- `trust_receiver_result`
- `public_goods_contribution_loss`
- `public_goods_payout`

## `publicGoodsRounds`

Mezők:

- `roundId`
- `sessionId`
- `roundNumber`
- `minimumAmount`
- `trainerMessage`
- `status`
- `totalContribution`
- `success`
- `payoutPerPlayer`
- `openedAt`
- `contributionsLockedAt`
- `calculatedAt`
- `resultsReleasedAt`

Lehetséges `status` értékek:

- `public_goods_prepared`
- `public_goods_open`
- `public_goods_waiting`
- `public_goods_contributions_locked`
- `public_goods_calculated`
- `public_goods_results_released`

## `publicGoodsContributions`

Mezők:

- `contributionId`
- `sessionId`
- `roundId`
- `playerId`
- `amount`
- `submittedAt`

## `feedback`

Mezők:

- `feedbackId`
- `sessionId`
- `playerId`
- `text`
- `status`
- `generatedAt`
- `reviewedAt`
- `releasedAt`

Lehetséges `status` értékek:

- `feedback_draft`
- `feedback_reviewed`
- `feedback_released`

## `auditLog`

Minden tréneri korrekciót naplózni kell.

Mezők:

- `auditId`
- `sessionId`
- `actor`
- `action`
- `targetCollection`
- `targetId`
- `before`
- `after`
- `createdAt`

## Nyitott technikai döntések

- Legyenek-e a session alatti adatok alkollekciókban, vagy felső szintű collectionökben `sessionId` szűréssel?
- Cloud Functions végezze-e az összes lezárási számolást?
- Anonymous Auth kötelező legyen-e már az első MVP-ben?
- Kell-e offline-védelem arra az esetre, ha egy résztvevő telefonja frissít vagy megszakad?
