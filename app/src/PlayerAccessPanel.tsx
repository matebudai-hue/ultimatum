import React,{useEffect,useRef,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import type {GameSession,Player} from './gameTypes';
import {gameStore} from './store';
import './playerAccess.css';
function AccessRow({session,player}:{session:GameSession;player:Player}){
 const[link,setLink]=useState(''),[expiresAt,setExpiresAt]=useState(0),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());
 const attempt=useRef({at:0,confirmed:false});
 useEffect(()=>{if(attempt.current.at && (session.sessionEvents??[]).some(e=>e.playerId===player.id && ['recovery_completed','resume_success'].includes(e.event) && Date.parse(e.at)>=attempt.current.at)){attempt.current.confirmed=true;setLink('');setMessage('A visszacsatlakoztatás megtörtént.');}},[session.sessionEvents,player.id]);
 const handle=useRef<{stop:()=>void}|null>(null);
 useEffect(()=>()=>handle.current?.stop(),[]);
 useEffect(()=>{if(!link)return;const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id);},[link]);
 const excluded=player.poolExcludedFromRound!==undefined;
 const issue=async()=>{attempt.current={at:Date.now(),confirmed:false};handle.current?.stop();setLink('');setBusy(true);setMessage('');try{const h=await gameStore.issuePlayerRecovery(session.code,player.id,()=>{setLink('');if(!attempt.current.confirmed)setMessage('A belépési jog visszaállt. Várjuk a telefon visszacsatlakozását.');},error=>{setLink('');setMessage(error);});handle.current=h;setLink(h.url);setExpiresAt(h.expiresAt);setNow(Date.now());}catch{setMessage('A visszacsatlakozási link nem készült el. Ellenőrizd a kapcsolatot.');}finally{setBusy(false);}};
 return <div className="player-access-row"><div className="player-access-label"><strong>{player.name}</strong><span>{excluded?'Kasszából kivéve · ettől a körtől: '+player.poolExcludedFromRound:player.botControlled?'Rendszerjátékos irányítja':gameStore.isPlayerOnline(player)?'Kapcsolódik':'Nincs friss kapcsolatjelzés'}</span></div><div className="player-access-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>void issue()}>Visszacsatlakoztatás</button>{player.botControlled&&<button type="button" className="secondary" onClick={()=>gameStore.setPlayerBotControl(session.code,player.id,false)}>Irányítás visszaadása</button>}{session.roundKey==='4'&&!excluded&&<button type="button" className="secondary" onClick={()=>{const message=session.publicGoodsPhase==='setup'?'A következő kasszakörben már nem tagja a csapatnak.':'A folyamatban lévő kör változatlan marad; a következő körben már nem tagja a csapatnak.';if(window.confirm(player.name+' kivétele a Közös kasszából? '+message+' Minden eddigi adata és vagyona megmarad.'))gameStore.excludeFromPublicGoods(session.code,player.id);}}>Kivétel a közös kasszából</button>}</div>{link&&(now<expiresAt?<div className="recovery-qr"><QRCodeSVG value={link} size={170} level="M" includeMargin/><div><strong>{player.name} olvassa be ezt a QR-kódot.</strong><p>Egyszer használható · még {Math.max(1,Math.ceil((expiresAt-now)/1000))} másodpercig érvényes. Tartsd nyitva ezt a tréneri oldalt.</p><a href={link} target="_blank" rel="noreferrer">Visszacsatlakozási link megnyitása</a><button type="button" className="secondary" onClick={()=>{handle.current?.stop();setLink('');}}>Link visszavonása</button></div></div>:<p role="status">A link lejárt. Készíts újat.</p>)}{message&&<p role="status">{message}</p>}</div>;
}
export function PlayerAccessPanel({session}:{session:GameSession}){
 const[open,setOpen]=useState(false);
 if(session.status!=='active')return null;
 const players=session.players.filter(p=>!p.isBot);
 const unresolved=players.filter(p=>p.botControlled&&p.poolExcludedFromRound===undefined);
 const disconnected=players.filter(p=>!p.botControlled&&p.poolExcludedFromRound===undefined&&!gameStore.isPlayerOnline(p));
 const attention=[...unresolved,...disconnected];
 return <section className="panel player-access-panel"><div className="player-access-heading"><div><strong>{attention.length?'Résztvevői kapcsolat · figyelmet kér':'Résztvevők visszacsatlakoztatása'}</strong>{attention.length>0&&<p role="status">{attention.map(p=>p.name).join(', ')}</p>}{session.roundKey==='4'&&unresolved.length>0&&<p className="error">A kasszakör indítása előtt add vissza az irányítást, csatlakoztasd vissza vagy vedd ki a rendszerirányítású résztvevőket.</p>}</div><button type="button" className="secondary" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Résztvevők elrejtése':'Résztvevők kezelése'}</button></div>{(open?players:attention).map(p=><AccessRow key={p.id} session={session} player={p}/>)}</section>;
}
