'use strict';
// A separate read-only workspace. All data comes from the server's scoped field allowlist.
let viewerMode='all';
function viewerLink(){return location.origin+location.pathname.replace(/[^/]*$/,'')+'?admin=1';}
async function viewerAccessDialog(cls){
 const rows=await api('/rest/v1/rpc/list_viewer_access',{target:cls.id});
 const active=row=>!row.revoked_at&&(!row.expires_at||new Date(row.expires_at)>new Date());
 const d=modal('Betekintő hozzáférés · '+cls.name,'<p>A meghívott saját fiókkal, csak ennek az osztálynak az eredményeit láthatja. Módosítani, törölni és további hozzáférést adni nem tud.</p><form id="viewerGrantForm"><div class="fields"><label>E-mail-cím<input id="viewerEmail" type="email" required maxlength="254" autocomplete="off" placeholder="nev@toyota.hu"></label><label>Hozzáférés időtartama<select id="viewerLifetime"><option value="7">7 nap</option><option value="30" selected>30 nap</option><option value="90">90 nap</option><option value="">Visszavonásig</option></select></label></div><label class="viewer-names-option"><input id="viewerNames" type="checkbox"> Résztvevők és megfigyelők neve, szöveges visszajelzések is láthatók</label><p class="muted">Kikapcsolva jelölt résztvevők és pontszámok látszanak, szöveges visszajelzések nélkül. A résztvevők e-mail-címe egyik esetben sem látható.</p><button class="primary" id="saveViewer" type="button">Hozzáférés engedélyezése</button></form><p id="viewerGrantStatus" role="status"></p><div class="viewer-share"><h3>Belépési link</h3><p>Az engedélyezés után ezt a linket küldd el a megadott e-mail-cím tulajdonosának. Első belépéskor ezen a címen saját fiókot kell létrehoznia és megerősítenie.</p><label>Megosztható link<input id="viewerShareLink" readonly value="'+esc(viewerLink())+'"></label><button class="secondary" id="copyViewerLink">Link másolása</button><p class="muted">Az alkalmazás nem küld automatikus meghívólevelet. A link továbbadása önmagában nem ad hozzáférést.</p></div><h3>Engedélyezett betekintők</h3><div class="table-scroll"><table><thead><tr><th>E-mail-cím</th><th>Részletek</th><th>Lejárat</th><th>Állapot</th><th></th></tr></thead><tbody>'+rows.map(row=>'<tr><td>'+esc(row.email)+'</td><td>'+(row.show_names?'Névvel és visszajelzéssel':'Név nélkül')+'</td><td>'+(row.expires_at?localStamp(row.expires_at):'Visszavonásig')+'</td><td>'+(row.revoked_at?'Visszavonva':active(row)?'Aktív':'Lejárt')+'</td><td>'+(active(row)?'<button class="text-button danger-action" data-revoke-viewer="'+esc(row.id)+'">Visszavonás</button>':'')+'</td></tr>').join('')+(rows.length?'':'<tr><td colspan="5" class="muted">Ehhez az osztályhoz még nincs betekintő hozzáférés.</td></tr>')+'</tbody></table></div>');
 d.classList.add('viewer-access-dialog');
 action('saveViewer',async()=>{
  if(!$('viewerGrantForm').reportValidity())return;
  const recipient=$('viewerEmail').value.trim(),days=$('viewerLifetime').value;
  await api('/rest/v1/rpc/manage_viewer_access',{target:cls.id,recipient,names_visible:$('viewerNames').checked,lifetime_days:days?Number(days):null});
  d.close();d.remove();await viewerAccessDialog(cls);$('viewerGrantStatus').textContent='A hozzáférés engedélyezve: '+recipient+'. A belépési linket most elküldheted neki.';
 });
 $('viewerGrantForm').onsubmit=e=>{e.preventDefault();$('saveViewer').click();};
 action('copyViewerLink',async()=>{try{await navigator.clipboard.writeText(viewerLink());$('viewerGrantStatus').textContent='A belépési linket kimásoltuk. Az engedélyezett e-mail-címmel használható.';}catch{$('viewerShareLink').focus();$('viewerShareLink').select();$('viewerGrantStatus').textContent='Jelöld ki és másold ki a belépési linket.';}});
 d.querySelectorAll('[data-revoke-viewer]').forEach(b=>b.onclick=()=>{
  const row=rows.find(r=>r.id===b.dataset.revokeViewer);
  const confirm=modal('Betekintés visszavonása','<p><b>'+esc(row.email)+'</b> többé nem kérheti le ennek az osztálynak az eredményeit. Más osztályokhoz kapott engedélye változatlan marad.</p><button class="primary" id="confirmViewerRevoke">Hozzáférés visszavonása</button>');
  action('confirmViewerRevoke',async()=>{await api('/rest/v1/rpc/revoke_viewer_access',{target:row.id});confirm.close();confirm.remove();d.close();d.remove();await viewerAccessDialog(cls);$('viewerGrantStatus').textContent='A hozzáférést visszavontad.';});
 });
}
async function loadViewerWorkspace(selectedClass=classId,selectedOccasion=occasionId){
 let result,all=[];
 for(let offset=0;;offset+=500){
  const page=await api('/rest/v1/rpc/viewer_workspace',{target_class:selectedClass||null,target_occasion:selectedOccasion||null,row_offset:offset});
  if(!result)result=page;
  // A change of grants while paging must never mix old named records with a new scope.
  if(JSON.stringify(page.classes)!==JSON.stringify(result.classes)||page.class_id!==result.class_id||page.occasion_id!==result.occasion_id)throw requestError('A betekintési jogosultság közben megváltozott. Frissítsd a nézetet.',403,true);
  all.push(...page.entries);if(page.entries.length<500)return {...result,entries:all};
  selectedClass=result.class_id;selectedOccasion=result.occasion_id;
 }
}
function clearViewerData(){
 classes=[];occasions=[];entries=[];examData=null;classId='';occasionId='';projectionSnapshot=null;adminActive=false;clearTimeout(refreshTimer);++dashboardRequest;
 document.querySelectorAll('dialog').forEach(d=>d.remove());
 if(projectorWindow&&!projectorWindow.closed)projectorWindow.postMessage({type:'toyota-projection-cleared'},location.origin);
}
function viewerUnavailable(message){
 clearViewerData();document.body.classList.remove('admin-mode');
 $('app').innerHTML='<section class="panel"><div class="eyebrow">Betekintés</div><h1>Jelenleg nincs megnyitható eredmény</h1><p>'+esc(message)+'</p><div class="actions"><button class="primary" id="retryViewer">Elérhető osztályok frissítése</button><button class="secondary" id="viewerLogout">Kilépés</button></div></section>';
 action('retryViewer',viewerDashboard);$('viewerLogout').onclick=logoutViewer;
}
async function logoutViewer(){
 clearViewerData();try{await api('/auth/v1/logout',{});}catch{}finally{clearAdminSession();appRole=null;loginScreen();}
}
async function viewerDashboard(){
 clearTimeout(refreshTimer);const request=++dashboardRequest,restoreControls=Boolean($('projectionControlPanel'));
 try{
  const data=await loadViewerWorkspace();if(request!==dashboardRequest)return;
  if(!data.classes.length){viewerUnavailable('Nincs aktív engedélyed. Lehet, hogy lejárt vagy visszavonták. A tréner tud hozzáférést adni.');return;}
  const oldClass=classes.find(c=>c.id===classId),cls=data.classes.find(c=>c.id===data.class_id);
  if(oldClass&&oldClass.show_names!==cls.show_names){document.querySelectorAll('dialog').forEach(d=>d.remove());projectionSnapshot=null;if(projectorWindow&&!projectorWindow.closed)projectorWindow.postMessage({type:'toyota-projection-cleared'},location.origin);}
  if(projectionSnapshot?.classId===data.class_id&&projectionSnapshot?.occasionId===data.occasion_id&&projectionSnapshot.sourceIds?.some(id=>!data.entries.some(r=>r.id===id)))projectionSettings.frozen=false;
  classes=data.classes;classId=data.class_id;occasions=data.occasions;occasionId=data.occasion_id;entries=data.entries;examData=data.exam_results?{...data.exam_results,occasion_id:data.occasion_id}:null;refreshedAt=new Date();
  adminActive=true;document.body.classList.add('admin-mode');$('bottom').classList.add('hidden');
  const occasion=occasions.find(a=>a.id===occasionId);
  if(occasion)feedProjection(cls,occasion,entries);
  $('app').innerHTML='<aside class="admin-sidebar"><div class="eyebrow">Toyota · betekintés</div><h2>Osztályok</h2><p class="viewer-role">Csak olvasási hozzáférés</p><nav aria-label="Elérhető osztályok">'+classes.map(c=>'<button data-viewer-class="'+esc(c.id)+'" class="'+(c.id===classId?'selected':'')+'"><b>'+esc(c.name)+'</b><small>'+exams[c.kind].name+' · '+c.roster.length+' fő'+(c.closed_at?' · Lezárva':'')+'</small></button>').join('')+'</nav><button class="secondary" id="viewerLogout">Kilépés</button></aside><div class="admin-work"><div class="admin-heading"><div><div class="eyebrow">'+exams[cls.kind].name+' · Betekintés</div><h1>'+esc(cls.name)+'</h1></div><span class="closed-label">'+(cls.closed_at?'Lezárt osztály':'Csak megtekintés')+'</span></div><div class="viewer-access-note">'+(cls.show_names?'Névvel és szöveges visszajelzésekkel megosztott eredmények.':'Név nélkül megosztott eredmények. A jelölések résztvevőket különböztetnek meg; a szöveges visszajelzések rejtve vannak.')+'<span>'+(cls.access_expires_at?'Hozzáférés: '+localStamp(cls.access_expires_at)+'-ig':'Hozzáférés: visszavonásig')+'</span></div><div class="admin-session-tools"><div class="occasion-row"><label>Alkalmak szűrése<select id="viewerMode"><option value="all">Megfigyelés és vizsga</option><option value="practice">Csak megfigyelés</option><option value="exam">Csak vizsga</option></select></label><label>Alkalom<select id="viewerOccasions"></select></label><button class="secondary icon-refresh" id="viewerRefresh" aria-label="Eredmények frissítése">↻</button></div>'+(occasion?'<div class="toolbar"><button class="secondary" id="viewerProject">Eredmények kivetítése</button><span class="muted" role="status" id="liveStatus">Frissítve · '+localStamp(refreshedAt)+'</span></div>':'')+'</div><nav class="admin-tabs" aria-label="Eredmények nézetei"><button data-viewer-tab="overview">Áttekintés</button><button data-viewer-tab="results">Értékelések</button>'+(occasion?.mode==='exam'?'<button data-viewer-tab="exam">Vizsgaeredmények</button>':'')+'</nav><div id="viewerContent"></div></div>';
  $('viewerLogout').onclick=logoutViewer;
  action('viewerRefresh',viewerDashboard);
  $('viewerMode').value=viewerMode;
  const drawOccasions=()=>{$('viewerOccasions').innerHTML=selectOptions(occasions.filter(a=>viewerMode==='all'||a.mode===viewerMode).map(a=>({...a,name:modeName(a.mode)+' · '+a.name})),occasionId);};drawOccasions();
  $('viewerMode').onchange=()=>{viewerMode=$('viewerMode').value;const next=occasions.find(a=>viewerMode==='all'||a.mode===viewerMode);if(next){occasionId=next.id;viewerDashboard();}else{drawOccasions();if($('viewerProject'))$('viewerProject').disabled=true;$('viewerContent').innerHTML='<section class="panel empty"><h2>Ehhez a célhoz még nincs alkalom</h2><p>Válassz másik szűrőt.</p></section>';document.querySelector('#projectionControlPanel')?.remove();}};
  $('viewerOccasions').onchange=e=>{occasionId=e.target.value;viewerDashboard();};
  document.querySelectorAll('[data-viewer-class]').forEach(b=>b.onclick=()=>{classId=b.dataset.viewerClass;occasionId='';viewerMode='all';adminTab='overview';viewerDashboard();});
  document.querySelectorAll('[data-viewer-tab]').forEach(b=>b.onclick=()=>{adminTab=b.dataset.viewerTab;renderViewerContent(cls,occasion);});
  renderViewerContent(cls,occasion);
  if($('viewerProject'))$('viewerProject').disabled=viewerMode!=='all'&&occasion?.mode!==viewerMode;
  if(occasion&&(viewerMode==='all'||occasion.mode===viewerMode)){$('viewerProject').onclick=()=>projectionControls(cls,occasion);if(restoreControls&&projectionSnapshot?.classId===cls.id&&projectionSnapshot?.occasionId===occasion.id)projectionControls(cls,occasion,false);}
  refreshTimer=setTimeout(()=>{if(appRole==='viewer'&&adminActive)viewerDashboard();},20000);
 }catch(err){
  if(request!==dashboardRequest)return;
  if(err.status===403){viewerUnavailable(err.message);return;}
  if($('liveStatus'))$('liveStatus').textContent='A frissítés nem sikerült · az utolsó betöltött adatokat látod';else{document.body.classList.remove('admin-mode');$('app').innerHTML='<section class="panel"><h1>Most nem sikerült kapcsolódni</h1><p>'+esc(err.message)+'</p><div class="actions"><button class="primary" id="retryViewer">Újrapróbálás</button><button class="secondary" id="viewerLogout">Kilépés</button></div></section>';action('retryViewer',viewerDashboard);$('viewerLogout').onclick=logoutViewer;}
  if(adminSession&&appRole==='viewer')refreshTimer=setTimeout(viewerDashboard,20000);
 }
}
function renderViewerContent(cls,occasion){
 if(adminTab==='exam'&&occasion?.mode!=='exam')adminTab='overview';
 document.querySelectorAll('[data-viewer-tab]').forEach(b=>b.setAttribute('aria-current',b.dataset.viewerTab===adminTab?'page':'false'));
 if(viewerMode!=='all'&&occasion?.mode!==viewerMode){$('viewerContent').innerHTML='<section class="panel empty"><h2>Ehhez a célhoz még nincs alkalom</h2><p>Válassz másik szűrőt.</p></section>';return;}
 if(!occasion){$('viewerContent').innerHTML='<section class="panel empty"><h2>Még nincs megtekinthető alkalom</h2></section>';return;}
 if(adminTab==='exam'){$('viewerContent').innerHTML=examResultsPanel(cls,occasion,true);bindExamResults(cls,occasion,true);return;}
 $('viewerContent').innerHTML=adminTab==='results'?'<section class="panel"><h2>'+modeName(occasion.mode)+' · '+esc(occasion.name)+'</h2><p class="muted">Minden sor egy megfigyelő értékelése. A pontszámok a megfigyelők saját értékelései.</p>'+resultsTable(cls,occasion,entries)+'</section>':adminOverview(cls,occasion,entries,true);
 bindCriterionSetPicker(cls,entries,()=>{changeProjectionCriterionSet(cls,occasion);renderViewerContent(cls,occasion);},$('viewerContent'));
 if($('seeResults'))$('seeResults').onclick=()=>{adminTab='results';renderViewerContent(cls,occasion);};
 bindPeople(cls,occasion,entries);bindExamResults(cls,occasion,true);
}

window.addEventListener('toyota-session-expired',()=>{if(appRole==='viewer'){clearViewerData();loginScreen('A belépés lejárt. Jelentkezz be újra a betekintés folytatásához.');}});
