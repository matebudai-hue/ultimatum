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
const {
  buildGroupPicture,
  buildInterestingEvents,
  buildSelfReport,
} = await import('../src/debriefEngine.ts');
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
        const ratios = [0.10, 0.20, 0.30, 0.50, 0.70];
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'ultimatum_offer',
          amount: Math.round(base * ratios[index % ratios.length]),
        });
      } else if (pairing.gameId === 'dictator') {
        const ratios = [0.00, 0.10, 0.35, 0.55, 0.80];
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'dictator_give',
          amount: Math.round(base * ratios[index % ratios.length]),
        });
      } else {
        const ratios = [0.15, 0.25, 0.60, 0.80, 1.00];
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
          accepted: offer >= Math.round(base * 0.30),
        });
      } else if (pairing.gameId === 'trust') {
        const sent = session.decisions.find(
          (decision) => decision.pairingId === pairing.id && decision.type === 'trust_send',
        )?.amount ?? 0;
        const multipliers = [0.05, 0.20, 0.45, 0.50, 0.60];
        localSessionStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'trust_return',
          amount: Math.min(sent * 3, Math.round(sent * 3 * multipliers[index % multipliers.length])),
        });
      }
    }
  });
}

function playPoolRound(code: string, roundIndex: number) {
  let state = localSessionStore.get(code)!;

  if (roundIndex === 1) {
    localSessionStore.setGroupMinimum(code, state.groups[0].id, '80');
    localSessionStore.setGroupMinimum(code, state.groups[1].id, 'none');
  } else if (roundIndex === 2) {
    localSessionStore.setGroupMinimum(code, state.groups[0].id, 'none');
    localSessionStore.setGroupMinimum(code, state.groups[1].id, '90');
  } else if (roundIndex === 3) {
    localSessionStore.setGroupMinimum(code, state.groups[0].id, '95');
    localSessionStore.setGroupMinimum(code, state.groups[1].id, 'none');
  } else {
    state.groups.forEach((group) => localSessionStore.setGroupMinimum(code, group.id, 'none'));
  }

  localSessionStore.startPublicGoodsRound(code);
  state = localSessionStore.get(code)!;

  const ratiosByRound = [
    [0.80, 0.10, 0.20, 0.05, 0.60, 0.15, 0.50, 0.25, 0.70, 0.05],
    [0.15, 0.55, 0.20, 0.60, 0.25, 0.70, 0.10, 0.45, 0.20, 0.65],
    [0.70, 0.20, 0.65, 0.15, 0.55, 0.10, 0.75, 0.20, 0.60, 0.15],
    [0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30],
  ];

  state.players.forEach((player, index) => {
    const ratio = ratiosByRound[roundIndex - 1][index];
    const amount = Math.min(player.currentBalance, Math.round(player.currentBalance * ratio));
    localSessionStore.submitPublicGoods(code, player.id, amount);
  });

  const progress = localSessionStore.publicGoodsProgress(localSessionStore.get(code)!);
  assert.equal(progress.complete, true, `A ${roundIndex}. kasszakörben minden tét beérkezzen.`);

  localSessionStore.lockPublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.publicGoodsPhase, 'locked');

  localSessionStore.settlePublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.publicGoodsPhase, 'setup');
  assert.equal(state.publicGoodsRoundNumber, roundIndex);
  assert.equal(
    state.publicGoodsRounds.filter((round) => round.roundNumber === roundIndex).every((round) => round.status === 'settled'),
    true,
  );

  return buildInterestingEvents(state).length;
}

const game = localSessionStore.create(100_000, 10);
for (let index = 1; index <= 10; index += 1) {
  localSessionStore.join(game.code, `e2e-player-${index}`, `Próba ${index}`);
}

let state = localSessionStore.get(game.code)!;
assert.equal(state.players.length, 10);
assert.equal(state.status, 'lobby');

state = localSessionStore.startGame(game.code);
assert.equal(state.status, 'active');
assert.equal(state.pairings.some((pairing) => pairing.playerA === 'BOT' || pairing.playerB === 'BOT'), false);

let previousEventCount = 0;
for (const round of strategicRounds) {
  state = localSessionStore.get(game.code)!;
  assert.equal(state.roundKey, round);
  submitStrategicRound(game.code);
  assert.equal(localSessionStore.roundProgress(localSessionStore.get(game.code)!).complete, true);
  localSessionStore.closeStrategicRound(game.code);

  state = localSessionStore.get(game.code)!;
  const eventCount = buildInterestingEvents(state).length;
  assert.ok(eventCount >= previousEventCount, 'Az érdekes események száma lezárt körök után ne csökkenjen.');
  previousEventCount = eventCount;

  if (round !== '3b') localSessionStore.nextRound(game.code);
}

state = localSessionStore.get(game.code)!;
assert.deepEqual(state.closedRounds, strategicRounds);
assert.ok(buildInterestingEvents(state).length > 0, 'A stratégiai játékok után legyen kivezetési alapanyag.');

localSessionStore.nextRound(game.code);
state = localSessionStore.get(game.code)!;
assert.equal(state.roundKey, '4');

