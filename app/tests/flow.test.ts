import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: dom.window.sessionStorage, configurable: true });
Object.defineProperty(globalThis, 'CustomEvent', { value: dom.window.CustomEvent, configurable: true });
Object.defineProperty(globalThis, 'StorageEvent', { value: dom.window.StorageEvent, configurable: true });

const { localSessionStore, canFinishPublicGoodsGame } = await import('../src/sessionStore.ts');
const { createCsv } = await import('../src/report.ts');
const { pairingRepeatStats } = await import('../src/pairingEngine.ts');
const { settleUltimatum, settleOneWayGive, settleTrust, settlePublicGoods } = await import('../src/gameEngine.ts');

const strategic = ['1a', '1b', '2a', '2b', '3a', '3b'] as const;

function testUltimatumThirtySecondTimeouts() {
  const proposerGame = localSessionStore.create(100_000, 2);
  localSessionStore.join(proposerGame.code, 'u-proposer-a', 'A');
  localSessionStore.join(proposerGame.code, 'u-proposer-b', 'B');
  let state = localSessionStore.startGame(proposerGame.code);
  const proposerPair = state.pairings.find((pairing) => pairing.roundKey === '1a')!;
  assert.equal(localSessionStore.ultimatumDeadlineAt(state, proposerPair.id, proposerPair.playerA), undefined, 'A számláló nem indul el, amíg a feladat nem jelent meg a kliensen.');

  localSessionStore.ackStrategicTaskVisible(proposerGame.code, proposerPair.playerA);
  state = localSessionStore.get(proposerGame.code)!;
  const proposerKey = `${proposerPair.id}:${proposerPair.playerA}`;
  const proposerSeenAt = state.strategicTaskSeenAt[proposerKey];
  const proposerDeadline = localSessionStore.ultimatumDeadlineAt(state, proposerPair.id, proposerPair.playerA)!;
  assert.equal(
    new Date(proposerDeadline).getTime() - new Date(proposerSeenAt).getTime(),
    30_000,
    'A felajánló ideje a kliens megjelenésétől pontosan 30 másodperc.',
  );

  localSessionStore.reconcileStrategicTimeouts(
    proposerGame.code,
    new Date(proposerDeadline).getTime() + 1,
  );
  state = localSessionStore.get(proposerGame.code)!;
  const proposerTimeout = state.decisions.find(
    (decision) => decision.pairingId === proposerPair.id && decision.type === 'ultimatum_timeout',
  );
  assert.equal(proposerTimeout?.timedOutRole, 'proposer');
  assert.equal(localSessionStore.roundProgress(state).complete, true);
  localSessionStore.closeStrategicRound(proposerGame.code);
  state = localSessionStore.get(proposerGame.code)!;
  assert.deepEqual(state.players.map((player) => player.currentBalance), [0, 0]);

  const receiverGame = localSessionStore.create(100_000, 2);
  localSessionStore.join(receiverGame.code, 'u-receiver-a', 'A');
  localSessionStore.join(receiverGame.code, 'u-receiver-b', 'B');
  state = localSessionStore.startGame(receiverGame.code);
  const receiverPair = state.pairings.find((pairing) => pairing.roundKey === '1a')!;
  localSessionStore.submitStrategicDecision(receiverGame.code, receiverPair.playerA, {
    type: 'ultimatum_offer',
    amount: 40_000,
  });
  state = localSessionStore.get(receiverGame.code)!;
  assert.equal(localSessionStore.ultimatumDeadlineAt(state, receiverPair.id, receiverPair.playerB), undefined, 'A fogadó órája sem indul, amíg az ajánlat nem jelent meg a kliensén.');

  localSessionStore.ackStrategicTaskVisible(receiverGame.code, receiverPair.playerB);
  state = localSessionStore.get(receiverGame.code)!;
  const receiverKey = `${receiverPair.id}:${receiverPair.playerB}`;
  const receiverSeenAt = state.strategicTaskSeenAt[receiverKey];
  const receiverDeadline = localSessionStore.ultimatumDeadlineAt(state, receiverPair.id, receiverPair.playerB)!;
  assert.equal(
    new Date(receiverDeadline).getTime() - new Date(receiverSeenAt).getTime(),
    30_000,
    'A fogadó ideje az ajánlat kliensen való megjelenésétől pontosan 30 másodperc.',
  );

  localSessionStore.reconcileStrategicTimeouts(
    receiverGame.code,
    new Date(receiverDeadline).getTime() + 1,
  );
  state = localSessionStore.get(receiverGame.code)!;
  const receiverTimeout = state.decisions.find(
    (decision) => decision.pairingId === receiverPair.id && decision.type === 'ultimatum_timeout',
  );
  assert.equal(receiverTimeout?.timedOutRole, 'receiver');
  localSessionStore.closeStrategicRound(receiverGame.code);
  state = localSessionStore.get(receiverGame.code)!;
  assert.deepEqual(state.players.map((player) => player.currentBalance), [0, 0]);

  console.log('ULTIMATUM 30/30 CLIENT-VISIBLE TIMEOUTS OK');
}

