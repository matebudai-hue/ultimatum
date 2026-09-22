import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: dom.window.sessionStorage, configurable: true });
Object.defineProperty(globalThis, 'CustomEvent', { value: dom.window.CustomEvent, configurable: true });
Object.defineProperty(globalThis, 'StorageEvent', { value: dom.window.StorageEvent, configurable: true });

const { localSessionStore } = await import('../src/sessionStore.ts');
const { buildGroupPicture, buildInterestingEvents, buildSelfReport } = await import('../src/debriefEngine.ts');
const { buildSelfReportShareText } = await import('../src/selfReportExport.ts');
const { buildProjectionStory } = await import('../src/projectionStory.ts');
const { buildParticipantProjection } = await import('../src/firebaseProjection.ts');

const strategicRounds = ['1a', '1b', '2a', '2b', '3a', '3b'] as const;

function submitStrategicRound(code: string) {
  let session = localSessionStore.get(code)!;
  const pairings = session.pairings.filter((pairing) => pairing.roundKey === session.roundKey);

  pairings.forEach((pairing, index) => {
    session = localSessionStore.get(code)!;
    const base = session.startingCredit;

    if (pairing.playerA !== 'BOT') {
      if (pairing.gameId === 'ultimatum') {
        const ratios = [0.08, 0.15, 0.25, 0.35, 0.50, 0.65, 0.80];
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'ultimatum_offer',
          amount: Math.round(base * ratios[index % ratios.length]),
        });
      } else if (pairing.gameId === 'dictator') {
        const ratios = [0, 0.05, 0.15, 0.30, 0.45, 0.60, 0.75];
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'dictator_give',
          amount: Math.round(base * ratios[index % ratios.length]),
        });
      } else {
        const ratios = [0.10, 0.20, 0.35, 0.55, 0.70, 0.85, 1.00];
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'trust_send',
          amount: Math.round(base * ratios[index % ratios.length]),
        });
      }
    }

    session = localSessionStore.get(code)!;
    if (pairing.playerB !== 'BOT') {
      if (pairing.gameId === 'ultimatum') {
        const offer = session.decisions.find(
          (decision) => decision.pairingId === pairing.id && decision.type === 'ultimatum_offer',
        )?.amount ?? 0;
        localSessionStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'ultimatum_response',
          accepted: offer >= Math.round(base * 0.25),
        });
      } else if (pairing.gameId === 'trust') {
        const sent = session.decisions.find(
          (decision) => decision.pairingId === pairing.id && decision.type === 'trust_send',
        )?.amount ?? 0;
        const returnRates = [0.05, 0.15, 0.25, 0.40, 0.50, 0.60, 0.70];
        localSessionStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'trust_return',
          amount: Math.round(sent * 3 * returnRates[index % returnRates.length]),
        });
      }
    }
  });
}

function configureMinimums(code: string, roundIndex: number) {
  const state = localSessionStore.get(code)!;
  const modes = ['none', '80', '90', '95'] as const;
  state.groups.forEach((group, groupIndex) => {
    const mode = modes[(roundIndex + groupIndex - 1) % modes.length];
    localSessionStore.setGroupMinimum(code, group.id, mode);
  });
}

function playPoolRound(code: string, roundIndex: number) {
  configureMinimums(code, roundIndex);
  localSessionStore.startPublicGoodsRound(code);
  let state = localSessionStore.get(code)!;

  state.players.forEach((player, index) => {
    const raw = ((index * 17 + roundIndex * 23) % 81) + 5; // 5–85%
    const ratio = raw / 100;
    const amount = Math.min(player.currentBalance, Math.round(player.currentBalance * ratio));
    localSessionStore.submitPublicGoods(code, player.id, amount);
  });

  const progress = localSessionStore.publicGoodsProgress(localSessionStore.get(code)!);
  assert.equal(progress.ready, 27);
  assert.equal(progress.total, 27);
  assert.equal(progress.complete, true);

  localSessionStore.lockPublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.publicGoodsPhase, 'locked');

  localSessionStore.settlePublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.publicGoodsPhase, 'setup');
  assert.equal(state.publicGoodsRoundNumber, roundIndex);
  assert.equal(
    state.publicGoodsRounds.filter((round) => round.roundNumber === roundIndex).length,
    3,
    'Minden kasszakörben három csoportot kell elszámolni.',
  );
  assert.equal(
    state.publicGoodsRounds
      .filter((round) => round.roundNumber === roundIndex)
      .every((round) => round.status === 'settled'),
    true,
  );
}

const game = localSessionStore.create(100_000, 27);
for (let index = 1; index <= 27; index += 1) {
  localSessionStore.join(game.code, `e2e27-player-${index}`, `Próba27 ${index}`);
}

let state = localSessionStore.get(game.code)!;
assert.equal(state.players.length, 27);
assert.equal(state.status, 'lobby');

state = localSessionStore.startGame(game.code);
assert.equal(state.status, 'active');

for (const round of strategicRounds) {
  const roundPairings = state.pairings.filter((pairing) => pairing.roundKey === round);
  assert.equal(roundPairings.length, 14, `${round}: 27 főnél 14 pár legyen a BOT-tal együtt.`);
  assert.equal(
    roundPairings.filter((pairing) => pairing.playerA === 'BOT' || pairing.playerB === 'BOT').length,
    1,
    `${round}: páratlan létszámnál pontosan egy BOT-pár legyen.`,
  );
}

for (const round of strategicRounds) {
  state = localSessionStore.get(game.code)!;
  assert.equal(state.roundKey, round);
  submitStrategicRound(game.code);
  assert.equal(localSessionStore.roundProgress(localSessionStore.get(game.code)!).complete, true);
  localSessionStore.closeStrategicRound(game.code);
  if (round !== '3b') localSessionStore.nextRound(game.code);
}

