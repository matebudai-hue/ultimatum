import React, { FormEvent, useState } from 'react';
import { GameSession, Pairing } from './gameTypes';
import { inlineStrategicTarget } from './inlineStrategic';
import { gameStore } from './store';

export function InlineDecisionEditor({session, pairing, playerId, onClose}: {
  session: GameSession; pairing: Pairing; playerId: string; onClose: () => void;
}) {
  const [target] = useState(() => inlineStrategicTarget(session, pairing.id, playerId));
  const [amount, setAmount] = useState('');
  const [answer, setAnswer] = useState('');
  const [note, setNote] = useState(target?.note ?? '');
  const [error, setError] = useState('');
  const name = session.players.find(p => p.id === playerId)?.name;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    try {
      const response = target.type === 'ultimatum_response';
      if (response ? !answer : !/^\d+$/.test(amount.trim())) throw new Error('Add meg a döntést.');
      gameStore.saveInlineStrategicDecision(session.code, pairing.id, playerId,
        response ? answer === 'yes' : Number(amount), note, target.snapshot);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'A rögzítés nem sikerült.');
    }
  };
  const response = target?.type === 'ultimatum_response';
  return <form className="pair-inline-editor" aria-label={name + ' kézi rögzítése'} onSubmit={submit}
    onKeyDown={event => {if (event.key === 'Escape') {event.stopPropagation(); onClose();}}}>
    <strong>{name} · Kézi rögzítés</strong>
    {target ? <>
      <div className="pair-inline-fields">
      <label>{response ? 'Válasz' : target.type === 'trust_return' ? 'Visszaadás' : 'Küldött összeg'}
        {response
          ? <select autoFocus required value={answer} onChange={event => setAnswer(event.target.value)}>
            <option value="">Válassz…</option><option value="yes">Elfogadja</option><option value="no">Elutasítja</option>
          </select>
          : <input autoFocus required type="number" min="0" max={target.max} step="1" inputMode="numeric"
            placeholder={'0–' + target.max} value={amount} onChange={event => setAmount(event.target.value)}/>}
      </label>
      <label>Indok<input required value={note} onChange={event => setNote(event.target.value)}/></label>
      {target.reopensPartner && <small>A partner megkapja az új összeget, és újra dönthet.</small>}
      {error && <small role="alert">{error}</small>}
      </div>
      <div className="pair-inline-footer"><button type="submit">Rögzítés</button><button type="button" onClick={onClose}>Mégse</button></div>
    </> : <><small role="alert">A döntés közben megváltozott.</small><button type="button" onClick={onClose}>Bezárás</button></>}
  </form>;
}
