import React from 'react';
import { GameSession, Pairing, PublicGoodsRound } from './gameTypes';
import { buildSelfReport } from './debriefEngine';
import { publicGoodsPlayerPayout } from './gameEngine';

export function openPatternNote(id: string) { const note=document.getElementById(id) as HTMLDetailsElement | null; if(note) note.open=!note.open; }
export const pairNoteId=(id:string)=>'pattern-pair-'+id;
export const poolNoteId=(roundId:string,playerId:string)=>'pattern-pool-'+roundId+'-'+playerId;
const money = (n: number) => Math.round(n).toLocaleString('hu-HU') + ' kr';
export function pairComments(session: GameSession, pairing: Pairing) {
  return (session.reflections ?? []).flatMap(reflection => {
    if (!reflection.comment.trim()) return [];
    const item = buildSelfReport(session, reflection.playerId).find(item => item.id === reflection.decisionId && item.pairingId === pairing.id);
    return item ? [{ ...reflection, role: item.role }] : [];
  });
}
export function PairComments({session, pairs, showNames, offset=0}: {session: GameSession; pairs: Pairing[]; showNames: boolean; offset?: number}) {
  const notes = pairs.flatMap((pairing, index) => pairComments(session, pairing).map(note => ({...note, pairing, index})));
  if (!notes.length) return null;
  const roles: Record<string,string> = {proposer:'ajánlattevő', receiver:'fogadó', dictator:'döntő', sender:'küldő', returner:'visszaadó'};
  return <aside className="pattern-notes" aria-label="Résztvevői kommentek">{pairs.map((pairing,index)=> {
    const comments=notes.filter(n=>n.pairing.id===pairing.id);
    return comments.length ? <details id={pairNoteId(pairing.id)} key={pairing.id}><summary title="Résztvevői kommentek">{offset+index+1}. pár 💬</summary><div className="pattern-note-content">{comments.map(note=><blockquote key={note.playerId+':'+note.decisionId}><small>{note.pairing.roundKey} · {roles[note.role]}{showNames ? ' · '+session.players.find(p=>p.id===note.playerId)?.name:''}</small><p>„{note.comment}”</p></blockquote>)}</div></details> : null;
  })}</aside>;
}
export function poolMarkers(round: PublicGoodsRound, playerId: string) {
  const amount = round.contributions[playerId] ?? 0;
  const payout = publicGoodsPlayerPayout(round, playerId);
  const others = round.memberIds.filter(id=>id!==playerId);
  const otherTotal = others.reduce((sum,id)=>sum+(round.contributions[id]??0),0);
  const startingWealth=round.startingPlayerWealth?.[playerId];
  const wiped=round.status==='settled' && round.success===false && startingWealth!==undefined && startingWealth>0 && amount>0 && startingWealth-amount+payout<=0;
  return {amount,payout,wiped, loss: round.status==='settled' && round.success===true && payout<amount, near: round.status==='settled' && amount>0 && Math.abs(payout-amount)<=amount*0.15,
    large: round.status==='settled' && amount>0 && others.length>0 && (otherTotal===0 || amount>=10*otherTotal/others.length), only: otherTotal===0};
}
export function PoolNotes({session, rounds, showNames}: {session:GameSession; rounds:PublicGoodsRound[]; showNames:boolean}) {
  const entries = rounds.flatMap(round=>round.memberIds.map((playerId,index)=> {
    const id=`decision:publicGoods:r${round.roundNumber}:${round.groupId}:${playerId}`;
    const comments=(session.reflections??[]).filter(r=>r.playerId===playerId && r.decisionId===id && r.comment.trim());
    const groupIndex=session.groups?.find(g=>g.id===round.groupId)?.memberIds.indexOf(playerId);
    return {round,playerId,index:groupIndex!==undefined && groupIndex>=0?groupIndex:index,comments,...poolMarkers(round,playerId)};
  })).filter(e=>e.comments.length||e.wiped||e.loss||e.near||e.large);
  if (!entries.length) return null;
  return <aside className="pattern-notes pool-notes" aria-label="Kassza kommentek és jelölések">{entries.map(e=><details id={poolNoteId(e.round.id,e.playerId)} key={e.round.id+e.playerId}><summary title="Kattints a részletekhez">{e.round.roundNumber}. kör · {e.index+1}. {e.wiped?'0 ':''}{e.loss?'− ':''}{e.near?'≈ ':''}{e.large?'◆ ':''}{e.comments.length?'💬':''}</summary><div className="pattern-note-content"><strong>{e.round.roundNumber}. kör · {showNames ? session.players.find(p=>p.id===e.playerId)?.name : (e.index+1)+'. résztvevő'}</strong><p>Be: {money(e.amount)} · vissza: {money(e.payout)} · nettó: {money(e.payout-e.amount)}</p>{e.wiped&&<p>0 · Lenullázódott: a minimum nem teljesült, és ebben a körben elvesztette a teljes vagyonát.</p>}{e.loss&&<p>− Bukó: kevesebbet kapott vissza, mint amennyit betett.</p>}{e.near&&<p>≈ Közel ugyanannyit kapott vissza (±15%).</p>}{e.large&&<p>◆ {e.only?'Egyedüli befizető':'Kiemelkedő befizetés: legalább a többiek átlagának tízszerese.'}</p>}{e.comments.map(c=><p key={c.decisionId}>💬 „{c.comment}”</p>)}</div></details>)}</aside>;
}
