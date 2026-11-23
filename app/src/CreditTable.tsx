import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { AmountInput } from './AmountInput';
import { formatCreditInput as format } from './browserCompat';
import './creditTable.css';

const denominations = [50_000, 10_000, 5_000, 1_000, 500, 100, 10, 1];
const short = (value: number) => value >= 1_000 ? value / 1_000 + 'k' : String(value);

export type CreditMechanism = 'bridge' | 'chute' | 'tripler' | 'return' | 'vault';

function splitCredits(credits: number, assorted = false) {
  // Reserve smaller denominations before stacking the remaining credits.
  const reserved = new Set<number>();
  if (assorted) {
    const total = credits;
    for (const value of denominations.slice(1)) {
      if (total < 2 * value || credits < value) continue;
      reserved.add(value);
      credits -= value;
    }
  }

  const stacks: { value: number; count: number }[] = [];
  for (const value of denominations) {
    const count = Math.floor(credits / value);
    credits -= count * value;
    const stackSize = count + Number(reserved.has(value));
    if (stackSize > 0) stacks.push({ value, count: stackSize });
  }
  return assorted ? stacks.reverse() : stacks;
}

type BoardSide = 'own' | 'other';
type BoardState = 'waiting' | 'receiving' | 'accepted' | 'rejected';

function Board({ own, other, ownLabel, otherLabel, state, dropReady, renderChip, mechanism = 'bridge', partner, center, multiplier }: {
  own: number;
  other: number;
  ownLabel: string;
  otherLabel: string;
  state?: BoardState;
  mechanism?: CreditMechanism;
  partner?: string;
  center?: BoardSide;
  dropReady?: BoardSide;
  multiplier?: number;
  renderChip?: (side: BoardSide, value: number, content: ReactNode) => ReactNode;
}) {
  return <div className="credit-board" data-state={state} data-focus={center} data-drop-ready={dropReady} data-mechanism={mechanism} aria-label="Kreditek elosztása">
    <div className="credit-seat">
      <div className="credit-seat-figures" aria-hidden="true">
        {mechanism === 'vault' && <div className="credit-seat-shadow credit-seat-shadow-left" />}
        {mechanism === 'vault' && <div className="credit-seat-shadow credit-seat-shadow-right" />}
        <div className="credit-seat-shadow" />
      </div>
      <span>{partner ?? (mechanism === 'vault' ? 'A csoport' : 'A másik játékos')}</span>
      {renderChip && <div className="transfer-sign" aria-hidden="true" data-flow={mechanism}>
        <i /><b /><i />
      </div>}
    </div>
    <div className="division-strip" aria-hidden="true">
      <i style={{ width: (state === 'rejected' || own + other === 0 ? 0 : 100 * other / (own + other)) + '%' }} />
    </div>
    {([['other', other, otherLabel], ['own', own, ownLabel]] as const).map(([side, credits, label]) => {
      const stacks = splitCredits(credits, Boolean(renderChip) && side === 'own');
      return <div key={side} className={'credit-half credit-half-' + side} data-center={center === side}>
        <div className="credit-balance">
          <span>{label}</span>
          <strong className="board-amount">{renderChip && <span className="amount-sizer" aria-hidden="true">{format(own + other)} <small>kr</small></span>}<span>{format(state === 'rejected' ? 0 : credits)} <small>kr</small></span></strong>
        </div>
        <div className="credit-pile">
          {stacks.map(({ value, count }) => {
            const content = <><span>{short(value)}</span>{count > 1 && <sup>×{count}</sup>}</>;
            return <div key={value} className="credit-pile-slot" data-stack={count > 1 ? Math.min(3, count) : undefined}>
              {renderChip ? renderChip(side, value, content)
                : <span className="credit-disc" aria-hidden="true">{content}</span>}
            </div>;
          })}
          {renderChip && Array.from({ length: denominations.filter(d => d <= own + other).length - stacks.length }, (_, i) =>
            <span key={'space-' + i} className="credit-pile-slot credit-spacer" aria-hidden="true" />)}
        </div>
        {side === 'other' && multiplier !== undefined && (
          <div className="credit-multiplier">
            <span><b>×{multiplier}</b> A másik kap</span>
            <strong>{format(credits * multiplier)} <small>kr</small></strong>
          </div>
        )}
      </div>;
    })}
  </div>;
}

export function CreditOffer({ own, other, receiving = false }: {
  own: number;
  other: number;
  receiving?: boolean;
}) {
  return <Board own={own} other={other} state={receiving ? 'receiving' : 'waiting'}
    center={receiving ? 'own' : 'other'} partner={receiving ? 'Ő ajánlott, te döntesz' : 'A másik játékos dönt'}
    ownLabel={receiving ? 'Neked ajánlott' : 'Elfogadáskor nálad marad'}
    otherLabel={receiving ? 'Nála maradna' : 'Ajánlatod az asztalon'} />;
}

