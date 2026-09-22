import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  Play,
  QrCode,
  RefreshCcw,
  Smartphone,
  Users,
} from 'lucide-react';
import './styles.css';
import {
  Decision,
  GameSession,
  MAX_PLAYERS,
  MinimumMode,
  Pairing,
  ParticipantSelfReportItem,
  PUBLIC_GOODS_SECONDS,
  ROUND_LABELS,
  StrategicRound,
  STRATEGIC_DECISION_SECONDS,
  ULTIMATUM_PROPOSER_SECONDS,
  ULTIMATUM_RECEIVER_SECONDS,
} from './gameTypes';
import { STRATEGIC_ROUNDS } from './pairingEngine';
import { gameStore } from './store';
import { canFinishGame } from './sessionStore';
import { downloadCsv, downloadTechnicalAudit, reportSummary } from './report';
import { buildGroupPicture, buildHighlightedEvents, buildInterestingEvents, buildSelfReport, InterestingEvent } from './debriefEngine';
import { buildProjectionStory, ProjectionStory } from './projectionStory';
import { buildDebriefEventGroups } from './debriefGrouping';

const formatCredits = (value: number) =>
  new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(value) + ' kr';

const params = new URLSearchParams(window.location.search);
const initialRole = params.get('role');
const initialCode = (params.get('code') || '').toUpperCase();
const testModeRequested = params.get('test') === '1';
const forcedTestPlayerId = testModeRequested ? params.get('testPlayer') : null;

const demoRequested = params.get('demo') === 'trainer';

function completeDemoRound(code: string) {
  let session = gameStore.get(code);
  if (!session || !STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) return;
  const pairings = session.pairings.filter((pairing) => pairing.roundKey === session!.roundKey);

  pairings.forEach((pairing, index) => {
    session = gameStore.get(code)!;
    const base = session.startingCredit;
    const amount = Math.round(base * (0.25 + (index % 5) * 0.1));

    if (pairing.playerA !== 'BOT') {
      if (pairing.gameId === 'ultimatum') {
        gameStore.submitStrategicDecision(code, pairing.playerA, { type: 'ultimatum_offer', amount: Math.min(base, amount) });
      } else if (pairing.gameId === 'dictator') {
        gameStore.submitStrategicDecision(code, pairing.playerA, { type: 'dictator_give', amount: Math.min(base, amount) });
      } else {
        gameStore.submitStrategicDecision(code, pairing.playerA, { type: 'trust_send', amount: Math.min(base, amount) });
      }
    }

    session = gameStore.get(code)!;
    if (pairing.playerB !== 'BOT') {
      if (pairing.gameId === 'ultimatum') {
        gameStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'ultimatum_response',
          accepted: index % 4 !== 0,
        });
      } else if (pairing.gameId === 'trust') {
        const sent = session.decisions.find((decision) => decision.pairingId === pairing.id && decision.type === 'trust_send')?.amount ?? 0;
        gameStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'trust_return',
          amount: Math.round(sent * (0.8 + (index % 3) * 0.35)),
        });
      }
    }
  });

  session = gameStore.get(code)!;
  if (gameStore.roundProgress(session).complete) {
    gameStore.closeStrategicRound(code);
  }
}

function ensureTrainerDemo() {
  if (params.get('reset') === '1') {
    localStorage.removeItem('kreditjatek_demo_code');
  }

  const stored = localStorage.getItem('kreditjatek_demo_code');
  const storedSession = stored ? gameStore.get(stored) : null;
  if (stored && storedSession) {
    storedSession.players.forEach((player) => gameStore.touchPlayer(stored, player.id));
    return stored;
  }

  const demo = gameStore.create(100_000, 12);
  const names = ['Anna', 'Bálint', 'Csilla', 'Dávid', 'Eszter', 'Ferenc', 'Gabi', 'Hanna', 'István', 'Judit', 'Krisztián', 'Lilla'];
  names.forEach((name, index) => gameStore.join(demo.code, `demo-${index + 1}`, name));
  gameStore.startGame(demo.code);

  for (let i = 0; i < 4; i += 1) {
    completeDemoRound(demo.code);
    gameStore.nextRound(demo.code);
  }

  localStorage.setItem('kreditjatek_demo_code', demo.code);
  return demo.code;
}

function sessionPlayerId() {
  if (forcedTestPlayerId) return forcedTestPlayerId;
  let id = localStorage.getItem('kreditjatek_player_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('kreditjatek_player_id', id);
  }
  return id;
}

function playerName(session: GameSession, id: string | 'BOT') {
  if (id === 'BOT') return 'Rendszerjátékos';
  return session.players.find((player) => player.id === id)?.name ?? '–';
}

function pairingFor(session: GameSession, playerId: string, roundKey: StrategicRound) {
  return session.pairings.find(
    (pairing) =>
      pairing.roundKey === roundKey &&
      (pairing.playerA === playerId || pairing.playerB === playerId),
  );
}

function decisionsFor(session: GameSession, pairing?: Pairing) {
  return pairing ? session.decisions.filter((decision) => decision.pairingId === pairing.id) : [];
}

function expectedDecision(session: GameSession, pairing: Pairing, playerId: string): Decision['type'] | null {
  const isA = pairing.playerA === playerId;
  if (pairing.gameId === 'ultimatum') return isA ? 'ultimatum_offer' : 'ultimatum_response';
  if (pairing.gameId === 'dictator') return isA ? 'dictator_give' : null;
  return isA ? 'trust_send' : 'trust_return';
}

function fillVirtualPlayers(session: GameSession) {
  for (let index = session.players.length; index < session.expectedPlayerCount; index += 1) {
    const number = index + 1;
    gameStore.join(
      session.code,
      `test-${session.code}-${String(number).padStart(3, '0')}`,
      `Tesztjátékos ${String(number).padStart(2, '0')}`,
    );
  }
  return gameStore.get(session.code)!;
}

function simulateStrategicRound(code: string) {
  let session = gameStore.get(code);
  if (!session || !STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) return;
  const pairings = session.pairings.filter((pairing) => pairing.roundKey === session!.roundKey);

  pairings.forEach((pairing, index) => {
    session = gameStore.get(code)!;
    let decisions = decisionsFor(session, pairing);
    const base = session.startingCredit;
    const proportion = [0, 0.2, 0.35, 0.5, 0.65][index % 5];
    const amount = Math.round((base * proportion) / 100) * 100;

    if (pairing.gameId === 'ultimatum') {
      if (pairing.playerA !== 'BOT' && !decisions.some((d) => d.type === 'ultimatum_offer')) {
        gameStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'ultimatum_offer',
          amount: Math.min(base, amount),
        });
      }
      session = gameStore.get(code)!;
      decisions = decisionsFor(session, pairing);
      if (pairing.playerB !== 'BOT' && !decisions.some((d) => d.type === 'ultimatum_response') && !decisions.some((d) => d.type === 'ultimatum_timeout')) {
        gameStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'ultimatum_response',
          accepted: index % 4 !== 0,
        });
      }
    }

    if (pairing.gameId === 'dictator') {
      if (pairing.playerA !== 'BOT' && !decisions.some((d) => d.type === 'dictator_give')) {
        gameStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'dictator_give',
          amount: Math.min(base, amount),
        });
      }
    }

    if (pairing.gameId === 'trust') {
      if (pairing.playerA !== 'BOT' && !decisions.some((d) => d.type === 'trust_send')) {
        gameStore.submitStrategicDecision(code, pairing.playerA, {
          type: 'trust_send',
          amount: Math.min(base, amount),
        });
      }
      session = gameStore.get(code)!;
      decisions = decisionsFor(session, pairing);
      const sent = decisions.find((d) => d.type === 'trust_send')?.amount;
      if (pairing.playerB !== 'BOT' && sent !== undefined && !decisions.some((d) => d.type === 'trust_return')) {
        const available = sent * 3;
        const returned = Math.round((available * [0, 0.2, 0.4, 0.6][index % 4]) / 100) * 100;
        gameStore.submitStrategicDecision(code, pairing.playerB, {
          type: 'trust_return',
          amount: Math.min(available, returned),
        });
      }
    }
  });
}

function simulatePublicGoodsRound(code: string) {
  const session = gameStore.get(code);
  if (!session || session.roundKey !== '4' || session.publicGoodsPhase !== 'open') return;
  session.players.forEach((player, index) => {
    const ratios = [0, 0.1, 0.25, 0.5, 0.75];
    const amount = Math.round((player.currentBalance * ratios[index % ratios.length]) / 100) * 100;
    gameStore.submitPublicGoods(code, player.id, Math.min(player.currentBalance, amount));
  });
}

function Landing({ onTrainer, onPlayer }: { onTrainer: () => void; onPlayer: () => void }) {
  return (
    <main className="shell narrow">
      <header className="brand">
        <p className="eyebrow">Online tréninggyakorlat</p>
        <h1>Kreditjáték</h1>
        <p>Tréneri vezérlés és résztvevői mobilkliens.</p>
      </header>
      <section className="choice-grid">
        <button className="choice-card" onClick={onTrainer}>
          <Users size={30} />
          <strong>Trénerként indítom</strong>
          <span>Setup, QR-belépés, körvezérlés, teljes áttekintő tábla és riport.</span>
        </button>
        <button className="choice-card light" onClick={onPlayer}>
          <Smartphone size={30} />
          <strong>Résztvevőként csatlakozom</strong>
          <span>Játékkód vagy QR után névvel belépés.</span>
        </button>
      </section>
    </main>
  );
}

