import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: dom.window.sessionStorage, configurable: true });
Object.defineProperty(globalThis, 'CustomEvent', { value: dom.window.CustomEvent, configurable: true });
Object.defineProperty(globalThis, 'StorageEvent', { value: dom.window.StorageEvent, configurable: true });

const { localSessionStore } = await import('../src/sessionStore.ts');
const { STRATEGIC_ROUNDS } = await import('../src/pairingEngine.ts');
const { buildInterestingEvents, buildSelfReport } = await import('../src/debriefEngine.ts');
const { buildParticipantProjection } = await import('../src/firebaseProjection.ts');

function createGame(count: number, prefix: string) {
  const game = localSessionStore.create(100_000, count);
  for (let i = 1; i <= count; i += 1) {
    localSessionStore.join(game.code, `${prefix}-${i}`, `${prefix} Játékos ${i}`);
  }
  return localSessionStore.startGame(game.code);
}

function submitMissingStrategicDecisions(code: string) {
  let session = localSessionStore.get(code)!;
  const pairings = session.pairings.filter((pairing) => pairing.roundKey === session.roundKey);

  for (const pairing of pairings) {
    session = localSessionStore.get(code)!;
    let decisions = session.decisions.filter((decision) => decision.pairingId === pairing.id);

    if (
      pairing.playerA !== 'BOT' &&
      !session.players.find((player) => player.id === pairing.playerA)?.botControlled
    ) {
      if (pairing.gameId === 'ultimatum' && !decisions.some((decision) => decision.type === 'ultimatum_offer')) {
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'ultimatum_offer',
          amount: 40_000,
        });
      } else if (pairing.gameId === 'dictator' && !decisions.some((decision) => decision.type === 'dictator_give')) {
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'dictator_give',
          amount: 30_000,
        });
      } else if (pairing.gameId === 'trust' && !decisions.some((decision) => decision.type === 'trust_send')) {
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'trust_send',
          amount: 50_000,
        });
      }
    }

    session = localSessionStore.get(code)!;
    decisions = session.decisions.filter((decision) => decision.pairingId === pairing.id);

    if (
      pairing.playerB !== 'BOT' &&
      !session.players.find((player) => player.id === pairing.playerB)?.botControlled
    ) {
      if (pairing.gameId === 'ultimatum' && !decisions.some((decision) => decision.type === 'ultimatum_response')) {
        localSessionStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'ultimatum_response',
          accepted: true,
        });
      } else if (pairing.gameId === 'trust' && !decisions.some((decision) => decision.type === 'trust_return')) {
        const sent = decisions.find((decision) => decision.type === 'trust_send')?.amount ?? 0;
        localSessionStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'trust_return',
          amount: Math.round(sent * 1.5),
        });
      }
    }
  }

  assert.equal(
    localSessionStore.roundProgress(localSessionStore.get(code)!).complete,
    true,
    `${localSessionStore.get(code)!.roundKey}: minden párnak be kell fejeznie a kört.`,
  );
}

function closeAndAdvanceStrategic(code: string) {
  const round = localSessionStore.get(code)!.roundKey;
  submitMissingStrategicDecisions(code);
  localSessionStore.closeStrategicRound(code);
  if (round !== '3b') localSessionStore.nextRound(code);
}

function playPoolRound(code: string, humanRatio = 0.25) {
  let session = localSessionStore.get(code)!;
  session.groups.forEach((group) => localSessionStore.setGroupMinimum(code, group.id, 'none'));
  localSessionStore.startPublicGoodsRound(code);
  session = localSessionStore.get(code)!;

  for (const player of session.players) {
    if (player.botControlled) continue;
    const amount = Math.min(player.currentBalance, Math.round(player.currentBalance * humanRatio));
    localSessionStore.submitPublicGoods(code, player.id, amount);
  }

  const progress = localSessionStore.publicGoodsProgress(localSessionStore.get(code)!);
  assert.equal(progress.complete, true, 'A BOT által átvett játékosok tétei is automatikusan érkezzenek be.');

  localSessionStore.lockPublicGoodsRound(code);
  localSessionStore.settlePublicGoodsRound(code);
}

function completeReflectionsForHumanControlledPlayers(code: string) {
  let session = localSessionStore.get(code)!;
  for (const player of session.players.filter((item) => !item.botControlled)) {
    const report = buildSelfReport(session, player.id);
    if (report.length === 0) continue;
    localSessionStore.submitReflection(code, player.id, [{
      decisionId: report[0].id,
      comment: 'Stresszteszt reflexió.',
    }]);
    session = localSessionStore.get(code)!;
  }
}

