import React, { useState } from 'react';
import { formatCreditInput, parseCreditInput, readStorage, writeStorage } from './browserCompat';

export function useAmountDraft(key: string, fallback: number | '' = '') {
  const read = (): number | '' => {
    const stored = readStorage(key);
    return stored === null ? fallback : parseCreditInput(stored);
  };
  const [state, setState] = useState(() => ({ key, amount: read() }));
  const amount = state.key === key ? state.amount : read();
  const setAmount = (value: number | '') => {
    writeStorage(key, String(value));
    setState({ key, amount: value });
  };
  return [amount, setAmount] as const;
}

export function AmountInput({ value, onChange, max, disabled = false }: {
  value: number | ''; onChange: (value: number | '') => void; max: number; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return <>
    <input type="text" inputMode="numeric" autoComplete="off" required
      disabled={disabled} value={focused ? value : formatCreditInput(value)}
      placeholder="Írd be az összeget"
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onChange={event => onChange(parseCreditInput(event.target.value))} />
    <button type="button" className="secondary" disabled={disabled} onClick={() => onChange(max)}>Teljes összeg</button>
    {value !== '' && <span className="amount-preview" aria-live="polite">
      <strong>{formatCreditInput(value)} kredit</strong>
      {' · '}{max > 0 ? (value / max * 100).toLocaleString('hu-HU', { maximumFractionDigits: 1 }) : 0}% a rendelkezésre álló összegből
    </span>}
  </>;
}

export const confirmAmount = (amount: number, max: number) =>
  window.confirm('Ezt az összeget küldöd be: ' + formatCreditInput(amount) + ' kredit (' + (max > 0 ? (amount / max * 100).toLocaleString('hu-HU', { maximumFractionDigits: 1 }) : 0) + '%)?');