function testUltimatumTechnicalProtection() {
  const game = localSessionStore.create(100_000, 2);
  localSessionStore.join(game.code, 'tech-a', 'A');
  localSessionStore.join(game.code, 'tech-b', 'B');
  let state = localSessionStore.startGame(game.code);
  const pair = state.pairings.find((pairing) => pairing.roundKey === '1a')!;
  localSessionStore.ackStrategicTaskVisible(game.code, pair.playerA);
  localSessionStore.markStrategicSubmitIntent(game.code, pair.playerA);
  state = localSessionStore.get(game.code)!;
  const key = `${pair.id}:${pair.playerA}`;
  const intentAt = state.strategicSubmitIntentAt[key];

  localSessionStore.reconcileStrategicTimeouts(game.code, new Date(intentAt).getTime() + 6_000);
  state = localSessionStore.get(game.code)!;
  assert.equal(
    state.decisions.some((decision) => decision.pairingId === pair.id && decision.type === 'ultimatum_timeout'),
    false,
    'Időben megnyomott küldésből technikai késés miatt nem lehet 0–0.',
  );
  assert.ok(
    state.strategicTechnicalIssues.some((issue) => issue.pairingId === pair.id && issue.playerId === pair.playerA),
    'A technikai késés külön állapotként jelenik meg.',
  );

  localSessionStore.reopenTechnicalDecision(game.code, pair.id, pair.playerA);
  state = localSessionStore.get(game.code)!;
  assert.equal(state.strategicTechnicalIssues.length, 0);
  assert.ok(localSessionStore.ultimatumDeadlineAt(state, pair.id, pair.playerA));

  console.log('ULTIMATUM TECHNICAL PROTECTION OK');
}

function advanceToRound(code: string, target: typeof strategic[number]) {
  while (localSessionStore.get(code)!.roundKey !== target) {
    const state = localSessionStore.get(code)!;
    assert.ok(strategic.includes(state.roundKey as typeof strategic[number]));
    submitCurrentRound(code);
    localSessionStore.closeStrategicRound(code);
    localSessionStore.nextRound(code);
  }
}

