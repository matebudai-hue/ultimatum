import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformSync } from 'esbuild';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'navigator'] as const)
  Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : dom.window[key], configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { default: React, act, useEffect, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
const { AmountInput, useAmountDraft } = await import('../src/AmountInput');
const { publicGoodsPlayerPayout } = await import('../src/gameEngine');
const source = fs.readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const taskSource = source.slice(source.indexOf('function PublicGoodsParticipantTask('), source.indexOf('function ParticipantLedger('));
const js = transformSync(taskSource, { loader: 'tsx', jsx: 'transform', target: 'es2020' }).code;
let confirmed = true;
let failSubmit = false;
const sent: number[] = [];
const Task = new Function('React','useState','useEffect','useAmountDraft','AmountInput','confirmAmount','gameStore','formatCredits','DeadlineTimer','Check','publicGoodsPlayerPayout',
  js + '; return PublicGoodsParticipantTask;')(
  React, useState, useEffect, useAmountDraft, AmountInput, () => confirmed,
  { submitPublicGoods: (_c: string, _p: string, amount: number) => { if (failSubmit) throw new Error('Lejárt a döntési idő.'); sent.push(amount); } },
  (value: number) => value.toLocaleString('hu-HU') + ' kr', () => null, () => null, publicGoodsPlayerPayout);
let session: any = { code:'TEST', players:[{id:'p',currentBalance:12000000}],groups:[{id:'g',name:'Teszt',memberIds:['p']}],
  publicGoodsRoundNumber:8, publicGoodsPhase:'open', publicGoodsDeadlineAt:new Date(Date.now()+90000).toISOString(),
  publicGoodsRounds:[{id:'r8',roundNumber:8,memberIds:['p'],contributions:{},minimumMode:'none'}], decisions:[] };
let root = createRoot(document.getElementById('root')!);
const render = async () => act(async () => root.render(<Task session={session} playerId="p" />));
const inputValue = async (value: string) => {
  const input = document.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);
    input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  });
};
const submit = async () => act(async () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
await render();
await inputValue('11000000');
confirmed = false;
await submit();
assert.deepEqual(sent,[]);
confirmed = true;
await submit();
assert.deepEqual(sent,[11000000]);
assert.doesNotMatch(document.body.textContent!, /Beérkezett:/, 'No success before acknowledgement');
session = {...session, publicGoodsRounds:[{...session.publicGoodsRounds[0],contributions:{p:11000000}}]};
await render();
assert.match(document.body.textContent!, /Beérkezett:/);
assert.equal(document.querySelector('form'),null);
await act(async () => Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Módosítom')!.click());
await inputValue('10000000');
await act(async () => root.unmount());
root = createRoot(document.getElementById('root')!);
await render();
assert.ok(document.querySelector('input'), 'Unsubmitted modification must remain accessible after reload');
assert.equal(document.querySelector('input')!.value,'10 000 000');
assert.match(document.body.textContent!, /Beérkezett:/, 'Saved amount must remain distinct from draft');
failSubmit = true;
await submit();
assert.match(document.querySelector('[role="alert"]')!.textContent!, /Lejárt/);
assert.equal((Array.from(document.querySelectorAll('button')).find(b => b.type === 'submit') as HTMLButtonElement).disabled, false);
await act(async () => root.unmount());
console.log('PUBLIC GOODS UI: confirmation, delayed acknowledgement, saved state and interrupted modification PASS');