state = localSessionStore.get(game.code)!;
assert.deepEqual(state.closedRounds, strategicRounds);
assert.ok(buildInterestingEvents(state).length > 0);

localSessionStore.nextRound(game.code);
state = localSessionStore.get(game.code)!;
assert.equal(state.roundKey, '4');

localSessionStore.createManualGroups(game.code, 3);
state = localSessionStore.get(game.code)!;
const group2 = state.groups[1].id;
const group3 = state.groups[2].id;
for (const player of state.players.slice(9, 18)) localSessionStore.setPlayerGroup(game.code, player.id, group2);
for (const player of state.players.slice(18, 27)) localSessionStore.setPlayerGroup(game.code, player.id, group3);
state = localSessionStore.get(game.code)!;
assert.deepEqual(state.groups.map((group) => group.memberIds.length), [9, 9, 9]);
assert.equal(
  state.groups.some((group) => group.memberIds.includes('BOT')),
  false,
  'A BOT nem kerülhet Közös kassza csoportba.',
);

for (let roundIndex = 1; roundIndex <= 6; roundIndex += 1) {
  playPoolRound(game.code, roundIndex);
}

state = localSessionStore.get(game.code)!;
assert.equal(state.publicGoodsRoundNumber, 6);
assert.equal(state.publicGoodsRounds.length, 18, '6 kör × 3 csoport = 18 elszámolt csoportkör.');
assert.equal(
  state.publicGoodsRounds.some((round) => round.memberIds.includes('BOT')),
  false,
  'A BOT semelyik kasszakörben nem jelenhet meg.',
);

const beforeFinishEvents = buildInterestingEvents(state);
assert.ok(beforeFinishEvents.some((event) => event.game === 'publicGoods'));
const pinCandidate = beforeFinishEvents[0];
localSessionStore.togglePinnedDebriefEvent(game.code, pinCandidate.id);

localSessionStore.finish(game.code);
state = localSessionStore.get(game.code)!;
assert.equal(state.status, 'finished');
assert.equal(state.roundKey, 'report');
assert.equal(state.publicGoodsRoundNumber, 6);
assert.equal(state.debriefPhase, 'reflection');

for (const player of state.players) {
  const report = buildSelfReport(state, player.id);
  assert.equal(report.filter((item) => item.game !== 'publicGoods').length, 6, `${player.name}: 6 stratégiai kör.`);
  assert.equal(report.filter((item) => item.game === 'publicGoods').length, 6, `${player.name}: 6 kasszaköri döntés.`);
  assert.equal(report.length, 12, `${player.name}: összesen 12 saját döntési csempe.`);

  const selected = report.slice(0, player.id.endsWith('-1') ? 3 : 1);
  localSessionStore.submitReflection(
    game.code,
    player.id,
    selected.map((item, index) => ({
      decisionId: item.id,
      comment: `27 fős próbareflexió ${index + 1}.`,
    })),
  );
}

state = localSessionStore.get(game.code)!;
assert.equal(state.debriefPhase, 'complete');
assert.equal(new Set((state.reflections ?? []).map((item) => item.playerId)).size, 27);

const firstPlayer = state.players[0];
const firstReport = buildSelfReport(state, firstPlayer.id);
const firstReflections = (state.reflections ?? []).filter((item) => item.playerId === firstPlayer.id);
const firstStage = state.firstStageFinalBalance[firstPlayer.id] ?? 0;
const finalWealth = firstPlayer.currentBalance;

const shareText = buildSelfReportShareText(
  firstPlayer.name,
  firstReport,
  firstReflections,
  {
    firstStage,
    publicGoodsResult: finalWealth - firstStage,
    finalWealth,
  },
);
assert.ok(shareText.includes(firstPlayer.name));
assert.equal(shareText.includes(firstPlayer.id), false);

const participantView = buildParticipantProjection(state, firstPlayer.id);
assert.equal(participantView.selfReport?.length, 11);
assert.equal(
  participantView.reflections?.every((reflection) => reflection.playerId === firstPlayer.id),
  true,
);
assert.equal(JSON.stringify(participantView.reflections).includes('e2e27-player-2'), false);

const groupPicture = buildGroupPicture(state);
assert.equal(groupPicture.publicGoods.length, 18);
assert.equal(JSON.stringify(groupPicture).includes('Próba27 1'), false);

const finalEvents = buildInterestingEvents(state);
const projectable = finalEvents.find((event) => event.selfDecisionIds.length > 0) ?? finalEvents[0];
assert.ok(projectable);
const story = buildProjectionStory(state, projectable);
assert.ok(story.steps.length >= 1);
assert.equal(JSON.stringify(story).includes('Próba27 1'), false);
assert.equal(JSON.stringify(story).includes('e2e27-player-1'), false);
assert.ok((state.pinnedDebriefEventIds ?? []).includes(pinCandidate.id));

console.log('27-PLAYER / 6-POOL-ROUND END-TO-END TEST OK', {
  players: state.players.length,
  strategicRounds: state.closedRounds.length,
  botPairPerStrategicRound: 1,
  poolGroups: state.groups.length,
  poolRounds: state.publicGoodsRoundNumber,
  settledGroupRounds: state.publicGoodsRounds.length,
  reflectedPlayers: new Set((state.reflections ?? []).map((item) => item.playerId)).size,
  reflections: state.reflections?.length ?? 0,
  interestingEvents: finalEvents.length,
  selfReportItemsPerPlayer: firstReport.length,
  projectionSteps: story.steps.length,
});

process.exit(0);