function testDictatorAndTrustThirtySecondTimeouts() {
  const dictatorGame = localSessionStore.create(100_000, 2);
  localSessionStore.join(dictatorGame.code, 'dict-a', 'A');
  localSessionStore.join(dictatorGame.code, 'dict-b', 'B');
  localSessionStore.startGame(dictatorGame.code);
  advanceToRound(dictatorGame.code, '2a');
  let state = localSessionStore.get(dictatorGame.code)!;
  const dictatorPair = state.pairings.find((pairing) => pairing.roundKey === '2a')!;
  localSessionStore.ackStrategicTaskVisible(dictatorGame.code, dictatorPair.playerA);
  state = localSessionStore.get(dictatorGame.code)!;
  const dictatorDeadline = localSessionStore.strategicDeadlineAt(state, dictatorPair.id, dictatorPair.playerA)!;
  localSessionStore.reconcileStrategicTimeouts(dictatorGame.code, new Date(dictatorDeadline).getTime() + 1);
  state = localSessionStore.get(dictatorGame.code)!;
  const dictatorTimeout = state.decisions.find(
    (decision) => decision.pairingId === dictatorPair.id && decision.type === 'dictator_give',
  );
  assert.equal(dictatorTimeout?.amount, 0);
  assert.equal(dictatorTimeout?.timedOutRole, 'dictator');
  assert.equal(localSessionStore.roundProgress(state).complete, true);

  const trustGame = localSessionStore.create(100_000, 2);
  localSessionStore.join(trustGame.code, 'trust-a', 'A');
  localSessionStore.join(trustGame.code, 'trust-b', 'B');
  localSessionStore.startGame(trustGame.code);
  advanceToRound(trustGame.code, '3a');
  state = localSessionStore.get(trustGame.code)!;
  const trustPair = state.pairings.find((pairing) => pairing.roundKey === '3a')!;

  localSessionStore.ackStrategicTaskVisible(trustGame.code, trustPair.playerA);
  state = localSessionStore.get(trustGame.code)!;
  const sendDeadline = localSessionStore.strategicDeadlineAt(state, trustPair.id, trustPair.playerA)!;
  localSessionStore.reconcileStrategicTimeouts(trustGame.code, new Date(sendDeadline).getTime() + 1);
  state = localSessionStore.get(trustGame.code)!;
  const timedSend = state.decisions.find(
    (decision) => decision.pairingId === trustPair.id && decision.type === 'trust_send',
  );
  assert.equal(timedSend?.amount, 0);
  assert.equal(timedSend?.timedOutRole, 'sender');

  localSessionStore.ackStrategicTaskVisible(trustGame.code, trustPair.playerB);
  state = localSessionStore.get(trustGame.code)!;
  const returnDeadline = localSessionStore.strategicDeadlineAt(state, trustPair.id, trustPair.playerB)!;
  localSessionStore.reconcileStrategicTimeouts(trustGame.code, new Date(returnDeadline).getTime() + 1);
  state = localSessionStore.get(trustGame.code)!;
  const timedReturn = state.decisions.find(
    (decision) => decision.pairingId === trustPair.id && decision.type === 'trust_return',
  );
  assert.equal(timedReturn?.amount, 0);
  assert.equal(timedReturn?.timedOutRole, 'returner');
  assert.equal(localSessionStore.roundProgress(state).complete, true);

  console.log('DICTATOR/TRUST 30 SECOND ZERO DEFAULTS OK');
}

function testStrategicTechnicalProtectionBeyondUltimatum() {
  const game = localSessionStore.create(100_000, 2);
  localSessionStore.join(game.code, 'tech2-a', 'A');
  localSessionStore.join(game.code, 'tech2-b', 'B');
  localSessionStore.startGame(game.code);
  advanceToRound(game.code, '2a');
  let state = localSessionStore.get(game.code)!;
  const pair = state.pairings.find((pairing) => pairing.roundKey === '2a')!;
  localSessionStore.ackStrategicTaskVisible(game.code, pair.playerA);
  localSessionStore.markStrategicSubmitIntent(game.code, pair.playerA);
  state = localSessionStore.get(game.code)!;
  const key = `${pair.id}:${pair.playerA}`;
  const intent = state.strategicSubmitIntentAt[key];
  localSessionStore.reconcileStrategicTimeouts(game.code, new Date(intent).getTime() + 6_000);
  state = localSessionStore.get(game.code)!;
  assert.equal(
    state.decisions.some((decision) => decision.pairingId === pair.id && decision.type === 'dictator_give'),
    false,
    'Időben megnyomott Diktátor-küldésből technikai késés miatt nem lehet automatikus 0.',
  );
  assert.ok(state.strategicTechnicalIssues.some((issue) => issue.pairingId === pair.id));
  localSessionStore.reopenTechnicalDecision(game.code, pair.id, pair.playerA);
  state = localSessionStore.get(game.code)!;
  assert.ok(localSessionStore.strategicDeadlineAt(state, pair.id, pair.playerA));

  console.log('GENERIC STRATEGIC TECHNICAL PROTECTION OK');
}


