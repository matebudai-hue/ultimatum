import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Player } from './gameTypes';
import { applyTransactions, settlePublicGoods } from './gameEngine';

const initialNames = ['Anna', 'Béla', 'Csilla', 'Dani', 'Eszter'];

const createPlayers = (): Player[] => initialNames.map((name) => ({
  id: crypto.randomUUID(),
  name,
  currentBalance: 0,
  active: true,
}));

function formatHuf(value: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(value) + ' Ft';
}

function App() {
  const [players, setPlayers] = useState<Player[]>(createPlayers);
  const [minimum, setMinimum] = useState(5_000_000);
  const [contributions, setContributions] = useState<Record<string, number>>({});
  const [lastResult, setLastResult] = useState<string>('');

  const total = useMemo(() => Object.values(contributions).reduce((sum, value) => sum + value, 0), [contributions]);

  const seedDemoCapital = () => {
    setPlayers((current) => current.map((player, index) => ({
      ...player,
      currentBalance: 3_000_000 + index * 350_000,
    })));
    setLastResult('Demo tőke beállítva. Ez a 4. játék első kattintható prototípusa.');
  };

  const updateContribution = (playerId: string, value: string) => {
    const amount = Number(value.replace(/\D/g, '')) || 0;
    setContributions((current) => ({ ...current, [playerId]: amount }));
  };

  const closeRound = () => {
    const result = settlePublicGoods(players, contributions, minimum);
    setPlayers((current) => applyTransactions(current, result.transactions));
    setLastResult(result.success
      ? `Kassza sikeres. Összes befizetés: ${formatHuf(result.totalContribution)}. Fejenkénti visszaosztás: ${formatHuf(result.payoutPerPlayer)}.`
      : `Kassza sikertelen. Összes befizetés: ${formatHuf(result.totalContribution)}. A befizetések elvesztek.`
    );
    setContributions({});
  };

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Ultimátum dashboard</p>
        <h1>Tréneri kontrollpanel – első működő váz</h1>
        <p>Ez még lokális prototípus. A következő lépés a Firebase session és a QR-kódos résztvevői belépés.</p>
      </section>

      <section className="card actions">
        <button onClick={seedDemoCapital}>Demo tőke beállítása</button>
        <label>
          Minimumkassza
          <input value={minimum} onChange={(event) => setMinimum(Number(event.target.value.replace(/\D/g, '')) || 0)} />
        </label>
        <button onClick={closeRound}>Közös kassza kör lezárása és visszaosztás</button>
      </section>

      <section className="card">
        <h2>Közös kassza – tréneri nézet</h2>
        <div className="summary">
          <span>Aktuális befizetés: <strong>{formatHuf(total)}</strong></span>
          <span>Minimum: <strong>{formatHuf(minimum)}</strong></span>
          <span>Státusz: <strong>{total >= minimum ? 'teljesülne' : 'nem teljesülne'}</strong></span>
        </div>

        <div className="table">
          <div className="row header"><span>Játékos</span><span>Vagyon</span><span>Befizetés</span></div>
          {players.map((player) => (
            <div className="row" key={player.id}>
              <span>{player.name}</span>
              <span>{formatHuf(player.currentBalance)}</span>
              <input
                value={contributions[player.id] ?? ''}
                onChange={(event) => updateContribution(player.id, event.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </section>

      {lastResult && <section className="notice">{lastResult}</section>}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
