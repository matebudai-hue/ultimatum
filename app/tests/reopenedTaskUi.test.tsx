import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformSync } from 'esbuild';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost'});
for(const key of ['window','document','navigator'] as const)
  Object.defineProperty(globalThis,key,{value:key==='window'?dom.window:dom.window[key],configurable:true});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const {default:React,act,useEffect,useState}=await import('react');
const {createRoot}=await import('react-dom/client');
const source=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const task=source.slice(source.indexOf('function StrategicParticipantTask('),source.indexOf('function PublicGoodsParticipantTask('));
const js=transformSync(task,{loader:'tsx',jsx:'transform',target:'es2020'}).code;
let acknowledgements=0;
const pair={id:'pair',playerA:'a',playerB:'b',gameId:'ultimatum'};
const Task=new Function('React','useState','useEffect','gameStore','decisionsFor','UltimatumRules','DeadlineTimer','AmountDecision','ULTIMATUM_PROPOSER_SECONDS',js+';return StrategicParticipantTask;')(
  React,useState,useEffect,{getPairingForPlayer:()=>pair,ackStrategicTaskVisible:()=>acknowledgements++,ultimatumDeadlineAt:()=>undefined},
  ()=>[],()=>null,()=>null,()=>React.createElement('input',{'aria-label':'Ajánlat'}),60);
const issue={pairingId:'pair',playerId:'a',detectedAt:'2026-10-29T10:00:00Z'};
let session:any={code:'TEST',roundKey:'1a',startingCredit:100000,closedRounds:[],strategicTechnicalIssues:[issue]};
const root=createRoot(document.getElementById('root')!);
await act(async()=>root.render(<Task session={session} playerId="a"/>));
assert.match(document.body.textContent!,/technikai ellenőrzés/);
const before=acknowledgements;
session={...session,strategicTechnicalIssues:[{...issue,resolvedAt:'2026-10-29T10:01:00Z',resolution:'reopened'}]};
await act(async()=>root.render(<Task session={session} playerId="a"/>));
assert.ok(document.querySelector('input'),'Reopened decision is visible');
assert.equal(acknowledgements,before+1,'Reopening the same pairing must restart visibility acknowledgement and its timer');
await act(async()=>root.unmount());
// A recovered connection must clear the old blocking error banner.
const banner=source.slice(source.indexOf('function FirebaseSyncBanner('),source.indexOf('\nfunction ',source.indexOf('function FirebaseSyncBanner(')+10));
const Banner=new Function('React','useState','useEffect',transformSync(banner,{loader:'tsx',jsx:'transform'}).code+';return FirebaseSyncBanner;')(React,useState,useEffect);
const root2=createRoot(document.getElementById('root')!);
await act(async()=>root2.render(<Banner/>));
await act(async()=>dom.window.dispatchEvent(new dom.window.CustomEvent('kreditjatek-sync-status',{detail:{status:'error',message:'Teszt kapcsolatmegszakadás'}})));
assert.ok(document.querySelector('[role="alert"]'));
await act(async()=>dom.window.dispatchEvent(new dom.window.CustomEvent('kreditjatek-sync-status',{detail:{status:'ok'}})));
assert.equal(document.querySelector('[role="alert"]'),null);
await act(async()=>root2.unmount());
console.log('RECOVERY UI: reopened task acknowledgement and recovered sync banner PASS');
process.exit(0);
