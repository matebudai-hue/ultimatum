import React,{useState} from 'react';
import {personalReportEmail} from './personalReportEmail';
export function PersonalReportDelivery({text,pendingChanges=false}:{text:string;pendingChanges?:boolean}) {
 const[address,setAddress]=useState(''),[status,setStatus]=useState('');
 const download=()=>{const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='kreditjatek-sajat-tortenetem.txt';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('A teljes személyes riportot elmentettük. E-mailhez is csatolhatod.');};
 const email=async()=>{
  let draft;try{draft=personalReportEmail(address,text);}catch(error){setStatus(error instanceof Error?error.message:'Ellenőrizd az e-mail-címet.');return;}
  if(draft.copyRequired){
   try{if(!navigator.clipboard?.writeText)throw new Error('clipboard');await navigator.clipboard.writeText(text);setStatus('A teljes riport a vágólapon van. Illeszd be a megnyíló levélbe, majd küldd el magadnak.');}
   catch{download();setStatus('A hosszú riportot fájlként mentettük. Csatold a megnyíló levélhez, majd küldd el magadnak.');}
  }else setStatus('A levél a saját leveleződben nyílik meg. Ott küldheted el.');
  window.location.href=draft.href;
 };
 return <section className="personal-report-delivery"><h2>A történetem megőrzése</h2><p>A riport tartalmazza a döntéseidet, az eredményeket, a saját kommentjeidet és a záró tanulságodat.</p><label className="field"><span>Saját e-mail-címem</span><input type="email" autoComplete="email" maxLength={254} value={address} onChange={e=>setAddress(e.target.value)} placeholder="nev@pelda.hu"/></label><div className="self-report-export-actions"><button type="button" className="primary" disabled={pendingChanges} onClick={()=>void email()}>E-mail előkészítése</button><button type="button" className="secondary" disabled={pendingChanges} onClick={download}>Teljes riport letöltése</button></div>{pendingChanges&&<p>Az új kommentek és tanulság bekerüléséhez előbb mentsd a reflexiódat.</p>}<small>A saját leveleződben tudod elküldeni. Az e-mail-címedet a játék nem tárolja. Hosszú riportnál másolással vagy fájlcsatolással viheted át a teljes szöveget.</small>{status&&<p role="status">{status}</p>}</section>;
}
