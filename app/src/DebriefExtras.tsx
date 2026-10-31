import React,{useEffect,useMemo,useState} from 'react';
import type {GameSession} from './gameTypes';
import {buildSelfReport} from './debriefEngine';
import {selfReportItemText} from './selfReportExport';
import {buildCreditStandings,STANDINGS_PAGE_SIZE} from './creditStandings';
import './debriefExtras.css';
export type ReflectionEntry={id:string;author:string;text:string;context:string;kind:'takeaway'|'decision'};
export function reflectionEntries(session:GameSession):ReflectionEntry[] {
 const names=new Map(session.players.map(p=>[p.id,p.name]));
 const reports=new Map(session.players.filter(p=>!p.isBot).map(p=>[p.id,buildSelfReport(session,p.id)]));
 return [
  ...(session.takeaways??[]).filter(t=>t.text.trim()).map(t=>({id:'takeaway:'+t.playerId,author:names.get(t.playerId)??'Résztvevő',text:t.text,context:'Mit viszel magaddal ebből a játékból?',kind:'takeaway' as const})),
  ...(session.reflections??[]).filter(t=>t.comment.trim()).map(t=>{const item=reports.get(t.playerId)?.find(i=>i.id===t.decisionId);return{id:'decision:'+t.playerId+':'+t.decisionId,author:names.get(t.playerId)??'Résztvevő',text:t.comment,context:item?({ultimatum:'Ultimátum',dictator:'Diktátor',trust:'Bizalom',publicGoods:'Közös kassza'}[item.game]+' · '+selfReportItemText(item).join(' · ')):'Döntéskomment',kind:'decision' as const};}),
 ];
}
export function reflectionPages(text:string,maxLength=550):string[]{
 if(maxLength<1)throw new Error('Érvénytelen oldalméret.');
 const pages:string[]=[];let rest=text;
 while(rest.length>maxLength){let cut=rest.lastIndexOf(' ',maxLength);if(cut<Math.floor(maxLength/2))cut=maxLength;else cut+=1;if(/[\uD800-\uDBFF]/.test(rest[cut-1])&&/[\uDC00-\uDFFF]/.test(rest[cut]))cut-=1;pages.push(rest.slice(0,cut));rest=rest.slice(cut);}
 if(rest||!pages.length)pages.push(rest);return pages;
}
function entryPages(entry:ReflectionEntry){return reflectionPages(entry.text,entry.kind==='decision'?400:550);}
export function renderReflectionProjection(target:Window,entry:ReflectionEntry,showNames:boolean,part=0){
 const doc=target.document;doc.head.replaceChildren();doc.title='Kreditjáték · Reflexió';
 const style=doc.createElement('style');style.textContent='html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#edf3f5;color:#163047;font-family:Arial,Helvetica,sans-serif}body{display:flex;align-items:center;justify-content:center}main{box-sizing:border-box;width:min(1280px,94vw);padding:5vh 3vw}blockquote{margin:0;font-size:clamp(24px,3.3vw,54px);line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}.decision-context{font-size:clamp(18px,1.6vw,26px);line-height:1.45;color:#52657b;margin:0 0 3vh;padding-bottom:2vh;border-bottom:1px solid #c6d7df}main[data-kind=decision] blockquote{font-size:clamp(24px,2.8vw,44px)}h1{font-size:clamp(20px,2.2vw,34px);margin:0 0 3vh;color:#0c817b}small{display:block;text-align:right;font-size:16px;color:#617589;margin-top:3vh}';doc.head.appendChild(style);
 const main=doc.createElement('main');main.dataset.kind=entry.kind;if(entry.kind==='decision'){const context=doc.createElement('p');context.className='decision-context';context.textContent=entry.context;main.appendChild(context);}if(showNames){const name=doc.createElement('h1');name.textContent=entry.author;main.appendChild(name);}
 const parts=entryPages(entry),safe=Math.max(0,Math.min(part,parts.length-1)),quote=doc.createElement('blockquote');quote.textContent=parts[safe];main.appendChild(quote);
 if(parts.length>1){const paging=doc.createElement('small');paging.textContent=(safe+1)+' / '+parts.length;main.appendChild(paging);}
 doc.body.replaceChildren(main);return true;
}
export function ReflectionsView({session,onProject,isProjecting}:{session:GameSession;onProject:(entry:ReflectionEntry,showNames:boolean,part:number)=>boolean;isProjecting:()=>boolean}){
 const all=useMemo(()=>reflectionEntries(session),[session]);
 const[filter,setFilter]=useState<'takeaway'|'decision'|'all'>('takeaway'),[selectedId,setSelectedId]=useState(''),[showNames,setShowNames]=useState(false),[part,setPart]=useState(0),[error,setError]=useState('');
 const entries=all.filter(e=>filter==='all'||e.kind===filter),selected=entries.find(e=>e.id===selectedId)??entries[0],parts=selected?entryPages(selected):[''],safePart=Math.min(part,parts.length-1);
 useEffect(()=>{if(selected&&selected.id!==selectedId){setSelectedId(selected.id);setPart(0);}},[selected?.id,selectedId]);
 useEffect(()=>{if(isProjecting())onProject(selected??{id:'empty',author:'',text:'Még nem érkezett ilyen reflexió.',context:'',kind:'takeaway'},selected?showNames:false,safePart);},[selected?.id,selected?.text,selected?.author,selected?.context,showNames,safePart]);
 const project=()=>{if(selected&&!onProject(selected,showNames,safePart))setError('Engedélyezd a kivetítőablak megnyitását.');else setError('');};
 return <div className="reflections-workspace"><div className="reflections-filters">{([{id:'takeaway',label:'Mit viszel magaddal?'},{id:'decision',label:'Döntéskommentek'},{id:'all',label:'Mind'}] as const).map(f=><button type="button" className={filter===f.id?'secondary active':'secondary'} key={f.id} onClick={()=>{setFilter(f.id);setSelectedId('');setPart(0);}}>{f.label} · {all.filter(e=>f.id==='all'||e.kind===f.id).length}</button>)}</div><div className="reflections-layout"><div className="reflections-list">{entries.map(e=><button type="button" className={selected?.id===e.id?'reflection-choice active':'reflection-choice'} key={e.id} onClick={()=>{setSelectedId(e.id);setPart(0);}}><strong>{e.author}</strong><small>{e.context}</small><span>{e.text}</span></button>)}{!entries.length&&<p>Még nem érkezett ilyen reflexió.</p>}</div><div className="reflection-preview">{selected&&<><div className="reflection-project-controls"><label><input type="checkbox" checked={showNames} onChange={e=>setShowNames(e.target.checked)}/>Nevek mutatása a kivetítőn</label><button type="button" className="primary" onClick={project}>Kivetítés</button></div><small>Kivetített tartalom előnézete</small><div className="reflection-slide">{selected.kind==='decision'&&<p className="decision-context">{selected.context}</p>}{showNames&&<strong>{selected.author}</strong>}<blockquote>{parts[safePart]}</blockquote></div>{parts.length>1&&<div className="reflections-paging"><button type="button" className="secondary" disabled={safePart===0} onClick={()=>setPart(safePart-1)}>← Előző részlet</button><span>{safePart+1} / {parts.length}</span><button type="button" className="secondary" disabled={safePart+1>=parts.length} onClick={()=>setPart(safePart+1)}>Következő részlet →</button></div>}<p>{selected.kind==='decision'?'A komment mellett a játék és a történtek is látszanak.':'Alapból kizárólag a szöveget vetíted ki.'} A szerző neve a kapcsolóval jeleníthető meg.</p></>}{error&&<p role="alert">{error}</p>}</div></div></div>;
}
export function StandingsView({session,onProject,isProjecting}:{session:GameSession;onProject:(page:number,onPageChange:(page:number)=>void)=>boolean;isProjecting:()=>boolean}){
 const rows=buildCreditStandings(session),[page,setPage]=useState(0),[error,setError]=useState(''),pages=Math.max(1,Math.ceil(rows.length/STANDINGS_PAGE_SIZE)),safe=Math.min(page,pages-1),hasAdjustments=rows.some(r=>r.adjustment!==0);
 useEffect(()=>{if(isProjecting())onProject(safe,setPage);},[session,safe]);
 const money=(n:number)=>n.toLocaleString('hu-HU');
 return <div className="standings-workspace"><div className="standings-toolbar"><h3>Végeredmény · kreditek játékonként</h3><button type="button" className="primary" onClick={()=>{if(!onProject(safe,setPage))setError('Engedélyezd a kivetítőablak megnyitását.');else setError('');}}>Kivetítés</button></div><div className="standings-table-wrap"><table><thead><tr>{['Hely','Résztvevő','Végső kredit','Ultimátum','Diktátor','Bizalom','Közös kassza',...(hasAdjustments?['Korrekció / feltöltés']:[])].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(safe*STANDINGS_PAGE_SIZE,(safe+1)*STANDINGS_PAGE_SIZE).map(r=><tr key={r.id}><td>{r.rank}</td><th scope="row">{r.name}</th><td><strong>{money(r.total)}</strong></td><td>{money(r.ultimatum)}</td><td>{money(r.dictator)}</td><td>{money(r.trust)}</td><td>{money(r.publicGoods)}</td>{hasAdjustments&&<td>{money(r.adjustment)}</td>}</tr>)}</tbody></table></div><div className="reflections-paging"><button type="button" className="secondary" disabled={safe===0} onClick={()=>setPage(safe-1)}>Előző oldal</button><span>{safe+1} / {pages}</span><button type="button" className="secondary" disabled={safe+1>=pages} onClick={()=>setPage(safe+1)}>Következő oldal</button></div>{error&&<p role="alert">{error}</p>}</div>;
}
