import { PairComments, PoolNotes, pairComments, poolMarkers, openPatternNote, pairNoteId, poolNoteId } from '../src/patternNotes';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {transformSync} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const compile=(start:string,end:string)=>transformSync(source.slice(source.indexOf(start),source.indexOf(end)),{loader:'tsx',jsx:'transform'}).code;
const patternPairings=new Function(compile('function patternPairings(','function ParticipantPatterns(')+';return patternPairings;')();
const decisionsFor=(s:any,p:any)=>s.decisions.filter((d:any)=>d.pairingId===p.id);
const playerName=(s:any,id:string)=>id==='BOT'?'Rendszerjátékos':s.players.find((p:any)=>p.id===id)?.name ?? id;
const create=(name:string,next:string)=>new Function('PairComments','PoolNotes','pairComments','poolMarkers','openPatternNote','pairNoteId','poolNoteId','React','patternPairings','decisionsFor','playerName','formatCredits',compile('function '+name+'(','function '+next+'(')+';return '+name+';')(PairComments,PoolNotes,pairComments,poolMarkers,openPatternNote,pairNoteId,poolNoteId,React,patternPairings,decisionsFor,playerName,(n:number)=>n+' kr');
const Split=create('SplitDecisionPattern','TrustBarsPattern');
const Trust=create('TrustBarsPattern','TrustMatrixPattern');
const session:any={startingCredit:100000,players:[],closedRounds:['1a','2a','3a'],pairings:[],decisions:[]};
for(const game of ['ultimatum','dictator','trust']) {
 for(let i=0;i<13;i++) {
  const id=game+i, a=i===12?'BOT':'a'+i,b='b'+i;
  session.players.push({id:a,name:'Titkos '+a},{id:b,name:'Titkos '+b});
  session.pairings.push({id,gameId:game,roundKey:game==='ultimatum'?'1a':game==='dictator'?'2a':'3a',playerA:a,playerB:b});
  session.decisions.push({pairingId:id,type:game==='ultimatum'?'ultimatum_offer':game==='dictator'?'dictator_give':'trust_send',amount:i===12?1:1000+i,isBotDecision:i===12});
  if(game!=='dictator') session.decisions.push({pairingId:id,type:game==='trust'?'trust_return':'ultimatum_response',amount:1,accepted:true});
 }
 assert.equal(patternPairings(session,game).length,13,'System pairs must be included by default');
 assert.equal(patternPairings(session,game)[12].playerA,'BOT');
}
for(const game of ['ultimatum','dictator']) {
 for(const page of [0,1]) {
  const html=renderToStaticMarkup(<Split session={session} game={game} showNames={false} page={page} onPageChange={()=>{}}/>);
  const dom=new JSDOM(html);
  const bars=dom.window.document.querySelectorAll('.split-pattern-item');
  assert.ok(bars[bars.length-1].classList.contains('is-system-pair'),'Reserve pair is pinned to the right on every page');
  assert.match(bars[bars.length-1].textContent!,/Tartalékjátékos/);
  assert.doesNotMatch(html,/Titkos/);
 }
}
for(const page of [0,1]) {
 const dom=new JSDOM(renderToStaticMarkup(<Trust session={session} showNames={false} page={page} onPageChange={()=>{}}/>));
 const rows=dom.window.document.querySelectorAll('.trust-simple-pair');
 assert.ok(rows[rows.length-1].classList.contains('is-system-pair'),'Trust reserve pair remains visible after pagination');
}
// The projected snapshot must carry both the hover data and its visible pointer.
const poolSource=compile('function PublicGoodsPatterns(','function renderPatternProjectionFromElement(');
const Pool=new Function('PairComments','PoolNotes','pairComments','poolMarkers','openPatternNote','pairNoteId','poolNoteId','React','poolPlayerColor','playerName','formatCredits',poolSource+';return PublicGoodsPatterns;')(PairComments,PoolNotes,pairComments,poolMarkers,openPatternNote,pairNoteId,poolNoteId,React,()=> 'red',playerName,(n:number)=>n+' kr');
const pool={players:[{id:'a',name:'Titkos Anna'},{id:'b',name:'Titkos Béla'}],groups:[{id:'g',name:'Balaton',memberIds:['a','b']}],publicGoodsRounds:[{id:'r',groupId:'g',roundNumber:1,status:'settled',memberIds:['a','b'],contributions:{a:100,b:200},totalContribution:300,startingGroupWealth:1000,startingPlayerWealth:{a:500,b:500}}]};
const hover={groupId:'g',roundId:'r',roundLabel:'1. kör',playerId:'a',amount:100,ownPercent:20,potPercent:33.3};
const html=renderToStaticMarkup(<Pool session={pool} showNames={false} selectedGroupId="g" onSelectGroup={()=>{}} hoveredSegment={hover} onHoverSegment={()=>{}}/>);
const controller=new JSDOM('<style>.pool-pattern-pointer{width:36px;height:44px}</style><div id="patterns-stage-publicGoods">'+html+'</div>',{url:'http://localhost'});
const projector=new JSDOM('',{url:'http://localhost'});
for(const key of ['window','document','CustomEvent','HTMLLinkElement'] as const) Object.defineProperty(globalThis,key,{value:controller.window[key],configurable:true});
const project=new Function('ensureProjectorWindow','PATTERN_GAME_OPTIONS', 'let projectorContentMode;'+compile('function renderPatternProjectionFromElement(','function DebriefPatternsView(')+';return renderPatternProjectionFromElement;')(()=>projector.window,[{id:'publicGoods',label:'Közös kassza'}]);
assert.equal(project('publicGoods'),true);
assert.equal(projector.window.document.querySelectorAll('.pool-pattern-segment.is-highlighted').length,1);
assert.equal(projector.window.document.querySelectorAll('.pool-pattern-pointer').length,1);
assert.match(projector.window.document.head.textContent!,/width:36px/);
const originalStyle=projector.window.document.getElementById('kredit-pattern-projection-style');
project('publicGoods');
assert.equal(projector.window.document.getElementById('kredit-pattern-projection-style'),originalStyle,'Hover updates must preserve styles instead of flashing an unstyled frame');
assert.match(projector.window.document.body.textContent!,/100 kr/);
assert.doesNotMatch(projector.window.document.body.textContent!,/Titkos/);
console.log('CHART PRESENTATION: reserve pairs visible on every page, anonymous labels and projected hover pointer PASS');

const sourceNote=controller.window.document.querySelector('details')!;
assert.equal(sourceNote.open,false,'Notes are closed until the trainer opens one');
sourceNote.open=true;
const sourceNotes=controller.window.document.querySelector('.pattern-notes')!;
sourceNotes.scrollTop=25;
project('publicGoods');
assert.equal(projector.window.document.querySelector('details')!.open,true,'Opened note is mirrored on the projector');
assert.equal(projector.window.document.querySelector('.pattern-notes')!.scrollTop,25,'Comment scroll is mirrored');
