import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { default: React, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { AmountInput, useAmountDraft, confirmAmount } = await import('../src/AmountInput');
function Harness({ draftKey }: { draftKey: string }) {
  const [amount, setAmount] = useAmountDraft(draftKey);
  return <AmountInput value={amount} onChange={setAmount} max={11266561} />;
}
let root = createRoot(document.getElementById('root')!);
await act(async () => root.render(<Harness draftKey="round-8" />));
let input = document.querySelector('input')!;
await act(async () => input.focus());
const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
for (const value of ['1', '11', '110', '1100', '11000', '110000', '1100000', '11000000']) {
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  assert.equal(input.value, value, 'Typing must not insert grouping characters or move the digit sequence');
}
await act(async () => input.blur());
assert.equal(input.value, '11 000 000');
assert.match(document.body.textContent!, /97,6%/);
await act(async () => root.unmount());
root = createRoot(document.getElementById('root')!);
await act(async () => root.render(<Harness draftKey="round-8" />));
assert.equal(document.querySelector('input')!.value, '11 000 000', 'Reload restores draft');
await act(async () => root.render(<Harness draftKey="round-9" />));
assert.equal(document.querySelector('input')!.value, '', 'Next round does not inherit prior amount');
await act(async () => document.querySelector('button')!.click());
assert.equal(document.querySelector('input')!.value, '11 266 561');
let prompt = '';
window.confirm = message => { prompt = String(message); return false; };
assert.equal(confirmAmount(11000000, 11266561), false);
assert.match(prompt, /11 000 000/);
await act(async () => root.unmount());
console.log('AMOUNT INPUT: 11 million typing, formatting, ratio, reload, round isolation, maximum and confirmation PASS');
