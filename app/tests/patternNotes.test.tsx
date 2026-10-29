import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {PairComments, PoolNotes, pairComments, poolMarkers, openPatternNote} from '../src/patternNotes';
const pair:any={id:'pair-a',gameId:'ultimatum',roundKey:'1a',playerA:'a',playerB:'b'};
const round:any={id:'pool-a',roundNumber:1,groupId:'g',status:'settled',success:true,memberIds:['a','b','c'],contributions:{a:100,b:10,c:10},payoutByPlayer:{a:109,b:65,c:66}};
const session:any={players:[{id:'a',name:'Anna'},{id:'b',name:'Béla'}],pairings:[pair],decisions:[],closedRounds:['1a'],publicGoodsRounds:[],reflections:[
 {playerId:'a',decisionId:'decision:ultimatum:proposer:pair-a',comment:'Ajánlatom oka'},
 {playerId:'b',decisionId:'decision:ultimatum:receiver:pair-a',comment:'Válaszom oka'},
 {playerId:'b',decisionId:'decision:ultimatum:proposer:pair-a',comment:'Hibás tulajdonos'},
 {playerId:'a',decisionId:'decision:ultimatum:proposer:other',comment:'Másik kör'},
]};
assert.equal(pairComments(session,pair).length,2,'Only matching self-report IDs AND author are linked');
const anon=renderToStaticMarkup(<PairComments session={session} pairs={[pair]} showNames={false}/>);
assert.match(anon,/Ajánlatom oka/); assert.match(anon,/Válaszom oka/); assert.doesNotMatch(anon,/Anna|Béla|Hibás tulajdonos|Másik kör/);
assert.match(renderToStaticMarkup(<PairComments session={session} pairs={[pair]} showNames/>),/Anna/);
assert.equal(renderToStaticMarkup(<PairComments session={session} pairs={[]} showNames/>),'');
assert.equal(poolMarkers({...round,payoutByPlayer:{a:90}},'a').loss,true);
assert.equal(poolMarkers(round,'a').loss,false);
assert.equal(poolMarkers(round,'a').near,true); assert.equal(poolMarkers(round,'a').large,true);
assert.equal(poolMarkers({...round,payoutByPlayer:{a:116}},'a').near,false);
assert.equal(poolMarkers({...round,payoutByPlayer:{a:115}},'a').near,true);
assert.equal(poolMarkers({...round,contributions:{a:99,b:10,c:10}},'a').large,false);
assert.equal(poolMarkers({...round,success:false},'a').near,false);
assert.equal(poolMarkers({...round,contributions:{a:0,b:0,c:0}},'a').near,false);
assert.equal(poolMarkers({...round,contributions:{a:100,b:0,c:0}},'a').only,true);
const poolSession={...session,reflections:[{playerId:'a',decisionId:'decision:publicGoods:r1:g:a',comment:'Kassza oka'},{playerId:'a',decisionId:'decision:publicGoods:r2:g:a',comment:'Másik kasszakör'}]};
const pool=renderToStaticMarkup(<PoolNotes session={poolSession} rounds={[round]} showNames={false}/>);
assert.match(pool,/Kassza oka/);assert.match(pool,/Közel ugyanannyit/);assert.match(pool,/Kiemelkedő befizetés/);assert.doesNotMatch(pool,/Anna|Másik kasszakör/);
const src=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
assert.doesNotMatch(src,/onClick=\{\(\) => setTab\('events'\)\}/);
assert.match(src,/useState<'participants' \| 'patterns'>\('patterns'\)/);
console.log('PATTERN COMMENTS: author, pair, round, anonymity and pool marker boundaries PASS');

const dom=new JSDOM('<details id="note"><summary>💬</summary><p>Komment</p></details>');
Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
assert.equal(dom.window.document.querySelector('details')!.open,false);
openPatternNote('note');assert.equal(dom.window.document.querySelector('details')!.open,true);
openPatternNote('note');assert.equal(dom.window.document.querySelector('details')!.open,false);
openPatternNote('missing');
