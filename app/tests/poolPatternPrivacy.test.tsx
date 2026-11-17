import { PairComments, PoolNotes, pairComments, poolMarkers, openPatternNote, pairNoteId, poolNoteId } from '../src/patternNotes';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
const src=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const fragment=src.slice(src.indexOf('function PublicGoodsPatterns('),src.indexOf('function renderPatternProjectionFromElement('));
const js=transformSync(fragment,{loader:'tsx',jsx:'transform'}).code;
const component=new Function('PairComments','PoolNotes','pairComments','poolMarkers','openPatternNote','pairNoteId','poolNoteId','React','poolPlayerColor','playerName','formatCredits',js+';return PublicGoodsPatterns;')(PairComments,PoolNotes,pairComments,poolMarkers,openPatternNote,pairNoteId,poolNoteId,React,()=>'red',(s:any,id:string)=>s.players.find((p:any)=>p.id===id)?.name ?? id,(n:number)=>n+' kr');
const session={players:[{id:'a',name:'Alma'},{id:'b',name:'Béla'}],groups:[{id:'g',name:'Balaton',memberIds:['a','b']}],publicGoodsRounds:[{id:'r',roundNumber:1,status:'settled',groupId:'g',memberIds:['a','b'],contributions:{a:100,b:200},totalContribution:300,startingGroupWealth:1000,startingPlayerWealth:{a:500,b:500}}]};
const hoveredSegment={groupId:'g',roundId:'r',roundLabel:'1. kör',playerId:'a',player:'Alma',amount:100,ownPercent:20,potPercent:33};
const render=(showNames:boolean)=>renderToStaticMarkup(React.createElement(component,{session,showNames,selectedGroupId:'g',onSelectGroup:()=>{},hoveredSegment,onHoverSegment:()=>{}}));
const anonymous=render(false); assert.doesNotMatch(anonymous,/Alma|Béla/); assert.match(anonymous,/1\. résztvevő/); assert.match(anonymous,/2\. résztvevő/);
const named=render(true); assert.match(named,/Alma/); assert.match(named,/Béla/);
console.log('PUBLIC GOODS CHART ANONYMITY OK');

const allGroups = renderToStaticMarkup(React.createElement(component, {
  session: {
    ...session,
    groups: [...session.groups, { id: 'h', name: 'Tisza', memberIds: ['b'] }],
    publicGoodsRounds: [...session.publicGoodsRounds, {
      ...session.publicGoodsRounds[0], id: 's', groupId: 'h', roundNumber: 2, totalContribution: 200,
      memberIds: ['b'], contributions: { b: 200 }, minimumAmount: 250,
    }],
  },
  showNames: true,
  selectedGroupId: ':all:',
  onSelectGroup: () => {},
  hoveredSegment,
  onHoverSegment: () => {},
}));
assert.match(allGroups, /Összes csoport · 2 kiscsoport/);
assert.equal((allGroups.match(/class="pool-overview-group"/g) ?? []).length, 2);
assert.match(allGroups, /1\. kör: 30%/);
assert.match(allGroups, /2\. kör: 20%, minimum 25%/);
assert.match(allGroups, /2\. kör: nincs lezárt eredmény/);
assert.doesNotMatch(allGroups, /Alma|Béla/);
console.log('ALL PUBLIC GOODS GROUPS AND SHARED SCALE OK');
