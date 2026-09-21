import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  BarChart3,
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
  ROUND_LABELS,
  StrategicRound,
  STRATEGIC_DECISION_SECONDS,
  ULTIMATUM_PROPOSER_SECONDS,
  ULTIMATUM_RECEIVER_SECONDS,
} from './gameTypes';
import { STRATEGIC_ROUNDS } from './pairingEngine';
import { gameStore } from './store';
import { canFinishGame } from './sessionStore';
import { downloadCsv, reportSummary } from './report';

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
    const progress = gameStore.roundProgress(session);
    ready = progress.ready;
    total = progress.total;
    label = 'pár kész';
  } else if (session.roundKey === '4' && session.publicGoodsPhase === 'open') {
    const progress = gameStore.publicGoodsProgress(session);
    ready = progress.ready;
    total = progress.total;
    label = 'tét bent';
  } else if (session.roundKey === '4' && session.publicGoodsPhase === 'locked') {
    ready = session.players.length;
    total = session.players.length;
    label = 'tét lezárva';
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
      <div className={'pulse-card issue-card ' + (technical + currentTimeouts > 0 ? 'danger-card' : 'neutral-card')}>
        <span>Hibák</span>
        <strong>{technical + currentTimeouts}</strong>
        <small>
          {technical + currentTimeouts > 0
            ? [
                technical > 0 ? `${technical} technikai hiba` : '',
                currentTimeouts > 0 ? `${currentTimeouts} időtúllépés` : '',
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
                <span>↔</span>
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
    <section className="panel player-table-panel dashboard-section">
      <div className="section-title player-table-title">
        <div>
          <p className="eyebrow">Élő helyzetkép</p>
          <h2>Résztvevők és döntések</h2>
        </div>
        <div className="status-legend">
          <span className="legend-chip success-chip">kész / sikeres</span>
          <span className="legend-chip wait-chip">várakozik</span>
          <span className="legend-chip fail-chip">sikertelen / időtúllépés</span>
          <span className="legend-chip technical-chip">technikai hiba</span>
        </div>
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
              const rowClass = tech ? 'row-technical' : timeout ? 'row-failed' : !online ? 'row-offline' : '';
              return (
                <tr key={player.id} className={rowClass}>
                  <td className="sticky-player player-ident">
                    <span className={'presence-dot ' + (online ? 'online' : 'offline')} />
                    <span className="row-number">{index + 1}</span>
                    <div>
                      <strong>{player.name}</strong>
                      <div className="player-sub">
                        <PlayerRoundState session={session} playerId={player.id} />
                        <span>{online ? 'online' : 'offline'}</span>
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
    </section>
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

function TrainerCockpit({ session, joinUrl }: { session: GameSession; joinUrl: string }) {
  const [projectorOpen, setProjectorOpen] = useState(false);

  useEffect(() => {
    if (!projectorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProjectorOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [projectorOpen]);
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
    primaryLabel = session.publicGoodsRoundNumber === 0 ? 'Első kasszakör indítása' : 'Új kasszakör indítása';
    primaryAction = () => gameStore.startPublicGoodsRound(session.code);
    primaryIcon = <Play size={20} />;
    actionHint = 'Ellenőrizd a csoportokat és az adott kör minimumait indulás előtt.';
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
            <button className="toolbar-button projector-trigger" onClick={() => setProjectorOpen(true)} title="QR-kód kivetítése"><QrCode size={16} />QR</button>
            <button className="compact-primary-action" disabled={primaryDisabled} onClick={primaryAction}>
              {primaryIcon}{primaryLabel}
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

      {projectorOpen && createPortal(
        <div
          className="projector-qr-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Kivetítő QR-kód"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProjectorOpen(false);
          }}
        >
          <div className="projector-qr-card">
            <button
              className="projector-close"
              type="button"
              aria-label="Kivetítő nézet bezárása"
              onClick={() => setProjectorOpen(false)}
            >
              ×
            </button>

            <div className="projector-copy">
              <p className="projector-eyebrow">Kreditjáték</p>
              <h1>
                {session.roundKey === 'lobby'
                  ? 'Csatlakozz a játékhoz'
                  : 'Visszacsatlakozás a játékhoz'}
              </h1>
              <p>
                {session.roundKey === 'lobby'
                  ? 'Olvasd be a QR-kódot a telefonoddal.'
                  : 'Ha kiestél a játékból, olvasd be újra ugyanazzal a telefonnal.'}
              </p>
            </div>

            <div className="projector-qr">
              <QRCodeSVG value={joinUrl} size={620} level="M" includeMargin />
            </div>

            <div className="projector-code">
              <span>Játékkód</span>
              <strong>{session.code}</strong>
            </div>

            <div className="projector-status">
              {session.roundKey === 'lobby'
                ? <><strong>{session.players.length} / {session.expectedPlayerCount}</strong><span>résztvevő belépett</span></>
                : <><strong>{session.players.filter((player) => gameStore.isPlayerOnline(player)).length} / {session.players.length}</strong><span>résztvevő online</span></>}
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

  return (
    <div className="pool-planning">
      <div className="pool-config-grid compact">
        <label className="compact-field">
          <span>Csapatok száma · max. 25</span>
          <input
            type="number"
            min={1}
            max={Math.min(25, Math.max(1, session.players.length))}
            value={groupCount}
            disabled={!editableGroups}
            onChange={(e) => setGroupCount(Number(e.target.value))}
          />
        </label>
        <button className="secondary" disabled={!editableGroups} onClick={() => gameStore.randomizeGroups(session.code, groupCount)}>
          <RefreshCcw size={17} />Csapatok sorsolása
        </button>
        <div className="pool-rule-note">
          <strong>Csoportnevek:</strong> a rendszer automatikusan magyar helyneveket ad. A résztvevők ugyanezt a nevet látják a telefonjukon.
        </div>
      </div>
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

      <div className="group-minimum-bar">
        <div>
          <span className="mini-label">Következő kör minimum kasszája</span>
          <strong>
            {group.nextMinimumMode === 'none'
              ? 'Nincs minimum'
              : group.nextMinimumMode === 'custom'
                ? formatCredits(group.nextCustomMinimum ?? 0)
                : `${group.nextMinimumMode}% · ${formatCredits(gameStore.minimumForGroup(session, group) ?? 0)}`}
          </strong>
        </div>
        <MinimumSelector
          mode={group.nextMinimumMode}
          custom={group.nextCustomMinimum}
          disabled={!editableMinimum}
          onMode={(mode) => gameStore.setGroupMinimum(session.code, group.id, mode, group.nextCustomMinimum)}
          onCustom={(value) => gameStore.setGroupMinimum(session.code, group.id, 'custom', value)}
        />
      </div>

      {session.publicGoodsRoundNumber === 0 && session.publicGoodsPhase === 'setup' && (
        <div className="manual-group-list">
          {memberPlayers.map((player) => (
            <label key={player.id}>
              <span>{player.name}</span>
              <select
                value={group.id}
                onChange={(e) => gameStore.setPlayerGroup(session.code, player.id, e.target.value)}
              >
                {session.groups.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
              </select>
            </label>
          ))}
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

      <PoolPlanning session={session} />

      <div className="group-boxes">
        {session.groups.map((group) => <GroupBox session={session} groupId={group.id} key={group.id} />)}
      </div>
    </section>
  );
}

function ReportPanel({ session }: { session: GameSession }) {
  const summary = reportSummary(session);
  const ultimatumOffers = session.pairings
    .filter((pairing) => pairing.gameId === 'ultimatum')
    .flatMap((pairing) => {
      const decisions = decisionsFor(session, pairing);
      const offer = decisions.find((decision) => decision.type === 'ultimatum_offer');
      if (!offer) return [];
      const response = decisions.find((decision) => decision.type === 'ultimatum_response');
      const timeout = decisions.find((decision) => decision.type === 'ultimatum_timeout');
      const timedOut = timeout !== undefined;
      return [{
        pairing,
        amount: offer.amount ?? 0,
        accepted: response?.accepted,
        timedOut,
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

  return (
    <section className="panel report-panel dashboard-section">
      <div className="section-title">
        <div><p className="eyebrow">Gyors összesítő</p><h2>Játékadatok</h2></div>
        <button className="secondary" onClick={() => downloadCsv(session)}><BarChart3 size={17} />Teljes CSV</button>
      </div>
      <div className="report-summary-grid report-summary-v2">
        <div className="summary-stat ultimatum-summary">
          <span>Ultimátum</span>
          <strong>{ultimatumOffers.length} ajánlat</strong>
          <small>{summary.ultimatum.accepted} elfogadott · {summary.ultimatum.rejected} elutasított · {summary.ultimatum.timeouts} időtúllépés</small>
          <div className="ultimatum-offer-list">
            {ultimatumOffers.length === 0 ? (
              <div className="ultimatum-empty">Még nincs ajánlat.</div>
            ) : ultimatumOffers.map(({ pairing, amount, accepted, timedOut }) => {
              const statusClass = timedOut || accepted === false
                ? 'rejected'
                : accepted === true
                  ? 'accepted'
                  : 'pending';
              const statusLabel = timedOut
                ? 'időtúllépés'
                : accepted === true
                  ? 'elfogadott'
                  : accepted === false
                    ? 'elutasított'
                    : 'folyamatban';
              return (
                <div className="ultimatum-offer-row" key={pairing.id}>
                  <span className="offer-round">{pairing.roundKey}</span>
                  <span className="offer-route">
                    <b>{playerName(session, pairing.playerA)}</b>
                    <i>→</i>
                    <b>{playerName(session, pairing.playerB)}</b>
                  </span>
                  <strong className="offer-amount">{formatCredits(amount)}</strong>
                  <span className={'offer-status ' + statusClass}>{statusLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="summary-stat dictator-summary">
          <span>Diktátor</span>
          <strong>{dictatorTransfers.length} átadás</strong>
          <small>{formatCredits(summary.dictator.givenAmount)} összesen · {summary.dictator.timeouts} időtúllépés</small>
          <div className="dictator-transfer-list">
            {dictatorTransfers.length === 0 ? (
              <div className="ultimatum-empty">Még nincs átadás.</div>
            ) : dictatorTransfers.map(({ pairing, amount, percent, band, bandLabel, timedOut }) => (
              <div className="dictator-transfer-row" key={pairing.id}>
                <span className="offer-round">{pairing.roundKey}</span>
                <span className="offer-route">
                  <b>{playerName(session, pairing.playerA)}</b>
                  <i>→</i>
                  <b>{playerName(session, pairing.playerB)}</b>
                </span>
                <strong className="offer-amount">{formatCredits(amount)}</strong>
                <span className={'dictator-band ' + band}>
                  {timedOut ? 'idő → 0' : `${percent}% · ${bandLabel}`}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="summary-stat trust-summary">
          <span>Bizalom</span>
          <strong>{trustTransfers.length} kapcsolat</strong>
          <small>{formatCredits(summary.trust.sentAmount)} elküldve · {formatCredits(summary.trust.returnedAmount)} vissza</small>
          <div className="trust-transfer-list">
            {trustTransfers.length === 0 ? (
              <div className="ultimatum-empty">Még nincs bizalmi átadás.</div>
            ) : trustTransfers.map(({
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
                <span className="offer-round">{pairing.roundKey}</span>
                <div className="trust-moves">
                  <div className="trust-move">
                    <span className="trust-direction">
                      <b>Oda:</b> {playerName(session, pairing.playerA)} <i>→</i> {playerName(session, pairing.playerB)}
                    </span>
                    <span className={'trust-value ' + sendBand}>
                      {sendTimedOut ? 'idő → 0' : `${formatCredits(sent)} · ${sendPercent}%`}
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
                          : `${formatCredits(returned)} · ${returnPercent}%`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <small className="trust-scale-note">Szín: alacsony ≤30% · kiugróan magas ≥70%. Visszaadásnál a háromszorozott összeghez viszonyítva.</small>
        </div>
        <div className="summary-stat public-goods-summary">
          <span>Közös kassza</span>
          <strong>{publicGoodsRounds.length} kör</strong>
          <small>
            Csapatonkénti kassza, egyéni befizetések és vagyonváltozás.
            A százalék az adott játékos kör eleji vagyonához viszonyított befizetés.
          </small>
          <div className="public-goods-round-list">
            {publicGoodsRounds.length === 0 ? (
              <div className="ultimatum-empty">Még nincs kasszakör.</div>
            ) : publicGoodsRounds.map(({ roundNumber, groups }) => (
              <section className="public-goods-round-card" key={roundNumber}>
                <header className="public-goods-round-head">
                  <strong>{roundNumber}. kör</strong>
                  <span>{groups.length} csapat</span>
                </header>
                <div className="public-goods-group-grid">
                  {groups.map((round) => {
                    const groupName = session.groups.find((group) => group.id === round.groupId)?.name ?? round.groupId;
                    return (
                      <div className="public-goods-group-summary" key={round.id}>
                        <div className="public-goods-group-head">
                          <div>
                            <b>{groupName}</b>
                            <small>{round.memberIds.length} fő</small>
                          </div>
                          <div className="pool-total">
                            <span>Teljes kassza</span>
                            <strong>{formatCredits(round.totalContribution)}</strong>
                          </div>
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
                                  {contribution === undefined
                                    ? 'még nincs tét'
                                    : `${formatCredits(contribution)} · vagyon ${contributionPercent}% · kassza ${poolSharePercent}%`}
                                </span>
                                <span className={'member-wealth-change ' + (delta === undefined ? 'pending' : delta >= 0 ? 'positive' : 'negative')}>
                                  {delta === undefined
                                    ? 'vagyon: elszámolásra vár'
                                    : `${formatCredits(startWealth)} → ${formatCredits(endWealth ?? startWealth)} · ${delta >= 0 ? '+' : ''}${formatCredits(delta)}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
        <div className="summary-stat">
          <span>Korrekció</span>
          <strong>{session.manualCorrections.length}</strong>
          <small>auditált kézi módosítás</small>
        </div>
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
        <strong>Kézi korrekció</strong>
        <span>{session.manualCorrections.length} rögzített módosítás</span>
      </summary>

      <div className="correction-body">
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

function TrainerDashboard({ code, testMode = false }: { code: string; testMode?: boolean }) {
  const [session, setSession] = useState<GameSession | null>(() => gameStore.get(code));
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
      <TrainerCockpit session={session} joinUrl={joinUrl} />
      {testMode && <TestHarness session={session} />}
      <CurrentPairsBoard session={session} />
      <PlayerTable session={session} />
      <TrainerCorrectionPanel session={session} />
      {session.roundKey === '4' || session.roundKey === 'report' ? <PublicGoodsDashboard session={session} /> : null}
      <ReportPanel session={session} />
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
  onSubmit,
}: {
  max: number;
  label: string;
  button: string;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(0);
  return (
    <form className="decision-form" onSubmit={(event) => { event.preventDefault(); onSubmit(Math.round(amount)); }}>
      <label className="field">
        <span>{label}</span>
        <input type="number" min={0} max={max} step={100} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
      </label>
      <p className="limit">0 – {formatCredits(max)}</p>
      <button className="primary big" type="submit">{button}</button>
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
  const [amount, setAmount] = useState(0);
  const tripled = Math.round(amount * 3);
  return (
    <form className="decision-form" onSubmit={(event) => { event.preventDefault(); onSubmit(Math.round(amount)); }}>
      <label className="field">
        <span>Mennyit küldesz a másik játékosnak?</span>
        <input type="number" min={0} max={max} step={100} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
      </label>
      <div className="decision-consequence">
        <span>Te küldesz: <strong>{formatCredits(amount)}</strong></span>
        <span>A bank átad neki: <strong>{formatCredits(tripled)}</strong></span>
      </div>
      <button className="primary big" type="submit">Küldés</button>
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
  const [amount, setAmount] = useState(0);
  const kept = Math.max(0, available - amount);
  return (
    <form className="decision-form" onSubmit={(event) => { event.preventDefault(); onSubmit(Math.round(amount)); }}>
      <label className="field">
        <span>Mennyit adsz vissza?</span>
        <input type="number" min={0} max={available} step={100} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
      </label>
      <div className="decision-consequence">
        <span>Visszaadsz: <strong>{formatCredits(amount)}</strong></span>
        <span>Nálad marad: <strong>{formatCredits(kept)}</strong></span>
      </div>
      <button className="primary big" type="submit">Visszaadás elküldése</button>
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
            <strong>{ownTimeout ? 'Lejárt a 30 másodperced.' : 'A másik játékos ideje lejárt.'}</strong>
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
            Várakozás a másik játékos ajánlatára… A te 30 másodperced még nem indult el.
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
                ? 'A másik játékos nem döntött 30 másodpercen belül, ezért 0 kreditet kapsz.'
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
          <strong>{giveDecision?.timedOutRole === 'dictator' ? 'Lejárt a 30 másodperc. 0 kreditet adtál.' : `${formatCredits(given)} kreditet adtál a másik játékosnak.`}</strong>
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
          <strong>{sentDecision.timedOutRole === 'sender' ? 'Lejárt a 30 másodperc. Nem küldtél kreditet.' : `Elküldtél ${formatCredits(sent)} kreditet.`}</strong>
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
      <span>{returnedDecision.timedOutRole === 'returner' ? 'Lejárt a 30 másodperc, ezért 0 kreditet adtál vissza.' : `${formatCredits(returned)} kreditet visszaadtál.`}</span>
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
  const existingAmount = currentRound?.contributions[playerId] ?? 0;
  const [amount, setAmount] = useState(existingAmount);

  useEffect(() => {
    setAmount(currentRound?.contributions[playerId] ?? 0);
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
              <strong>Az első három játék véget ért.</strong> Az eddig megszerzett vagyonod: {formatCredits(player.currentBalance)}.
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
          <strong>Tét lezárva: {formatCredits(existingAmount)}</strong>
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
          <p>Az egy perc alatt többször is módosíthatod a tétedet. Mindig az utolsó mentett összeg számít.</p>
        </div>
        <DeadlineTimer deadlineAt={session.publicGoodsDeadlineAt} />
      </div>

      <form className="decision-form" onSubmit={(event) => {
        event.preventDefault();
        if (canEdit) gameStore.submitPublicGoods(session.code, playerId, Math.round(amount));
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
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
        <div className="decision-consequence">
          <span>Jelenlegi téted: <strong>{formatCredits(amount)}</strong></span>
          <span>A befizetés után nálad marad: <strong>{formatCredits(Math.max(0, player.currentBalance - amount))}</strong></span>
        </div>
        <button className="primary big" disabled={!canEdit} type="submit">
          {currentRound.contributions[playerId] !== undefined ? 'Tét módosítása' : 'Tét mentése'}
        </button>
      </form>

      {currentRound.contributions[playerId] !== undefined && (
        <div className="stake-saved">Mentett tét: <strong>{formatCredits(existingAmount)}</strong></div>
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
    session.roundKey === '3a' || session.roundKey === '3b' ? 3 : 4;

  const stages = ['Belépés', 'Ultimátum', 'Diktátor', 'Bizalom', 'Kassza'];
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
  if (session.roundKey === 'report') return 'Játék lezárva';
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
          <span className="context-round">{ROUND_LABELS[session.roundKey]}</span>
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
          const poolResult = currentPlayer.currentBalance - firstStage;
          return (
            <div className="game-finish">
              <p className="eyebrow">Játék vége</p>
              <h1>A Kreditjáték véget ért.</h1>
              <div className="final-summary">
                <div><span>Az első három játék után</span><strong>{formatCredits(firstStage)}</strong></div>
                <div><span>Közös kassza eredménye</span><strong className={poolResult >= 0 ? 'good' : 'bad'}>{poolResult >= 0 ? '+' : ''}{formatCredits(poolResult)}</strong></div>
                <div className="final-total"><span>Végső vagyon</span><strong>{formatCredits(currentPlayer.currentBalance)}</strong></div>
              </div>
            </div>
          );
        })()}
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