export function CreditOutcome({ mechanism, left, right, rejected = false }: {
  mechanism: CreditMechanism;
  left: number;
  right: number;
  rejected?: boolean;
}) {
  return <Board mechanism={mechanism} own={left} other={right} ownLabel="Nálad" otherLabel="A másiknál"
    state={rejected ? 'rejected' : 'accepted'} />;
}

export function CreditEncounter({ mechanism, own, other, ownLabel, otherLabel, partner, center }: {
  mechanism: CreditMechanism;
  own: number;
  other: number;
  ownLabel: string;
  otherLabel: string;
  partner?: string;
  center?: BoardSide;
}) {
  return <Board mechanism={mechanism} own={own} other={other}
    ownLabel={ownLabel} otherLabel={otherLabel} partner={partner} center={center} state="receiving" />;
}

export function VaultOutcome({ total, minimum }: { total: number; minimum?: number }) {
  const scale = Math.max(total, minimum ?? 0, 1);
  return <div className="credit-vault-meter">
    <span className="credit-vault-reveal" aria-hidden="true" />
    <div className="credit-vault-numbers">
      <span>A csoport befizetése <strong>{format(total)} kr</strong></span>
      {minimum !== undefined && <span>Minimum <strong>{format(minimum)} kr</strong></span>}
    </div>
    {minimum !== undefined && <div className="credit-vault-track"
      role="meter" aria-label={`A csoport befizetése. Minimum: ${format(minimum)} kredit`}
      aria-valuemin={0} aria-valuemax={scale} aria-valuenow={total}
      aria-valuetext={format(total) + ' kredit'}>
      <span style={{ width: total / scale * 100 + '%' }} />
      <i style={{ left: minimum / scale * 100 + '%' }} />
    </div>}
  </div>;
}