function testRecordedSubmitIntentSurvivesNetworkDelay() {
  const game = localSessionStore.create(100_000, 2);
  localSessionStore.join(game.code, 'delay-a', 'A');
  localSessionStore.join(game.code, 'delay-b', 'B');
  let state = localSessionStore.startGame(game.code);
  const pairing = state.pairings.find((item) => item.roundKey === '1a')!;

  const proposer = pairing.playerA as string;
  localSessionStore.ackStrategicTaskVisible(game.code, proposer);
  state = localSessionStore.get(game.code)!;
  const deadline = localSessionStore.strategicDeadlineAt(state, pairing.id, proposer)!;
  const onTime = new Date(new Date(deadline).getTime() - 500).toISOString();

  localSessionStore.markStrategicSubmitIntentAt(game.code, proposer, onTime);
  const delayedNow = new Date(deadline).getTime() + 15_000;
  state = localSessionStore.reconcileStrategicTimeouts(game.code, delayedNow);

  assert.equal(
    state.decisions.some((decision) => decision.pairingId === pairing.id && decision.type === 'ultimatum_timeout'),
    false,
    'Időben kattintott döntést hálózati késés miatt nem szabad timeoutnak könyvelni.',
  );
  assert.ok(
    state.strategicTechnicalIssues.some((issue) => issue.pairingId === pairing.id && issue.playerId === proposer),
    'Hosszú továbbítási késés technikai hibaként jelenjen meg.',
  );

  localSessionStore.submitStrategicDecision(game.code, proposer, {
    type: 'ultimatum_offer',
    amount: 40_000,
  });
  state = localSessionStore.get(game.code)!;
  assert.ok(
    state.decisions.some((decision) => decision.pairingId === pairing.id && decision.type === 'ultimatum_offer'),
    'Az időben kattintott döntés később is befogadható legyen.',
  );
  console.log('RECORDED SUBMIT INTENT NETWORK DELAY PROTECTION OK');
}

function testSettlementRules() {
  const players = [
    { id: 'A', name: 'A', currentBalance: 0, active: true },
    { id: 'B', name: 'B', currentBalance: 0, active: true },
  ];

  const ultimatumPair = {
    id: 'u',
    gameId: 'ultimatum' as const,
    roundKey: '1a' as const,
    playerA: 'A',
    playerB: 'B',
    roleA: 'proposer' as const,
    roleB: 'receiver' as const,
    playerAIsBot: false,
    playerBIsBot: false,
  };

  assert.deepEqual(settleUltimatum(players, ultimatumPair, 40_000, false, 100_000).map((t) => t.amount), [0, 0]);
  assert.deepEqual(settleUltimatum(players, ultimatumPair, 40_000, true, 100_000).map((t) => t.amount), [60_000, 40_000]);

  const dictatorPair = { ...ultimatumPair, id: 'd', gameId: 'dictator' as const, roundKey: '2a' as const, roleA: 'dictator' as const };
  assert.deepEqual(settleOneWayGive(players, dictatorPair, 30_000, 100_000).map((t) => t.amount), [70_000, 30_000]);

  const trustPair = { ...ultimatumPair, id: 't', gameId: 'trust' as const, roundKey: '3a' as const, roleA: 'sender' as const, roleB: 'returner' as const };
  assert.deepEqual(settleTrust(players, trustPair, 50_000, 75_000, 100_000).map((t) => t.amount), [125_000, 75_000]);

  const poolPlayers = players.map((p) => ({ ...p, currentBalance: 100_000 }));
  const success = settlePublicGoods(poolPlayers, { A: 10_000, B: 20_000 }, '4');
  assert.equal(success.totalContribution, 30_000);
  assert.equal(success.payoutPerPlayer, 30_000);
  assert.deepEqual(success.transactions.map((t) => t.amount), [20_000, 10_000]);

  const fail = settlePublicGoods(poolPlayers, { A: 10_000, B: 20_000 }, '4', 40_000);
  assert.equal(fail.success, false);
  assert.deepEqual(fail.transactions.map((t) => t.amount), [-10_000, -20_000]);

  console.log('SETTLEMENT RULES OK');
}

function submitCurrentRound(code: string) {
  let session = localSessionStore.get(code)!;
  const pairings = session.pairings.filter((p) => p.roundKey === session.roundKey);

  for (const pairing of pairings) {
    session = localSessionStore.get(code)!;

    if (pairing.playerA !== 'BOT') {
      if (pairing.gameId === 'ultimatum') {
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'ultimatum_offer',
          amount: Math.round(session.startingCredit * 0.4),
        });
      } else if (pairing.gameId === 'dictator') {
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'dictator_give',
          amount: Math.round(session.startingCredit * 0.3),
        });
      } else {
        localSessionStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'trust_send',
          amount: Math.round(session.startingCredit * 0.5),
        });
      }
    }

    session = localSessionStore.get(code)!;

    if (pairing.playerB !== 'BOT') {
      if (pairing.gameId === 'ultimatum') {
        localSessionStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'ultimatum_response',
          accepted: true,
        });
      } else if (pairing.gameId === 'trust') {
        const sent = session.decisions.find(
          (d) => d.pairingId === pairing.id && d.type === 'trust_send',
        )?.amount ?? 0;
        localSessionStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'trust_return',
          amount: Math.round(sent * 1.5),
        });
      }
    }
  }
}

