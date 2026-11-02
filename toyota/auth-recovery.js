'use strict';
// Recovery credentials stay in memory; never reuse the persistent admin session for a password change.
let recoverySession=null;
function authRedirect(){return location.origin+location.pathname.replace(/[^/]*$/,'')+'?admin=1&recover=1';}
function parseRecoveryLink(value){
 let url;try{url=new URL(value.trim());}catch{throw Error('A helyreállító levél gombjának teljes hivatkozását illeszd be.');}
 if(url.origin===apiRoot&&url.pathname==='/auth/v1/verify'&&url.searchParams.get('type')==='recovery'){
  const hash=url.searchParams.get('token_hash')||url.searchParams.get('token');
  if(hash)return {tokenHash:hash};
 }
 const fragment=new URLSearchParams(url.hash.slice(1));
 if((url.origin===location.origin||url.origin==='http://localhost:3000')&&fragment.get('type')==='recovery'&&fragment.get('access_token')&&fragment.get('refresh_token'))return {session:{access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token')}};
 throw Error('Ez nem a Toyota-projekt jelszó-helyreállító hivatkozása. A legfrissebb helyreállító levél hivatkozását használd.');
}
function recoveryRequestScreen(email='',message=''){
 recoverySession=null;adminActive=false;clearTimeout(refreshTimer);document.body.classList.remove('admin-mode');$('bottom').classList.add('hidden');
 $('app').innerHTML='<section class="panel auth-panel"><div class="eyebrow">Fiók helyreállítása</div><h1>Elfelejtetted a jelszavad?</h1><p>Add meg a fiókod e-mail-címét. Levélben kapsz hivatkozást az új jelszó beállításához.</p><form id="recoveryRequest"><label>E-mail-cím<input id="recoveryEmail" type="email" autocomplete="username" required maxlength="254" value="'+esc(email)+'"></label><button class="primary" type="submit" id="requestRecovery">Helyreállító levél kérése</button></form><p id="recoveryMessage" role="status" aria-live="polite">'+esc(message)+'</p><details class="auth-help"><summary>A levélben lévő gomb nem nyitja meg az alkalmazást</summary><p>Másold ki a legutóbbi helyreállító levél gombjának hivatkozását, és illeszd ide. A másolás után töröld a mezőt, ha mégsem folytatod.</p><label>Helyreállító hivatkozás<input id="recoveryLink" type="password" autocomplete="off"></label><button class="secondary" id="verifyRecovery" type="button">Hivatkozás ellenőrzése</button></details><p><button class="text-button" id="backToLogin" type="button">← Vissza a belépéshez</button></p></section>';
 $('backToLogin').onclick=()=>loginScreen();
 $('recoveryRequest').onsubmit=async e=>{
  e.preventDefault();if(!$('recoveryRequest').reportValidity())return;
  const button=$('requestRecovery');button.disabled=true;button.setAttribute('aria-busy','true');$('recoveryMessage').textContent='Helyreállító levél kérése…';
  try{await rawApi('/auth/v1/recover?redirect_to='+encodeURIComponent(authRedirect()),{email:$('recoveryEmail').value.trim()},'');$('recoveryMessage').textContent='Ha ehhez a címhez tartozik fiók, megérkezik a helyreállító levél. Nézd meg a levélszemét mappát is, és a legfrissebb levél gombját használd.';button.textContent='Új levél kérése';}
  catch(err){$('recoveryMessage').textContent=err.message;}finally{button.disabled=false;button.removeAttribute('aria-busy');}
 };
 $('verifyRecovery').onclick=async()=>{
  const button=$('verifyRecovery');button.disabled=true;
  try{
   const parsed=parseRecoveryLink($('recoveryLink').value);$('recoveryLink').value='';
   const session=parsed.session||await rawApi('/auth/v1/verify',{token_hash:parsed.tokenHash,type:'recovery'},'');
   await startPasswordRecovery(session);
  }catch(err){if($('recoveryMessage'))$('recoveryMessage').textContent=err.message;}finally{button.disabled=false;}
 };
}
async function startPasswordRecovery(session){
 adminActive=false;clearTimeout(refreshTimer);document.body.classList.remove('admin-mode');$('bottom').classList.add('hidden');
 const user=await rawApi('/auth/v1/user',undefined,session.access_token);
 if(!user?.id)throw Error('A helyreállító hivatkozás nem érvényes. Kérj új levelet.');
 recoverySession={access_token:session.access_token};
 $('app').innerHTML='<section class="panel auth-panel"><div class="eyebrow">Fiók helyreállítása</div><h1>Új jelszó beállítása</h1><p>'+esc(user.email||'A saját fiókod')+'</p><form id="newPasswordForm"><label>Új jelszó<input id="newPassword" type="password" autocomplete="new-password" minlength="8" required></label><p class="muted">Legalább 8 karakter. Több szóból álló jelmondatot is választhatsz.</p><label>Új jelszó még egyszer<input id="repeatPassword" type="password" autocomplete="new-password" minlength="8" required></label><button class="primary" type="submit" id="saveNewPassword">Új jelszó mentése</button></form><p id="passwordMessage" role="status" aria-live="polite"></p><p><button class="text-button" id="cancelRecovery" type="button">Vissza a belépéshez</button></p></section>';
 $('cancelRecovery').onclick=()=>{recoverySession=null;loginScreen();};
 $('newPasswordForm').onsubmit=async e=>{
  e.preventDefault();if(!$('newPasswordForm').reportValidity())return;
  if($('newPassword').value!==$('repeatPassword').value){$('passwordMessage').textContent='A két jelszó nem egyezik. Ellenőrizd őket.';return;}
  const button=$('saveNewPassword');button.disabled=true;button.setAttribute('aria-busy','true');$('passwordMessage').textContent='Jelszó mentése…';
  try{
   if(!recoverySession)throw Error('Nyisd meg újra a helyreállító levél hivatkozását.');
   await rawApi('/auth/v1/user',{password:$('newPassword').value},recoverySession.access_token,'PUT');
   $('newPassword').value='';$('repeatPassword').value='';
   const recoveredToken=recoverySession.access_token;recoverySession=null;clearAdminSession();
   try{await rawApi('/auth/v1/logout?scope=local',{},recoveredToken);}catch{}
   loginScreen('Az új jelszavadat elmentettük. Lépj be az e-mail-címeddel és az új jelszóval.');
  }catch(err){
   $('passwordMessage').textContent=err.status===0?'A mentés válaszát nem kaptuk meg. Próbálj belépni az új jelszóval. Ha nem működik, nyisd meg újra a helyreállító levelet.':err.message;
  }finally{button.disabled=false;button.removeAttribute('aria-busy');}
 };
}
