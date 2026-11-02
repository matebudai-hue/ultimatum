'use strict';
const apiRoot='https://wmhyreahavyslxcqlqli.supabase.co';
const publicKey='sb_publishable_xq4-rTjl3DDakZyX1ysSwA_dbpC1Dhk';
const route=new URLSearchParams(location.hash.slice(1));
const preview=route.has('preview');
const demo=preview&&!route.has('occasion');
const occasionLink=route.get('occasion')||(demo?'demo':null);
const invitation=occasionLink||route.get('observe');
let appRole=null;
let context=null, access='', classes=[], occasions=[], entries=[],classId='',occasionId='';
const modeName=mode=>mode==='exam'?'Vizsga':'Megfigyelés';
const ADMIN_SESSION_KEY='toyota-admin-session-v1';
let adminSession=null, sessionRenewal=null, sessionTimer=null, sessionEpoch=0;
function storedSession(){
 try{const s=JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY));return s&&typeof s.access_token==='string'&&typeof s.refresh_token==='string'&&Number.isFinite(s.expires_at)?s:null;}catch{return null;}
}
function clearAdminSession(){
 sessionEpoch++;adminSession=null;access='';clearTimeout(sessionTimer);
 try{localStorage.removeItem(ADMIN_SESSION_KEY);}catch{}
}
function rememberAdminSession(s){
 adminSession={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+s.expires_in};
 access=adminSession.access_token;
 try{localStorage.setItem(ADMIN_SESSION_KEY,JSON.stringify(adminSession));}catch{throw Error('A böngésző nem engedi a tartós belépés mentését. Engedélyezd az oldal helyi adattárolását.');}
 scheduleSessionRenewal();
}
function scheduleSessionRenewal(){
 clearTimeout(sessionTimer);
 if(!adminSession)return;
 sessionTimer=setTimeout(()=>renewAdminSession().catch(()=>{if(adminSession)sessionTimer=setTimeout(scheduleSessionRenewal,30000);}),Math.max(1000,(adminSession.expires_at*1000-Date.now())-90000));
}
async function renewAdminSession(force=false){
 if(sessionRenewal)return sessionRenewal;
 const epoch=sessionEpoch;
 const refresh=async()=>{
  const latest=storedSession();
  if(!latest){clearAdminSession();window.dispatchEvent(new Event('toyota-session-expired'));throw Error('Lépj be az adminfelületre.');}
  if(!force&&latest.expires_at*1000>Date.now()+90000){adminSession=latest;access=latest.access_token;scheduleSessionRenewal();return;}
  // Another tab may already have renewed the session while this tab waited for the lock.
  if(force&&adminSession&&latest.access_token!==adminSession.access_token&&latest.expires_at*1000>Date.now()+90000){adminSession=latest;access=latest.access_token;scheduleSessionRenewal();return;}
  try{
   const s=await rawApi('/auth/v1/token?grant_type=refresh_token',{refresh_token:latest.refresh_token},'');
   if(epoch!==sessionEpoch)return;
   rememberAdminSession(s);
  }catch(err){
   if(epoch===sessionEpoch&&(err.status===400||err.status===401)){
    const current=storedSession();
    if(current?.refresh_token===latest.refresh_token){clearAdminSession();window.dispatchEvent(new Event('toyota-session-expired'));}
   }
   throw err;
  }
 };
 const run=typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request('toyota-admin-session-refresh',refresh):refresh();
 sessionRenewal=Promise.resolve(run).finally(()=>{sessionRenewal=null;});
 return sessionRenewal;
}
function requestError(message,status,definitive=false){const e=Error(message);e.status=status;e.definitive=definitive;return e;}
async function rawApi(path,body,token,method){
 const headers={apikey:publicKey,'Content-Type':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const res=await fetch(apiRoot+path,{method:method||(body===undefined?'GET':'POST'),headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
  const raw=await res.text();let data=null;
  try{data=raw?JSON.parse(raw):null;}catch{throw requestError('A szerver szokatlan választ adott. Próbáld újra; a megadott adatok megmaradtak.',res.status);}
  if(!res.ok){
   const source=data?.message||data?.msg||data?.error_description||'';
   const authMessage=path.startsWith('/auth/')?(/invalid login credentials/i.test(source)?'A belépés nem sikerült. Ellenőrizd az e-mail-címet és a jelszót.':/not confirmed/i.test(source)?'Erősítsd meg az e-mail-címed a regisztrációs levélben.':/rate limit|too many/i.test(source)?'Túl sok kérés érkezett. Próbáld újra később.':''):'';
   const hungarian=/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(source);
   const message=authMessage|| (res.status===401?'A belépés lejárt. Lépj be újra.':res.status===429?'Túl sok kérés érkezett. Próbáld újra egy kicsit később.':hungarian?source:res.status===403?'Ehhez a művelethez nincs jogosultságod.':res.status>=500?'A szerver átmenetileg nem elérhető. Próbáld újra.':'A kérés nem fogadható el. Ellenőrizd a megadott adatokat.');
   // A proxy/network error cannot establish whether a write committed.
   throw requestError(message,res.status,Boolean(data?.code&&res.status>=400&&res.status<500&&res.status!==408&&res.status!==429));
  }
  return data;
 }catch(err){
  if(err.name==='AbortError')throw requestError('A válaszra túl sokáig kellett várni. Az adataid megmaradtak; próbáld újra.',0);
  if(err instanceof TypeError)throw requestError('Nem sikerült kapcsolódni. Ellenőrizd az internetkapcsolatot, majd próbáld újra.',0);
  throw err;
 }finally{clearTimeout(timer);}
}
async function api(path,body,token=access,method){
 const adminRequest=!path.startsWith('/auth/')&&(Boolean(token)||adminActive);
 if(adminRequest&&!token){window.dispatchEvent(new Event('toyota-session-expired'));throw requestError('A belépés lejárt. Lépj be újra.',401);}
 if(adminRequest&&adminSession){await renewAdminSession();token=access;}
 try{return await rawApi(path,body,token,method);}
 catch(err){
  if(err.status!==401||!adminRequest)throw err;
  if(adminSession){
   await renewAdminSession(true);
   try{return await rawApi(path,body,access,method);}catch(retry){if(retry.status!==401)throw retry;}
  }
  clearAdminSession();window.dispatchEvent(new Event('toyota-session-expired'));
  throw requestError('A belépés lejárt. Lépj be újra.',401);
 }
}
async function restoreAdmin(){
 $('app').textContent='Adminfelület betöltése…';
 adminSession=storedSession();
 if(!adminSession){loginScreen();return;}
 try{
  access=adminSession.access_token;await renewAdminSession();
  appRole=await api('/rest/v1/rpc/toyota_app_role',{});
  if(!['admin','viewer'].includes(appRole)){clearAdminSession();loginScreen('Ehhez a fiókhoz jelenleg nincs engedélyezett hozzáférés. A tréner tud betekintést adni.');return;}
  await dashboard();
 }catch(err){
  if(!adminSession){loginScreen();return;}
  $('app').innerHTML='<section class="panel"><h1>A kapcsolat megszakadt</h1><p>A mentett belépésed megvan. Próbáld meg újra a kapcsolódást.</p><button class="primary" id="retryAdmin">Újrapróbálás</button></section>';
  $('retryAdmin').onclick=restoreAdmin;
 }
}
window.addEventListener('storage',event=>{
 if(event.key!==ADMIN_SESSION_KEY)return;
 const saved=storedSession();
 if(!saved){clearAdminSession();if(adminActive){adminActive=false;clearTimeout(refreshTimer);loginScreen();}}
 else if(adminSession){adminSession=saved;access=saved.access_token;scheduleSessionRenewal();}
});
window.addEventListener('online',()=>{if(adminSession)renewAdminSession().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&adminSession)renewAdminSession().catch(()=>{});});


async function acceptAppSession(session){
 const role=await rawApi('/rest/v1/rpc/toyota_app_role',{},session.access_token);
 if(!['admin','viewer'].includes(role)){clearAdminSession();throw Error('Ehhez a fiókhoz jelenleg nincs engedélyezett hozzáférés. A tréner tud betekintést adni.');}
 appRole=role;adminTab='overview';classId='';occasionId='';rememberAdminSession(session);await dashboard();
}