function TrainerStart({ onCreated, testMode = false }: { onCreated: (session: GameSession) => void; testMode?: boolean }) {
  const [startingCredit, setStartingCredit] = useState(100_000);
  const [playerCount, setPlayerCount] = useState(12);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const create = async (virtual = false) => {
    setCreating(true);
    setCreateError('');
    try {
      await gameStore.ready();
      const credit = Math.max(1_000, Math.min(1_000_000, Math.round(startingCredit / 100) * 100));
      const count = Math.max(2, Math.min(MAX_PLAYERS, Math.round(playerCount)));
      const created = gameStore.create(credit, count);
      const prepared = virtual ? fillVirtualPlayers(created) : created;
      await gameStore.afterCreate(prepared);
      onCreated(prepared);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Nem sikerült létrehozni a játékot.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="shell narrow">
      <header className="brand">
        <p className="eyebrow">{testMode ? 'Firebase előtti tesztmód' : 'Tréneri setup'}</p>
        <h1>Új Kreditjáték</h1>
        <p>
          {testMode
            ? 'Ugyanaz a játékmotor fut, mint az éles játékban. A virtuális résztvevők csak az emberi jelenlétet helyettesítik.'
            : 'Indulás előtt ezt a két dolgot kell megadnod. Később minden a dashboardról vezérelhető.'}
        </p>
      </header>
      <section className="panel setup-panel">
        <div className="setup-grid">
          <label className="field">
            <span>Játékosok száma</span>
            <input
              type="number"
              min={2}
              max={MAX_PLAYERS}
              value={playerCount}
              onChange={(event) => setPlayerCount(Number(event.target.value))}
            />
            <small>2–{MAX_PLAYERS} fő.</small>
          </label>
          <label className="field">
            <span>Induló kredit</span>
            <input
              type="number"
              min={1000}
              max={1000000}
              step={100}
              value={startingCredit}
              onChange={(event) => setStartingCredit(Number(event.target.value))}
            />
            <small>1 000–1 000 000, 100-as lépésekben.</small>
          </label>
        </div>
        {createError && <div className="error">{createError}</div>}
        <div className="setup-actions">
          <button className="primary big" disabled={creating} onClick={() => void create(false)}><Play size={19} />{creating ? 'Kapcsolódás…' : 'Játék előkészítése'}</button>
          {testMode && (
            <button className="secondary big test-create" disabled={creating} onClick={() => void create(true)}>
              <Users size={19} />Tesztjáték virtuális résztvevőkkel
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function SummaryCell({ lines }: { lines: React.ReactNode[] }) {
  return (
    <div className="summary-cell">
      {lines.length ? lines.map((line, index) => <div key={index}>{line}</div>) : <span className="muted">–</span>}
    </div>
  );
}

function UltimatumCell({ session, playerId }: { session: GameSession; playerId: string }) {
  let offered: number | undefined;
  let offerResult: boolean | undefined;
  let offerTimedOut = false;
  let received: number | undefined;
  let ownResponse: boolean | undefined;
  let responseTimedOut = false;

  for (const round of ['1a', '1b'] as const) {
    const pairing = pairingFor(session, playerId, round);
    if (!pairing) continue;
    const decisions = decisionsFor(session, pairing);
    const offer = decisions.find((decision) => decision.type === 'ultimatum_offer')?.amount;
    const response = decisions.find((decision) => decision.type === 'ultimatum_response')?.accepted;
    const timeout = decisions.find((decision) => decision.type === 'ultimatum_timeout');

    if (pairing.playerA === playerId) {
      offered = offer;
      offerResult = response;
      offerTimedOut = timeout?.timedOutRole === 'proposer' || timeout?.timedOutRole === 'receiver';
    } else {
      received = offer;
      ownResponse = response;
      responseTimedOut = timeout?.timedOutRole === 'receiver';
    }
  }

  const result = (value?: boolean, timedOut = false) =>
    timedOut
      ? <span className="bad">időtúllépés</span>
      : value === undefined
        ? '–'
        : value
          ? <span className="good">elfogadva</span>
          : <span className="bad">elutasítva</span>;

  return <SummaryCell lines={[
    <>Adott: <b>{offered === undefined ? '–' : formatCredits(offered)}</b></>,
    <>Ajánlata: {result(offerResult, offerTimedOut)}</>,
    <>Kapott: <b>{received === undefined ? '–' : formatCredits(received)}</b></>,
    <>Döntése: {result(ownResponse, responseTimedOut)}</>,
  ]} />;
}

function DictatorCell({ session, playerId }: { session: GameSession; playerId: string }) {
  let given: number | undefined;
  let received: number | undefined;
  let gaveTimedOut = false;
  let partnerTimedOut = false;

  for (const round of ['2a', '2b'] as const) {
    const pairing = pairingFor(session, playerId, round);
    if (!pairing) continue;
    const decision = decisionsFor(session, pairing).find((item) => item.type === 'dictator_give');
    const amount = decision?.amount;
    if (pairing.playerA === playerId) {
      given = amount;
      gaveTimedOut = decision?.timedOutRole === 'dictator';
    } else {
      received = amount;
      partnerTimedOut = decision?.timedOutRole === 'dictator';
    }
  }

  return <SummaryCell lines={[
    <>Adott: <b>{given === undefined ? '–' : formatCredits(given)}</b> {gaveTimedOut && <span className="bad">idő → 0</span>}</>,
    <>Kapott: <b>{received === undefined ? '–' : formatCredits(received)}</b> {partnerTimedOut && <span className="bad">partner idő → 0</span>}</>,
  ]} />;
}

function TrustCell({ session, playerId }: { session: GameSession; playerId: string }) {
  let sent: number | undefined;
  let gotBack: number | undefined;
  let receivedTripled: number | undefined;
  let returned: number | undefined;
  let sentTimedOut = false;
  let returnTimedOut = false;
  let partnerSendTimedOut = false;
  let partnerReturnTimedOut = false;

  for (const round of ['3a', '3b'] as const) {
    const pairing = pairingFor(session, playerId, round);
    if (!pairing) continue;
    const decisions = decisionsFor(session, pairing);
    const sendDecision = decisions.find((decision) => decision.type === 'trust_send');
    const backDecision = decisions.find((decision) => decision.type === 'trust_return');
    const send = sendDecision?.amount;
    const back = backDecision?.amount;

    if (pairing.playerA === playerId) {
      sent = send;
      gotBack = back;
      sentTimedOut = sendDecision?.timedOutRole === 'sender';
      partnerReturnTimedOut = backDecision?.timedOutRole === 'returner';
    } else {
      receivedTripled = send === undefined ? undefined : send * 3;
      returned = back;
      partnerSendTimedOut = sendDecision?.timedOutRole === 'sender';
      returnTimedOut = backDecision?.timedOutRole === 'returner';
    }
  }

  return <SummaryCell lines={[
    <>Küldött: <b>{sent === undefined ? '–' : formatCredits(sent)}</b> {sentTimedOut && <span className="bad">idő → 0</span>}</>,
    <>Visszakapott: <b>{gotBack === undefined ? '–' : formatCredits(gotBack)}</b> {partnerReturnTimedOut && <span className="bad">partner idő → 0</span>}</>,
    <>Kapott: <b>{receivedTripled === undefined ? '–' : formatCredits(receivedTripled)}</b> {partnerSendTimedOut && <span className="bad">partner idő → 0</span>}</>,
    <>Visszaadott: <b>{returned === undefined ? '–' : formatCredits(returned)}</b> {returnTimedOut && <span className="bad">idő → 0</span>}</>,
  ]} />;
}

function PairHistoryCell({ session, playerId }: { session: GameSession; playerId: string }) {
  return (
    <div className="pair-history">
      {STRATEGIC_ROUNDS.map((round) => {
        const pairing = pairingFor(session, playerId, round);
        if (!pairing) return <span key={round}><b>{round}</b> –</span>;
        const partnerId = pairing.playerA === playerId ? pairing.playerB : pairing.playerA;
        return <span key={round}><b>{round}</b> {playerName(session, partnerId)}</span>;
      })}
    </div>
  );
}

function PlayerRoundState({ session, playerId }: { session: GameSession; playerId: string }) {
  if (session.roundKey === 'lobby') return <span className="state neutral">belépve</span>;

  if (STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) {
    const pairing = gameStore.getPairingForPlayer(session, playerId);
    if (!pairing) return <span className="state wait">nincs pár</span>;

    const technicalIssue = session.strategicTechnicalIssues.find(
      (issue) => issue.pairingId === pairing.id && issue.playerId === playerId,
    );
    if (technicalIssue) {
      return (
        <span className="state technical">
          technikai hiba
          <button
            className="state-action"
            onClick={() => gameStore.reopenTechnicalDecision(session.code, pairing.id, playerId)}
          >
            30 mp újra
          </button>
        </span>
      );
    }

    const timeout = session.decisions.find(
      (decision) => decision.pairingId === pairing.id &&
        (decision.type === 'ultimatum_timeout' || decision.timedOutRole !== undefined),
    );
    if (timeout) return <span className="state wait">idő lejárt → 0</span>;

    const expected = expectedDecision(session, pairing, playerId);
    if (!expected) {
      const partnerDone = session.decisions.some(
        (decision) => decision.pairingId === pairing.id &&
          (decision.type === 'dictator_give' || decision.type === 'trust_send'),
      );
      return <span className={'state ' + (partnerDone ? 'ok' : 'neutral')}>{partnerDone ? 'érkezett' : 'fogadó'}</span>;
    }

    const done = session.decisions.some(
      (decision) => decision.pairingId === pairing.id && decision.playerId === playerId && decision.type === expected,
    );
    return done ? <span className="state ok">kész</span> : <span className="state wait">várunk</span>;
  }

  if (session.roundKey === '4') {
    if (session.publicGoodsPhase === 'setup') return <span className="state neutral">következő kör</span>;
    const round = session.publicGoodsRounds.find(
      (item) => item.roundNumber === session.publicGoodsRoundNumber && item.memberIds.includes(playerId),
    );
    const hasStake = round?.contributions[playerId] !== undefined;
    if (session.publicGoodsPhase === 'locked') return <span className="state neutral">tét lezárva</span>;
    return hasStake ? <span className="state ok">tét bent</span> : <span className="state wait">várunk</span>;
  }

  return <span className="state ok">kész</span>;
}

function GameTimeline({ session }: { session: GameSession }) {
  const stages = [
    { id: 'lobby', label: 'Belépés', rounds: [] as StrategicRound[] },
    { id: 'ultimatum', label: 'Ultimátum', rounds: ['1a', '1b'] as StrategicRound[] },
    { id: 'dictator', label: 'Diktátor', rounds: ['2a', '2b'] as StrategicRound[] },
    { id: 'trust', label: 'Bizalom', rounds: ['3a', '3b'] as StrategicRound[] },
    { id: 'pool', label: 'Közös kassza', rounds: [] as StrategicRound[] },
  ];

  return (
    <div className="game-timeline" aria-label="Játékmenet">
      {stages.map((stage, index) => {
        const active =
          (stage.id === 'lobby' && session.roundKey === 'lobby') ||
          stage.rounds.includes(session.roundKey as StrategicRound) ||
          (stage.id === 'pool' && (session.roundKey === '4' || session.roundKey === 'report'));
        const done =
          stage.id === 'lobby'
            ? session.roundKey !== 'lobby'
            : stage.id === 'pool'
              ? session.roundKey === 'report'
              : stage.rounds.every((round) => session.closedRounds.includes(round));
        return (
          <React.Fragment key={stage.id}>
            <div className={'timeline-stage ' + (active ? 'active ' : '') + (done ? 'done' : '')}>
              <span className="timeline-index">{done ? '✓' : index + 1}</span>
              <div>
                <strong>{stage.label}</strong>
                {stage.rounds.length > 0 && (
                  <small>
                    {stage.rounds.map((round) => (
                      <b key={round} className={session.closedRounds.includes(round) ? 'round-done' : session.roundKey === round ? 'round-active' : ''}>
                        {round}
                      </b>
                    ))}
                  </small>
                )}
              </div>
            </div>
            {index < stages.length - 1 && <span className="timeline-line" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TrainerPulse({ session }: { session: GameSession }) {
  const online = session.players.filter((player) => gameStore.isPlayerOnline(player)).length;
  const offline = session.players.length - online;
  const technical = session.strategicTechnicalIssues.filter((issue) => issue.roundKey === session.roundKey).length;
  const currentTimeouts = STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)
    ? session.decisions.filter((decision) => decision.roundKey === session.roundKey && decision.timedOutRole !== undefined).length
    : 0;

  let ready = session.players.length;
  let total = session.expectedPlayerCount;
  let label = 'belépett';

  if (STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) {
    const roundProgress = gameStore.roundProgress(session);
    ready = roundProgress.ready;
    total = roundProgress.total;
    label = 'pár kész';
  } else if (session.roundKey === '4' && session.publicGoodsPhase === 'open') {
    const roundProgress = gameStore.publicGoodsProgress(session);
    ready = roundProgress.ready;
    total = roundProgress.total;
    label = 'tét bent';
  } else if (session.roundKey === '4' && session.publicGoodsPhase === 'locked') {
    ready = session.players.length;
    total = session.players.length;
    label = 'tét lezárva';
  }

  let timeValue = '–';
  let timeLabel = 'nincs aktív visszaszámlálás';
  let timeClass = 'neutral-card';

  if (STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound) && !session.closedRounds.includes(session.roundKey as StrategicRound)) {
    const deadlines: string[] = [];
    const currentPairings = session.pairings.filter((pairing) => pairing.roundKey === session.roundKey);
    for (const pairing of currentPairings) {
      for (const playerId of [pairing.playerA, pairing.playerB]) {
        if (playerId === 'BOT') continue;
        const deadline = gameStore.strategicDeadlineAt(session, pairing.id, playerId);
        if (deadline) deadlines.push(deadline);
      }
    }

    if (deadlines.length > 0) {
      const seconds = Math.max(
        0,
        Math.min(...deadlines.map((deadline) => Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000))),
      );
      timeValue = seconds + ' mp';
      timeLabel = deadlines.length + ' aktív döntési idő · a legkevesebb';
      timeClass = seconds <= 5 ? 'danger-card' : seconds <= 10 ? 'warning' : 'time-active';
    } else {
      const roundProgress = gameStore.roundProgress(session);
      timeValue = roundProgress.complete ? 'kész' : '30 mp';
      timeLabel = roundProgress.complete ? 'minden döntés beérkezett' : 'játékosonként, a feladat megjelenésétől';
      timeClass = roundProgress.complete ? 'success' : 'neutral-card';
    }
  } else if (session.roundKey === '4' && session.publicGoodsPhase === 'open') {
    const seconds = gameStore.publicGoodsSecondsLeft(session);
    timeValue = seconds + ' mp';
    timeLabel = 'közös kassza · teljes kör';
    timeClass = seconds <= 5 ? 'danger-card' : seconds <= 10 ? 'warning' : 'time-active';
  } else if (session.roundKey === '4' && session.publicGoodsPhase === 'locked') {
    timeValue = 'lezárva';
    timeLabel = 'banki elszámolásra vár';
    timeClass = 'neutral-card';
  }

  const progress = total > 0 ? Math.min(100, Math.round((ready / total) * 100)) : 0;

  return (
    <div className="trainer-pulse">
      <div className="pulse-card primary-metric">
        <span>Készültség</span>
        <strong>{ready}/{total}</strong>
        <small>{label}</small>
        <div className="metric-progress"><i style={{ width: progress + '%' }} /></div>
      </div>
      <div className={'pulse-card ' + (offline > 0 ? 'warning' : 'success')}>
        <span>Kapcsolat</span>
        <strong>{online}/{session.players.length}</strong>
        <small>{offline > 0 ? offline + ' offline' : 'mindenki online'}</small>
      </div>
      <div className={'pulse-card trainer-time-card ' + timeClass}>
        <span>Idő</span>
        <strong>{timeValue}</strong>
        <small>{timeLabel}</small>
      </div>
      <div className={'pulse-card issue-card ' + (technical + currentTimeouts > 0 ? 'danger-card' : 'neutral-card')}>
        <span>Hibák</span>
        <strong>{technical + currentTimeouts}</strong>
        <small>
          {technical + currentTimeouts > 0
            ? [
                technical > 0 ? technical + ' technikai hiba' : '',
                currentTimeouts > 0 ? currentTimeouts + ' időtúllépés' : '',
              ].filter(Boolean).join(' · ')
            : 'nincs hiba'}
        </small>
      </div>
      <div className="pulse-card">
        <span>Induló kredit</span>
        <strong className="metric-credit">{formatCredits(session.startingCredit)}</strong>
        <small>1a–3b körönként</small>
      </div>
    </div>
  );
}

function TrainerAttention({ session }: { session: GameSession }) {
  const offline = session.players.filter((player) => !gameStore.isPlayerOnline(player));
  if (offline.length === 0) return null;

  return (
    <div className="attention-strip">
      <div className="attention-item warning-attention">
        <strong>{offline.length} offline résztvevő</strong>
        <span>{offline.slice(0, 5).map((player) => player.name).join(', ')}{offline.length > 5 ? '…' : ''}</span>
      </div>
    </div>
  );
}

function CurrentPairsBoard({ session }: { session: GameSession }) {
  if (!STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) return null;
  const pairings = session.pairings.filter((pairing) => pairing.roundKey === session.roundKey);

  return (
    <section className="panel pair-board dashboard-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">Aktuális kör · páronként</p>
          <h2>Élő páros helyzetkép</h2>
        </div>
        <span className="pill">{pairings.length} pár</span>
      </div>

      <div className="pair-board-grid">
        {pairings.map((pairing, index) => {
          const decisions = decisionsFor(session, pairing);
          const tech = session.strategicTechnicalIssues.some((issue) => issue.pairingId === pairing.id);
          const timed = decisions.some((decision) => decision.timedOutRole !== undefined || decision.type === 'ultimatum_timeout');
          let state: 'success' | 'failed' | 'waiting' | 'technical' = 'waiting';
          let detail = 'Döntés folyamatban';

          if (tech) {
            state = 'technical';
            detail = 'Technikai ellenőrzés';
          } else if (pairing.gameId === 'ultimatum') {
            const offer = decisions.find((decision) => decision.type === 'ultimatum_offer');
            const response = decisions.find((decision) => decision.type === 'ultimatum_response');
            if (timed) {
              state = 'failed';
              detail = 'Időtúllépés · 0–0';
            } else if (response) {
              state = response.accepted ? 'success' : 'failed';
              detail = response.accepted
                ? `Elfogadva · ${formatCredits(offer?.amount ?? 0)}`
                : 'Elutasítva · 0–0';
            } else if (offer) {
              detail = `Ajánlat: ${formatCredits(offer.amount ?? 0)} · válaszra vár`;
            }
          } else if (pairing.gameId === 'dictator') {
            const give = decisions.find((decision) => decision.type === 'dictator_give');
            if (give) {
              state = give.timedOutRole === 'dictator' ? 'failed' : 'success';
              detail = give.timedOutRole === 'dictator'
                ? 'Időtúllépés · 0 átadás'
                : `Átadás: ${formatCredits(give.amount ?? 0)}`;
            }
          } else {
            const send = decisions.find((decision) => decision.type === 'trust_send');
            const returned = decisions.find((decision) => decision.type === 'trust_return');
            if (returned) {
              state = timed ? 'failed' : 'success';
              detail = timed
                ? `Időtúllépés · küldött ${formatCredits(send?.amount ?? 0)} · vissza ${formatCredits(returned.amount ?? 0)}`
                : `Küldött ${formatCredits(send?.amount ?? 0)} · vissza ${formatCredits(returned.amount ?? 0)}`;
            } else if (send) {
              detail = `Küldött ${formatCredits(send.amount ?? 0)} · visszaadásra vár`;
            }
          }

          return (
            <div className={'pair-tile pair-' + state} key={pairing.id}>
              <div className="pair-tile-top">
                <span className="pair-number">#{index + 1}</span>
                <span className={'pair-state pair-state-' + state}>
                  {state === 'success' ? 'KÉSZ' : state === 'failed' ? 'SIKERTELEN' : state === 'technical' ? 'TECHNIKAI HIBA' : 'VÁR'}
                </span>
              </div>
              <div className="pair-names">
                <strong>{playerName(session, pairing.playerA)}</strong>
                <span>→</span>
                <strong>{playerName(session, pairing.playerB)}</strong>
              </div>
              <p>{detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlayerTable({ session }: { session: GameSession }) {
  return (
    <details className="panel player-table-panel dashboard-section diagnostic-details">
      <summary className="diagnostic-summary">
        <div>
          <p className="eyebrow">Diagnosztikai nézet</p>
          <strong>Résztvevők és egyéni történet</strong>
        </div>
        <span>{session.players.length} fő</span>
      </summary>

      <div className="diagnostic-body">
        <div className="status-legend diagnostic-legend">
          <span className="legend-chip success-chip">kész / sikeres</span>
          <span className="legend-chip wait-chip">várakozik</span>
          <span className="legend-chip fail-chip">sikertelen / időtúllépés</span>
          <span className="legend-chip technical-chip">technikai hiba</span>
        </div>

        <div className="trainer-table-wrap">
          <table className="trainer-table trainer-table-v2">
            <thead>
              <tr>
                <th className="sticky-player">Játékos / most</th>
                <th>Ultimátum · 1a/1b</th>
                <th>Diktátor · 2a/2b</th>
                <th>Bizalom · 3a/3b</th>
                <th>Vagyon</th>
                <th>Párok · 1a–3b</th>
              </tr>
            </thead>
            <tbody>
              {session.players.map((player, index) => {
                const online = gameStore.isPlayerOnline(player);
                const currentPairing = STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)
                  ? gameStore.getPairingForPlayer(session, player.id)
                  : undefined;
                const tech = currentPairing && session.strategicTechnicalIssues.some(
                  (issue) => issue.pairingId === currentPairing.id && issue.playerId === player.id,
                );
                const timeout = currentPairing && session.decisions.some(
                  (decision) => decision.pairingId === currentPairing.id && decision.playerId === player.id && decision.timedOutRole !== undefined,
                );
                const rowClass = player.botControlled ? 'row-bot-controlled' : tech ? 'row-technical' : timeout ? 'row-failed' : !online ? 'row-offline' : '';
                return (
                  <tr key={player.id} className={rowClass}>
                    <td className="sticky-player player-ident">
                      <span className={'presence-dot ' + (online ? 'online' : 'offline')} />
                      <span className="row-number">{index + 1}</span>
                      <div>
                        <strong>{player.name}</strong>
                        <div className="player-sub">
                          <PlayerRoundState session={session} playerId={player.id} />
                          <span>{player.botControlled ? 'BOT irányítja' : online ? 'online' : 'offline'}</span>
                          {session.status === 'active' && session.roundKey !== 'lobby' && session.roundKey !== 'report' && (
                            <button
                              type="button"
                              className={'bot-control-toggle ' + (player.botControlled ? 'is-active' : '')}
                              onClick={() => gameStore.setPlayerBotControl(session.code, player.id, !player.botControlled)}
                            >
                              {player.botControlled ? 'Irányítás visszaadása' : 'BOT vegye át'}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td><UltimatumCell session={session} playerId={player.id} /></td>
                    <td><DictatorCell session={session} playerId={player.id} /></td>
                    <td><TrustCell session={session} playerId={player.id} /></td>
                    <td className="wealth-cell">
                      <strong>{formatCredits(player.currentBalance)}</strong>
                      {session.firstStageFinalBalance[player.id] !== undefined && (
                        <small>3b után {formatCredits(session.firstStageFinalBalance[player.id])}</small>
                      )}
                    </td>
                    <td><PairHistoryCell session={session} playerId={player.id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function CurrentRoundStatus({ session }: { session: GameSession }) {
  if (STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound)) {
    const progress = gameStore.roundProgress(session);
    return <>{progress.ready}/{progress.total} pár kész</>;
  }
  if (session.roundKey === '4') {
    if (session.publicGoodsPhase === 'setup') {
      return <>{session.publicGoodsRoundNumber} kör elszámolva</>;
    }
    if (session.publicGoodsPhase === 'locked') return <>tétek lezárva</>;
    const progress = gameStore.publicGoodsProgress(session);
    const left = gameStore.publicGoodsSecondsLeft(session);
    return <>{progress.ready}/{progress.total} tét · {left} mp</>;
  }
  return <>–</>;
}

type RulesProjectionGame = 'ultimatum' | 'dictator' | 'trust' | 'publicGoods';
type ProjectionMode = 'qr' | RulesProjectionGame;

const RULES_PROJECTION_OPTIONS: { id: RulesProjectionGame; label: string; short: string }[] = [
  { id: 'ultimatum', label: 'Ultimátumjáték', short: '1. játék' },
  { id: 'dictator', label: 'Diktátorjáték', short: '2. játék' },
  { id: 'trust', label: 'Bizalomjáték', short: '3. játék' },
  { id: 'publicGoods', label: 'Közös kassza', short: '4. játék' },
];

let projectionWindow: Window | null = null;

function rulesProjectionGameForSession(session: GameSession): RulesProjectionGame {
  if (session.roundKey === '1a' || session.roundKey === '1b' || session.roundKey === 'lobby') return 'ultimatum';
  if (session.roundKey === '2a' || session.roundKey === '2b') return 'dictator';
  if (session.roundKey === '3a' || session.roundKey === '3b') return 'trust';
  return 'publicGoods';
}

function rulesProjectionCopy(session: GameSession, game: RulesProjectionGame) {
  const credit = formatCredits(session.startingCredit);

  if (game === 'ultimatum') {
    return {
      stage: '1. játék · két kör',
      title: 'Ultimátumjáték',
      lead: `Az egyik játékos ${credit} kreditet kap. Ebből ajánl fel valamennyit a párjának.`,
      rules: [
        ['Ajánlat', `Az ajánlattevő 0 és ${credit} között dönt: mennyit ajánl fel a másik játékosnak?`],
        ['Elfogadás vagy elutasítás', 'A fogadó látja az ajánlatot, majd eldönti, elfogadja-e. Alku és ellenajánlat nincs.'],
        ['Elszámolás', 'Elfogadáskor a fogadó megkapja a felajánlott összeget, az ajánlattevőnél marad a többi. Elutasításkor ebből a körből mindketten 0 kreditet kapnak.'],
        ['Második kör', 'Mindenki a másik szerepbe kerül, és a rendszer új párosítást készít.'],
      ],
      decision: 'Ajánlattevő: mennyit ajánlasz? · Fogadó: elfogadod vagy elutasítod?',
      footer: `Döntési idő: ${STRATEGIC_DECISION_SECONDS} másodperc / döntés. A kör eredménye hozzáadódik a vagyonodhoz.`,
    };
  }

  if (game === 'dictator') {
    return {
      stage: '2. játék · két kör',
      title: 'Diktátorjáték',
      lead: `Az egyik játékos ${credit} kreditet kap, és egyedül dönti el, mennyit ad belőle a párjának.`,
      rules: [
        ['Egyetlen döntés', `A döntő játékos 0 és ${credit} között választ: mennyit ad a másiknak?`],
        ['A fogadó nem dönt', 'A másik játékos nem fogad el és nem utasít el semmit. Azt az összeget kapja, amit neki adnak.'],
        ['Elszámolás', 'A döntő játékosnál marad, amit nem adott oda. A fogadó vagyonához az átadott összeg kerül.'],
        ['Második kör', 'Mindenki a másik szerepbe kerül, és a rendszer új párosítást készít.'],
      ],
      decision: 'Döntő játékos: mennyit adsz? · Fogadó játékos: ebben a körben nincs döntésed.',
      footer: `A döntő játékosnak ${STRATEGIC_DECISION_SECONDS} másodperce van. Ha nem dönt, 0 kreditet ad.`,
    };
  }

  if (game === 'trust') {
    return {
      stage: '3. játék · két kör',
      title: 'Bizalomjáték',
      lead: `Az egyik játékos ${credit} kreditet kap. Eldönti, mennyit küld belőle a párjának – a bank az elküldött összeget megháromszorozza.`,
      rules: [
        ['Küldés', `A küldő 0 és ${credit} között dönt. Amit nem küld el, nála marad.`],
        ['A bank háromszoroz', 'A bank az elküldött összeget megszorozza hárommal, és ezt az összeget kapja meg a másik játékos.'],
        ['Visszaadás', 'A fogadó ezután szabadon eldönti, mennyit ad vissza a hozzá került összegből. Akár 0 kreditet is visszaadhat.'],
        ['Elszámolás', 'A küldőnél a meg nem küldött összeg + a visszakapott kredit marad. A fogadónál a háromszorozott összeg vissza nem adott része marad.'],
      ],
      decision: 'Küldő: mennyit küldesz? · Fogadó: mennyit adsz vissza a háromszorozott összegből?',
      footer: `Mindkét döntésre ${STRATEGIC_DECISION_SECONDS} másodperc van. A következő körben szerepcsere és új párosítás következik.`,
    };
  }

  return {
    stage: '4. játék · több kör',
    title: 'Közös kassza',
    lead: 'Az első három játékban megszerzett vagyonoddal érkezel ide. Csoportban játszotok, és minden körben a saját vagyonodból döntesz.',
    rules: [
      ['Befizetés', 'Eldöntöd, mennyit teszel a saját vagyonodból a közös kasszába. 0 kredit is lehet.'],
      ['A bank dupláz', 'A csoport összes befizetését a bank megduplázza.'],
      ['Egyenlő visszaosztás', 'A megduplázott kasszát a bank egyenlő részben osztja szét a csoport tagjai között – függetlenül attól, ki mennyit fizetett be.'],
      ['Minimum lehet', 'Ha a körben van minimum és a csoport nem éri el, a bank nem fizet vissza, a befizetések pedig elvesznek. Ha nincs minimum, nincs ilyen feltétel. A saját csoportodra érvényes minimumot a telefonodon látod.'],
    ],
    decision: 'Mennyit teszel a saját vagyonodból a közös kasszába?',
    footer: `${PUBLIC_GOODS_SECONDS} másodperc / kör. A tétedet az idő lejártáig módosíthatod; az utolsó mentett összeg számít. Ha nincs tét, 0 kredit számít. Az elszámolt vagyonoddal mész tovább.`,
  };
}

function ensureProjectionWindow() {
  if (projectionWindow && !projectionWindow.closed) return projectionWindow;

  const availableWidth = window.screen.availWidth || 1920;
  const availableHeight = window.screen.availHeight || 1080;
  const width = Math.min(1480, Math.max(1180, availableWidth - 360));
  const height = Math.min(860, Math.max(720, availableHeight - 180));
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  projectionWindow = window.open(
    '',
    'kreditjatek-projection',
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`,
  );
  return projectionWindow;
}

function renderRulesProjectionWindow(session: GameSession, game: RulesProjectionGame) {
  const target = ensureProjectionWindow();
  if (!target) return false;

  const copy = rulesProjectionCopy(session, game);
  const doc = target.document;
  doc.title = `Kreditjáték – ${copy.title}`;

  let style = doc.getElementById('kreditjatek-projection-style') as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = 'kreditjatek-projection-style';
    doc.head.appendChild(style);
  }
  style.textContent = `
      :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#10213a;background:#f6f8fb}
      *{box-sizing:border-box}
      html,body{width:100%;height:100%;overflow:hidden}
      body{margin:0;background:linear-gradient(145deg,#ffffff 0%,#f5f7fb 58%,#edf2f7 100%);padding:24px 36px}
      main{width:min(1380px,100%);height:100%;margin:0 auto;display:flex;flex-direction:column;justify-content:center}
      .stage{font-size:clamp(14px,1.15vw,18px);font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:5px}
      h1{font-size:clamp(42px,4.5vw,68px);line-height:.98;margin:0;color:#10213a;letter-spacing:-.04em}
      .lead{font-size:clamp(19px,1.8vw,27px);line-height:1.24;font-weight:650;max-width:1280px;margin:13px 0 17px;color:#334155}
      .rules{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
      .rule{display:grid;grid-template-columns:46px 1fr;gap:13px;align-items:start;min-height:112px;padding:13px 15px;background:#fff;border:1px solid #dbe3ed;border-radius:12px;box-shadow:0 6px 20px rgba(15,23,42,.04)}
      .number{width:40px;height:40px;border-radius:10px;background:#10213a;color:#fff;display:grid;place-items:center;font-size:19px;font-weight:950}
      .rule strong{display:block;font-size:clamp(18px,1.45vw,23px);margin:0 0 3px;color:#10213a}
      .rule p{margin:0;font-size:clamp(15px,1.25vw,19px);line-height:1.3;color:#475569}
      .decision{margin-top:15px;padding:14px 18px;border-radius:13px;background:#10213a;color:#fff}
      .decision span{display:block;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#a8dfe0;margin-bottom:4px}
      .decision strong{font-size:clamp(20px,1.9vw,29px);line-height:1.18}
      .footer{margin:10px 2px 0;font-size:clamp(13px,1.1vw,17px);line-height:1.28;font-weight:700;color:#64748b}
      @media(max-width:1050px){
        body{padding:18px 24px}
        .lead{font-size:18px;margin:10px 0 13px}
        .rules{gap:8px}
        .rule{min-height:100px;padding:10px 12px}
        .rule p{font-size:14px}
        .decision{margin-top:10px;padding:11px 14px}
        .footer{margin-top:7px;font-size:12px}
      }
    `;

  const main = doc.createElement('main');

  const stage = doc.createElement('div');
  stage.className = 'stage';
  stage.textContent = copy.stage;
  main.appendChild(stage);

  const title = doc.createElement('h1');
  title.textContent = copy.title;
  main.appendChild(title);

  const lead = doc.createElement('p');
  lead.className = 'lead';
  lead.textContent = copy.lead;
  main.appendChild(lead);

  const rules = doc.createElement('section');
  rules.className = 'rules';
  copy.rules.forEach(([heading, text], index) => {
    const item = doc.createElement('div');
    item.className = 'rule';

    const number = doc.createElement('div');
    number.className = 'number';
    number.textContent = String(index + 1);
    item.appendChild(number);

    const body = doc.createElement('div');
    const strong = doc.createElement('strong');
    strong.textContent = heading;
    const paragraph = doc.createElement('p');
    paragraph.textContent = text;
    body.append(strong, paragraph);
    item.appendChild(body);
    rules.appendChild(item);
  });
  main.appendChild(rules);

  const decision = doc.createElement('div');
  decision.className = 'decision';
  const decisionLabel = doc.createElement('span');
  decisionLabel.textContent = 'Miről kell döntened?';
  const decisionText = doc.createElement('strong');
  decisionText.textContent = copy.decision;
  decision.append(decisionLabel, decisionText);
  main.appendChild(decision);

  const footer = doc.createElement('p');
  footer.className = 'footer';
  footer.textContent = copy.footer;
  main.appendChild(footer);

  doc.body.replaceChildren(main);
  return true;
}

function renderQrProjectionWindow(session: GameSession, joinUrl: string) {
  const target = ensureProjectionWindow();
  if (!target) return false;

  const sourceSvg = document.querySelector('#projection-qr-source svg');
  if (!sourceSvg) return false;

  const doc = target.document;
  doc.title = 'Kreditjáték – QR-kód';

  let style = doc.getElementById('kreditjatek-projection-style') as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = 'kreditjatek-projection-style';
    doc.head.appendChild(style);
  }
  style.textContent = `
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#10213a;background:#f6f8fb}
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden}
    body{margin:0;background:linear-gradient(145deg,#ffffff 0%,#f5f7fb 58%,#edf2f7 100%);padding:28px 40px}
    main{width:min(1380px,100%);height:100%;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(420px,620px);gap:48px;align-items:center}
    .copy{display:flex;flex-direction:column;justify-content:center;min-width:0}
    .eyebrow{font-size:16px;font-weight:950;letter-spacing:.11em;text-transform:uppercase;color:#64748b}
    h1{font-size:clamp(48px,5.4vw,78px);line-height:.98;letter-spacing:-.045em;margin:10px 0 18px;color:#10213a}
    .lead{font-size:clamp(21px,2vw,30px);line-height:1.35;color:#475569;margin:0 0 30px;max-width:680px}
    .code{display:inline-flex;flex-direction:column;align-self:flex-start;padding:18px 24px;border-radius:16px;background:#10213a;color:#fff}
    .code span{font-size:13px;text-transform:uppercase;font-weight:900;letter-spacing:.08em;color:#cbd5e1}
    .code strong{font-size:48px;letter-spacing:.12em;margin-top:2px}
    .status{margin-top:20px;display:flex;align-items:baseline;gap:10px;color:#475569}
    .status strong{font-size:32px;color:#10213a}
    .status span{font-size:18px;font-weight:800}
    .qr{display:grid;place-items:center;width:min(100%,620px);aspect-ratio:1;border-radius:24px;background:#fff;padding:18px;box-shadow:0 18px 60px rgba(15,23,42,.12);border:1px solid #dbe3ed}
    .qr svg{width:100%;height:100%;display:block}
    @media(max-width:1050px){
      body{padding:20px 26px}
      main{grid-template-columns:minmax(0,1fr) minmax(360px,500px);gap:28px}
      h1{font-size:48px}.lead{font-size:20px}.code strong{font-size:38px}
    }
  `;

  const main = doc.createElement('main');
  const copy = doc.createElement('section');
  copy.className = 'copy';

  const eyebrow = doc.createElement('div');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Kreditjáték';

  const title = doc.createElement('h1');
  title.textContent = session.roundKey === 'lobby' ? 'Csatlakozz a játékhoz' : 'Visszacsatlakozás';

  const lead = doc.createElement('p');
  lead.className = 'lead';
  lead.textContent = session.roundKey === 'lobby'
    ? 'Olvasd be a QR-kódot a telefonoddal, majd add meg a neved.'
    : 'Ha kiestél a játékból, ugyanazzal a telefonnal olvasd be újra a QR-kódot.';

  const code = doc.createElement('div');
  code.className = 'code';
  const codeLabel = doc.createElement('span');
  codeLabel.textContent = 'Játékkód';
  const codeValue = doc.createElement('strong');
  codeValue.textContent = session.code;
  code.append(codeLabel, codeValue);

  const status = doc.createElement('div');
  status.className = 'status';
  const statusValue = doc.createElement('strong');
  const statusLabel = doc.createElement('span');
  if (session.roundKey === 'lobby') {
    statusValue.textContent = `${session.players.length} / ${session.expectedPlayerCount}`;
    statusLabel.textContent = 'résztvevő belépett';
  } else {
    statusValue.textContent = `${session.players.filter((player) => gameStore.isPlayerOnline(player)).length} / ${session.players.length}`;
    statusLabel.textContent = 'résztvevő online';
  }
  status.append(statusValue, statusLabel);
  copy.append(eyebrow, title, lead, code, status);

  const qr = doc.createElement('section');
  qr.className = 'qr';
  qr.appendChild(doc.importNode(sourceSvg, true));

  main.append(copy, qr);
  doc.body.replaceChildren(main);

  // A joinUrl a QR forrás SVG-jében van; itt csak azért tartjuk paraméterként,
  // hogy a hívás egyértelműen az aktuális belépési linkhez kötődjön.
  void joinUrl;
  return true;
}

function TrainerCockpit({
  session,
  joinUrl,
  onOpenDebrief,
}: {
  session: GameSession;
  joinUrl: string;
  onOpenDebrief: () => void;
}) {
  const [rulesPickerOpen, setRulesPickerOpen] = useState(false);
  const [selectedProjectionMode, setSelectedProjectionMode] = useState<ProjectionMode>(() => rulesProjectionGameForSession(session));

  useEffect(() => {
    if (!projectionWindow || projectionWindow.closed) return;
    if (selectedProjectionMode === 'qr') {
      renderQrProjectionWindow(session, joinUrl);
    } else {
      renderRulesProjectionWindow(session, selectedProjectionMode);
    }
  }, [joinUrl, selectedProjectionMode, session]);

  const strategic = STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound);
  const strategicClosed = strategic && session.closedRounds.includes(session.roundKey as StrategicRound);
  const strategicProgress = strategic ? gameStore.roundProgress(session) : null;

  let primaryLabel = 'Játék indítása';
  let primaryDisabled = false;
  let primaryAction = () => gameStore.startGame(session.code);
  let primaryIcon: React.ReactNode = <Play size={20} />;
  let actionHint = 'Minden résztvevő belépése után indítható.';

  if (session.roundKey === 'lobby') {
    primaryDisabled = session.players.length !== session.expectedPlayerCount;
    actionHint = primaryDisabled
      ? `Még ${session.expectedPlayerCount - session.players.length} résztvevő hiányzik.`
      : 'Mindenki bent van. Indítható az 1a kör.';
  } else if (strategic && !strategicClosed) {
    primaryLabel = 'Kör lezárása és könyvelése';
    primaryDisabled = !strategicProgress?.complete;
    primaryAction = () => gameStore.closeStrategicRound(session.code);
    primaryIcon = <Check size={20} />;
    actionHint = primaryDisabled
      ? `Még ${(strategicProgress?.total ?? 0) - (strategicProgress?.ready ?? 0)} pár döntése hiányzik.`
      : 'Minden pár kész. A kör biztonságosan könyvelhető.';
  } else if (strategic && strategicClosed) {
    const currentIndex = STRATEGIC_ROUNDS.indexOf(session.roundKey as StrategicRound);
    primaryLabel = currentIndex === STRATEGIC_ROUNDS.length - 1
      ? 'Első szakasz lezárása → csapatképzés'
      : 'Következő kör indítása';
    primaryAction = () => gameStore.nextRound(session.code);
    primaryIcon = <ChevronRight size={20} />;
    actionHint = currentIndex === STRATEGIC_ROUNDS.length - 1
      ? 'A 3b könyvelve. Következhet a Közös kassza.'
      : 'A kör könyvelve. A következő kör új párokkal indul.';
  } else if (session.roundKey === '4' && session.publicGoodsPhase === 'open') {
    const progress = gameStore.publicGoodsProgress(session);
    primaryLabel = 'Tétek lezárása';
    primaryAction = () => gameStore.lockPublicGoodsRound(session.code);
    primaryIcon = <Check size={20} />;
    actionHint = `${progress.ready}/${progress.total} tét érkezett. A hiányzó tétek lezáráskor 0-nak számítanak.`;
  } else if (session.roundKey === '4' && session.publicGoodsPhase === 'locked') {
    primaryLabel = 'Bank elszámol';
    primaryAction = () => gameStore.settlePublicGoodsRound(session.code);
    primaryIcon = <RefreshCcw size={20} />;
    actionHint = 'A tétek már nem változnak. Az elszámolás módosítja a vagyonokat.';
  } else if (session.roundKey === '4') {
    const groupsValid = session.groups.length > 0 && session.groups.every((group) => group.memberIds.length > 0);
    primaryLabel = session.publicGoodsRoundNumber === 0 ? 'Első kasszakör indítása' : 'Új kasszakör indítása';
    primaryDisabled = !groupsValid;
    primaryAction = () => gameStore.startPublicGoodsRound(session.code);
    primaryIcon = <Play size={20} />;
    actionHint = groupsValid
      ? 'A csapatok rendben vannak. Ellenőrizd a minimumokat, majd indítható a kör.'
      : 'A csapatbeosztás még nem érvényes: minden csapatban legyen legalább egy játékos.';
  } else {
    primaryLabel = 'Játék lezárva';
    primaryDisabled = true;
    actionHint = 'A játék véget ért. A riport letölthető.';
  }

  return (
    <section className="cockpit cockpit-v2">
      <div className="command-deck">
        <div className="compact-command-bar">
          <div className="compact-state">
            <div className="compact-state-line">
              <strong>{ROUND_LABELS[session.roundKey]}</strong>
              <span className={'live-status ' + (session.status === 'active' ? 'is-live' : '')}>
                {session.status === 'active' ? 'ÉLŐ' : session.status === 'finished' ? 'LEZÁRVA' : 'ELŐKÉSZÍTÉS'}
              </span>
              <span className="compact-hint">{actionHint}</span>
            </div>
          </div>

          <div className="compact-controls">
            <button
              className="toolbar-button projector-trigger"
              onClick={() => {
                setSelectedProjectionMode('qr');
                const opened = renderQrProjectionWindow(session, joinUrl);
                if (!opened) window.alert('A böngésző blokkolta a kivetítőablakot. Engedélyezd a felugró ablakokat ennél az oldalnál.');
              }}
              title="QR-kód kivetítése külön ablakban"
            ><QrCode size={16} />QR</button>
            <button className="compact-primary-action" disabled={primaryDisabled} onClick={primaryAction}>
              {primaryIcon}{primaryLabel}
            </button>
            <button className="toolbar-button debrief-toolbar-trigger" onClick={onOpenDebrief} title="Kivezetés megnyitása"><BarChart3 size={16} />Kivezetés</button>
            <button
              className="toolbar-button"
              onClick={() => {
                const defaultGame = rulesProjectionGameForSession(session);
                setSelectedProjectionMode(defaultGame);
                const opened = renderRulesProjectionWindow(session, defaultGame);
                if (!opened) {
                  window.alert('A böngésző blokkolta a kivetítőablakot. Engedélyezd a felugró ablakokat ennél az oldalnál.');
                  return;
                }
                setRulesPickerOpen(true);
              }}
              title="Játékszabály kivetítése"
            >
              <BookOpen size={16} />Szabályok
            </button>
            <button className="toolbar-button" onClick={() => downloadCsv(session)} title="Riport letöltése"><Download size={16} />Riport</button>
            {canFinishGame(session) && (
              <button
                className="toolbar-button danger-action"
                onClick={() => {
                  const confirmed = window.confirm(
                    'Biztosan lezárod a teljes Kreditjátékot? Ezt nem lehet visszavonni. Ha most fut egy még le nem zárt kör, annak félkész döntései nem kerülnek bele a végső eredménybe.',
                  );
                  if (confirmed) gameStore.finish(session.code);
                }}
              >
                Játék lezárása
              </button>
            )}
          </div>
        </div>

        <GameTimeline session={session} />
        <TrainerPulse session={session} />
        <TrainerAttention session={session} />


      </div>

      <div id="projection-qr-source" style={{ display: 'none' }} aria-hidden="true">
        <QRCodeSVG value={joinUrl} size={620} level="M" includeMargin />
      </div>

      {rulesPickerOpen && createPortal(
        <div
          className="projector-qr-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Játékszabály kivetítés vezérlése"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesPickerOpen(false);
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 'min(760px, 96vw)',
              maxHeight: '92vh',
              overflow: 'auto',
              borderRadius: 14,
              padding: '32px',
              background: '#fff',
              boxShadow: '0 28px 80px rgba(0,0,0,.35)',
            }}
          >
            <button
              className="projector-close"
              type="button"
              aria-label="Szabályválasztó bezárása"
              onClick={() => setRulesPickerOpen(false)}
            >
              ×
            </button>
            <p className="projector-eyebrow">Kivetítő vezérlése</p>
            <h2 style={{ margin: '4px 0 8px', fontSize: 30, color: '#10213a' }}>Melyik játék szabálya látszódjon?</h2>
            <p style={{ margin: '0 0 24px', color: '#64748b', lineHeight: 1.5 }}>
              A kivetítőablakot egyszer húzd át a projektorra. Ezután innen válthatsz QR-kód és a négy játékszabály között; a kivetítőablak a helyén marad.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedProjectionMode('qr');
                const opened = renderQrProjectionWindow(session, joinUrl);
                if (!opened) window.alert('A böngésző blokkolta a kivetítőablakot. Engedélyezd a felugró ablakokat ennél az oldalnál.');
              }}
              style={{
                width: '100%',
                minHeight: 66,
                marginBottom: 12,
                padding: '12px 16px',
                border: '1px solid #d8e0ea',
                borderRadius: 12,
                background: selectedProjectionMode === 'qr' ? '#eef6f6' : '#fff',
                color: '#10213a',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: 900,
              }}
            >
              QR-kód / belépés
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {RULES_PROJECTION_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedProjectionMode(option.id);
                    const opened = renderRulesProjectionWindow(session, option.id);
                    if (!opened) window.alert('A böngésző blokkolta a kivetítőablakot. Engedélyezd a felugró ablakokat ennél az oldalnál.');
                  }}
                  style={{
                    minHeight: 92,
                    padding: '16px 18px',
                    border: '1px solid #d8e0ea',
                    borderRadius: 12,
                    background: option.id === selectedProjectionMode ? '#eef6f6' : '#fff',
                    color: '#10213a',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>{option.short}</span>
                  <strong style={{ display: 'block', marginTop: 5, fontSize: 20 }}>{option.label}</strong>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button
                type="button"
                onClick={() => projectionWindow?.focus()}
                style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 14px', background: '#fff', color: '#10213a', fontWeight: 800, cursor: 'pointer' }}
              >
                Kivetítőablak előre
              </button>
              <button
                type="button"
                onClick={() => setRulesPickerOpen(false)}
                style={{ border: 0, borderRadius: 8, padding: '10px 14px', background: '#10213a', color: '#fff', fontWeight: 850, cursor: 'pointer' }}
              >
                Kész
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}

function MinimumSelector({
  mode,
  custom,
  disabled = false,
  onMode,
  onCustom,
}: {
  mode: MinimumMode;
  custom?: number;
  disabled?: boolean;
  onMode: (mode: MinimumMode) => void;
  onCustom: (value: number) => void;
}) {
  return (
    <div className="minimum-selector">
      <button disabled={disabled} className={mode === 'none' ? 'selected' : ''} onClick={() => onMode('none')}>Nincs</button>
      <button disabled={disabled} className={mode === '80' ? 'selected' : ''} onClick={() => onMode('80')}>80%</button>
      <button disabled={disabled} className={mode === '90' ? 'selected' : ''} onClick={() => onMode('90')}>90%</button>
      <button disabled={disabled} className={mode === '95' ? 'selected' : ''} onClick={() => onMode('95')}>95%</button>
      <div className="custom-minimum">
        <button disabled={disabled} className={mode === 'custom' ? 'selected' : ''} onClick={() => onMode('custom')}>Egyedi</button>
        {mode === 'custom' && <input disabled={disabled} type="number" min={0} step={100} value={custom ?? 0} onChange={(e) => onCustom(Number(e.target.value))} />}
      </div>
    </div>
  );
}

function PoolPlanning({ session }: { session: GameSession }) {
  const [groupCount, setGroupCount] = useState(Math.max(1, session.groups.length || 1));
  const editableGroups = session.publicGoodsRoundNumber === 0 && session.publicGoodsPhase === 'setup';
  const editableMinimum = session.publicGoodsPhase === 'setup';
  const groupsValid = session.groups.length > 0 && session.groups.every((group) => group.memberIds.length > 0);
  const activePlayers = session.players.filter((player) => !player.isBot && player.active);

  return (
    <div className="pool-planning pool-setup-flow">
      <section className="pool-setup-step">
        <header className="pool-setup-step-head">
          <span className="pool-step-number">1</span>
          <div>
            <strong>Csapatok</strong>
            <small>Véletlen sorsolás vagy teljes kézi beosztás.</small>
          </div>
          <span className={'pool-step-status ' + (groupsValid ? 'ready' : 'needs-action')}>
            {groupsValid ? session.groups.length + ' csapat kész' : 'beállítás szükséges'}
          </span>
        </header>

        <div className="pool-config-grid compact">
          <label className="compact-field">
            <span>Csapatok száma · max. 25</span>
            <input
              type="number"
              min={1}
              max={Math.min(25, Math.max(1, activePlayers.length))}
              value={groupCount}
              disabled={!editableGroups}
              onChange={(e) => setGroupCount(Number(e.target.value))}
            />
          </label>
          <button className="secondary" disabled={!editableGroups} onClick={() => gameStore.randomizeGroups(session.code, groupCount)}>
            <RefreshCcw size={17} />Véletlen sorsolás
          </button>
          <button className="secondary manual-group-button" disabled={!editableGroups} onClick={() => gameStore.createManualGroups(session.code, groupCount)}>
            <Users size={17} />Kézi beosztás
          </button>
        </div>

        {editableGroups && session.groups.length > 0 && (
          <>
            <div className="manual-assignment-head">
              <strong>Játékosok kézi áthelyezése</strong>
              <span>Válaszd ki mindenkinél a csapatot. Üres csapattal a kasszakör nem indítható.</span>
            </div>
            <div className="manual-assignment-grid">
              {activePlayers.map((player) => {
                const currentGroup = session.groups.find((group) => group.memberIds.includes(player.id));
                return (
                  <label key={player.id}>
                    <span>{player.name}</span>
                    <select
                      value={currentGroup?.id ?? ''}
                      onChange={(e) => gameStore.setPlayerGroup(session.code, player.id, e.target.value)}
                    >
                      {!currentGroup && <option value="">Válassz csapatot</option>}
                      {session.groups.map((group) => (
                        <option value={group.id} key={group.id}>
                          {group.name} · {group.memberIds.length} fő
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="pool-setup-step">
        <header className="pool-setup-step-head">
          <span className="pool-step-number">2</span>
          <div>
            <strong>Minimum kassza</strong>
            <small>Csapatonként külön állítható a következő körre.</small>
          </div>
        </header>

        {session.groups.length === 0 ? (
          <div className="pool-setup-empty">Előbb hozd létre a csapatokat.</div>
        ) : (
          <div className="minimum-setup-list">
            {session.groups.map((group) => (
              <div className={'minimum-setup-row ' + (group.memberIds.length === 0 ? 'empty-group' : '')} key={group.id}>
                <div className="minimum-group-ident">
                  <strong>{group.name}</strong>
                  <span>{group.memberIds.length} fő · vagyon {formatCredits(gameStore.groupWealth(session, group))}</span>
                </div>
                <MinimumSelector
                  mode={group.nextMinimumMode}
                  custom={group.nextCustomMinimum}
                  disabled={!editableMinimum}
                  onMode={(mode) => gameStore.setGroupMinimum(session.code, group.id, mode, group.nextCustomMinimum)}
                  onCustom={(value) => gameStore.setGroupMinimum(session.code, group.id, 'custom', value)}
                />
                <div className="minimum-result">
                  {group.nextMinimumMode === 'none'
                    ? 'nincs minimum'
                    : group.nextMinimumMode === 'custom'
                      ? formatCredits(group.nextCustomMinimum ?? 0)
                      : group.nextMinimumMode + '% · ' + formatCredits(gameStore.minimumForGroup(session, group) ?? 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pool-setup-step pool-start-step">
        <header className="pool-setup-step-head">
          <span className="pool-step-number">3</span>
          <div>
            <strong>Kör indítása</strong>
            <small>
              {groupsValid
                ? 'A csapatok érvényesek. Ellenőrizd a minimumokat, majd indítsd a kört a felső fő gombbal.'
                : 'Minden játékos legyen csapatban, és ne maradjon üres csapat.'}
            </small>
          </div>
          <span className={'pool-step-status ' + (groupsValid ? 'ready' : 'needs-action')}>
            {groupsValid ? 'indítható' : 'még nem indítható'}
          </span>
        </header>
      </section>
    </div>
  );
}

function GroupBox({ session, groupId }: { session: GameSession; groupId: string }) {
  const group = session.groups.find((item) => item.id === groupId)!;
  const currentWealth = gameStore.groupWealth(session, group);
  const startingWealth = group.memberIds.reduce(
    (sum, id) => sum + (session.firstStageFinalBalance[id] ?? 0),
    0,
  );
  const editableMinimum = session.publicGoodsPhase === 'setup';
  const memberPlayers = group.memberIds
    .map((id) => session.players.find((player) => player.id === id))
    .filter(Boolean) as GameSession['players'];
  const groupRounds = session.publicGoodsRounds
    .filter((round) => round.groupId === group.id)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  const activeRound = groupRounds.find(
    (round) => round.roundNumber === session.publicGoodsRoundNumber && round.status !== 'settled',
  );
  const latestRound = groupRounds[groupRounds.length - 1];
  const metricRound = activeRound ?? latestRound;
  const minimum = metricRound?.minimumAmount;
  const pool = metricRound?.totalContribution ?? 0;
  const gap = minimum === undefined ? undefined : minimum - pool;
  const minimumProgress = minimum && minimum > 0 ? Math.min(100, Math.round((pool / minimum) * 100)) : 0;

  const visualState =
    activeRound?.status === 'open' ? 'open' :
    activeRound?.status === 'locked' ? 'locked' :
    latestRound?.status === 'settled' ? (latestRound.success ? 'success' : 'failed') :
    'setup';

  const stateLabel =
    visualState === 'open' ? 'döntés folyik' :
    visualState === 'locked' ? 'tétek lezárva' :
    visualState === 'success' ? 'utolsó kör sikeres' :
    visualState === 'failed' ? 'utolsó kör sikertelen' :
    'következő kör beállítása';

  return (
    <section className={'group-box group-state-' + visualState}>
      <header className="group-box-head">
        <div className="group-title-block">
          <div className={'group-state-dot ' + visualState} />
          <div>
            <p className="eyebrow">Közös kassza csoport</p>
            <h3 className="group-place-name">{group.name}</h3>
            <span className="group-place-meta">{group.memberIds.length} fő · {stateLabel}</span>
          </div>
        </div>
        <div className="group-wealth pair">
          <div>
            <span>Induló vagyon</span>
            <strong>{formatCredits(startingWealth)}</strong>
          </div>
          <div>
            <span>Aktuális vagyon</span>
            <strong>{formatCredits(currentWealth)}</strong>
          </div>
        </div>
      </header>

      {metricRound && (
        <div className="pool-live-strip">
          <div>
            <span>Aktuális kassza</span>
            <strong>{formatCredits(pool)}</strong>
          </div>
          <div>
            <span>Minimum</span>
            <strong>{minimum === undefined ? 'nincs' : formatCredits(minimum)}</strong>
          </div>
          <div className={gap !== undefined && gap > 0 ? 'metric-negative' : gap !== undefined ? 'metric-positive' : ''}>
            <span>{gap === undefined ? 'Kassza állapota' : gap > 0 ? 'Még hiányzik' : 'Minimum felett'}</span>
            <strong>
              {gap === undefined ? stateLabel : gap > 0 ? formatCredits(gap) : '+' + formatCredits(Math.abs(gap))}
            </strong>
          </div>
          <div>
            <span>Állapot</span>
            <strong className={'round-state-text ' + visualState}>{stateLabel}</strong>
          </div>
          {minimum !== undefined && (
            <div className="pool-minimum-progress" aria-label={'Minimum teljesülése ' + minimumProgress + '%'}>
              <i style={{ width: minimumProgress + '%' }} />
            </div>
          )}
        </div>
      )}

      <div className="pool-table-wrap">
        <table className="pool-table">
          <thead>
            <tr>
              <th>Résztvevő</th>
              <th>3b utáni vagyon</th>
              <th>Aktuális vagyon</th>
              {groupRounds.map((round) => <th key={round.id}>Kör {round.roundNumber}</th>)}
            </tr>
          </thead>
          <tbody>
            {memberPlayers.map((player) => (
              <tr key={player.id}>
                <td><strong>{player.name}</strong></td>
                <td>{formatCredits(session.firstStageFinalBalance[player.id] ?? player.currentBalance)}</td>
                <td className="wealth-cell">{formatCredits(player.currentBalance)}</td>
                {groupRounds.map((round) => {
                  const contribution = round.contributions[player.id];
                  const payout = round.status === 'settled' ? (round.payoutPerPlayer ?? 0) : undefined;
                  const net = contribution !== undefined && payout !== undefined ? payout - contribution : undefined;
                  return (
                    <td key={round.id} className={round.status === 'settled' ? (round.success ? 'pool-result-success' : 'pool-result-failed') : ''}>
                      <div className="pool-cell">
                        <span>Be: <b>{contribution === undefined ? '–' : formatCredits(contribution)}</b></span>
                        <span>Vissza: <b>{payout === undefined ? '–' : formatCredits(payout)}</b></span>
                        {net !== undefined && <span className={net >= 0 ? 'good' : 'bad'}>Nettó: <b>{net >= 0 ? '+' : ''}{formatCredits(net)}</b></span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {groupRounds.length > 0 && (
        <div className="group-round-summary">
          {groupRounds.map((round) => {
            const roundMinimum = round.minimumAmount ?? 0;
            const shortfall = round.minimumMode === 'none'
              ? 0
              : Math.max(0, roundMinimum - round.totalContribution);
            const resultClass = round.status === 'settled'
              ? (round.success ? 'round-chip-success' : 'round-chip-failed')
              : round.status === 'locked'
                ? 'round-chip-locked'
                : 'round-chip-open';
            return (
              <span key={round.id} className={resultClass}>
                <b>{round.roundNumber}. kör</b> · {round.minimumMode === 'none' ? 'nincs minimum' : `min. ${formatCredits(roundMinimum)}`} ·
                {' '}kassza {formatCredits(round.totalContribution)}
                {round.minimumMode !== 'none' && shortfall > 0 ? ` · hiány ${formatCredits(shortfall)}` : ''}
                {' · '}{round.status === 'settled'
                  ? (round.success ? `sikeres · ${formatCredits(round.payoutPerPlayer ?? 0)}/fő` : 'sikertelen · tét elveszett')
                  : round.status === 'locked'
                    ? 'lezárva'
                    : 'folyamatban'}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PublicGoodsLiveBar({ session }: { session: GameSession }) {
  if (session.publicGoodsRoundNumber < 1) return null;

  const rounds = session.publicGoodsRounds.filter(
    (round) => round.roundNumber === session.publicGoodsRoundNumber,
  );
  if (rounds.length === 0) return null;

  const open = session.publicGoodsPhase === 'open';
  const locked = session.publicGoodsPhase === 'locked';
  const progress = open ? gameStore.publicGoodsProgress(session) : null;
  const secondsLeft = open ? gameStore.publicGoodsSecondsLeft(session) : null;

  return (
    <div className={'pool-sticky-live ' + (open ? 'is-open' : locked ? 'is-locked' : 'is-settled')}>
      <div className="pool-sticky-clock">
        <span>
          {session.publicGoodsContinuation && session.publicGoodsRoundNumber >= session.publicGoodsContinuation.firstContinuationRoundNumber
            ? 'Tanulókör ' + (session.publicGoodsRoundNumber - session.publicGoodsContinuation.firstContinuationRoundNumber + 1) + '. kör'
            : 'Kassza ' + session.publicGoodsRoundNumber + '. kör'}
        </span>
        <strong>{open ? secondsLeft + ' mp' : locked ? 'TÉTEK LEZÁRVA' : 'KÖR EREDMÉNYE'}</strong>
        {progress && <small>{progress.ready}/{progress.total} tét beérkezett</small>}
      </div>
      <div className="pool-sticky-groups">
        {rounds.map((round) => {
          const group = session.groups.find((item) => item.id === round.groupId);
          const minimum = round.minimumAmount;
          const gap = minimum === undefined ? undefined : minimum - round.totalContribution;
          const near = minimum !== undefined && minimum > 0 && gap !== undefined && gap > 0 && gap / minimum <= 0.05;
          const above = gap !== undefined && gap <= 0;
          const settledFailure = round.status === 'settled' && round.success === false;
          const chipClass =
            'pool-sticky-group' +
            (near ? ' is-near' : '') +
            (above ? ' is-above' : '') +
            (settledFailure ? ' is-failed' : '');
          return (
            <div className={chipClass} key={round.id}>
              <b>{group?.name ?? 'Csoport'}</b>
              {minimum === undefined ? (
                <span>kassza {formatCredits(round.totalContribution)} · nincs minimum</span>
              ) : gap !== undefined && gap > 0 ? (
                <>
                  <strong>MÉG {formatCredits(gap)}</strong>
                  <span>{Math.round((round.totalContribution / minimum) * 1000) / 10}% a minimumból{near ? ' · KÖZEL A HATÁRHOZ' : ''}</span>
                </>
              ) : (
                <>
                  <strong>+{formatCredits(Math.abs(gap ?? 0))}</strong>
                  <span>minimum teljesült</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PublicGoodsDashboard({ session }: { session: GameSession }) {
  const phaseLabel =
    session.publicGoodsPhase === 'open' ? `döntés folyik · ${gameStore.publicGoodsSecondsLeft(session)} mp` :
    session.publicGoodsPhase === 'locked' ? 'tétek lezárva · bankra vár' :
    'következő kör beállítható';

  const successful = session.publicGoodsRounds.filter((round) => round.status === 'settled' && round.success).length;
  const failed = session.publicGoodsRounds.filter((round) => round.status === 'settled' && round.success === false).length;

  return (
    <section className="panel public-goods-panel dashboard-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">4. játék · tréneri nézet</p>
          <h2>Közös kassza</h2>
        </div>
        <div className="pool-header-status">
          <span className="pill">{session.publicGoodsRoundNumber}. kör · {phaseLabel}</span>
          <span className="mini-result success-mini">{successful} sikeres</span>
          <span className="mini-result failed-mini">{failed} sikertelen</span>
        </div>
      </div>

      <PublicGoodsLiveBar session={session} />
      <PoolPlanning session={session} />

      <div className="group-boxes">
        {session.groups.map((group) => <GroupBox session={session} groupId={group.id} key={group.id} />)}
      </div>
    </section>
  );
}

function ReportPanel({ session }: { session: GameSession }) {
  type SummaryGame = 'ultimatum' | 'dictator' | 'trust' | 'pool';

  const summary = reportSummary(session);
  const currentSummaryGame: SummaryGame | null =
    session.roundKey === '1a' || session.roundKey === '1b' ? 'ultimatum' :
    session.roundKey === '2a' || session.roundKey === '2b' ? 'dictator' :
    session.roundKey === '3a' || session.roundKey === '3b' ? 'trust' :
    session.roundKey === '4' ? 'pool' :
    null;

  const [openGames, setOpenGames] = useState<Record<SummaryGame, boolean>>(() => ({
    ultimatum: currentSummaryGame === 'ultimatum',
    dictator: currentSummaryGame === 'dictator',
    trust: currentSummaryGame === 'trust',
    pool: currentSummaryGame === 'pool',
  }));
  const [autoGame, setAutoGame] = useState<SummaryGame | null>(currentSummaryGame);
  const [openPoolRound, setOpenPoolRound] = useState<number | null>(() =>
    session.publicGoodsRoundNumber > 0 ? session.publicGoodsRoundNumber : null,
  );

  useEffect(() => {
    if (currentSummaryGame && currentSummaryGame !== autoGame) {
      setOpenGames({
        ultimatum: currentSummaryGame === 'ultimatum',
        dictator: currentSummaryGame === 'dictator',
        trust: currentSummaryGame === 'trust',
        pool: currentSummaryGame === 'pool',
      });
      setAutoGame(currentSummaryGame);
    }
  }, [currentSummaryGame, autoGame]);

  useEffect(() => {
    if (session.roundKey === '4' && session.publicGoodsRoundNumber > 0) {
      setOpenPoolRound(session.publicGoodsRoundNumber);
    }
  }, [session.roundKey, session.publicGoodsRoundNumber]);

  const toggleGame = (game: SummaryGame) => {
    setOpenGames((current) => ({ ...current, [game]: !current[game] }));
  };

  const roundState = (round: StrategicRound) => {
    if (session.closedRounds.includes(round)) return { className: 'done', label: 'kész' };
    if (session.roundKey === round) return { className: 'active', label: 'aktuális' };
    return { className: 'upcoming', label: 'következik' };
  };

  const ultimatumOffers = session.pairings
    .filter((pairing) => pairing.gameId === 'ultimatum')
    .flatMap((pairing) => {
      const decisions = decisionsFor(session, pairing);
      const offer = decisions.find((decision) => decision.type === 'ultimatum_offer');
      if (!offer) return [];
      const response = decisions.find((decision) => decision.type === 'ultimatum_response');
      const timeout = decisions.find((decision) => decision.type === 'ultimatum_timeout');
      return [{
        pairing,
        amount: offer.amount ?? 0,
        accepted: response?.accepted,
        timedOut: timeout !== undefined,
      }];
    });

  const dictatorTransfers = session.pairings
    .filter((pairing) => pairing.gameId === 'dictator')
    .flatMap((pairing) => {
      const decision = decisionsFor(session, pairing).find((item) => item.type === 'dictator_give');
      if (!decision) return [];
      const amount = decision.amount ?? 0;
      const percent = session.startingCredit > 0 ? Math.round((amount / session.startingCredit) * 100) : 0;
      const band = percent <= 30 ? 'low' : percent <= 51 ? 'mid' : 'high';
      const bandLabel = percent <= 30 ? '0–30%' : percent <= 51 ? '31–51%' : '51% felett';
      return [{
        pairing,
        amount,
        percent,
        band,
        bandLabel,
        timedOut: decision.timedOutRole === 'dictator',
      }];
    });

  const trustTransfers = session.pairings
    .filter((pairing) => pairing.gameId === 'trust')
    .flatMap((pairing) => {
      const decisions = decisionsFor(session, pairing);
      const sendDecision = decisions.find((item) => item.type === 'trust_send');
      if (!sendDecision) return [];
      const returnDecision = decisions.find((item) => item.type === 'trust_return');

      const sent = sendDecision.amount ?? 0;
      const returned = returnDecision?.amount;
      const sendPercent = session.startingCredit > 0
        ? Math.round((sent / session.startingCredit) * 100)
        : 0;
      const returnBase = sent * 3;
      const returnPercent = returned === undefined
        ? undefined
        : returnBase > 0
          ? Math.round((returned / returnBase) * 100)
          : 0;

      const bandFor = (percent: number | undefined) =>
        percent === undefined ? 'pending' : percent <= 30 ? 'low' : percent >= 70 ? 'high' : 'mid';

      return [{
        pairing,
        sent,
        returned,
        sendPercent,
        returnPercent,
        sendBand: bandFor(sendPercent),
        returnBand: bandFor(returnPercent),
        sendTimedOut: sendDecision.timedOutRole === 'sender',
        returnTimedOut: returnDecision?.timedOutRole === 'returner',
      }];
    });

  const publicGoodsRounds = [...new Set(session.publicGoodsRounds.map((round) => round.roundNumber))]
    .sort((a, b) => a - b)
    .map((roundNumber) => ({
      roundNumber,
      groups: session.publicGoodsRounds
        .filter((round) => round.roundNumber === roundNumber)
        .sort((a, b) => {
          const aName = session.groups.find((group) => group.id === a.groupId)?.name ?? a.groupId;
          const bName = session.groups.find((group) => group.id === b.groupId)?.name ?? b.groupId;
          return aName.localeCompare(bName, 'hu');
        }),
    }));

  const gameDone = {
    ultimatum: ['1a', '1b'].every((round) => session.closedRounds.includes(round as StrategicRound)),
    dictator: ['2a', '2b'].every((round) => session.closedRounds.includes(round as StrategicRound)),
    trust: ['3a', '3b'].every((round) => session.closedRounds.includes(round as StrategicRound)),
    pool: session.roundKey === 'report',
  };

  const blockClass = (game: SummaryGame) =>
    'game-summary-block' +
    (currentSummaryGame === game ? ' is-current' : '') +
    (gameDone[game] ? ' is-done' : '') +
    (openGames[game] ? ' is-open' : '');

  return (
    <section className="panel report-panel dashboard-section game-summary-panel">
      <div className="section-title game-summary-title">
        <div>
          <p className="eyebrow">Tréneri elemzés</p>
          <h2>Játékösszesítő</h2>
        </div>
        <button className="secondary" onClick={() => downloadCsv(session)}>
          <BarChart3 size={17} />Teljes CSV
        </button>
      </div>

      <div className="game-summary-stack">
        <section className={blockClass('ultimatum')}>
          <button className="game-summary-toggle" type="button" onClick={() => toggleGame('ultimatum')} aria-expanded={openGames.ultimatum}>
            <div className="game-summary-heading">
              <span className="game-summary-index">1</span>
              <div>
                <strong>Ultimátum</strong>
                <small>{ultimatumOffers.length} ajánlat · {summary.ultimatum.accepted} elfogadott · {summary.ultimatum.rejected} elutasított</small>
              </div>
            </div>
            <div className="game-summary-toggle-state">
              {gameDone.ultimatum && <span className="summary-done-chip">kész</span>}
              {currentSummaryGame === 'ultimatum' && <span className="summary-current-chip">most</span>}
              <ChevronRight size={18} className="summary-chevron" />
            </div>
          </button>

          {openGames.ultimatum && (
            <div className="game-summary-body">
              <p className="game-summary-note">1a + 1b: mindenki egyszer ajánlattevő és egyszer fogadó; a partner körönként változhat.</p>
              {(['1a', '1b'] as const).map((round) => {
                const state = roundState(round);
                const rows = ultimatumOffers.filter((item) => item.pairing.roundKey === round);
                return (
                  <section className="summary-round-section" key={round}>
                    <header className="summary-round-head">
                      <div><strong>{round} kör</strong><span>{rows.length} ajánlat</span></div>
                      <span className={'round-state-chip ' + state.className}>{state.label}</span>
                    </header>
                    <div className="decision-summary-list">
                      {rows.length === 0 ? (
                        <div className="summary-empty">Még nincs adat ebben a körben.</div>
                      ) : rows.map(({ pairing, amount, accepted, timedOut }) => {
                        const statusClass = timedOut || accepted === false ? 'rejected' : accepted === true ? 'accepted' : 'pending';
                        const statusLabel = timedOut ? 'időtúllépés' : accepted === true ? 'elfogadott' : accepted === false ? 'elutasított' : 'folyamatban';
                        return (
                          <div className="ultimatum-offer-row" key={pairing.id}>
                            <span className="offer-route">
                              <b>{playerName(session, pairing.playerA)}</b><i>→</i><b>{playerName(session, pairing.playerB)}</b>
                            </span>
                            <strong className="offer-amount">{formatCredits(amount)}</strong>
                            <span className={'offer-status ' + statusClass}>{statusLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <section className={blockClass('dictator')}>
          <button className="game-summary-toggle" type="button" onClick={() => toggleGame('dictator')} aria-expanded={openGames.dictator}>
            <div className="game-summary-heading">
              <span className="game-summary-index">2</span>
              <div>
                <strong>Diktátor</strong>
                <small>{dictatorTransfers.length} átadás · {formatCredits(summary.dictator.givenAmount)} összesen</small>
              </div>
            </div>
            <div className="game-summary-toggle-state">
              {gameDone.dictator && <span className="summary-done-chip">kész</span>}
              {currentSummaryGame === 'dictator' && <span className="summary-current-chip">most</span>}
              <ChevronRight size={18} className="summary-chevron" />
            </div>
          </button>

          {openGames.dictator && (
            <div className="game-summary-body">
              <p className="game-summary-note">2a + 2b: mindenki egyszer adó és egyszer fogadó; a fogadó itt nem dönt.</p>
              {(['2a', '2b'] as const).map((round) => {
                const state = roundState(round);
                const rows = dictatorTransfers.filter((item) => item.pairing.roundKey === round);
                return (
                  <section className="summary-round-section" key={round}>
                    <header className="summary-round-head">
                      <div><strong>{round} kör</strong><span>{rows.length} átadás</span></div>
                      <span className={'round-state-chip ' + state.className}>{state.label}</span>
                    </header>
                    <div className="decision-summary-list">
                      {rows.length === 0 ? (
                        <div className="summary-empty">Még nincs adat ebben a körben.</div>
                      ) : rows.map(({ pairing, amount, percent, band, bandLabel, timedOut }) => (
                        <div className="dictator-transfer-row" key={pairing.id}>
                          <span className="offer-route">
                            <b>{playerName(session, pairing.playerA)}</b><i>→</i><b>{playerName(session, pairing.playerB)}</b>
                          </span>
                          <strong className="offer-amount">{formatCredits(amount)}</strong>
                          <span className={'dictator-band ' + band}>
                            {timedOut ? 'idő → 0' : percent + '% · ' + bandLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <section className={blockClass('trust')}>
          <button className="game-summary-toggle" type="button" onClick={() => toggleGame('trust')} aria-expanded={openGames.trust}>
            <div className="game-summary-heading">
              <span className="game-summary-index">3</span>
              <div>
                <strong>Bizalom</strong>
                <small>{trustTransfers.length} kapcsolat · {formatCredits(summary.trust.sentAmount)} elküldve · {formatCredits(summary.trust.returnedAmount)} vissza</small>
              </div>
            </div>
            <div className="game-summary-toggle-state">
              {gameDone.trust && <span className="summary-done-chip">kész</span>}
              {currentSummaryGame === 'trust' && <span className="summary-current-chip">most</span>}
              <ChevronRight size={18} className="summary-chevron" />
            </div>
          </button>

          {openGames.trust && (
            <div className="game-summary-body">
              <p className="game-summary-note">3a + 3b: mindenki egyszer küldő és egyszer fogadó. Az „oda” az induló kredithez, a „vissza” a háromszorozott összeghez viszonyított arány.</p>
              {(['3a', '3b'] as const).map((round) => {
                const state = roundState(round);
                const rows = trustTransfers.filter((item) => item.pairing.roundKey === round);
                return (
                  <section className="summary-round-section" key={round}>
                    <header className="summary-round-head">
                      <div><strong>{round} kör</strong><span>{rows.length} kapcsolat</span></div>
                      <span className={'round-state-chip ' + state.className}>{state.label}</span>
                    </header>
                    <div className="decision-summary-list">
                      {rows.length === 0 ? (
                        <div className="summary-empty">Még nincs adat ebben a körben.</div>
                      ) : rows.map(({
                        pairing,
                        sent,
                        returned,
                        sendPercent,
                        returnPercent,
                        sendBand,
                        returnBand,
                        sendTimedOut,
                        returnTimedOut,
                      }) => (
                        <div className="trust-transfer-row" key={pairing.id}>
                          <div className="trust-moves">
                            <div className="trust-move">
                              <span className="trust-direction">
                                <b>Oda:</b> {playerName(session, pairing.playerA)} <i>→</i> {playerName(session, pairing.playerB)}
                              </span>
                              <span className={'trust-value ' + sendBand}>
                                {sendTimedOut ? 'idő → 0' : formatCredits(sent) + ' · ' + sendPercent + '%'}
                              </span>
                            </div>
                            <div className="trust-move">
                              <span className="trust-direction">
                                <b>Vissza:</b> {playerName(session, pairing.playerB)} <i>→</i> {playerName(session, pairing.playerA)}
                              </span>
                              <span className={'trust-value ' + returnBand}>
                                {returnTimedOut
                                  ? 'idő → 0'
                                  : returned === undefined
                                    ? 'folyamatban'
                                    : formatCredits(returned) + ' · ' + returnPercent + '%'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <section className={blockClass('pool')}>
          <button className="game-summary-toggle" type="button" onClick={() => toggleGame('pool')} aria-expanded={openGames.pool}>
            <div className="game-summary-heading">
              <span className="game-summary-index">4</span>
              <div>
                <strong>Közös kassza</strong>
                <small>{publicGoodsRounds.length} kör · {session.publicGoodsRounds.filter((round) => round.status === 'settled' && round.success).length} sikeres csoportkör</small>
              </div>
            </div>
            <div className="game-summary-toggle-state">
              {gameDone.pool && <span className="summary-done-chip">kész</span>}
              {currentSummaryGame === 'pool' && <span className="summary-current-chip">most</span>}
              <ChevronRight size={18} className="summary-chevron" />
            </div>
          </button>

          {openGames.pool && (
            <div className="game-summary-body public-goods-analysis">
              <p className="game-summary-note">Játékosonként látszik a befizetés összege, a saját kör eleji vagyonából vállalt arány, a teljes csapatkasszából adott rész és a vagyonváltozás.</p>
              <div className="public-goods-round-list">
                {publicGoodsRounds.length === 0 ? (
                  <div className="summary-empty">Még nincs kasszakör.</div>
                ) : publicGoodsRounds.map(({ roundNumber, groups }) => {
                  const isOpen = openPoolRound === roundNumber;
                  const isCurrent = session.roundKey === '4' && session.publicGoodsRoundNumber === roundNumber;
                  return (
                    <section className={'public-goods-round-card' + (isCurrent ? ' is-current' : '')} key={roundNumber}>
                      <button
                        className="public-goods-round-toggle"
                        type="button"
                        onClick={() => setOpenPoolRound(isOpen ? null : roundNumber)}
                        aria-expanded={isOpen}
                      >
                        <div>
                          <strong>{roundNumber}. kör</strong>
                          <span>{groups.length} csapat</span>
                        </div>
                        <div>
                          {isCurrent && <span className="summary-current-chip">aktuális</span>}
                          <ChevronRight size={17} className={'pool-round-chevron' + (isOpen ? ' is-open' : '')} />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="public-goods-group-grid">
                          {groups.map((round) => {
                            const groupName = session.groups.find((group) => group.id === round.groupId)?.name ?? round.groupId;
                            const resultClass =
                              round.status === 'settled'
                                ? round.success ? 'pool-summary-success' : 'pool-summary-failed'
                                : 'pool-summary-live';
                            const resultText =
                              round.status === 'settled'
                                ? round.success
                                  ? 'Bank ' + formatCredits(round.totalContribution * 2) + ' · ' + formatCredits(round.payoutPerPlayer ?? 0) + '/fő'
                                  : 'Sikertelen · a befizetés elveszett'
                                : round.status === 'locked'
                                  ? 'Tétek lezárva · elszámolásra vár'
                                  : 'Döntés folyamatban';
                            return (
                              <div className={'public-goods-group-summary ' + resultClass} key={round.id}>
                                <div className="public-goods-group-head">
                                  <div>
                                    <b>{groupName}</b>
                                    <small>{round.memberIds.length} fő · {resultText}</small>
                                  </div>
                                  <div className="pool-total">
                                    <span>Teljes kassza</span>
                                    <strong>{formatCredits(round.totalContribution)}</strong>
                                  </div>
                                </div>

                                <div className="public-goods-member-head">
                                  <span>Játékos</span>
                                  <span>Befizetés</span>
                                  <span>Arányok</span>
                                  <span>Vagyonváltozás</span>
                                </div>

                                <div className="public-goods-member-list">
                                  {round.memberIds.map((playerId) => {
                                    const contribution = round.contributions[playerId];
                                    const startWealth = round.startingPlayerWealth?.[playerId] ?? 0;
                                    const contributionPercent = contribution === undefined
                                      ? undefined
                                      : startWealth > 0
                                        ? Math.round((contribution / startWealth) * 100)
                                        : 0;
                                    const poolSharePercent = contribution === undefined
                                      ? undefined
                                      : round.totalContribution > 0
                                        ? Math.round((contribution / round.totalContribution) * 100)
                                        : 0;
                                    const delta = contribution !== undefined && round.status === 'settled'
                                      ? (round.payoutPerPlayer ?? 0) - contribution
                                      : undefined;
                                    const endWealth = delta === undefined ? undefined : startWealth + delta;

                                    return (
                                      <div className="public-goods-member-row" key={playerId}>
                                        <b>{playerName(session, playerId)}</b>
                                        <span className="member-contribution">
                                          {contribution === undefined ? 'még nincs tét' : formatCredits(contribution)}
                                        </span>
                                        <span className="member-ratios">
                                          {contribution === undefined
                                            ? '–'
                                            : 'vagyon ' + contributionPercent + '% · kassza ' + poolSharePercent + '%'}
                                        </span>
                                        <span className={'member-wealth-change ' + (delta === undefined ? 'pending' : delta >= 0 ? 'positive' : 'negative')}>
                                          {delta === undefined
                                            ? 'elszámolásra vár'
                                            : formatCredits(startWealth) + ' → ' + formatCredits(endWealth ?? startWealth) + ' · ' + (delta >= 0 ? '+' : '') + formatCredits(delta)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function TrainerCorrectionPanel({ session }: { session: GameSession }) {
  const [playerId, setPlayerId] = useState(session.players[0]?.id ?? '');
  const [balanceValue, setBalanceValue] = useState(session.players[0]?.currentBalance ?? 0);
  const [balanceNote, setBalanceNote] = useState('');
  const [roundKey, setRoundKey] = useState<StrategicRound>('1a');
  const [decisionAmount, setDecisionAmount] = useState(0);
  const [decisionAccepted, setDecisionAccepted] = useState(true);
  const [decisionNote, setDecisionNote] = useState('');
  const [poolRound, setPoolRound] = useState(1);
  const [poolAmount, setPoolAmount] = useState(0);
  const [poolNote, setPoolNote] = useState('');
  const [message, setMessage] = useState('');

  const player = session.players.find((item) => item.id === playerId);
  const pairing = session.pairings.find(
    (item) => item.roundKey === roundKey && (item.playerA === playerId || item.playerB === playerId),
  );
  const isA = pairing?.playerA === playerId;

  let decision: Decision | undefined;
  let decisionLabel = 'Nincs korrigálható döntés';
  let booleanDecision = false;
  if (pairing) {
    const type: Decision['type'] =
      pairing.gameId === 'ultimatum'
        ? (isA ? 'ultimatum_offer' : 'ultimatum_response')
        : pairing.gameId === 'dictator'
          ? 'dictator_give'
          : (isA ? 'trust_send' : 'trust_return');
    if (!(pairing.gameId === 'dictator' && !isA)) {
      decision = session.decisions.find(
        (item) => item.pairingId === pairing.id && item.playerId === playerId && item.type === type,
      );
      decisionLabel = type;
      booleanDecision = type === 'ultimatum_response';
    }
  }

  const poolRounds = [...new Set(
    session.publicGoodsRounds
      .filter((round) => round.memberIds.includes(playerId))
      .map((round) => round.roundNumber),
  )].sort((a, b) => a - b);
  const selectedPool = session.publicGoodsRounds.find(
    (round) => round.roundNumber === poolRound && round.memberIds.includes(playerId),
  );

  useEffect(() => {
    if (player) setBalanceValue(player.currentBalance);
  }, [playerId, player?.currentBalance]);

  useEffect(() => {
    if (!decision) return;
    if (booleanDecision) setDecisionAccepted(decision.accepted ?? false);
    else setDecisionAmount(decision.amount ?? 0);
  }, [playerId, roundKey, decision?.id, decision?.amount, decision?.accepted]);

  useEffect(() => {
    if (poolRounds.length && !poolRounds.includes(poolRound)) setPoolRound(poolRounds[0]);
  }, [playerId, poolRounds.join('|')]);

  useEffect(() => {
    setPoolAmount(selectedPool?.contributions[playerId] ?? 0);
  }, [playerId, poolRound, selectedPool?.contributions[playerId]]);

  const run = (action: () => void) => {
    try {
      action();
      setMessage('Korrekció rögzítve.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'A korrekció nem sikerült.');
    }
  };

  return (
    <details className="panel correction-panel">
      <summary>
        <strong>Adminisztráció és kézi korrekció</strong>
        <span>{session.manualCorrections.length} rögzített módosítás</span>
      </summary>

      <div className="correction-body">
        <div className="technical-audit-export">
          <div>
            <strong>Technikai audit</strong>
            <span>Teljes nyers diagnosztikai állapot: időbélyegek, döntési ablakok, beküldési szándékok, technikai hibák, BOT-jelölések, tranzakciók és kasszakörök.</span>
          </div>
          <button className="secondary" type="button" onClick={() => downloadTechnicalAudit(session)}>
            <Download size={16} />Technikai audit letöltése
          </button>
        </div>

        <label className="field">
          <span>Résztvevő</span>
          <select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
            {session.players.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>

        <div className="correction-grid">
          <form onSubmit={(event) => {
            event.preventDefault();
            run(() => {
              gameStore.correctPlayerBalance(session.code, playerId, balanceValue, balanceNote);
              setBalanceNote('');
            });
          }}>
            <h3>Vagyon javítása</h3>
            <p>Aktuális: <strong>{formatCredits(player?.currentBalance ?? 0)}</strong></p>
            <label className="field"><span>Új vagyon</span><input type="number" min={0} step={100} value={balanceValue} onChange={(e) => setBalanceValue(Number(e.target.value))} /></label>
            <label className="field"><span>Indoklás</span><input value={balanceNote} onChange={(e) => setBalanceNote(e.target.value)} placeholder="pl. technikai hiba javítása" /></label>
            <button className="secondary" type="submit">Vagyon korrigálása</button>
          </form>

          <form onSubmit={(event) => {
            event.preventDefault();
            if (!decision) return setMessage('Ehhez a körhöz nincs meglévő korrigálható döntés.');
            run(() => {
              gameStore.correctStrategicDecision(
                session.code,
                roundKey,
                playerId,
                booleanDecision ? decisionAccepted : decisionAmount,
                decisionNote,
              );
              setDecisionNote('');
            });
          }}>
            <h3>1a–3b döntés javítása</h3>
            <label className="field">
              <span>Kör</span>
              <select value={roundKey} onChange={(e) => setRoundKey(e.target.value as StrategicRound)}>
                {STRATEGIC_ROUNDS.map((round) => <option value={round} key={round}>{ROUND_LABELS[round]}</option>)}
              </select>
            </label>
            <p>Típus: <strong>{decisionLabel}</strong></p>
            {booleanDecision ? (
              <label className="field"><span>Új döntés</span><select value={decisionAccepted ? 'yes' : 'no'} onChange={(e) => setDecisionAccepted(e.target.value === 'yes')}><option value="yes">Elfogadta</option><option value="no">Elutasította</option></select></label>
            ) : (
              <label className="field"><span>Új összeg</span><input type="number" min={0} step={100} value={decisionAmount} onChange={(e) => setDecisionAmount(Number(e.target.value))} /></label>
            )}
            <label className="field"><span>Indoklás</span><input value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Miért javítod?" /></label>
            <button className="secondary" type="submit" disabled={!decision}>Döntés korrigálása</button>
          </form>

          <form onSubmit={(event) => {
            event.preventDefault();
            if (!selectedPool) return setMessage('Ehhez a játékoshoz nincs ilyen kasszakör.');
            run(() => {
              gameStore.correctPublicGoodsContribution(session.code, poolRound, playerId, poolAmount, poolNote);
              setPoolNote('');
            });
          }}>
            <h3>Közös kassza tét javítása</h3>
            <label className="field">
              <span>Kasszakör</span>
              <select value={poolRound} onChange={(e) => setPoolRound(Number(e.target.value))} disabled={!poolRounds.length}>
                {poolRounds.map((round) => <option value={round} key={round}>{round}. kör</option>)}
              </select>
            </label>
            <label className="field"><span>Új befizetés</span><input type="number" min={0} step={100} value={poolAmount} onChange={(e) => setPoolAmount(Number(e.target.value))} /></label>
            <label className="field"><span>Indoklás</span><input value={poolNote} onChange={(e) => setPoolNote(e.target.value)} placeholder="Miért javítod?" /></label>
            <button className="secondary" type="submit" disabled={!selectedPool}>Tét korrigálása</button>
          </form>
        </div>

        {message && <div className="correction-message">{message}</div>}

        {session.manualCorrections.length > 0 && (
          <div className="correction-log">
            <strong>Korrekciós napló</strong>
            {session.manualCorrections.slice().reverse().slice(0, 12).map((item) => (
              <div key={item.id}>
                <span>{new Date(item.createdAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}</span>
                <b>{session.players.find((p) => p.id === item.playerId)?.name ?? item.playerId}</b>
                <span>{item.field}: {String(item.beforeValue)} → {String(item.afterValue)}</span>
                <em>{item.note}</em>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function TestHarness({ session }: { session: GameSession }) {
  const virtualPlayers = session.players.filter((player) => player.id.startsWith(`test-${session.code}-`));
  const [selectedPlayerId, setSelectedPlayerId] = useState(virtualPlayers[0]?.id ?? '');

  useEffect(() => {
    if (virtualPlayers.length === 0) return;
    const touch = () => gameStore.touchPlayers(session.code, virtualPlayers.map((player) => player.id));
    touch();
    const id = window.setInterval(touch, 20_000);
    return () => window.clearInterval(id);
  }, [session.code, virtualPlayers.map((player) => player.id).join('|')]);

  useEffect(() => {
    if (!selectedPlayerId && virtualPlayers[0]) setSelectedPlayerId(virtualPlayers[0].id);
  }, [selectedPlayerId, virtualPlayers[0]?.id]);

  const openClient = () => {
    if (!selectedPlayerId) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('role', 'player');
    url.searchParams.set('code', session.code);
    url.searchParams.set('test', '1');
    url.searchParams.set('testPlayer', selectedPlayerId);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const canSimulateStrategic =
    STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound) &&
    !session.closedRounds.includes(session.roundKey as StrategicRound);
  const canSimulatePool = session.roundKey === '4' && session.publicGoodsPhase === 'open';

  return (
    <section className="panel test-harness">
      <div className="section-title">
        <div>
          <p className="eyebrow">Tesztmód · Firebase nélkül</p>
          <h2>Virtuális résztvevők</h2>
        </div>
        <span className="pill">{virtualPlayers.length} virtuális játékos</span>
      </div>

      <div className="test-harness-grid">
        <div className="test-action-card">
          <strong>Résztvevői kliens megnézése</strong>
          <p>Nyisd meg bármelyik virtuális játékos valódi kliensnézetét külön fülön.</p>
          <label className="field">
            <span>Játékos</span>
            <select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)}>
              {virtualPlayers.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}
            </select>
          </label>
          <button className="secondary" disabled={!selectedPlayerId} onClick={openClient}>
            <Smartphone size={17} />Kliens megnyitása
          </button>
        </div>

        <div className="test-action-card">
          <strong>Aktuális döntések szimulálása</strong>
          <p>A rendszer különböző összegekkel és eredményekkel kitölti az aktuális kört. A kör lezárását továbbra is te végzed.</p>
          <button
            className="secondary"
            disabled={!canSimulateStrategic && !canSimulatePool}
            onClick={() => canSimulateStrategic ? simulateStrategicRound(session.code) : simulatePublicGoodsRound(session.code)}
          >
            <RefreshCcw size={17} />
            {canSimulatePool ? 'Kasszatétek szimulálása' : 'Döntések szimulálása'}
          </button>
        </div>

        <div className="test-action-card">
          <strong>Mit tesztelsz?</strong>
          <p>
            A dashboard, párosítás, könyvelés, kliensszöveg, csoportképzés és kassza ugyanazt a kódot használja,
            mint az éles játék. Csak a külön telefonok közti adatkapcsolat hiányzik.
          </p>
        </div>
      </div>
    </section>
  );
}

function FirebaseSyncBanner() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ status: 'ok' | 'error'; message?: string }>).detail;
      if (detail?.status === 'error') setMessage(detail.message || 'Firebase szinkronhiba.');
      if (detail?.status === 'ok') setMessage('');
    };
    window.addEventListener('kreditjatek-sync-status', handler);
    return () => window.removeEventListener('kreditjatek-sync-status', handler);
  }, []);

  if (!message) return null;
  return (
    <div className="firebase-sync-error" role="alert">
      <strong>Kapcsolati hiba</strong>
      <span>{message}</span>
      <span>Ne lépj tovább a következő körre, amíg a kapcsolat helyre nem áll.</span>
    </div>
  );
}


let projectionWindow: Window | null = null;

function ensureProjectionWindow() {
  if (projectionWindow && !projectionWindow.closed) return projectionWindow;
  projectionWindow = window.open(
    '',
    'kreditjatek-projection',
    'popup=yes,width=1280,height=820,resizable=yes,scrollbars=yes',
  );
  return projectionWindow;
}

function renderProjectionWindow(
  story: ProjectionStory,
  revealedSteps: number,
  showComments: boolean,
) {
  const target = ensureProjectionWindow();
  if (!target) return false;

  const doc = target.document;
  doc.title = 'Kreditjáték – kivetítés';

  if (!doc.getElementById('kreditjatek-projection-style')) {
    const style = doc.createElement('style');
    style.id = 'kreditjatek-projection-style';
    style.textContent = `
      :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a;background:#f8fafc}
      *{box-sizing:border-box}
      body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#fff 0,#f8fafc 58%,#eef2f7 100%);display:grid;place-items:center;padding:5vw}
      main{width:min(1180px,100%);min-height:70vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
      .round{font-size:clamp(18px,2vw,30px);font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:4vh}
      .steps{width:100%;display:flex;flex-direction:column;gap:clamp(20px,3vh,38px);align-items:center}
      .step{font-size:clamp(34px,5vw,72px);line-height:1.08;font-weight:850;color:#0f172a;max-width:1050px}
      .step:not(:last-child){font-size:clamp(25px,3.4vw,48px);color:#475569}
      .reflection{margin-top:6vh;width:min(920px,100%);border-top:2px solid #cbd5e1;padding-top:3vh}
      .reflection-label{font-size:clamp(14px,1.5vw,22px);font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:2vh}
      blockquote{margin:1.2vh 0;font-size:clamp(24px,3.3vw,46px);line-height:1.25;font-weight:650;color:#1e293b}
      .blank{font-size:clamp(24px,3vw,42px);color:#94a3b8;font-weight:750}
    `;
    doc.head.appendChild(style);
  }

  const main = doc.createElement('main');
  const round = doc.createElement('div');
  round.className = 'round';
  round.textContent = story.roundLabel;
  main.appendChild(round);

  const steps = doc.createElement('div');
  steps.className = 'steps';
  story.steps.slice(0, Math.max(1, revealedSteps)).forEach((text) => {
    const node = doc.createElement('div');
    node.className = 'step';
    node.textContent = text;
    steps.appendChild(node);
  });
  main.appendChild(steps);

  if (showComments && story.comments.length > 0) {
    const reflection = doc.createElement('section');
    reflection.className = 'reflection';
    const label = doc.createElement('div');
    label.className = 'reflection-label';
    label.textContent = 'Résztvevői reflexió';
    reflection.appendChild(label);
    story.comments.forEach((comment) => {
      const quote = doc.createElement('blockquote');
      quote.textContent = '„' + comment + '”';
      reflection.appendChild(quote);
    });
    main.appendChild(reflection);
  }

  doc.body.replaceChildren(main);
  target.focus();
  return true;
}

function closeProjectionWindow() {
  if (projectionWindow && !projectionWindow.closed) projectionWindow.close();
  projectionWindow = null;
}

const eventRoundLabel = (event: InterestingEvent) =>
  event.game === 'publicGoods'
    ? `Kassza ${event.publicGoodsRound ?? ''}. kör`
    : ROUND_LABELS[event.roundKey];

const eventParticipantLabel = (session: GameSession, event: InterestingEvent) =>
  event.playerIds
    .map((id) => session.players.find((player) => player.id === id)?.name)
    .filter(Boolean)
    .join(' · ');

const factNumber = (event: InterestingEvent, key: string) => {
  const value = event.facts[key];
  return typeof value === 'number' ? value : undefined;
};

const signedCredits = (value: number) =>
  (value > 0 ? '+' : '') + formatCredits(value);

function DebriefEventSummary({
  session,
  event,
  pinned = false,
  onTogglePin,
  onProject,
  projecting = false,
}: {
  session: GameSession;
  event: InterestingEvent;
  pinned?: boolean;
  onTogglePin?: () => void;
  onProject?: () => void;
  projecting?: boolean;
}) {
  const participants = eventParticipantLabel(session, event);
  const offer = factNumber(event, 'offer');
  const amount = factNumber(event, 'amount');
  const sent = factNumber(event, 'sent');
  const multiplied = factNumber(event, 'multiplied');
  const returned = factNumber(event, 'returned');
  const contribution = factNumber(event, 'contribution');
  const ownWealthPercent = factNumber(event, 'ownWealthPercent');
  const potPercent = factNumber(event, 'potPercent');
  const netAmount = factNumber(event, 'netAmount');

  let detail: React.ReactNode = null;

  if (event.kind === 'ultimatum_rejection' || event.kind === 'ultimatum_extreme_offer') {
    detail = (
      <>
        {participants && <span>{participants}</span>}
        {offer !== undefined && <strong>{formatCredits(offer)}</strong>}
        {event.kind === 'ultimatum_extreme_offer' && typeof event.facts.accepted === 'boolean' && (
          <span>{event.facts.accepted ? 'elfogadva' : 'elutasítva'}</span>
        )}
      </>
    );
  } else if (event.kind === 'ultimatum_acceptance_boundary') {
    const rejected = factNumber(event, 'highestRejected');
    const accepted = factNumber(event, 'lowestAccepted');
    detail = (
      <>
        {rejected !== undefined && <span>legmagasabb elutasított <b>{formatCredits(rejected)}</b></span>}
        {accepted !== undefined && <span>legalacsonyabb elfogadott <b>{formatCredits(accepted)}</b></span>}
      </>
    );
  } else if (event.kind === 'dictator_extreme_give') {
    detail = (
      <>
        {participants && <span>{participants}</span>}
        {amount !== undefined && <strong>{formatCredits(amount)}</strong>}
      </>
    );
  } else if (event.kind === 'ultimatum_dictator_shift') {
    const ultimatumAmount = factNumber(event, 'ultimatumAmount');
    const dictatorAmount = factNumber(event, 'dictatorAmount');
    const shift = factNumber(event, 'shiftPercentagePoints');
    detail = (
      <>
        {participants && <span>{participants}</span>}
        <strong>
          {ultimatumAmount !== undefined ? formatCredits(ultimatumAmount) : '–'}
          {' → '}
          {dictatorAmount !== undefined ? formatCredits(dictatorAmount) : '–'}
        </strong>
        {shift !== undefined && <span>{shift > 0 ? '+' : ''}{shift} százalékpont</span>}
      </>
    );
  } else if (
    event.kind === 'trust_high_high' ||
    event.kind === 'trust_high_low' ||
    event.kind === 'trust_low_high' ||
    event.kind === 'trust_near_equal_outcome'
  ) {
    detail = (
      <>
        {participants && <span>{participants}</span>}
        <strong>
          {sent !== undefined ? formatCredits(sent) : '–'}
          {' → '}
          {multiplied !== undefined ? formatCredits(multiplied) : '–'}
          {' → '}
          {returned !== undefined ? formatCredits(returned) : '–'}
        </strong>
      </>
    );
  } else if (
    event.kind === 'pool_personal_vs_group_share' ||
    event.kind === 'pool_high_contribution_net_loss' ||
    event.kind === 'pool_low_contribution_net_gain'
  ) {
    detail = (
      <>
        {participants && <span>{participants}</span>}
        {contribution !== undefined && <strong>{formatCredits(contribution)}</strong>}
        <span>
          saját vagyon {ownWealthPercent ?? '–'}% · közös kassza {potPercent ?? '–'}%
          {netAmount !== undefined ? ' · nettó ' + signedCredits(netAmount) : ''}
        </span>
      </>
    );
  } else if (event.kind === 'pool_pivotal_minimum') {
    const total = factNumber(event, 'totalContribution');
    const minimum = factNumber(event, 'minimumAmount');
    detail = (
      <>
        {participants && <span>{participants}</span>}
        {contribution !== undefined && <strong>{formatCredits(contribution)}</strong>}
        <span>
          kassza {total !== undefined ? formatCredits(total) : '–'}
          {' · minimum '}
          {minimum !== undefined ? formatCredits(minimum) : '–'}
        </span>
      </>
    );
  } else if (event.kind === 'pool_large_shift') {
    const previous = factNumber(event, 'previousPercent');
    const current = factNumber(event, 'currentPercent');
    detail = (
      <>
        {participants && <span>{participants}</span>}
        <strong>{previous ?? '–'}% → {current ?? '–'}%</strong>
      </>
    );
  } else if (event.kind === 'pool_group_minimum_transition') {
    const previousTotal = factNumber(event, 'previousTotal');
    const currentTotal = factNumber(event, 'currentTotal');
    const previousMinimum = factNumber(event, 'previousMinimum');
    const currentMinimum = factNumber(event, 'currentMinimum');
    const groupName = session.groups.find((group) => group.id === event.groupId)?.name ?? 'Csoport';
    detail = (
      <>
        <span>{groupName}</span>
        <strong>
          {previousTotal !== undefined ? formatCredits(previousTotal) : '–'}
          {' → '}
          {currentTotal !== undefined ? formatCredits(currentTotal) : '–'}
        </strong>
        <span>
          minimum {previousMinimum !== undefined ? formatCredits(previousMinimum) : '–'}
          {' → '}
          {currentMinimum !== undefined ? formatCredits(currentMinimum) : '–'}
        </span>
      </>
    );
  }

  return (
    <article className={'debrief-note-card priority-' + event.priority}>
      <header>
        <span>{eventRoundLabel(event)}</span>
        <div className="debrief-note-actions">
          <small>{pinned ? 'félretéve' : 'rendszer által kiemelt'}</small>
          {onTogglePin && (
            <button
              type="button"
              className={'debrief-pin-button ' + (pinned ? 'is-pinned' : '')}
              onClick={onTogglePin}
              aria-pressed={pinned}
            >
              {pinned ? '★ Félretéve' : '☆ Félreteszem'}
            </button>
          )}
          {onProject && (
            <button
              type="button"
              className={'debrief-project-button ' + (projecting ? 'is-projecting' : '')}
              onClick={onProject}
            >
              {projecting ? '● Kivetítve' : 'Kivetítés'}
            </button>
          )}
        </div>
      </header>
      <h3>{event.title}</h3>
      <div className="debrief-note-facts">{detail}</div>
      {(() => {
        const linked = (session.reflections ?? []).filter((reflection) =>
          event.selfDecisionIds.includes(reflection.decisionId),
        );
        if (linked.length === 0) return null;
        return (
          <div className="debrief-event-reflections">
            {linked.map((reflection) => {
              const author = session.players.find((player) => player.id === reflection.playerId)?.name ?? 'Résztvevő';
              return (
                <div key={reflection.playerId + ':' + reflection.decisionId}>
                  <strong>{author} is kiemelte</strong>
                  <span>„{reflection.comment}”</span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </article>
  );
}

function LiveDebriefNotes({ session }: { session: GameSession }) {
  const highlightedEvents = useMemo(() => buildHighlightedEvents(session), [session]);
  const allEvents = useMemo(() => buildInterestingEvents(session), [session]);
  const pinnedIds = new Set(session.pinnedDebriefEventIds ?? []);
  const pinnedEvents = allEvents.filter((item) => pinnedIds.has(item.id));

  if (highlightedEvents.length === 0 && pinnedEvents.length === 0) return null;

  const roundOrder: Record<string, number> = {
    '1a': 1,
    '1b': 2,
    '2a': 3,
    '2b': 4,
    '3a': 5,
    '3b': 6,
    '4': 7,
  };
  const byRecency = (a: InterestingEvent, b: InterestingEvent) => {
    const stage = (roundOrder[b.roundKey] ?? 0) - (roundOrder[a.roundKey] ?? 0);
    if (stage !== 0) return stage;
    if (a.roundKey === '4' && b.roundKey === '4') {
      const round = (b.publicGoodsRound ?? 0) - (a.publicGoodsRound ?? 0);
      if (round !== 0) return round;
    }
    return a.priority - b.priority;
  };

  const pinned = [...pinnedEvents].sort(byRecency);
  const unpinned = highlightedEvents.filter((item) => !pinnedIds.has(item.id)).sort(byRecency);
  const latest = unpinned.slice(0, 6);
  const older = unpinned.slice(6);

  const togglePin = (eventId: string) => gameStore.togglePinnedDebriefEvent(session.code, eventId);

  return (
    <section className="panel dashboard-section live-debrief-panel">
      <div className="section-title debrief-section-title">
        <div>
          <p className="eyebrow">Kivezetés · élő gyűjtés</p>
          <h2>Kivezetési jegyzetek · {highlightedEvents.length}</h2>
          <p>A rendszer csak lezárt, elszámolt körökből emel ki helyzeteket. Ezt csak te látod.</p>
        </div>
        {pinned.length > 0 && <span className="debrief-pinned-count">★ Félretett · {pinned.length}</span>}
      </div>

      {pinned.length > 0 && (
        <div className="debrief-pinned-section">
          <strong>Félretett eseményeim</strong>
          <div className="debrief-note-grid">
            {pinned.map((item) => (
              <DebriefEventSummary
                session={session}
                event={item}
                pinned
                onTogglePin={() => togglePin(item.id)}
                key={item.id}
              />
            ))}
          </div>
        </div>
      )}

      {latest.length > 0 && (
        <>
          {pinned.length > 0 && <div className="debrief-subhead">Friss rendszerjelzések</div>}
          <div className="debrief-note-grid">
            {latest.map((item) => (
              <DebriefEventSummary
                session={session}
                event={item}
                onTogglePin={() => togglePin(item.id)}
                key={item.id}
              />
            ))}
          </div>
        </>
      )}

      {older.length > 0 && (
        <details className="debrief-older-notes">
          <summary>Korábbi jelzések · {older.length}</summary>
          <div className="debrief-note-grid">
            {older.map((item) => (
              <DebriefEventSummary
                session={session}
                event={item}
                onTogglePin={() => togglePin(item.id)}
                key={item.id}
              />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}


function SelfReportMiniCard({
  item,
}: {
  item: ReturnType<typeof buildSelfReport>[number];
}) {
  let main = '';
  let secondary = '';

  if (item.game === 'ultimatum') {
    if (item.timedOutRole) {
      if (item.timedOutRole === 'proposer') {
        main = item.role === 'proposer'
          ? 'Nem küldtél ajánlatot időben'
          : 'A másik játékos nem küldött ajánlatot időben';
      } else {
        main = item.role === 'receiver'
          ? `${formatCredits(item.amount ?? 0)} kredites ajánlatra nem döntöttél időben`
          : `Ajánlatod: ${formatCredits(item.amount ?? 0)} · a másik játékos ideje lejárt`;
      }
      secondary = 'Időtúllépés · ebből a párosításból 0 kredit';
    } else {
      main = item.role === 'proposer'
        ? `${formatCredits(item.amount ?? 0)} kreditet ajánlottál`
        : `${formatCredits(item.amount ?? 0)} kreditet ajánlottak neked`;
      secondary = item.accepted
        ? (item.role === 'proposer' ? 'Elfogadták' : 'Elfogadtad')
        : (item.role === 'proposer' ? 'Elutasították' : 'Elutasítottad');
    }
  } else if (item.game === 'dictator') {
    main = item.timedOutRole === 'dictator'
      ? 'Nem döntöttél időben'
      : `${formatCredits(item.amount ?? 0)} kreditet adtál`;
    secondary = item.timedOutRole === 'dictator'
      ? 'Időtúllépés · 0 kredit került átadásra'
      : `${formatCredits(item.keptAmount ?? 0)} maradt nálad`;
  } else if (item.game === 'trust') {
    if (item.role === 'sender') {
      main = item.timedOutRole === 'sender'
        ? 'Nem döntöttél időben a küldésről'
        : `${formatCredits(item.sentAmount ?? 0)}-et küldtél → ${formatCredits(item.multipliedAmount ?? 0)} lett belőle`;
      secondary = item.timedOutRole === 'sender'
        ? 'Időtúllépés · 0 kredit küldés'
        : `${formatCredits(item.returnedAmount ?? 0)}-et kaptál vissza`;
    } else {
      main = item.timedOutRole === 'returner'
        ? `${formatCredits(item.multipliedAmount ?? 0)} került hozzád · nem döntöttél időben a visszaadásról`
        : `${formatCredits(item.multipliedAmount ?? 0)} került hozzád`;
      secondary = item.timedOutRole === 'returner'
        ? `Időtúllépés · ${formatCredits(item.keptAmount ?? 0)} maradt nálad`
        : `${formatCredits(item.returnedAmount ?? 0)}-et adtál vissza · ${formatCredits(item.keptAmount ?? 0)} maradt nálad`;
    }
  } else {
    main = `${formatCredits(item.contributionAmount ?? 0)} befizetés`;
    secondary = `saját vagyon ${item.ownWealthPercent ?? '–'}% · közös kassza ${item.potPercent ?? '–'}% · nettó ${signedCredits(item.netAmount ?? 0)}`;
  }

  return (
    <div className="self-report-mini-card">
      <span>{item.roundLabel}</span>
      <strong>{main}</strong>
      <small>{secondary}</small>
      {item.isBotDecision && <em className="self-report-bot-note">BOT döntése</em>}
    </div>
  );
}

function DebriefGroupView({ session }: { session: GameSession }) {
  const picture = useMemo(() => buildGroupPicture(session), [session]);

  return (
    <div className="debrief-workspace-body">
      <section className="debrief-group-block">
        <header>
          <h3>Ultimátum</h3>
          <div>
            <strong>{picture.ultimatum.averageOffer === null ? '–' : formatCredits(picture.ultimatum.averageOffer)}</strong>
            <span>átlagos ajánlat</span>
          </div>
          <div>
            <strong>{picture.ultimatum.rejectedCount}</strong>
            <span>elutasítás</span>
          </div>
        </header>
        <div className="anonymous-values">
          {picture.ultimatum.offers.length === 0 ? <span>–</span> : picture.ultimatum.offers.map((item, index) => (
            <span className={item.accepted ? 'accepted' : 'rejected'} key={index}>
              {formatCredits(item.amount)} {item.accepted ? '✓' : '×'}
            </span>
          ))}
        </div>
      </section>

      <section className="debrief-group-block">
        <header>
          <h3>Diktátor</h3>
          <div>
            <strong>{picture.dictator.averageGiven === null ? '–' : formatCredits(picture.dictator.averageGiven)}</strong>
            <span>átlagos átadás</span>
          </div>
        </header>
        <div className="anonymous-values">
          {picture.dictator.amounts.length === 0 ? <span>–</span> : picture.dictator.amounts.map((item, index) => (
            <span key={index}>{formatCredits(item.amount)}</span>
          ))}
        </div>
      </section>

      <section className="debrief-group-block">
        <header>
          <h3>Bizalom</h3>
          <div>
            <strong>{picture.trust.averageSent === null ? '–' : formatCredits(picture.trust.averageSent)}</strong>
            <span>átlag elküldve</span>
          </div>
          <div>
            <strong>{picture.trust.averageReturned === null ? '–' : formatCredits(picture.trust.averageReturned)}</strong>
            <span>átlag vissza</span>
          </div>
        </header>
        <div className="anonymous-values trust-anonymous-values">
          {picture.trust.pairs.length === 0 ? <span>–</span> : picture.trust.pairs.map((item, index) => (
            <span key={index}>{formatCredits(item.sent)} → {formatCredits(item.returned)}</span>
          ))}
        </div>
      </section>

      <section className="debrief-group-block">
        <header>
          <h3>Közös kassza</h3>
        </header>
        {picture.publicGoods.length === 0 ? (
          <div className="summary-empty">Még nincs elszámolt kasszakör.</div>
        ) : (
          <div className="debrief-pool-rounds">
            {picture.publicGoods.map((round) => {
              const groupName = session.groups.find((group) => group.id === round.groupId)?.name ?? 'Csoport';
              return (
                <div className="debrief-pool-round" key={round.groupId + '-' + round.roundNumber}>
                  <div className="debrief-pool-round-head">
                    <strong>{round.roundNumber}. kör · {groupName}</strong>
                    <span>
                      Kassza {formatCredits(round.totalContribution)}
                      {round.success ? ' → bank után ' + formatCredits(round.doubledPot) : ' · minimum nem teljesült'}
                    </span>
                  </div>
                  <div className="anonymous-values pool-anonymous-values">
                    {round.contributions.map((item, index) => (
                      <span key={index}>
                        {formatCredits(item.amount)}
                        {item.ownWealthPercent !== null ? ' · saját ' + item.ownWealthPercent + '%' : ''}
                        {item.potPercent !== null ? ' · kassza ' + item.potPercent + '%' : ''}
                        {' · nettó '}{signedCredits(item.netAmount)}
                        {item.automated ? ' · BOT' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DebriefEventsView({ session }: { session: GameSession }) {
  const events = useMemo(() => buildInterestingEvents(session), [session]);
  const pinnedIds = new Set(session.pinnedDebriefEventIds ?? []);
  const pinned = events.filter((item) => pinnedIds.has(item.id));
  const rest = events.filter((item) => !pinnedIds.has(item.id));
  const grouped = useMemo(() => buildDebriefEventGroups(rest), [rest]);
  const toggle = (id: string) => gameStore.togglePinnedDebriefEvent(session.code, id);
  const [projection, setProjection] = useState<{
    eventId: string;
    story: ProjectionStory;
    revealedSteps: number;
    showComments: boolean;
  } | null>(null);
  const [projectionError, setProjectionError] = useState('');

  const project = (event: InterestingEvent) => {
    const story = buildProjectionStory(session, event);
    const next = { eventId: event.id, story, revealedSteps: 1, showComments: false };
    setProjectionError('');
    if (!renderProjectionWindow(story, 1, false)) {
      setProjectionError('A böngésző letiltotta a vetítőablakot. Engedélyezd a felugró ablakot, majd kattints újra a Kivetítés gombra.');
      return;
    }
    setProjection(next);
  };

  const updateProjection = (next: {
    eventId: string;
    story: ProjectionStory;
    revealedSteps: number;
    showComments: boolean;
  }) => {
    setProjection(next);
    if (!renderProjectionWindow(next.story, next.revealedSteps, next.showComments)) {
      setProjectionError('A vetítőablak nem érhető el. Kattints újra az esemény Kivetítés gombjára.');
    }
  };

  const closeProjection = () => {
    closeProjectionWindow();
    setProjection(null);
    setProjectionError('');
  };

  const renderEventCard = (item: InterestingEvent, isPinned = false) => (
    <DebriefEventSummary
      key={item.id}
      session={session}
      event={item}
      pinned={isPinned}
      onTogglePin={() => toggle(item.id)}
      onProject={() => project(item)}
      projecting={projection?.eventId === item.id}
    />
  );

  return (
    <div className="debrief-workspace-body">
      {projection && (
        <section className="projection-controller">
          <div className="projection-controller-copy">
            <span>Kivetítve</span>
            <strong>{projection.story.title}</strong>
            <small>{projection.story.roundLabel} · {projection.revealedSteps}/{projection.story.steps.length} adat látható</small>
          </div>
          <div className="projection-controller-actions">
            <button
              type="button"
              className="secondary"
              disabled={projection.revealedSteps <= 1}
              onClick={() => updateProjection({
                ...projection,
                revealedSteps: Math.max(1, projection.revealedSteps - 1),
              })}
            >
              Előző adat
            </button>
            <button
              type="button"
              className="secondary"
              disabled={projection.revealedSteps >= projection.story.steps.length}
              onClick={() => updateProjection({
                ...projection,
                revealedSteps: Math.min(projection.story.steps.length, projection.revealedSteps + 1),
              })}
            >
              Következő adat
            </button>
            {projection.story.comments.length > 0 && (
              <button
                type="button"
                className={projection.showComments ? 'secondary active' : 'secondary'}
                onClick={() => updateProjection({
                  ...projection,
                  showComments: !projection.showComments,
                })}
              >
                {projection.showComments ? 'Komment elrejtése' : 'Komment mutatása'}
              </button>
            )}
            <button type="button" className="danger-subtle" onClick={closeProjection}>Kivetítés bezárása</button>
          </div>
        </section>
      )}

      {projectionError && <div className="error">{projectionError}</div>}

      {pinned.length > 0 && (
        <section className="debrief-workspace-section">
          <h3>★ Félretett eseményeim · {pinned.length}</h3>
          <div className="debrief-note-grid">
            {pinned.map((item) => renderEventCard(item, true))}
          </div>
        </section>
      )}

      <section className="debrief-workspace-section">
        <h3>Minden érdekes esemény · {events.length}</h3>
        {rest.length === 0 ? (
          <div className="summary-empty">Nincs további rendszer által kiemelt esemény.</div>
        ) : (
          <div className="debrief-event-game-groups">
            {grouped.map((gameGroup) => (
              <details className="debrief-event-game-group" key={gameGroup.game}>
                <summary>
                  <strong>{gameGroup.label}</strong>
                  <span>{gameGroup.count} esemény · {gameGroup.stories.length} történetcsoport</span>
                </summary>

                <div className="debrief-event-story-groups">
                  {gameGroup.stories.map((story) => {
                    const featured = story.events.slice(0, 3);
                    const remaining = story.events.slice(3);

                    return (
                      <details className="debrief-event-story-group" key={story.id}>
                        <summary>
                          <strong>{story.label}</strong>
                          <span>{story.events.length} eset</span>
                        </summary>

                        <div className="debrief-event-story-content">
                          <div className="debrief-note-grid">
                            {featured.map((item) => renderEventCard(item))}
                          </div>

                          {remaining.length > 0 && (
                            <details className="debrief-event-more">
                              <summary>Mind a {story.events.length} eset megmutatása</summary>
                              <div className="debrief-note-grid">
                                {remaining.map((item) => renderEventCard(item))}
                              </div>
                            </details>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DebriefParticipantsView({ session }: { session: GameSession }) {
  const events = useMemo(() => buildInterestingEvents(session), [session]);
  const participantRows = useMemo(() => session.players
    .filter((player) => !player.isBot)
    .map((player) => ({
      player,
      events: events.filter((item) => item.playerIds.includes(player.id)),
      report: buildSelfReport(session, player.id),
      reflections: (session.reflections ?? []).filter((item) => item.playerId === player.id),
    }))
    .sort((a, b) =>
      b.reflections.length - a.reflections.length ||
      b.events.length - a.events.length ||
      a.player.name.localeCompare(b.player.name, 'hu')
    ),
  [session, events]);

  return (
    <div className="debrief-workspace-body participant-debrief-list">
      {participantRows.map(({ player, events: playerEvents, report, reflections }) => (
        <details className="participant-debrief-item" key={player.id}>
          <summary>
            <strong>{player.name}</strong>
            <span>
              {playerEvents.length} érdekes esemény
              {reflections.length > 0 ? ' · ' + reflections.length + ' saját kiemelés' : ' · reflexióra vár'}
            </span>
          </summary>
          <div className="participant-debrief-content">
            {playerEvents.length > 0 && (
              <div className="participant-event-tags">
                {playerEvents.map((item) => <span key={item.id}>{item.title}</span>)}
              </div>
            )}
            {reflections.length > 0 && (
              <div className="participant-reflection-list">
                {reflections.map((reflection) => {
                  const item = report.find((reportItem) => reportItem.id === reflection.decisionId);
                  return (
                    <div key={reflection.decisionId}>
                      <strong>{item?.roundLabel ?? 'Saját döntés'}</strong>
                      <span>„{reflection.comment}”</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="self-report-mini-grid">
              {report.map((item) => <SelfReportMiniCard item={item} key={item.id} />)}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function DebriefWorkspace({
  session,
  open,
  onOpenChange,
}: {
  session: GameSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const finalMode = session.roundKey === 'report';
  const [tab, setTab] = useState<'group' | 'events' | 'participants'>(finalMode ? 'group' : 'events');
  const reflectedPlayers = new Set((session.reflections ?? []).map((item) => item.playerId)).size;
  const eligiblePlayers = session.players.filter(
    (player) => !player.isBot && !player.botControlled && buildSelfReport(session, player.id).length > 0,
  ).length;
  const hasData =
    session.closedRounds.length > 0 ||
    session.publicGoodsRounds.some((round) => round.status === 'settled');

  useEffect(() => {
    if (finalMode) setTab('group');
  }, [finalMode]);

  useEffect(() => {
    if (finalMode || !open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [finalMode, open, onOpenChange]);

  const content = hasData ? (
    <>
      <div className="debrief-tabs" role="tablist" aria-label="Kivezetés nézetei">
        <button type="button" className={tab === 'group' ? 'active' : ''} onClick={() => setTab('group')}>Csoportkép</button>
        <button type="button" className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>Érdekes események</button>
        <button type="button" className={tab === 'participants' ? 'active' : ''} onClick={() => setTab('participants')}>Résztvevők</button>
      </div>

      {tab === 'group' && <DebriefGroupView session={session} />}
      {tab === 'events' && <DebriefEventsView session={session} />}
      {tab === 'participants' && <DebriefParticipantsView session={session} />}
    </>
  ) : (
    <div className="debrief-empty-state">
      <strong>Még nincs kivezetési adat.</strong>
      <span>Az első lezárt kör után itt jelenik meg a csoportkép, az érdekes események és a résztvevői történet.</span>
    </div>
  );

  if (!finalMode) {
    if (!open) return null;
    return createPortal(
      <div
        className="debrief-drawer-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onOpenChange(false);
        }}
      >
        <aside className="debrief-drawer" role="dialog" aria-modal="true" aria-label="Kivezetés">
          <header className="debrief-drawer-head">
            <div>
              <p className="eyebrow">Tréneri backstage</p>
              <h2>Kivezetés</h2>
              <span>Csak te látod. A játék fő vezérlése a háttérben változatlan marad.</span>
            </div>
            <button type="button" className="debrief-drawer-close" onClick={() => onOpenChange(false)} aria-label="Kivezetés bezárása">×</button>
          </header>
          <div className="debrief-drawer-content">{content}</div>
        </aside>
      </div>,
      document.body,
    );
  }

  return (
    <section className="panel dashboard-section debrief-workspace debrief-workspace-final" id="debrief-workspace">
      <button
        type="button"
        className="debrief-workspace-toggle"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <div>
          <p className="eyebrow">Játék lezárva · tréneri nézet</p>
          <h2>Kivezetés</h2>
          <p className="debrief-workspace-intro">Most ez a fő munkafelület: csoportkép, érdekes események és egyéni történetek.</p>
        </div>
        <div className="debrief-workspace-status">
          <b>Reflexió {reflectedPlayers}/{eligiblePlayers}</b>
          <span>{open ? 'Bezárás' : 'Megnyitás'}</span>
        </div>
      </button>
      {open && content}
    </section>
  );
}

function PostReportLearningRoundPanel({ session }: { session: GameSession }) {
  if (session.roundKey !== 'report') return null;

  const continuation = session.publicGoodsContinuation;
  if (continuation) {
    const topUpCount = Object.keys(continuation.restartBalance).filter(
      (playerId) => (continuation.baselineFinalBalance[playerId] ?? 0) < (continuation.restartBalance[playerId] ?? 0),
    ).length;
    return (
      <section className="panel post-report-learning-panel dashboard-section">
        <div>
          <p className="eyebrow">Közös kassza · tanulókör</p>
          <h2>Az utójáték lezárult</h2>
          <p>
            Az első lezárás eredménye megmaradt összehasonlítási alapnak.
            {topUpCount > 0 ? ` ${topUpCount} résztvevő kapott induló-kredit minimumot a tanulókör elején.` : ''}
          </p>
        </div>
      </section>
    );
  }

  if (!session.publicGoodsRounds.some((round) => round.status === 'settled')) return null;

  const belowFloor = session.players.filter(
    (player) => !player.isBot && player.currentBalance < session.startingCredit,
  );

  return (
    <section className="panel post-report-learning-panel dashboard-section">
      <div>
        <p className="eyebrow">Közös kassza · tanulókör</p>
        <h2>Tanultak belőle?</h2>
        <p>
          Ugyanazok a csoportok újabb kasszaköröket játszhatnak. Mindenki az első lezáráskor meglévő vagyonával indul tovább;
          aki {formatCredits(session.startingCredit)} alatt maradt, {formatCredits(session.startingCredit)} kreditre egészül ki.
        </p>
        <small>
          {belowFloor.length > 0
            ? `${belowFloor.length} résztvevő kap induló-kredit minimumot.`
            : 'Minden résztvevő legalább az induló kredit összegével rendelkezik.'}
          {' '}Az első szakasz eredménye megmarad a későbbi összehasonlításhoz.
        </small>
      </div>
      <button
        type="button"
        className="primary"
        onClick={() => {
          const confirmed = window.confirm(
            'Elindítod a Közös kassza tanulókört? Az első lezárás eredménye megmarad, a csoportok változatlanok maradnak, és az induló kredit alatti vagyonokat a rendszer feltölti az induló kreditre.',
          );
          if (confirmed) gameStore.resumePublicGoodsAfterReport(session.code);
        }}
      >
        Közös kassza folytatása
      </button>
    </section>
  );
}

function TrainerDashboard({ code, testMode = false }: { code: string; testMode?: boolean }) {
  const [session, setSession] = useState<GameSession | null>(() => gameStore.get(code));
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [, setClock] = useState(0);
  useEffect(() => gameStore.subscribe(code, setSession), [code]);
  useEffect(() => {
    const id = window.setInterval(() => {
      setClock((value) => value + 1);
      const current = gameStore.get(code);
      if (current && STRATEGIC_ROUNDS.includes(current.roundKey as StrategicRound)) {
        gameStore.reconcileStrategicTimeouts(code);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [code]);

  useEffect(() => {
    if (session?.roundKey === 'report') setDebriefOpen(true);
  }, [session?.roundKey]);

  const openDebrief = () => {
    setDebriefOpen(true);
    if (session?.roundKey !== 'report') return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById('debrief-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const joinUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('role', 'player');
    url.searchParams.set('code', code);
    return url.toString();
  }, [code]);

  if (!session) {
    return <main className="shell narrow"><section className="panel"><h2>A játék nem található.</h2></section></main>;
  }

  return (
    <main className="shell trainer-shell">
      <FirebaseSyncBanner />
      <TrainerCockpit session={session} joinUrl={joinUrl} onOpenDebrief={openDebrief} />
      <PostReportLearningRoundPanel session={session} />
      {testMode && <TestHarness session={session} />}

      <CurrentPairsBoard session={session} />
      {session.roundKey === '4' ? <PublicGoodsDashboard session={session} /> : null}
      <DebriefWorkspace session={session} open={debriefOpen} onOpenChange={setDebriefOpen} />

      <ReportPanel session={session} />
      <PlayerTable session={session} />
      <TrainerCorrectionPanel session={session} />

      <footer className="trainer-legal-footer">
        Készítette Budai Máté 2026-ban. Minden jog fenntartva. Hajrá, Fradi!
      </footer>
    </main>
  );
}

function Timer({ startedAt }: { startedAt?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  if (!startedAt) return null;
  const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const remaining = Math.max(0, 60 - elapsed);
  return <div className={'timer ' + (remaining === 0 ? 'expired' : '')}>{remaining > 0 ? remaining + ' mp' : 'Lejárt'}</div>;
}

function DeadlineTimer({ deadlineAt }: { deadlineAt?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  if (!deadlineAt) return null;
  const remaining = Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000));
  return <div className={'timer ' + (remaining === 0 ? 'expired' : '')}>{remaining > 0 ? remaining + ' mp' : 'Idő lejárt'}</div>;
}

function AmountDecision({
  max,
  label,
  button,
  giveLabel = 'Odaadod',
  keepLabel = 'Nálad marad',
  onSubmit,
}: {
  max: number;
  label: string;
  button: string;
  giveLabel?: string;
  keepLabel?: string;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState<number | ''>('');
  const numericAmount = amount === '' ? null : Math.round(amount);
  return (
    <form className="decision-form" onSubmit={(event) => {
      event.preventDefault();
      if (numericAmount === null) return;
      onSubmit(numericAmount);
    }}>
      <label className="field">
        <span>{label}</span>
        <input
          type="number"
          min={0}
          max={max}
          step={100}
          value={amount}
          placeholder="Írd be az összeget"
          required
          onChange={(event) => setAmount(event.target.value === '' ? '' : Number(event.target.value))}
        />
      </label>
      <p className="limit">0 – {formatCredits(max)}</p>
      {numericAmount !== null && (
        <div className="decision-consequence">
          <span>{giveLabel}: <strong>{formatCredits(numericAmount)}</strong></span>
          <span>{keepLabel}: <strong>{formatCredits(Math.max(0, max - numericAmount))}</strong></span>
        </div>
      )}
      <button className="primary big" type="submit" disabled={numericAmount === null}>{button}</button>
    </form>
  );
}

function UltimatumRules({ credit, role }: { credit: number; role: 'proposer' | 'receiver' }) {
  return (
    <div className="game-rules-card">
      {role === 'proposer' ? (
        <>
          <p>
            <strong>Kapsz {formatCredits(credit)} kreditet.</strong> A rendszer összesorsol egy idegennel, aki ugyanazt tudja, mint Te. Ebből az összegből te döntöd el, mennyit ajánlasz fel neki.
          </p>
          <p>
            Ha elfogadja az ajánlatodat, a bank mindkettőtöknek jóváírja az elosztást: ő megkapja a felajánlott összeget, nálad marad a többi. <strong>Ha elutasítja, egyikőtök sem kap semmit.</strong>
          </p>
          <p><strong>Alku nincs.</strong></p>
        </>
      ) : (
        <>
          <p>
            <strong>A másik játékos {formatCredits(credit)} kreditet kapott.</strong> Ebből az összegből ő dönti el, mennyit ajánl fel neked.
          </p>
          <p>
            Ha elfogadod az ajánlatát, a bank mindkettőtöknek jóváírja az elosztást. <strong>Ha elutasítod, egyikőtök sem kap semmit.</strong>
          </p>
          <p><strong>Alku nincs.</strong></p>
        </>
      )}
    </div>
  );
}

function TrustSendDecision({
  max,
  onSubmit,
}: {
  max: number;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState<number | ''>('');
  const numericAmount = amount === '' ? null : Math.round(amount);
  const tripled = numericAmount === null ? null : numericAmount * 3;
  return (
    <form className="decision-form" onSubmit={(event) => {
      event.preventDefault();
      if (numericAmount === null) return;
      onSubmit(numericAmount);
    }}>
      <label className="field">
        <span>Mennyit küldesz a másik játékosnak?</span>
        <input
          type="number"
          min={0}
          max={max}
          step={100}
          value={amount}
          placeholder="Írd be az összeget"
          required
          onChange={(event) => setAmount(event.target.value === '' ? '' : Number(event.target.value))}
        />
      </label>
      {numericAmount !== null && tripled !== null && (
        <div className="decision-consequence">
          <span>Te küldesz: <strong>{formatCredits(numericAmount)}</strong></span>
          <span>Nálad marad: <strong>{formatCredits(Math.max(0, max - numericAmount))}</strong></span>
          <span>A másikhoz kerül: <strong>{formatCredits(tripled)}</strong></span>
        </div>
      )}
      <button className="primary big" type="submit" disabled={numericAmount === null}>Küldés</button>
    </form>
  );
}

function TrustReturnDecision({
  available,
  onSubmit,
}: {
  available: number;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState<number | ''>('');
  const numericAmount = amount === '' ? null : Math.round(amount);
  const kept = numericAmount === null ? null : Math.max(0, available - numericAmount);
  return (
    <form className="decision-form" onSubmit={(event) => {
      event.preventDefault();
      if (numericAmount === null) return;
      onSubmit(numericAmount);
    }}>
      <label className="field">
        <span>Mennyit adsz vissza?</span>
        <input
          type="number"
          min={0}
          max={available}
          step={100}
          value={amount}
          placeholder="Írd be az összeget"
          required
          onChange={(event) => setAmount(event.target.value === '' ? '' : Number(event.target.value))}
        />
      </label>
      {numericAmount !== null && kept !== null && (
        <div className="decision-consequence">
          <span>Visszaadsz: <strong>{formatCredits(numericAmount)}</strong></span>
          <span>Nálad marad: <strong>{formatCredits(kept)}</strong></span>
        </div>
      )}
      <button className="primary big" type="submit" disabled={numericAmount === null}>Visszaadás elküldése</button>
    </form>
  );
}

function StrategicParticipantTask({ session, playerId }: { session: GameSession; playerId: string }) {
  const pairing = gameStore.getPairingForPlayer(session, playerId);
  const decisions = pairing ? decisionsFor(session, pairing) : [];
  const offerDecision = decisions.find((decision) => decision.type === 'ultimatum_offer');
  const responseDecision = decisions.find((decision) => decision.type === 'ultimatum_response');

  useEffect(() => {
    if (!pairing) return;
    gameStore.ackStrategicTaskVisible(session.code, playerId);
  }, [
    session.code,
    session.roundKey,
    playerId,
    pairing?.id,
    decisions.map((decision) => decision.id).join('|'),
  ]);

  if (!pairing) return <p>Nincs párosításod ebben a körben.</p>;

  const isA = pairing.playerA === playerId;
  const closed = session.closedRounds.includes(session.roundKey as StrategicRound);
  const timeout = decisions.find((decision) => decision.type === 'ultimatum_timeout');
  const technicalIssue = session.strategicTechnicalIssues.find(
    (issue) => issue.pairingId === pairing.id && issue.playerId === playerId,
  );
  const partnerTechnicalIssue = session.strategicTechnicalIssues.find(
    (issue) => issue.pairingId === pairing.id && issue.playerId !== playerId,
  );

  const submit = (payload: { type: Decision['type']; amount?: number; accepted?: boolean }) => {
    gameStore.markStrategicSubmitIntent(session.code, playerId);
    return gameStore.submitStrategicDecision(session.code, playerId, payload);
  };

  if (technicalIssue) {
    return (
      <div className="submitted technical-pending">
        <strong>A döntésed elküldése technikai ellenőrzés alatt van.</strong>
        <span>Ez nem számít időtúllépésnek. A tréner látja a hibát, és szükség esetén újranyithatja a döntést.</span>
      </div>
    );
  }

  if (pairing.gameId === 'ultimatum') {
    if (timeout) {
      const ownTimeout = timeout.playerId === playerId;
      return (
        <>
          <UltimatumRules credit={session.startingCredit} role={isA ? 'proposer' : 'receiver'} />
          <div className="submitted timeout-result">
            <strong>{ownTimeout ? 'Lejárt a 60 másodperced.' : 'A másik játékos ideje lejárt.'}</strong>
            <span>Ebből a párosításból egyikőtök sem kap kreditet.</span>
          </div>
        </>
      );
    }

    if (closed) {
      const offer = offerDecision?.amount ?? 0;
      const accepted = responseDecision?.accepted === true;
      const ownCredit = accepted ? (isA ? session.startingCredit - offer : offer) : 0;
      return (
        <>
          <UltimatumRules credit={session.startingCredit} role={isA ? 'proposer' : 'receiver'} />
          <div className={'submitted ' + (accepted ? '' : 'timeout-result')}>
            <Check size={28} />
            <strong>{accepted ? 'Az ajánlatot elfogadták.' : 'Az ajánlatot elutasították.'}</strong>
            <span>{accepted ? `Ebben a körben ${formatCredits(ownCredit)} került a vagyonodhoz.` : 'Ebből a körből egyikőtök sem kapott kreditet.'}</span>
          </div>
        </>
      );
    }

    if (isA) {
      if (!offerDecision) {
        const proposerDeadline = gameStore.ultimatumDeadlineAt(session, pairing.id, playerId);
        return (
          <>
            <UltimatumRules credit={session.startingCredit} role="proposer" />
            <div className="participant-pool-heading">
              <div>
                <h2>Mennyit ajánlasz fel a másik játékosnak?</h2>
                <p>{ULTIMATUM_PROPOSER_SECONDS} másodperced van a döntésre.</p>
              </div>
              <DeadlineTimer deadlineAt={proposerDeadline} />
            </div>
            <AmountDecision
              max={session.startingCredit}
              label="A másik játékosnak felajánlott kredit"
              button="Ajánlat elküldése"
              giveLabel="Felajánlasz"
              keepLabel="Elfogadáskor nálad marad"
              onSubmit={(amount) => submit({ type: 'ultimatum_offer', amount })}
            />
          </>
        );
      }

      const receiverDeadline = gameStore.ultimatumDeadlineAt(session, pairing.id, pairing.playerB);
      return (
        <>
          <UltimatumRules credit={session.startingCredit} role="proposer" />
          <div className="submitted">
            <Check size={28} />
            <strong>Ajánlat elküldve: {formatCredits(offerDecision.amount ?? 0)}</strong>
            <span>
              {partnerTechnicalIssue
                ? 'A másik játékos döntése technikai ellenőrzés alatt van. A tréner látja.'
                : 'Várakozás a másik játékos döntésére.'}
            </span>
            {receiverDeadline && <DeadlineTimer deadlineAt={receiverDeadline} />}
          </div>
        </>
      );
    }

    if (!offerDecision) {
      return (
        <>
          <UltimatumRules credit={session.startingCredit} role="receiver" />
          <div className="waiting-box">
            Várakozás a másik játékos ajánlatára… A te 60 másodperced még nem indult el.
          </div>
        </>
      );
    }

    if (!responseDecision) {
      const receiverDeadline = gameStore.ultimatumDeadlineAt(session, pairing.id, playerId);
      return (
        <>
          <UltimatumRules credit={session.startingCredit} role="receiver" />
          <div className="participant-pool-heading">
            <div>
              <h2>A másik játékos {formatCredits(offerDecision.amount ?? 0)} kreditet ajánlott neked.</h2>
              <p>Elfogadod? {ULTIMATUM_RECEIVER_SECONDS} másodperced van dönteni.</p>
            </div>
            <DeadlineTimer deadlineAt={receiverDeadline} />
          </div>
          <div className="decision-buttons">
            <button className="primary" onClick={() => submit({ type: 'ultimatum_response', accepted: true })}>Elfogadom</button>
            <button className="danger" onClick={() => submit({ type: 'ultimatum_response', accepted: false })}>Elutasítom</button>
          </div>
        </>
      );
    }

    return (
      <>
        <UltimatumRules credit={session.startingCredit} role="receiver" />
        <div className="submitted">
          <Check size={28} />
          <strong>{responseDecision.accepted ? 'Elfogadtad az ajánlatot.' : 'Elutasítottad az ajánlatot.'}</strong>
          <span>Várakozás a kör könyvelésére.</span>
        </div>
      </>
    );
  }

  if (pairing.gameId === 'dictator') {
    const giveDecision = decisions.find((decision) => decision.type === 'dictator_give');
    const given = giveDecision?.amount ?? 0;

    if (!isA) {
      if (closed) {
        return (
          <>
            <div className="game-rules-card">
              <p>
                <strong>A másik játékos {formatCredits(session.startingCredit)} kreditet kapott.</strong> Ő döntötte el, mennyit ad neked.
              </p>
              <p>
                <strong>Neked ebben a körben nem volt döntési lehetőséged:</strong> azt az összeget kaptad, amit ő adott neked.
              </p>
            </div>
            <div className="submitted">
              <Check size={28} />
              <strong>{formatCredits(given)} kreditet kaptál.</strong>
              <span>Ez az összeg bekerült a vagyonodba.</span>
            </div>
          </>
        );
      }

      return (
        <>
          <div className="game-rules-card">
            <p>
              <strong>A másik játékos {formatCredits(session.startingCredit)} kreditet kapott.</strong> A rendszer összesorsolt vele, és ő dönti el, mennyit ad neked.
            </p>
            <p>
              <strong>Neked ebben a körben nincs döntési lehetőséged:</strong> azt az összeget kapod, amit ő ad neked.
            </p>
          </div>
          <div className="waiting-box">
            {giveDecision
              ? (giveDecision.timedOutRole === 'dictator'
                ? 'A másik játékos nem döntött 60 másodpercen belül, ezért 0 kreditet kapsz.'
                : `A másik játékos ${formatCredits(given)} kreditet adott neked. Várakozás a kör könyvelésére…`)
              : 'Várakozás a másik játékos döntésére…'}
          </div>
        </>
      );
    }

    if (!giveDecision) {
      return (
        <>
          <div className="game-rules-card">
            <p>
              <strong>Most is kapsz {formatCredits(session.startingCredit)} kreditet.</strong> A rendszer összesorsol egy idegennel, aki ugyanazt tudja, mint Te. A kapott kreditből eldöntheted, mennyit adsz neki.
            </p>
            <p>
              <strong>A döntés kizárólag a tiéd. A másik félnek nincs döntési lehetősége: azt az összeget kapja, amit te adsz neki.</strong>
            </p>
            <p>
              Amit neki adsz, azt a bank az ő vagyonához írja. Ami nálad marad, azt a te vagyonodhoz írja. <strong>Alku nincs.</strong>
            </p>
          </div>
          <div className="participant-pool-heading">
            <div>
              <h2>Mennyit adsz a másik játékosnak?</h2>
              <p>{STRATEGIC_DECISION_SECONDS} másodperced van. Ha nem döntesz, 0 kreditet adsz.</p>
            </div>
            <DeadlineTimer deadlineAt={gameStore.strategicDeadlineAt(session, pairing.id, playerId)} />
          </div>
          <AmountDecision
            max={session.startingCredit}
            label="A másik játékosnak adott kredit"
            button="Döntés elküldése"
            giveLabel="Odaadod"
            keepLabel="Nálad marad"
            onSubmit={(amount) => submit({ type: 'dictator_give', amount })}
          />
        </>
      );
    }

    return (
      <>
        <div className="game-rules-card">
          <p>
            <strong>Most is kapsz {formatCredits(session.startingCredit)} kreditet.</strong> Te döntöttél az elosztásról.
          </p>
        </div>
        <div className="submitted">
          <Check size={28} />
          <strong>{giveDecision?.timedOutRole === 'dictator' ? 'Lejárt a 60 másodperc. 0 kreditet adtál.' : `${formatCredits(given)} kreditet adtál a másik játékosnak.`}</strong>
          <span>Nálad {formatCredits(session.startingCredit - given)} kredit marad ebből a körből.</span>
          <span>{closed ? 'A kör könyvelve.' : 'Várakozás a kör könyvelésére.'}</span>
        </div>
      </>
    );
  }

  const sentDecision = decisions.find((decision) => decision.type === 'trust_send');
  const returnedDecision = decisions.find((decision) => decision.type === 'trust_return');

  if (isA) {
    if (!sentDecision) {
      return (
        <>
          <div className="game-rules-card">
            <p>
              <strong>Kapsz {formatCredits(session.startingCredit)} kreditet.</strong> A rendszer összesorsol egy idegennel, aki ugyanazt tudja, mint Te.
            </p>
            <p>
              Eldöntheted, hogy a kapott kreditből mennyit küldesz neki. <strong>A bank az elküldött összeget megháromszorozza</strong>, és ezt kapja meg a másik játékos.
            </p>
            <p>
              Ezután ő dönt arról, hogy a hozzá került összegből mennyit ad vissza neked. Akár semmit is visszaadhat.
            </p>
            <p>
              Ami nálad maradt, az a tiéd. Ehhez hozzáadódik az az összeg, amit a másik játékos visszaad.
            </p>
          </div>
          <div className="participant-pool-heading">
            <div>
              <h2>Mennyit küldesz a másik játékosnak?</h2>
              <p>{STRATEGIC_DECISION_SECONDS} másodperced van. Ha nem döntesz, 0 kreditet küldesz.</p>
            </div>
            <DeadlineTimer deadlineAt={gameStore.strategicDeadlineAt(session, pairing.id, playerId)} />
          </div>
          <TrustSendDecision
            max={session.startingCredit}
            onSubmit={(amount) => submit({ type: 'trust_send', amount })}
          />
        </>
      );
    }

    const sent = sentDecision.amount ?? 0;
    const tripled = sent * 3;

    if (!returnedDecision) {
      return (
        <div className="submitted">
          <Check size={28} />
          <strong>{sentDecision.timedOutRole === 'sender' ? 'Lejárt a 60 másodperc. Nem küldtél kreditet.' : `Elküldtél ${formatCredits(sent)} kreditet.`}</strong>
          <span>A bank {formatCredits(tripled)} kreditet adott a másik játékosnak.</span>
          <span>Várakozás arra, hogy eldöntse, mennyit ad vissza.</span>
        </div>
      );
    }

    const returned = returnedDecision.amount ?? 0;
    const keptFromStart = session.startingCredit - sent;
    const totalGain = keptFromStart + returned;

    return (
      <div className="submitted">
        <Check size={28} />
        <strong>A másik játékos {formatCredits(returned)} kreditet adott vissza.</strong>
        <span>Az induló összegből nálad maradt {formatCredits(keptFromStart)}, és {formatCredits(returned)} kreditet kaptál vissza.</span>
        <span><strong>Ebben a körben {formatCredits(totalGain)} kerül a vagyonodhoz.</strong></span>
        <span>{closed ? 'A kör könyvelve.' : 'Várakozás a kör könyvelésére.'}</span>
      </div>
    );
  }

  if (!sentDecision) {
    return (
      <>
        <div className="game-rules-card">
          <p>
            <strong>A másik játékos most arról dönt, mennyit küld neked.</strong> A bank az általa elküldött összeget megháromszorozza. Ezután te döntöd el, mennyit adsz vissza neki.
          </p>
        </div>
        <div className="waiting-box">Várakozás a másik játékos döntésére…</div>
      </>
    );
  }

  const sent = sentDecision.amount ?? 0;
  const tripled = sent * 3;

  if (!returnedDecision) {
    return (
      <>
        <div className="game-rules-card">
          <p>
            <strong>A másik játékos {formatCredits(sent)} kreditet küldött neked.</strong> A bank ezt megháromszorozta, ezért <strong>{formatCredits(tripled)} kredit került hozzád.</strong>
          </p>
          <p>Most te döntesz. Ebből az összegből mennyit adsz vissza a másik játékosnak?</p>
          <p>Amit visszaadsz, azt ő kapja meg. Ami megmarad, az a te vagyonodhoz kerül.</p>
        </div>
        <div className="participant-pool-heading">
          <div>
            <h2>Mennyit adsz vissza?</h2>
            <p>{STRATEGIC_DECISION_SECONDS} másodperced van. Ha nem döntesz, 0 kreditet adsz vissza.</p>
          </div>
          <DeadlineTimer deadlineAt={gameStore.strategicDeadlineAt(session, pairing.id, playerId)} />
        </div>
        <TrustReturnDecision
          available={tripled}
          onSubmit={(amount) => submit({ type: 'trust_return', amount })}
        />
      </>
    );
  }

  const returned = returnedDecision.amount ?? 0;
  return (
    <div className="submitted">
      <Check size={28} />
      <strong>{formatCredits(tripled)} kredit került hozzád.</strong>
      <span>{returnedDecision.timedOutRole === 'returner' ? 'Lejárt a 60 másodperc, ezért 0 kreditet adtál vissza.' : `${formatCredits(returned)} kreditet visszaadtál.`}</span>
      <span><strong>{formatCredits(tripled - returned)} kredit marad nálad.</strong></span>
      <span>{closed ? 'A kör könyvelve.' : 'Várakozás a kör könyvelésére.'}</span>
    </div>
  );
}

function PublicGoodsParticipantTask({ session, playerId }: { session: GameSession; playerId: string }) {
  const player = session.players.find((item) => item.id === playerId);
  const currentGroup = session.groups.find((group) => group.memberIds.includes(playerId));
  const [now, setNow] = useState(Date.now());
  const currentRound = session.publicGoodsRounds.find(
    (item) => item.roundNumber === session.publicGoodsRoundNumber && item.memberIds.includes(playerId),
  );
  const existingAmount = currentRound?.contributions[playerId];
  const [amount, setAmount] = useState<number | ''>(existingAmount ?? '');

  useEffect(() => {
    setAmount(currentRound?.contributions[playerId] ?? '');
  }, [currentRound?.contributions[playerId], session.publicGoodsRoundNumber]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 300);
    return () => window.clearInterval(id);
  }, []);

  if (!player) return null;

  if (session.publicGoodsPhase === 'setup') {
    if (session.publicGoodsRoundNumber === 0 || !currentRound || currentRound.status !== 'settled') {
      return (
        <>
          {currentGroup && (
            <div className="participant-group-card">
              <span>A csoportod</span>
              <strong>{currentGroup.name}</strong>
              <p>Keresd meg azokat, akik ugyanezt a csoportnevet kapták.</p>
              <small>{currentGroup.memberIds.length} fős csoport</small>
            </div>
          )}
          <div className="game-rules-card">
            <p>
              <strong>{session.publicGoodsContinuation ? 'A tanulókör következik.' : 'Az első három játék véget ért.'}</strong> Jelenlegi vagyonod: {formatCredits(player.currentBalance)}.
            </p>
            <p>
              Mostantól ebben a csoportban játszol. A saját vagyonodból döntheted el, mennyit teszel a közös kasszába.
            </p>
            <p>
              A csoport által befizetett teljes összeget a <strong>bank megduplázza</strong>, majd egyenlő részben osztja vissza a csoport tagjai között. Nem számít, ki mennyit fizetett be: mindenki ugyanakkora összeget kap vissza.
            </p>
          </div>
          <div className="waiting-box">Ha megtaláltátok egymást, várjatok a tréner következő körére.</div>
        </>
      );
    }

    const contribution = currentRound.contributions[playerId] ?? 0;
    const payout = currentRound.payoutPerPlayer ?? 0;
    const personalResult = payout - contribution;

    if (currentRound.success) {
      return (
        <>
          <div className="game-rules-card">
            <p><strong>A kör lezárult.</strong></p>
            <p>
              A csoport összesen <strong>{formatCredits(currentRound.totalContribution)}</strong> kreditet tett a közös kasszába.
              A bank ezt megduplázta: <strong>{formatCredits(currentRound.totalContribution * 2)}</strong>.
            </p>
            <p>
              Minden csoporttag <strong>{formatCredits(payout)}</strong> kreditet kapott vissza.
            </p>
          </div>
          <div className="submitted">
            <Check size={28} />
            <strong>Te befizettél: {formatCredits(contribution)}</strong>
            <span>Visszakaptál: {formatCredits(payout)}</span>
            <span>A kör eredménye számodra: {personalResult >= 0 ? '+' : ''}{formatCredits(personalResult)}</span>
            <span><strong>Új vagyonod: {formatCredits(player.currentBalance)}</strong></span>
          </div>
          <div className="waiting-box">Várakozás a következő körre…</div>
        </>
      );
    }

    return (
      <>
        <div className="game-rules-card">
          <p><strong>A kör lezárult.</strong></p>
          <p>
            A közös kassza nem érte el a körhöz szükséges minimumot.
          </p>
          <p>
            A bank ebben a körben <strong>nem fizet vissza</strong>.
          </p>
        </div>
        <div className="submitted timeout-result">
          <strong>Te befizettél: {formatCredits(contribution)}</strong>
          <span>Visszakaptál: 0 kredit</span>
          <span>A befizetett összeget elvesztetted.</span>
          <span><strong>Új vagyonod: {formatCredits(player.currentBalance)}</strong></span>
        </div>
        <div className="waiting-box">Várakozás a következő körre…</div>
      </>
    );
  }

  if (!currentRound) return <div className="waiting-box">A csoportod nem található.</div>;

  const minimumVisible = currentRound.minimumMode !== 'none' && currentRound.minimumAmount !== undefined;

  if (session.publicGoodsPhase === 'locked') {
    return (
      <>
        {currentGroup && <div className="participant-group-mini">Csoport: <strong>{currentGroup.name}</strong></div>}
        {minimumVisible && (
          <div className="minimum-visible">
            Minimum kassza ebben a körben: <strong>{formatCredits(currentRound.minimumAmount ?? 0)}</strong>
          </div>
        )}
        <div className="submitted">
          <Check size={28} />
          <strong>Tét lezárva: {formatCredits(existingAmount ?? 0)}</strong>
          <span>Várakozás a banki elszámolásra.</span>
        </div>
      </>
    );
  }

  const deadline = session.publicGoodsDeadlineAt ? new Date(session.publicGoodsDeadlineAt).getTime() : 0;
  const canEdit = session.publicGoodsPhase === 'open' && now < deadline;

  return (
    <>
      {currentGroup && <div className="participant-group-mini">Csoport: <strong>{currentGroup.name}</strong></div>}
      <div className="game-rules-card">
        <p>
          <strong>Közös kassza · {session.publicGoodsRoundNumber}. kör</strong>
        </p>
        <p>Jelenlegi vagyonod: <strong>{formatCredits(player.currentBalance)}</strong>.</p>
        {minimumVisible ? (
          <p>
            A kör minimum kasszája: <strong>{formatCredits(currentRound.minimumAmount ?? 0)}</strong>.
          </p>
        ) : (
          <p>Ebben a körben nincs minimum kassza.</p>
        )}
        <p>
          A csoport teljes befizetését a bank megduplázza, majd egyenlő részben osztja vissza a csoport tagjai között.
        </p>
      </div>

      <div className="participant-pool-heading">
        <div>
          <h2>Mennyit teszel a közös kasszába?</h2>
          <p>A 90 másodperc alatt többször is módosíthatod a tétedet. Mindig az utolsó mentett összeg számít.</p>
        </div>
        <DeadlineTimer deadlineAt={session.publicGoodsDeadlineAt} />
      </div>

      <form className="decision-form" onSubmit={(event) => {
        event.preventDefault();
        if (canEdit && amount !== '') gameStore.submitPublicGoods(session.code, playerId, Math.round(amount));
      }}>
        <label className="field">
          <span>Befizetés</span>
          <input
            type="number"
            min={0}
            max={player.currentBalance}
            step={100}
            disabled={!canEdit}
            value={amount}
            placeholder="Írd be az összeget"
            onChange={(event) => setAmount(event.target.value === '' ? '' : Number(event.target.value))}
          />
        </label>
        {amount !== '' && (
          <div className="decision-consequence">
            <span>Beteszel: <strong>{formatCredits(amount)}</strong></span>
            <span>Nálad marad: <strong>{formatCredits(Math.max(0, player.currentBalance - amount))}</strong></span>
          </div>
        )}
        <button className="primary big" disabled={!canEdit || amount === ''} type="submit">
          {currentRound.contributions[playerId] !== undefined ? 'Tét módosítása' : 'Tét mentése'}
        </button>
      </form>

      {currentRound.contributions[playerId] !== undefined && (
        <div className="stake-saved">Mentett tét: <strong>{formatCredits(existingAmount ?? 0)}</strong></div>
      )}
      {!canEdit && <div className="waiting-box">A döntési idő lejárt. A tréner zárja a téteket.</div>}
    </>
  );
}

function ParticipantLedger({ session, playerId }: { session: GameSession; playerId: string }) {
  const rows = session.transactions.filter((transaction) => transaction.playerId === playerId);
  if (rows.length === 0) return null;

  return (
    <details className="participant-ledger">
      <summary>Saját kreditnapló · {rows.length} tétel</summary>
      <div className="ledger-list">
        {rows.map((transaction) => (
          <div className="ledger-row" key={transaction.id}>
            <span>{ROUND_LABELS[transaction.roundKey]}</span>
            <strong className={transaction.amount >= 0 ? 'good' : 'bad'}>
              {transaction.amount >= 0 ? '+' : ''}{formatCredits(transaction.amount)}
            </strong>
            <small>{formatCredits(transaction.balanceAfter)}</small>
          </div>
        ))}
      </div>
    </details>
  );
}

function ParticipantStageRail({ session }: { session: GameSession }) {
  const stageIndex =
    session.roundKey === 'lobby' ? 0 :
    session.roundKey === '1a' || session.roundKey === '1b' ? 1 :
    session.roundKey === '2a' || session.roundKey === '2b' ? 2 :
    session.roundKey === '3a' || session.roundKey === '3b' ? 3 :
    session.roundKey === '4' ? 4 : 5;

  const stages = ['Belépés', 'Ultimátum', 'Diktátor', 'Bizalom', 'Kassza', 'Reflexió'];
  return (
    <div className="participant-stage-rail">
      {stages.map((label, index) => (
        <div key={label} className={'participant-stage ' + (index === stageIndex ? 'active' : index < stageIndex ? 'done' : '')}>
          <i>{index < stageIndex ? '✓' : index + 1}</i>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function participantRole(session: GameSession, playerId: string) {
  if (session.roundKey === 'lobby') return 'Várakozás a kezdésre';
  if (session.roundKey === 'report') {
    const done = (session.reflections ?? []).some((item) => item.playerId === playerId);
    return done ? 'Saját riport' : 'Saját reflexió';
  }
  if (session.roundKey === '4') {
    const group = session.groups.find((item) => item.memberIds.includes(playerId));
    return group ? `Közös kassza · ${group.name}` : 'Közös kassza';
  }

  const pairing = gameStore.getPairingForPlayer(session, playerId);
  if (!pairing) return 'Aktuális kör';
  const isA = pairing.playerA === playerId;
  if (pairing.gameId === 'ultimatum') return isA ? 'Szereped: felajánló' : 'Szereped: fogadó';
  if (pairing.gameId === 'dictator') return isA ? 'Szereped: te döntesz' : 'Szereped: fogadó';
  return isA ? 'Szereped: küldő' : 'Szereped: visszaadó';
}


function ParticipantReflectionCard({
  item,
  selected,
  comment,
  disabled,
  onToggle,
  onComment,
}: {
  item: ParticipantSelfReportItem;
  selected: boolean;
  comment: string;
  disabled: boolean;
  onToggle: () => void;
  onComment: (value: string) => void;
}) {
  return (
    <article className={'participant-reflection-card ' + (selected ? 'selected' : '') + (disabled ? ' disabled' : '')}>
      <button type="button" className="participant-reflection-select" onClick={onToggle} disabled={disabled && !selected}>
        <span className="reflection-check">{selected ? '✓' : ''}</span>
        <SelfReportMiniCard item={item} />
      </button>
      {selected && (
        <label className="participant-reflection-comment">
          <span>Mi célból döntöttél így?</span>
          <textarea
            maxLength={300}
            rows={3}
            value={comment}
            onChange={(event) => onComment(event.target.value)}
            placeholder="Röviden írd le, mi volt a célod ezzel a döntéssel."
          />
          <small>{comment.length}/300</small>
        </label>
      )}
    </article>
  );
}

function ParticipantReflectionPanel({
  session,
  playerId,
}: {
  session: GameSession;
  playerId: string;
}) {
  const ownReflections = (session.reflections ?? []).filter((item) => item.playerId === playerId);
  const report = session.selfReport?.length ? session.selfReport : buildSelfReport(session, playerId);
  const [selected, setSelected] = useState<string[]>(() => ownReflections.map((item) => item.decisionId));
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(ownReflections.map((item) => [item.decisionId, item.comment])),
  );
  const [submitError, setSubmitError] = useState('');
  const [sending, setSending] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const submitted = ownReflections.length > 0;
  const playerName = session.players.find((player) => player.id === playerId)?.name ?? '';
  const currentPlayer = session.players.find((player) => player.id === playerId);
  const firstStage = session.firstStageFinalBalance[playerId] ?? currentPlayer?.currentBalance ?? 0;
  const finalWealth = currentPlayer?.currentBalance ?? firstStage;
  const continuation = session.publicGoodsContinuation;
  const firstPoolFinalWealth = continuation?.baselineFinalBalance[playerId];
  const learningStartWealth = continuation?.restartBalance[playerId];
  const publicGoodsResult = (firstPoolFinalWealth ?? finalWealth) - firstStage;
  const learningResult =
    learningStartWealth === undefined ? undefined : finalWealth - learningStartWealth;

  useEffect(() => {
    if (!sending || submitted) return;
    const timeout = window.setTimeout(() => setSending(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [sending, submitted]);

  if (report.length === 0) {
    return (
      <div className="participant-own-report">
        <p className="eyebrow">Játék vége</p>
        <h1>Nincs lezárt saját döntésed.</h1>
        <p>A játék ebben az állapotban úgy ért véget, hogy még nem készült saját döntési történeted.</p>
      </div>
    );
  }

  const reportShareText = () => buildSelfReportShareText(
    playerName,
    report,
    ownReflections,
    {
      firstStage,
      publicGoodsResult,
      finalWealth,
      firstPoolFinalWealth,
      learningStartWealth,
      learningResult,
    },
  );

  const printReport = () => {
    setExportStatus('');
    const root = document.documentElement;
    const previousTitle = document.title;
    root.setAttribute('data-print-self-report', 'true');
    document.title = 'Kreditjáték – saját riport' + (playerName ? ' – ' + playerName : '');

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      root.removeAttribute('data-print-self-report');
      document.title = previousTitle;
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 60_000);
  };

  const shareReport = async () => {
    setExportStatus('');
    const text = reportShareText();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Kreditjáték – saját riport',
          text,
        });
        setExportStatus('A megosztás elkészült.');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setExportStatus('A riport a vágólapra került. Innen bármelyik alkalmazásba beillesztheted.');
        return;
      }

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'kreditjatek-sajat-riport.txt';
      link.click();
      URL.revokeObjectURL(url);
      setExportStatus('A riport szöveges fájlként elmentve.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setExportStatus('A megosztás nem sikerült. Próbáld meg újra.');
    }
  };

  if (submitted) {
    return (
      <div className="participant-own-report">
        <p className="eyebrow">Saját riportom</p>
        <h1>A reflexiód elkészült.</h1>
        <p>A saját döntéseidet és a kiemelt gondolataidat később is visszanézheted ezen a képernyőn.</p>
        <div className="participant-own-report-grid">
          {report.map((item) => {
            const reflection = ownReflections.find((entry) => entry.decisionId === item.id);
            return (
              <div className={'participant-own-report-item ' + (reflection ? 'highlighted' : '')} key={item.id}>
                <SelfReportMiniCard item={item} />
                {reflection && (
                  <div className="own-reflection-text">
                    <strong>Mi célból döntöttél így?</strong>
                    <span>„{reflection.comment}”</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="self-report-export-actions">
          <button type="button" className="secondary" onClick={printReport}>PDF mentése</button>
          <button type="button" className="primary" onClick={() => void shareReport()}>Megosztás</button>
        </div>
        <p className="self-report-export-help">PDF mentésnél a megnyíló rendszerablakban válaszd a PDF-ként mentést.</p>
        {exportStatus && <div className="self-report-export-status">{exportStatus}</div>}
      </div>
    );
  }

  const toggle = (id: string) => {
    setSubmitError('');
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  };

  const submit = () => {
    setSubmitError('');
    if (selected.length < 1 || selected.length > 3) {
      setSubmitError('Válassz legalább 1, legfeljebb 3 döntést.');
      return;
    }
    const items = selected.map((decisionId) => ({
      decisionId,
      comment: (comments[decisionId] ?? '').trim(),
    }));
    if (items.some((item) => !item.comment)) {
      setSubmitError('Minden kiválasztott döntéshez válaszolj arra, hogy mi célból döntöttél így.');
      return;
    }
    setSending(true);
    gameStore.submitReflection(session.code, playerId, items);
  };

  return (
    <div className="participant-reflection">
      <p className="eyebrow">Játék vége · saját reflexió</p>
      <h1>Melyik döntésed volt számodra a legérdekesebb?</h1>
      <p>Válassz legalább 1, legfeljebb 3 döntést. A kiválasztott döntéseknél írd le röviden, mi célból döntöttél így.</p>
      <div className="reflection-selection-status">
        <strong>{selected.length}/3 kiválasztva</strong>
        <span>{selected.length === 3 ? 'Elérted a maximumot.' : 'Még választhatsz.'}</span>
      </div>
      <div className="participant-reflection-grid">
        {report.map((item) => (
          <ParticipantReflectionCard
            key={item.id}
            item={item}
            selected={selected.includes(item.id)}
            comment={comments[item.id] ?? ''}
            disabled={selected.length >= 3}
            onToggle={() => toggle(item.id)}
            onComment={(value) => setComments((current) => ({ ...current, [item.id]: value }))}
          />
        ))}
      </div>
      {submitError && <div className="error">{submitError}</div>}
      <button
        className="primary big participant-reflection-submit"
        type="button"
        onClick={submit}
        disabled={sending}
      >
        {sending ? 'Reflexió mentése…' : 'Reflexió elküldése'}
      </button>
      {sending && <p className="reflection-saving-note">A mentés után automatikusan megjelenik a saját riportod.</p>}
    </div>
  );
}

function ParticipantClient({ code: initial }: { code?: string }) {
  const initialPlayerId = useMemo(() => sessionPlayerId(), []);
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const initialSession = initial ? gameStore.get(initial) : null;
  const existing = initialSession?.players.find((player) => player.id === initialPlayerId);
  const [code, setCode] = useState(initial || '');
  const [name, setName] = useState(existing?.name ?? '');
  const [joined, setJoined] = useState(false);
  const [session, setSession] = useState<GameSession | null>(initialSession);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!joined || !code) return;
    const unsubscribe = gameStore.subscribe(code, setSession);
    const touch = () => gameStore.touchPlayer(code, playerId);
    touch();
    const heartbeat = window.setInterval(touch, 15_000);
    const timeoutWatcher = window.setInterval(() => {
      const current = gameStore.get(code);
      if (current && STRATEGIC_ROUNDS.includes(current.roundKey as StrategicRound)) {
        gameStore.reconcileStrategicTimeouts(code);
      }
    }, 500);
    return () => {
      unsubscribe();
      window.clearInterval(heartbeat);
      window.clearInterval(timeoutWatcher);
    };
  }, [joined, code, playerId]);

  const submitJoin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setJoining(true);
    try {
      const cleanCode = code.trim().toUpperCase();
      const cleanName = name.trim();
      if (cleanCode.length !== 6) throw new Error('A játékkód 6 karakteres.');
      if (!cleanName) throw new Error('Írd be a neved.');
      await gameStore.ready();
      const resolvedPlayerId = gameStore.resolvePlayerId(playerId);
      setPlayerId(resolvedPlayerId);

      try {
        await gameStore.prepareJoin(cleanCode);
      } catch (prepareError) {
        const message = prepareError instanceof Error ? prepareError.message : '';
        if (!message.includes('már elindult')) throw prepareError;

        try {
          const resumed = await gameStore.resumePlayer(cleanCode, resolvedPlayerId);
          if (resumed) {
            setCode(cleanCode);
            setName(resumed.name);
            setSession(resumed.session);
            setJoined(true);
            const url = new URL(window.location.href);
            url.searchParams.set('role', 'player');
            url.searchParams.set('code', cleanCode);
            history.replaceState(null, '', url);
            return;
          }
        } catch {
          // Aktív játékhoz új résztvevő nem csatlakozhat.
        }
        throw prepareError;
      }

      const result = gameStore.join(cleanCode, resolvedPlayerId, cleanName);
      await gameStore.afterJoin(cleanCode, resolvedPlayerId);
      setCode(cleanCode);
      setSession(result);
      setJoined(true);
      const url = new URL(window.location.href);
      url.searchParams.set('role', 'player');
      url.searchParams.set('code', cleanCode);
      history.replaceState(null, '', url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nem sikerült csatlakozni.');
    } finally {
      setJoining(false);
    }
  };

  if (!joined && joining) {
    return (
      <main className="shell narrow participant-join-shell">
        <header className="brand participant-brand">
          <p className="eyebrow">Kreditjáték · csatlakozás</p>
          <h1>Belépés folyamatban…</h1>
          <p>A rendszer rögzíti a csatlakozásodat.</p>
        </header>
        <section className="panel participant-waiting-hero join-waiting-state">
          <div className="waiting-pulse" />
          <h2>Várj egy pillanatot.</h2>
          <p>Amint a belépésed rögzült, itt fogod látni, hogy várnod kell a többiekre.</p>
        </section>
      </main>
    );
  }

  if (!joined) {
    return (
      <main className="shell narrow participant-join-shell">
        <header className="brand participant-brand">
          <p className="eyebrow">Kreditjáték · résztvevő</p>
          <h1>Csatlakozás</h1>
          <p>A tréner által megadott kóddal lépj be. Ezután ezen a telefonon kapod a döntéseidet.</p>
        </header>
        <form className="panel join-panel" onSubmit={submitJoin}>
          <label className="field"><span>Játékkód</span><input className="join-code-input" value={code} maxLength={6} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} /></label>
          <label className="field"><span>Neved</span><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
          {error && <div className="error">{error}</div>}
          <button className="primary big" type="submit">Belépek a játékba</button>
        </form>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="shell narrow participant-join-shell">
        <header className="brand participant-brand">
          <p className="eyebrow">Kreditjáték · résztvevő</p>
          <h1>Csatlakoztál.</h1>
          <p>A játékállapot betöltése folyamatban van.</p>
        </header>
        <section className="panel participant-waiting-hero join-waiting-state">
          <div className="waiting-pulse" />
          <h2>Várj a többiekre.</h2>
          <p>A játék automatikusan megjelenik itt, amikor a tréner elindítja.</p>
        </section>
      </main>
    );
  }
  const currentPlayer = session.players.find((player) => player.id === playerId);

  return (
    <main className="shell participant-shell participant-v2">
      <FirebaseSyncBanner />
      <header className="participant-head">
        <span>Játék <strong>{code}</strong></span>
        <span className="participant-name">{name}</span>
      </header>

      <ParticipantStageRail session={session} />

      <div className="participant-context-bar">
        <div>
          <span className="context-round">{session.roundKey === 'report' ? 'Reflexió' : ROUND_LABELS[session.roundKey]}</span>
          <strong>{participantRole(session, playerId)}</strong>
        </div>
        {currentPlayer && (
          <div className="context-balance">
            <span>Saját vagyon</span>
            <strong>{formatCredits(currentPlayer.currentBalance)}</strong>
          </div>
        )}
      </div>

      <section className="task-card participant-task-card">
        {currentPlayer?.botControlled && session.status === 'active' ? (
          <div className="participant-waiting-hero bot-controlled-participant">
            <p className="eyebrow">BOT átvette az irányítást</p>
            <h1>A játék folytatódik helyetted.</h1>
            <p>Ha visszatértél, jelezd a trénernek. Ő tudja visszaadni neked az irányítást a következő még el nem döntött helyzetekre.</p>
          </div>
        ) : (
          <>
        {session.roundKey === 'lobby' && (
          <div className="participant-waiting-hero">
            <div className="waiting-pulse" />
            <p className="eyebrow">Sikeresen csatlakoztál</p>
            <h1>Várd meg a többieket.</h1>
            <p>Maradj ezen a képernyőn. Amikor mindenki belépett, a tréner elindítja a játékot, és itt automatikusan megjelenik az első feladat.</p>
          </div>
        )}

        {STRATEGIC_ROUNDS.includes(session.roundKey as StrategicRound) && (
          <StrategicParticipantTask key={session.roundKey} session={session} playerId={playerId} />
        )}

        {session.roundKey === '4' && (
          <PublicGoodsParticipantTask
            key={'4-' + session.publicGoodsRoundNumber + '-' + session.publicGoodsPhase}
            session={session}
            playerId={playerId}
          />
        )}

        {session.roundKey === 'report' && currentPlayer && (() => {
          const firstStage = session.firstStageFinalBalance[playerId] ?? currentPlayer.currentBalance;
          const continuation = session.publicGoodsContinuation;
          const firstPoolFinal = continuation?.baselineFinalBalance[playerId];
          const learningStart = continuation?.restartBalance[playerId];
          const firstPoolResult = (firstPoolFinal ?? currentPlayer.currentBalance) - firstStage;
          const learningResult = learningStart === undefined ? undefined : currentPlayer.currentBalance - learningStart;

          return (
            <div className="game-finish">
              <div className="final-summary reflection-final-summary">
                <div><span>Az első három játék után</span><strong>{formatCredits(firstStage)}</strong></div>
                <div>
                  <span>{continuation ? 'Első Közös kassza eredménye' : 'Közös kassza eredménye'}</span>
                  <strong className={firstPoolResult >= 0 ? 'good' : 'bad'}>{firstPoolResult >= 0 ? '+' : ''}{formatCredits(firstPoolResult)}</strong>
                </div>
                {continuation && firstPoolFinal !== undefined && (
                  <div><span>Első lezárás végső vagyona</span><strong>{formatCredits(firstPoolFinal)}</strong></div>
                )}
                {continuation && learningStart !== undefined && (
                  <div><span>Tanulókör induló vagyona</span><strong>{formatCredits(learningStart)}</strong></div>
                )}
                {continuation && learningResult !== undefined && (
                  <div>
                    <span>Tanulókör eredménye</span>
                    <strong className={learningResult >= 0 ? 'good' : 'bad'}>{learningResult >= 0 ? '+' : ''}{formatCredits(learningResult)}</strong>
                  </div>
                )}
                <div className="final-total"><span>{continuation ? 'Új végső vagyon' : 'Végső vagyon'}</span><strong>{formatCredits(currentPlayer.currentBalance)}</strong></div>
              </div>
              <ParticipantReflectionPanel session={session} playerId={playerId} />
            </div>
          );
        })()}
          </>
        )}
      </section>

      {currentPlayer && <ParticipantLedger session={session} playerId={playerId} />}
    </main>
  );
}

function App() {
  const demoCode = useMemo(() => demoRequested ? ensureTrainerDemo() : '', []);
  const [screen, setScreen] = useState<'landing' | 'trainer-start' | 'trainer' | 'player'>(() => {
    if (demoRequested) return 'trainer';
    if (initialRole === 'trainer' && initialCode) return 'trainer';
    if (initialRole === 'trainer') return 'trainer-start';
    if (initialRole === 'player') return 'player';
    return 'landing';
  });
  const [trainerCode, setTrainerCode] = useState(demoCode || initialCode);

  const openTrainerStart = () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('role', 'trainer');
    if (testModeRequested) url.searchParams.set('test', '1');
    history.replaceState(null, '', url);
    setTrainerCode('');
    setScreen('trainer-start');
  };

  const openPlayer = () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('role', 'player');
    history.replaceState(null, '', url);
    setScreen('player');
  };

  const created = (session: GameSession) => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('role', 'trainer');
    url.searchParams.set('code', session.code);
    if (testModeRequested) url.searchParams.set('test', '1');
    history.replaceState(null, '', url);
    setTrainerCode(session.code);
    setScreen('trainer');
  };

  if (screen === 'trainer-start') {
    return <TrainerStart onCreated={created} testMode={testModeRequested} />;
  }
  if (screen === 'trainer' && trainerCode) return <TrainerDashboard code={trainerCode} testMode={testModeRequested} />;
  if (screen === 'player') return <ParticipantClient code={initialCode || undefined} />;
  return <Landing onTrainer={openTrainerStart} onPlayer={openPlayer} />;
}

createRoot(document.getElementById('root')!).render(<App />);

import { buildSelfReportShareText } from './selfReportExport';