function tinyCase(count: 2 | 3) {
  localStorage.clear();
  const session = createGame(count, `tiny${count}`);
  const code = session.code;

  if (count === 2) {
    assert.equal(session.pairings.some((pairing) => pairing.playerA === 'BOT' || pairing.playerB === 'BOT'), false);
  } else {
    for (const round of STRATEGIC_ROUNDS) {
      assert.equal(
        session.pairings.filter((pairing) =>
          pairing.roundKey === round && (pairing.playerA === 'BOT' || pairing.playerB === 'BOT')
        ).length,
        1,
        '3 főnél minden stratégiai körben pontosan egy BOT-pár legyen.',
      );
    }
  }

  for (const round of STRATEGIC_ROUNDS) {
    assert.equal(localSessionStore.get(code)!.roundKey, round);
    closeAndAdvanceStrategic(code);
  }
  localSessionStore.nextRound(code);
  localSessionStore.randomizeGroups(code, 1);
  playPoolRound(code, 0.20);
  playPoolRound(code, 0.35);
  localSessionStore.finish(code);

  const final = localSessionStore.get(code)!;
  for (const player of final.players) {
    assert.equal(buildSelfReport(final, player.id).length, 7, `${count} főnél 5 stratégiai + 2 kasszadöntés legyen.`);
  }
  assert.ok(buildInterestingEvents(final).length >= 0);
  console.log(`TINY CASE ${count} PLAYERS OK`);
}

function mediumDropoutCase() {
  localStorage.clear();
  const session = createGame(18, 'medium');
  const code = session.code;

  // 1a normál.
  closeAndAdvanceStrategic(code);

  // 1b: egy játékos kiesik; BOT azonnal átveszi.
  const dropoutA = 'medium-3';
  localSessionStore.setPlayerBotControl(code, dropoutA, true);
  const pairing1b = localSessionStore.get(code)!.pairings.find(
    (pairing) => pairing.roundKey === '1b' && (pairing.playerA === dropoutA || pairing.playerB === dropoutA),
  )!;
  closeAndAdvanceStrategic(code);
  let state = localSessionStore.get(code)!;
  assert.ok(
    state.decisions.some((decision) => decision.pairingId === pairing1b.id && decision.playerId === dropoutA && decision.isBotDecision),
    'A kiesett játékos helyett BOT-döntésnek kell születnie a saját játékosazonosítóján.',
  );

  // 2a normál a maradóknak, BOT folytatja az első kieső helyett.
  closeAndAdvanceStrategic(code);

  // 2b: újabb kieső.
  const dropoutB = 'medium-7';
  localSessionStore.setPlayerBotControl(code, dropoutB, true);
  closeAndAdvanceStrategic(code);

  // 3a: harmadik játékost ideiglenesen BOT vesz át.
  const returnsLater = 'medium-5';
  localSessionStore.setPlayerBotControl(code, returnsLater, true);
  closeAndAdvanceStrategic(code);

  // 3b-ra visszatér, a tréner visszaadja az irányítást.
  localSessionStore.setPlayerBotControl(code, returnsLater, false);
  closeAndAdvanceStrategic(code);
  state = localSessionStore.get(code)!;
  const pairing3b = state.pairings.find(
    (pairing) => pairing.roundKey === '3b' && (pairing.playerA === returnsLater || pairing.playerB === returnsLater),
  )!;
  assert.ok(
    state.decisions.some((decision) => decision.pairingId === pairing3b.id && decision.playerId === returnsLater && !decision.isBotDecision),
    'A visszatért résztvevőnek újra emberként kell tudnia dönteni.',
  );

  localSessionStore.nextRound(code);
  localSessionStore.randomizeGroups(code, 3);

  // Első kasszakör.
  playPoolRound(code, 0.30);

  // Második kasszakör közben még valaki kiesik.
  state = localSessionStore.get(code)!;
  state.groups.forEach((group) => localSessionStore.setGroupMinimum(code, group.id, 'none'));
  localSessionStore.startPublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  const poolDropout = 'medium-10';
  for (const player of state.players) {
    if (player.id === poolDropout || player.botControlled) continue;
    localSessionStore.submitPublicGoods(code, player.id, Math.round(player.currentBalance * 0.25));
  }
  localSessionStore.setPlayerBotControl(code, poolDropout, true);
  state = localSessionStore.get(code)!;
  const botPoolDecision = state.decisions.find(
    (decision) =>
      decision.type === 'public_goods_contribution' &&
      decision.playerId === poolDropout &&
      decision.publicGoodsRound === state.publicGoodsRoundNumber
  );
  assert.ok(botPoolDecision?.isBotDecision, 'Kasszakör közbeni kiesésnél a BOT adjon automatikus tétet.');
  assert.equal(localSessionStore.publicGoodsProgress(state).complete, true);
  localSessionStore.lockPublicGoodsRound(code);
  localSessionStore.settlePublicGoodsRound(code);

  // Két további kasszakör.
  playPoolRound(code, 0.20);
  playPoolRound(code, 0.40);

  state = localSessionStore.get(code)!;
  const automatedDecisionIds = new Set(
    state.decisions.filter((decision) => decision.isBotDecision).map((decision) => decision.id),
  );
  assert.ok(automatedDecisionIds.size > 0);

  // A Kivezetés emberi eseményei ne hivatkozzanak a konkrét 1b BOT-párra.
  const eventsBeforeFinish = buildInterestingEvents(state);
  assert.equal(
    eventsBeforeFinish.some((event) => event.selfDecisionIds.some((id) => id.includes(pairing1b.id))),
    false,
    'BOT által generált stratégiai döntés ne legyen emberi kivezetési esemény.',
  );

  const poolRound = state.publicGoodsRounds.find(
    (round) => round.roundNumber === 2 && round.memberIds.includes(poolDropout),
  )!;
  const botPoolSelfId = `decision:publicGoods:r2:${poolRound.groupId}:${poolDropout}`;
  assert.equal(
    eventsBeforeFinish.some((event) => event.selfDecisionIds.includes(botPoolSelfId)),
    false,
    'BOT által generált kasszadöntés ne legyen emberi kivezetési esemény.',
  );

  localSessionStore.finish(code);
  completeReflectionsForHumanControlledPlayers(code);
  state = localSessionStore.get(code)!;

  assert.equal(state.debriefPhase, 'complete');
  assert.equal(state.players.filter((player) => player.botControlled).length, 3);
  assert.equal(
    new Set((state.reflections ?? []).map((reflection) => reflection.playerId)).size,
    15,
    'A három BOT által átvett kiesőtől ne várjon végső reflexiót.',
  );

  const dropoutReport = buildSelfReport(state, dropoutA);
  assert.ok(dropoutReport.some((item) => item.isBotDecision), 'A személyes történetben jelölve legyen a BOT döntése.');
  const returnedReport = buildSelfReport(state, returnsLater);
  assert.ok(returnedReport.some((item) => item.isBotDecision), 'A visszatérő történetében maradjon meg a korábbi BOT-döntés.');
  assert.ok(returnedReport.some((item) => !item.isBotDecision), 'A visszatérő későbbi saját döntései is maradjanak meg.');

  console.log('MEDIUM DROPOUT + BOT TAKEOVER CASE OK', {
    players: state.players.length,
    botControlledAtFinish: state.players.filter((player) => player.botControlled).length,
    automatedDecisions: state.decisions.filter((decision) => decision.isBotDecision).length,
    reflectedPlayers: new Set((state.reflections ?? []).map((reflection) => reflection.playerId)).size,
  });
}