function partnerMap(session: NonNullable<ReturnType<typeof localSessionStore.get>>, roundKey: string) {
  const map = new Map<string, string>();
  for (const pairing of session.pairings.filter((p) => p.roundKey === roundKey)) {
    map.set(pairing.playerA, pairing.playerB);
    map.set(pairing.playerB, pairing.playerA);
  }
  return map;
}

function assertRoleSwap(session: NonNullable<ReturnType<typeof localSessionStore.get>>, a: typeof strategic[number], b: typeof strategic[number]) {
  for (const player of session.players) {
    const pa = session.pairings.find((p) => p.roundKey === a && (p.playerA === player.id || p.playerB === player.id));
    const pb = session.pairings.find((p) => p.roundKey === b && (p.playerA === player.id || p.playerB === player.id));
    assert.ok(pa && pb);
    assert.notEqual(pa.playerA === player.id, pb.playerA === player.id, `${player.name}: az a/b körben szerepet kell cserélnie`);
  }
}

function testPairingInvariantsForAllSupportedCounts() {
  for (let count = 2; count <= 100; count += 1) {
    const game = localSessionStore.create(100_000, count);
    for (let i = 1; i <= count; i += 1) {
      localSessionStore.join(game.code, `pair-${count}-${i}`, `P${i}`);
    }
    const state = localSessionStore.startGame(game.code);
    assertRoleSwap(state, '1a', '1b');
    assertRoleSwap(state, '2a', '2b');
    assertRoleSwap(state, '3a', '3b');

    const stats = pairingRepeatStats(state.pairings);
    if (count >= 7) assert.equal(stats.repeatedPairCount, 0, `${count} főnél ne legyen ismételt pár hat körön belül.`);

    if (count > 2) {
      for (const [a, b] of [['1a', '1b'], ['2a', '2b'], ['3a', '3b']] as const) {
        const aPartners = partnerMap(state, a);
        const bPartners = partnerMap(state, b);
        for (const player of state.players) {
          assert.notEqual(aPartners.get(player.id), bPartners.get(player.id), `${count} fő / ${a}-${b}: azonnali párismétlés.`);
        }
      }
    }
  }
  console.log('PAIRING INVARIANTS OK: 2–100');
}

function runStrategicStage(count: number) {
  const session = localSessionStore.create(100_000, count);
  for (let i = 1; i <= count; i += 1) {
    localSessionStore.join(session.code, `p-${count}-${i}`, `Játékos ${i}`);
  }

  let state = localSessionStore.startGame(session.code);
  const repeatStats = pairingRepeatStats(state.pairings);

  if (count >= 7) assert.equal(repeatStats.repeatedPairCount, 0);
  else if (count >= 5) assert.ok(repeatStats.maximumRepeat <= 2);

  assertRoleSwap(state, '1a', '1b');
  assertRoleSwap(state, '2a', '2b');
  assertRoleSwap(state, '3a', '3b');

  for (const round of strategic) {
    state = localSessionStore.get(session.code)!;
    assert.equal(state.roundKey, round);
    submitCurrentRound(session.code);
    state = localSessionStore.get(session.code)!;
    assert.equal(localSessionStore.roundProgress(state).complete, true);

    localSessionStore.closeStrategicRound(session.code);
    state = localSessionStore.get(session.code)!;

    if (round.endsWith('b') && count > 2) {
      const aPartners = partnerMap(state, `${round[0]}a`);
      const bPartners = partnerMap(state, round);
      for (const player of state.players) {
        assert.notEqual(aPartners.get(player.id), bPartners.get(player.id));
      }
    }

    if (round !== '3b') localSessionStore.nextRound(session.code);
  }

  state = localSessionStore.get(session.code)!;
  const stageBalances = Object.fromEntries(state.players.map((p) => [p.id, p.currentBalance]));
  localSessionStore.nextRound(session.code);
  state = localSessionStore.get(session.code)!;

  assert.equal(state.roundKey, '4');
  assert.equal(state.publicGoodsPhase, 'setup');
  assert.deepEqual(state.firstStageFinalBalance, stageBalances);
  return session.code;
}