export function CreditTable({ value, onChange, max, disabled, label, destination, source = 'Nálad marad', multiplier, mechanism }: {
  value: number | '';
  onChange: (amount: number | '') => void;
  max: number;
  disabled: boolean;
  label: string;
  destination: string;
  source?: string;
  multiplier?: number;
  mechanism: CreditMechanism;
}) {
  const [history, setHistory] = useState<Array<number | ''>>([]);
  const board = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const sliderGesture = useRef<{ id: number; x: number; y: number; offset: number; intent?: 'horizontal' | 'vertical' } | null>(null);
  const sliderInput = useRef<HTMLInputElement>(null);
  const [overTarget, setOverTarget] = useState<BoardSide>();
  const [ghost, setGhost] = useState<{ x: number; y: number; value: number }>();
  const [motion, setMotion] = useState<{ id: number; direction: number; value?: number }>();
  const amount = value === '' ? 0 : value;
  const placed = Math.max(0, Math.min(amount, max));
  const share = max > 0 ? placed / max : 0;
  const animate = (next: number, credit?: number) => {
    if (next === placed) return;
    setMotion(previous => ({ id: (previous?.id ?? 0) + 1, direction: Math.sign(next - placed), value: credit }));
  };
  const setExact = (next: number | '', sliding = false) => {
    const nextPlaced = Math.min(max, next || 0);
    if (!sliding) animate(nextPlaced);
    setHistory([]);
    onChange(next);
  };
  const transfer = (next: number, credit: number) => {
    if (disabled || next < 0 || next > max) return;
    setHistory((previous) => [...previous.slice(-99), value]);
    animate(next, credit);
    onChange(next);
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (disabled || previous === undefined) return;
    setHistory(history.slice(0, -1));
    animate(previous || 0);
    onChange(previous);
  };

  const dropSide = (x: number, y: number): BoardSide | undefined => {
    const area = board.current?.querySelector('.credit-board')?.getBoundingClientRect();
    if (!area || !area.width || x < area.left - 12 || x > area.right + 12
      || y < area.top - 12 || y > area.bottom + 12) return;
    const ownSeat = board.current?.querySelector('.credit-half-own')?.getBoundingClientRect();
    const seam = ownSeat?.top ?? area.top + area.height / 2;
    return y <= seam ? 'other' : 'own';
  };
  const cancelDrag = () => {
    pointer.current = null;
    setGhost(undefined);
    setOverTarget(undefined);
  };

  const chipButton = (from: BoardSide, credit: number, content: ReactNode) => {
    const destination = from === 'own' ? 'other' : 'own';
    const next = amount + (from === 'own' ? credit : -credit);
    const action = from === 'own' ? 'hozzáadása' : 'visszavétele';
    const accessibleName = format(credit) + ' kredit ' + action;

    return <button key={credit} type="button" className="credit-disc"
      aria-label={accessibleName} title={accessibleName}
      disabled={disabled || next < 0 || next > max}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        dragged.current = false;
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = pointer.current;
        if (start?.id !== event.pointerId) return;
        dragged.current ||= Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7;
        if (!dragged.current) return;
        setGhost({ x: event.clientX, y: event.clientY, value: credit });
        setOverTarget(dropSide(event.clientX, event.clientY) === destination ? destination : undefined);
      }}
      onPointerUp={(event) => {
        const start = pointer.current;
        if (start?.id !== event.pointerId) return;
        dragged.current ||= Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7;
        cancelDrag();
        if (dragged.current && dropSide(event.clientX, event.clientY) === destination) transfer(next, credit);
      }}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (!dragged.current || event.detail === 0) transfer(next, credit);
        dragged.current = false;
      }}>{content}</button>;
  };

  const sliderPosition = (element: HTMLElement, x: number, offset = 0) => {
    const { left, width } = element.getBoundingClientRect();
    const position = (x - left - 12 - offset) / Math.max(1, width - 24);
    return Math.round(Math.max(0, Math.min(1, position)) * max);
  };
  const moveSlider = (event: PointerEvent<HTMLSpanElement>) => {
    const gesture = sliderGesture.current;
    if (gesture?.id !== event.pointerId) return;
    const dx = Math.abs(event.clientX - gesture.x);
    const dy = Math.abs(event.clientY - gesture.y);
    if (!gesture.intent && Math.max(dx, dy) >= 8) {
      gesture.intent = dx > dy ? 'horizontal' : 'vertical';
    }
    if (gesture.intent === 'horizontal') {
      const next = sliderPosition(event.currentTarget, event.clientX, gesture.offset);
      if (next !== placed) setExact(next, true);
    }
  };
  const endSlider = (event: PointerEvent<HTMLSpanElement>) => {
    const gesture = sliderGesture.current;
    if (gesture?.id !== event.pointerId) return;
    moveSlider(event);
    if (!gesture.intent && event.pointerType === 'mouse') {
      sliderInput.current?.focus({ preventScroll: true });
      const next = sliderPosition(event.currentTarget, event.clientX);
      if (next !== placed) setExact(next, true);
    }
    sliderGesture.current = null;
  };

  return (
    <div className="credit-table" data-mechanism={mechanism}>
      <div ref={board} className="credit-board-wrap">
        <Board mechanism={mechanism} multiplier={multiplier} own={max - placed} other={placed} ownLabel={source} otherLabel={destination}
          center={mechanism === 'bridge' || mechanism === 'vault' ? 'other' : undefined}
          partner={mechanism === 'chute' ? 'A másik játékos vár' : undefined}
          dropReady={overTarget} renderChip={chipButton} />
        {motion && <span key={motion.id} className="credit-disc credit-motion" data-direction={motion.direction}
          aria-hidden="true">{mechanism === 'tripler' && motion.direction > 0 ? '×' + multiplier : motion.value ? short(motion.value) : ''}</span>}
      </div>
      <div className="credit-slider">
        <span className="credit-slider-label">Választott összeg</span>
        <span className="credit-slider-track">
          <span aria-hidden="true">0</span>
          <span className="credit-slider-control">
            <input ref={sliderInput} type="range" min={0} max={max} step={1} value={placed}
              style={{ '--share': share * 100 + '%' } as CSSProperties}
              aria-label="Választott összeg" aria-valuetext={format(placed) + ' kredit'} disabled={disabled || max === 0}
              onChange={(event) => setExact(event.currentTarget.valueAsNumber, true)} />
            <span className="credit-slider-gesture" aria-hidden="true"
              onPointerDown={(event) => {
                if (disabled || max === 0 || !event.isPrimary || event.button !== 0) return;
                const { left, width } = event.currentTarget.getBoundingClientRect();
                const offset = event.clientX - (left + 12 + share * Math.max(1, width - 24));
                sliderGesture.current = {
                  id: event.pointerId, x: event.clientX, y: event.clientY,
                  offset: Math.abs(offset) <= 22 ? offset : 0,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={moveSlider} onPointerUp={endSlider}
              onPointerCancel={() => { sliderGesture.current = null; }}
              onLostPointerCapture={() => { sliderGesture.current = null; }} />
          </span>
          <span aria-hidden="true">{format(max)}</span>
        </span>
      </div>
      {ghost && <span aria-hidden="true" className="credit-disc credit-ghost"
        style={{ left: ghost.x, top: ghost.y }}>{short(ghost.value)}</span>}
      <button className="quick-undo" type="button" onClick={undo} disabled={disabled || !history.length}>↶ Visszavonás</button>
      <details className="credit-exact">
        <summary>Pontos összeg</summary>
        <label className="field">
          <span>{label}</span>
          <AmountInput value={value} onChange={setExact} max={max} disabled={disabled} required={false} />
        </label>
        <div className="credit-toolbar">

          <button type="button" onClick={() => setExact(0)} disabled={disabled || value === 0}>0 kredit</button>
        </div>
        {amount > max && <p className="error">Legfeljebb {format(max)} kreditet adhatsz meg.</p>}
      </details>
    </div>
  );
}