function ninetyNineStressCase() {
  localStorage.clear();
  const session = createGame(99, 'stress99');
  const code = session.code;

  for (const round of STRATEGIC_ROUNDS) {
    const current = localSessionStore.get(code)!;
    assert.equal(current.roundKey, round);
    assert.equal(
      current.pairings.filter((pairing) =>
        pairing.roundKey === round && (pairing.playerA === 'BOT' || pairing.playerB === 'BOT')
      ).length,
      1,
      '99 főnél minden stratégiai körben pontosan egy BOT-pár legyen.',
    );
    closeAndAdvanceStrategic(code);
  }

  localSessionStore.nextRound(code);
  localSessionStore.randomizeGroups(code, 11);
  let state = localSessionStore.get(code)!;
  assert.equal(state.groups.length, 11);
  assert.equal(state.groups.reduce((sum, group) => sum + group.memberIds.length, 0), 99);

  for (let poolRound = 1; poolRound <= 12; poolRound += 1) {
    playPoolRound(code, 0.10 + (poolRound % 5) * 0.05);
  }

  localSessionStore.finish(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.publicGoodsRoundNumber, 12);
  assert.equal(state.publicGoodsRounds.length, 132, '12 kör × 11 csoport = 132 elszámolt csoportkör.');

  for (const player of state.players) {
    const report = buildSelfReport(state, player.id);
    assert.equal(report.length, 17, '99 főnél minden résztvevőnek 5 stratégiai + 12 kasszadöntése legyen.');
  }

  completeReflectionsForHumanControlledPlayers(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.debriefPhase, 'complete');
  assert.equal(new Set((state.reflections ?? []).map((reflection) => reflection.playerId)).size, 99);

  const raw = JSON.stringify(state);
  const compressedBytes = gzipSync(raw).byteLength;
  const largestProjection = Math.max(
    ...state.players.map((player) =>
      Buffer.byteLength(JSON.stringify(buildParticipantProjection(state, player.id)), 'utf8')
    ),
  );
  assert.ok(compressedBytes < 750_000, `99 fős stresszállapot túl nagy: ${compressedBytes} byte`);
  assert.ok(largestProjection < 750_000, `99 fős résztvevői vetület túl nagy: ${largestProjection} byte`);

  console.log('99-PLAYER / 12-POOL-ROUND FULL STRESS CASE OK', {
    players: 99,
    strategicRounds: state.closedRounds.length,
    poolRounds: state.publicGoodsRoundNumber,
    settledGroupRounds: state.publicGoodsRounds.length,
    reflections: state.reflections?.length ?? 0,
    compressedBytes,
    largestProjection,
    interestingEvents: buildInterestingEvents(state).length,
  });
}

tinyCase(2);
tinyCase(3);
mediumDropoutCase();
ninetyNineStressCase();

console.log('RESILIENCE STRESS SUITE OK');
process.exit(0);