function testPublicGoodsControl(code: string, count: number) {
  let state = localSessionStore.get(code)!;
  const groupCount = count === 100 ? 25 : count >= 20 ? 5 : count >= 4 ? 2 : 1;
  localSessionStore.randomizeGroups(code, groupCount);
  state = localSessionStore.get(code)!;

  assert.equal(state.groups.length, groupCount);
  assert.equal(state.groups.reduce((sum, group) => sum + group.memberIds.length, 0), count);
  assert.equal(new Set(state.groups.map((group) => group.name)).size, groupCount, 'Minden csoport neve legyen egyedi.');
  assert.ok(state.groups.every((group) => !/^Csoport\s+\d+$/i.test(group.name)), 'A csoportok magyar helynevet kapjanak, ne sorszámot.');
  if (count === 100) {
    assert.equal(state.groups.length, 25, '100 fő esetén legfeljebb 25 csoport legyen.');
    assert.ok(state.groups.every((group) => group.memberIds.length === 4), '100 fő / 25 csoport esetén minden csoport 4 fős.');
  }

  assert.equal(canFinishPublicGoodsGame(state), true, 'A teljes játék lezárása már a Közös kassza kezdetétől elérhető.');

  // 1. kör: csoportonként eltérő minimum-beállítás.
  state.groups.forEach((group, index) => {
    const mode = index % 3 === 0 ? 'none' : index % 3 === 1 ? '80' : '95';
    localSessionStore.setGroupMinimum(code, group.id, mode);
  });

  localSessionStore.startPublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.publicGoodsPhase, 'open');
  assert.equal(canFinishPublicGoodsGame(state), true, 'Futó kasszakör közben is elérhető a teljes játék lezárása.');
  assert.ok(state.publicGoodsDeadlineAt);
  assert.ok(localSessionStore.publicGoodsSecondsLeft(state) <= 60);

  const firstPlayer = state.players[0];
  const firstAmount = Math.round(firstPlayer.currentBalance * 0.1);
  const changedAmount = Math.round(firstPlayer.currentBalance * 0.2);
  localSessionStore.submitPublicGoods(code, firstPlayer.id, firstAmount);
  localSessionStore.submitPublicGoods(code, firstPlayer.id, changedAmount);
  state = localSessionStore.get(code)!;
  const firstRound = state.publicGoodsRounds.find((r) => r.roundNumber === 1 && r.memberIds.includes(firstPlayer.id))!;
  assert.equal(firstRound.contributions[firstPlayer.id], changedAmount, 'A tét zárásig módosítható.');

  for (const player of state.players.slice(1)) {
    localSessionStore.submitPublicGoods(code, player.id, player.currentBalance);
  }

  const beforeSettle = Object.fromEntries(localSessionStore.get(code)!.players.map((p) => [p.id, p.currentBalance]));
  localSessionStore.lockPublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.publicGoodsPhase, 'locked');
  assert.equal(canFinishPublicGoodsGame(state), true, 'Lezárt, még el nem számolt kasszakörnél is elérhető a teljes játék lezárása.');
  assert.deepEqual(Object.fromEntries(state.players.map((p) => [p.id, p.currentBalance])), beforeSettle, 'Tétzáráskor még nincs könyvelés.');
  assert.throws(() => localSessionStore.submitPublicGoods(code, firstPlayer.id, 0));

  localSessionStore.settlePublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.publicGoodsPhase, 'setup');
  assert.equal(state.publicGoodsRoundNumber, 1);
  assert.equal(canFinishPublicGoodsGame(state), true, 'Két kasszakör között is elérhető a teljes játék lezárása.');
  assert.ok(state.publicGoodsRounds.filter((r) => r.roundNumber === 1).every((r) => r.status === 'settled'));
  assert.ok(state.groups.every((group) => group.nextMinimumMode === 'none'), 'A következő kör minimuma alapból visszaáll: nincs minimum.');

  // 2. kör: minden csoportnak lehet eltérő minimuma, köztük 90% és custom.
  state.groups.forEach((group, index) => {
    if (index % 2 === 0) localSessionStore.setGroupMinimum(code, group.id, '90');
    else localSessionStore.setGroupMinimum(code, group.id, 'custom', localSessionStore.groupWealth(state, group) + 1);
  });

  localSessionStore.startPublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  for (const player of state.players) {
    const group = state.groups.find((g) => g.memberIds.includes(player.id))!;
    const amount = group.nextMinimumMode === 'custom' ? Math.min(1, player.currentBalance) : player.currentBalance;
    localSessionStore.submitPublicGoods(code, player.id, amount);
  }

  // Nem kell megvárni, hogy mindenki "kész" legyen: a tréner zárhat, a hiányzó tét 0.
  if (state.players.length > 2) {
    // A fenti körben mindenki adott; a lock ettől függetlenül tréneri művelet.
  }
  localSessionStore.lockPublicGoodsRound(code);
  localSessionStore.settlePublicGoodsRound(code);
  state = localSessionStore.get(code)!;

  const customRounds = state.publicGoodsRounds.filter((r) => r.roundNumber === 2 && r.minimumMode === 'custom');
  assert.ok(customRounds.every((r) => r.success === false), 'Minimum alatt a befizetés elvész és nincs visszaosztás.');

  // 3. kör: igazoljuk, hogy nincs előre rögzített körszám.
  state.groups.forEach((group) => localSessionStore.setGroupMinimum(code, group.id, 'none'));
  localSessionStore.startPublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  for (const player of state.players) localSessionStore.submitPublicGoods(code, player.id, 0);
  localSessionStore.lockPublicGoodsRound(code);
  localSessionStore.settlePublicGoodsRound(code);

  localSessionStore.finish(code);
  state = localSessionStore.get(code)!;
  assert.equal(state.roundKey, 'report');
  assert.equal(state.status, 'finished');
  assert.equal(state.publicGoodsRoundNumber, 3);

  const csv = createCsv(state);
  assert.ok(csv.includes('VAGYON'));
  assert.ok(csv.includes('KÖZÖS KASSZA'));
  console.log(`FLOW OK: ${count} résztvevő, 1a–3b, 3 trénervezérelt kasszakör, riport`);
}