localSessionStore.createManualGroups(game.code, 2);
state = localSessionStore.get(game.code)!;
const secondGroup = state.groups[1].id;
for (const player of state.players.slice(5)) {
  localSessionStore.setPlayerGroup(game.code, player.id, secondGroup);
}
state = localSessionStore.get(game.code)!;
assert.deepEqual(state.groups.map((group) => group.memberIds.length), [5, 5]);

const eventCounts: number[] = [];
for (let roundIndex = 1; roundIndex <= 4; roundIndex += 1) {
  eventCounts.push(playPoolRound(game.code, roundIndex));
}
assert.ok(
  eventCounts[eventCounts.length - 1] >= eventCounts[0],
  'A kasszakörök után a kivezetési eseménykészlet maradjon elérhető.',
);

state = localSessionStore.get(game.code)!;
const beforeFinishEvents = buildInterestingEvents(state);
assert.ok(beforeFinishEvents.some((event) => event.game === 'publicGoods'), 'A kasszából is legyen érdekes esemény.');

const pinCandidate = beforeFinishEvents[0];
localSessionStore.togglePinnedDebriefEvent(game.code, pinCandidate.id);
state = localSessionStore.get(game.code)!;
assert.ok(state.pinnedDebriefEventIds?.includes(pinCandidate.id), 'A tréner félretett eseménye megmaradjon.');

localSessionStore.finish(game.code);
state = localSessionStore.get(game.code)!;
assert.equal(state.status, 'finished');
assert.equal(state.roundKey, 'report');
assert.equal(state.publicGoodsRoundNumber, 4);
assert.equal(state.debriefPhase, 'reflection');

for (const player of state.players) {
  const report = buildSelfReport(state, player.id);
  assert.equal(report.filter((item) => item.game !== 'publicGoods').length, 5, `${player.name}: öt stratégiai saját döntés legyen.`);
  assert.equal(report.filter((item) => item.game === 'publicGoods').length, 4, `${player.name}: négy kasszaköri saját döntés legyen.`);
  assert.equal(report.length, 9, `${player.name}: összesen kilenc saját döntési csempe legyen.`);

  const selected = report.slice(0, player.id.endsWith('1') ? 3 : 1);
  localSessionStore.submitReflection(
    game.code,
    player.id,
    selected.map((item, index) => ({
      decisionId: item.id,
      comment: `Próbareflexió ${index + 1}: ezt a döntést tartottam érdekesnek.`,
    })),
  );
}

state = localSessionStore.get(game.code)!;
assert.equal(state.debriefPhase, 'complete');
assert.equal(new Set((state.reflections ?? []).map((item) => item.playerId)).size, 10);

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
assert.ok(shareText.includes('KREDITJÁTÉK – SAJÁT RIPORT'));
assert.ok(shareText.includes(firstPlayer.name));
assert.ok(shareText.includes('Mi célból döntöttél így?'));
assert.equal(shareText.includes(firstPlayer.id), false, 'A hazavihető riport ne tartalmazzon belső játékosazonosítót.');

const participantView = buildParticipantProjection(state, firstPlayer.id);
assert.equal(participantView.selfReport?.length, 9);
assert.equal(
  participantView.reflections?.every((reflection) => reflection.playerId === firstPlayer.id),
  true,
  'A kliens csak a saját reflexióját kapja.',
);
assert.equal(
  JSON.stringify(participantView.reflections).includes('e2e-player-2'),
  false,
  'Más játékos reflexiója ne kerüljön ki a klienshez.',
);

const groupPicture = buildGroupPicture(state);
assert.equal(groupPicture.publicGoods.length, 8, '4 kör × 2 csoport legyen a csoportképben.');
assert.equal(JSON.stringify(groupPicture).includes('Próba 1'), false, 'A csoportkép maradjon anonim.');

const finalEvents = buildInterestingEvents(state);
const projectable = finalEvents.find((event) => event.selfDecisionIds.length > 0) ?? finalEvents[0];
assert.ok(projectable, 'Legyen kivetíthető érdekes esemény.');
const story = buildProjectionStory(state, projectable);
assert.ok(story.steps.length >= 1);
assert.equal(JSON.stringify(story).includes('Próba 1'), false, 'A kivetített történet ne tartalmazzon nevet.');
assert.equal(JSON.stringify(story).includes('e2e-player-1'), false, 'A kivetített történet ne tartalmazzon belső játékosazonosítót.');

assert.ok((state.pinnedDebriefEventIds ?? []).includes(pinCandidate.id), 'A játék végéig maradjon meg a tréner félretett eseménye.');

console.log('10-PLAYER END-TO-END ROOM TEST OK', {
  players: state.players.length,
  strategicRounds: state.closedRounds.length,
  poolRounds: state.publicGoodsRoundNumber,
  reflections: state.reflections?.length ?? 0,
  interestingEvents: finalEvents.length,
  selfReportItemsPerPlayer: firstReport.length,
  projectionSteps: story.steps.length,
});
process.exit(0);
