import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {buildCreditStandings,renderCreditStandings,STANDINGS_PAGE_SIZE} from '../src/creditStandings';
import type {GameSession} from '../src/gameTypes';
const session={status:'finished',players:[
 {id:'a',name:'Anna',currentBalance:375},
 {id:'b',name:'Béla',currentBalance:375},
 {id:'c',name:'Csilla <script>alert(1)</script>',currentBalance:50},
 {id:'BOT',name:'Tartalék',currentBalance:999,isBot:true},
],pairings:[{playerA:'a',playerB:'BOT'}],transactions:[
 {playerId:'a',roundKey:'1a',amount:100,reason:'ultimatum_proposer_paid'},
 {playerId:'a',roundKey:'2b',amount:200,reason:'dictator_keep'},
 {playerId:'a',roundKey:'3a',amount:300,reason:'trust_sender_result'},
 {playerId:'a',roundKey:'4',amount:-250,reason:'public_goods_failed_loss'},
 {playerId:'a',roundKey:'4',amount:25,reason:'manual_balance_correction'},
 {playerId:'b',roundKey:'2a',amount:300,reason:'dictator_keep'},
 {playerId:'b',roundKey:'4',amount:75,reason:'post_report_restart_floor'},
 {playerId:'c',roundKey:'1b',amount:50,reason:'ultimatum_receiver_paid'},
]} as GameSession;
const rows=buildCreditStandings(session);
assert.deepEqual(rows.map(row=>[row.id,row.rank]),[['a',1],['b',1],['c',3]]);
assert.deepEqual([rows[0].ultimatum,rows[0].dictator,rows[0].trust,rows[0].publicGoods,rows[0].adjustment],[100,200,300,-250,25]);
assert.equal(rows[1].publicGoods,0,'Restart top-ups must not appear as pool earnings');
assert.equal(rows[1].adjustment,75);
for(const row of rows) assert.equal(row.ultimatum+row.dictator+row.trust+row.publicGoods+row.adjustment,row.total);
const target=new JSDOM('',{url:'http://localhost'});
renderCreditStandings(target.window as unknown as Window,session);
const doc=target.window.document;
assert.equal(doc.querySelectorAll('tbody tr').length,3);
assert.match(doc.querySelector('h1')!.textContent!,/Végeredmény/);
assert.equal(doc.querySelectorAll('script').length,0,'Participant names are plain text');
assert.match(doc.body.textContent!,/Csilla <script>/);
assert.match(doc.body.textContent!,/Korrekció \/ feltöltés/);
assert.equal(doc.querySelector('.negative')!.textContent,'-250');
const many={...session,players:Array.from({length:23},(_,i)=>({id:'p'+i,name:'Név '+i,currentBalance:1000-i,active:true})),transactions:[]} as GameSession;
renderCreditStandings(target.window as unknown as Window,many,1);
assert.equal(doc.querySelectorAll('tbody tr').length,STANDINGS_PAGE_SIZE);
assert.equal(doc.querySelector('tbody tr td:nth-child(2)')!.textContent,'Név 10');
renderCreditStandings(target.window as unknown as Window,many,999);
assert.equal(doc.querySelectorAll('tbody tr').length,3,'Out-of-range pages clamp to the final page');
assert.match(doc.querySelector('footer strong')!.textContent!,/^3 \/ 3/);
renderCreditStandings(target.window as unknown as Window,{...session,status:'active'});
assert.match(doc.querySelector('h1')!.textContent!,/Aktuális kreditállás/);
console.log('CREDIT STANDINGS: per-game net earnings, losses, corrections, top-ups, ties, pagination and safe names PASS');