function testPublicGoodsCanFinishImmediatelyOrMidRound() {
  const immediateCode = runStrategicStage(4);
  let state = localSessionStore.get(immediateCode)!;
  assert.equal(canFinishPublicGoodsGame(state), true);
  localSessionStore.finish(immediateCode);
  state = localSessionStore.get(immediateCode)!;
  assert.equal(state.roundKey, 'report');
  assert.equal(state.status, 'finished');
  assert.equal(state.publicGoodsRoundNumber, 0, 'A Közös kassza kör nélkül is lezárható.');

  const midRoundCode = runStrategicStage(4);
  state = localSessionStore.get(midRoundCode)!;
  localSessionStore.randomizeGroups(midRoundCode, 1);
  localSessionStore.startPublicGoodsRound(midRoundCode);
  state = localSessionStore.get(midRoundCode)!;
  localSessionStore.submitPublicGoods(midRoundCode, state.players[0].id, Math.min(1000, state.players[0].currentBalance));
  assert.equal(canFinishPublicGoodsGame(localSessionStore.get(midRoundCode)!), true);
  localSessionStore.finish(midRoundCode);
  state = localSessionStore.get(midRoundCode)!;
  assert.equal(state.roundKey, 'report');
  assert.equal(state.status, 'finished');
  assert.equal(state.publicGoodsRoundNumber, 0, 'A félbehagyott kasszakör ne számítson elszámolt körnek.');
  assert.equal(state.publicGoodsRounds.length, 0, 'A félbehagyott kasszakör ne maradjon a riportban.');
  assert.equal(
    state.decisions.some((decision) => decision.type === 'public_goods_contribution'),
    false,
    'A félbehagyott kasszakör tétjei ne kerüljenek a végső riportba.',
  );

  console.log('PUBLIC GOODS FINISH ANYTIME OK');
}

function testManualCorrections() {
  const game = localSessionStore.create(100_000, 2);
  localSessionStore.join(game.code, 'corr-a', 'A');
  localSessionStore.join(game.code, 'corr-b', 'B');
  let state = localSessionStore.startGame(game.code);
  const pair = state.pairings.find((pairing) => pairing.roundKey === '1a')!;
  localSessionStore.submitStrategicDecision(game.code, pair.playerA, { type: 'ultimatum_offer', amount: 40_000 });
  localSessionStore.submitStrategicDecision(game.code, pair.playerB, { type: 'ultimatum_response', accepted: true });
  localSessionStore.closeStrategicRound(game.code);
  state = localSessionStore.get(game.code)!;
  const beforeCorrection = Object.fromEntries(state.players.map((player) => [player.id, player.currentBalance]));
  assert.equal(beforeCorrection[pair.playerA], 60_000);
  assert.equal(beforeCorrection[pair.playerB], 40_000);

  localSessionStore.correctStrategicDecision(game.code, '1a', pair.playerB, false, 'Teszt: rossz elfogadás javítása');
  state = localSessionStore.get(game.code)!;
  assert.equal(state.players.find((p) => p.id === pair.playerA)!.currentBalance, 0);
  assert.equal(state.players.find((p) => p.id === pair.playerB)!.currentBalance, 0);

  localSessionStore.correctPlayerBalance(game.code, pair.playerA, 12_345, 'Teszt: kézi vagyonkorrekció');
  state = localSessionStore.get(game.code)!;
  assert.equal(state.players.find((p) => p.id === pair.playerA)!.currentBalance, 12_345);
  assert.equal(state.manualCorrections.length, 2);

  const poolCode = runStrategicStage(4);
  state = localSessionStore.get(poolCode)!;
  localSessionStore.randomizeGroups(poolCode, 1);
  localSessionStore.startPublicGoodsRound(poolCode);
  state = localSessionStore.get(poolCode)!;
  for (const player of state.players) localSessionStore.submitPublicGoods(poolCode, player.id, Math.min(1000, player.currentBalance));
  localSessionStore.lockPublicGoodsRound(poolCode);
  localSessionStore.settlePublicGoodsRound(poolCode);
  state = localSessionStore.get(poolCode)!;
  const target = state.players[0];
  const beforePoolCorrection = target.currentBalance;
  localSessionStore.correctPublicGoodsContribution(poolCode, 1, target.id, 0, 'Teszt: kasszatét javítása');
  state = localSessionStore.get(poolCode)!;
  assert.ok(state.manualCorrections.some((item) => item.kind === 'public_goods_contribution'));
  assert.notEqual(state.players.find((p) => p.id === target.id)!.currentBalance, beforePoolCorrection);

  console.log('MANUAL CORRECTIONS OK');
}

function testMissingStakeBecomesZero() {
  const code = runStrategicStage(4);
  let state = localSessionStore.get(code)!;
  localSessionStore.randomizeGroups(code, 1);
  state = localSessionStore.get(code)!;
  localSessionStore.setGroupMinimum(code, state.groups[0].id, 'none');
  localSessionStore.startPublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  localSessionStore.submitPublicGoods(code, state.players[0].id, 1000);
  localSessionStore.lockPublicGoodsRound(code);
  state = localSessionStore.get(code)!;
  const round = state.publicGoodsRounds.find((r) => r.roundNumber === 1)!;
  assert.equal(Object.keys(round.contributions).length, 4);
  assert.equal(round.contributions[state.players[1].id], 0);
  console.log('MISSING STAKE -> 0 OK');
}

testUltimatumThirtySecondTimeouts();
testUltimatumTechnicalProtection();
testDictatorAndTrustThirtySecondTimeouts();
testStrategicTechnicalProtectionBeyondUltimatum();
testRecordedSubmitIntentSurvivesNetworkDelay();
testSettlementRules();
testPairingInvariantsForAllSupportedCounts();
for (const count of [2, 3, 4, 5, 6, 7, 50, 100]) {
  const code = runStrategicStage(count);
  testPublicGoodsControl(code, count);
}
testMissingStakeBecomesZero();
testPublicGoodsCanFinishImmediatelyOrMidRound();
testManualCorrections();
console.log('ALL FLOW TESTS PASSED');
process.exit(0);
