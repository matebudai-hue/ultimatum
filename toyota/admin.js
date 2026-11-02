function alertError(err){
 document.getElementById('appError')?.remove();
 const toast=document.createElement('div');toast.id='appError';toast.className='toast';toast.setAttribute('role','alert');
 const text=document.createElement('span');text.textContent='A művelet nem sikerült. '+err.message;
 const close=document.createElement('button');close.textContent='Bezárás';close.onclick=()=>toast.remove();toast.append(text,close);document.body.append(toast);
}
function action(id,fn){
 $(id).onclick=async e=>{
  const button=e.currentTarget,label=button.textContent;
  button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Folyamatban…';
  try{await fn();}catch(err){alertError(err);}finally{button.disabled=false;button.removeAttribute('aria-busy');if(button.textContent==='Folyamatban…')button.textContent=label;}
 };
}
function selectOptions(rows,current){return rows.map(r=>`<option value="${esc(r.id)}" ${r.id===current?'selected':''}>${esc(r.name)}</option>`).join('');}
async function startApp(){
 const recovering=route.get('type')==='recovery'||new URLSearchParams(location.search).get('recover')==='1';
 if(!invitation&&recovering){
  history.replaceState(null,'',location.pathname+'#admin');
  if(route.has('access_token')&&route.has('refresh_token')){try{await startPasswordRecovery({access_token:route.get('access_token'),refresh_token:route.get('refresh_token')});}catch(err){recoveryRequestScreen('',err.message);}return;}
  recoveryRequestScreen('',route.has('error')?'A helyreállító hivatkozás lejárt vagy már nem használható. Kérj új levelet.':'');return;
 }
 if(!invitation&&route.has('access_token')&&route.has('refresh_token')){
  history.replaceState(null,'',location.pathname+'#admin');
  try{await acceptAppSession({access_token:route.get('access_token'),refresh_token:route.get('refresh_token'),expires_at:Number(route.get('expires_at'))||Math.floor(Date.now()/1000)+Number(route.get('expires_in')||3600)});}catch(err){clearAdminSession();loginScreen(err.message);}return;
 }
 if(!invitation&&(route.has('admin')||new URLSearchParams(location.search).has('admin')||route.has('access_token'))){history.replaceState(null,'',location.pathname+'#admin');await restoreAdmin();return;}
 if(!invitation){render();return;}
 try{
  context=demo?{className:'Mintaosztály',occasion:'Bemutató alkalom',kind:route.get('kind')==='passenger'?'passenger':'fleet',mode:'practice',roster:['Minta Anna','Minta Péter']}:await api(occasionLink?'/rest/v1/rpc/occasion_context':'/rest/v1/rpc/observation_context',{link:invitation});
  if(!context)throw Error('Ez a meghívó nem érvényes.');
  if(context.closed){$('bottom').classList.add('hidden');$('app').innerHTML='<section class="panel"><h1>Ez az alkalom lezárult</h1><p>Új értékelést már nem lehet beküldeni. A korábban beküldött eredmények megmaradtak.</p></section>';return;}
  if(!state.type)state=fresh(context.kind);
  state.observer=context.observer||state.observer;
  choosing=false;render();
 }catch(err){$('app').innerHTML='<section class="panel"><h1>A megfigyelés nem nyitható meg</h1><p>'+esc(err.message)+'</p><button class="secondary" id="retryLink">Újrapróbálás</button></section>';$('retryLink').onclick=startApp;}
}
function loginScreen(message=''){
 if(appRole==='viewer')clearViewerData();appRole=null;adminActive=false;clearTimeout(refreshTimer);
 document.body.classList.remove('admin-mode');
 $('bottom').classList.add('hidden');
 $('app').innerHTML=`<h1>Belépés</h1><p>Tréneri adminisztráció és engedélyezett Toyota-betekintés.</p><div class="panel"><form id="adminForm"><label>E-mail<input id="mail" type="email" autocomplete="username" required></label><label>Jelszó<input id="pw" type="password" autocomplete="current-password" required></label><button class="primary" type="submit" id="login">Belépés</button></form><p><button class="text-button" id="forgotPassword" type="button">Elfelejtettem a jelszavam</button></p><p id="authMsg" role="status"></p><details id="activation"><summary>Fiók aktiválása</summary><p>Ha már regisztráltál, erősítsd meg a címed a regisztrációs levélben. Ezután itt léphetsz be a megadott jelszóval.</p><button class="secondary" id="resend">Új megerősítő levél kérése</button><details><summary>A levélben lévő gomb nem működik</summary><p>Másold ki a legutóbbi levél megerősítő gombjának hivatkozását, és illeszd ide.</p><label>Megerősítő hivatkozás<input id="confirmUrl" type="password" autocomplete="off"></label><button class="secondary" id="verify">Cím megerősítése</button></details></details><details><summary>Első regisztráció</summary><p>A hozzáféréshez engedélyezett e-mail-címedet és egy saját jelszót adj meg fent. A regisztráció önmagában nem ad betekintési jogot.</p><button class="secondary" id="register">Fiók létrehozása</button></details></div><a href="./">Megfigyelés indítása</a>`;
 $('authMsg').textContent=message;
 $('forgotPassword').onclick=()=>recoveryRequestScreen($('mail').value.trim());
 const credentials=()=>({email:$('mail').value.trim(),password:$('pw').value});
 const redirect='?redirect_to='+encodeURIComponent(location.href.split('#')[0]+'?admin=1');
 function authAction(id,fn){
  $(id).onclick=async e=>{
   e.preventDefault();const b=e.currentTarget;b.disabled=true;$('authMsg').textContent='Egy pillanat…';
   try{await fn();}
   catch(err){
    const msg=err.message;
    if(/rate limit|too many|after \d+ seconds/i.test(msg))$('authMsg').textContent='A levélküldés átmenetileg korlátozott. Használd a legutóbbi megerősítő levelet, vagy próbáld meg később.';
    else if(/not confirmed|invalid login credentials/i.test(msg)){$('activation').open=true;$('authMsg').textContent='A belépés nem sikerült. Ellenőrizd a jelszót, és ha még nem tetted, erősítsd meg az e-mail-címed.';}
    else $('authMsg').textContent=msg;
   }finally{b.disabled=false;}
  };
 }
 const enter=acceptAppSession;
 authAction('login',async()=>{if(!$('adminForm').reportValidity())throw Error('Add meg az e-mail-címed és a jelszavad.');await enter(await api('/auth/v1/token?grant_type=password',credentials()));});
 $('adminForm').onsubmit=e=>{e.preventDefault();$('login').click();};
 authAction('register',async()=>{if(!$('adminForm').reportValidity())throw Error('Add meg az e-mail-címed és a jelszavad.');await api('/auth/v1/signup'+redirect,credentials());$('activation').open=true;$('authMsg').textContent='A következő lépés az e-mail-címed megerősítése. Ellenőrizd a levélszemét mappát is.';});
 authAction('resend',async()=>{if(!$('mail').reportValidity())throw Error('Add meg az adminisztrátori e-mail-címed.');await api('/auth/v1/resend'+redirect,{type:'signup',email:credentials().email});$('authMsg').textContent='Megerősítő levél kérve. A legújabb levél hivatkozását használd.';});
 authAction('verify',async()=>{
  let u;try{u=new URL($('confirmUrl').value.trim());}catch{throw Error('A levélben lévő megerősítő gomb teljes hivatkozását illeszd be.');}
  const token=u.searchParams.get('token');
  if(u.origin!==apiRoot||u.pathname!=='/auth/v1/verify'||!token||u.searchParams.get('type')!=='signup')throw Error('Ez nem a Toyota-projekt regisztrációs hivatkozása.');
  $('confirmUrl').value='';
  await enter(await api('/auth/v1/verify',{token_hash:token,type:'signup'}));
 });
}

function parseRoster(text){
 const names=[],contacts={};
 for(const line of text.split(/\r?\n/)){
  if(!line.trim())continue;
  const parts=line.split(/[\t;,]/).map(v=>v.trim().replace(/^"|"$/g,''));
  const name=parts[0], email=parts[1]||'';
  if(!name||names.includes(name))throw Error('Minden név egyszer szerepeljen. Azonos nevű résztvevőknél adj megkülönböztető jelölést.');
  if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Error('Hibás e-mail-cím: '+name);
  names.push(name);if(email)contacts[name]=email;
 }
 return {names,contacts};
}
function criterionMeans(cls,records){const group=selectedCriterionSet(cls,records);return group.unresolved?[]:ToyStats.criteria(group.items,cls.roster,group.records);}
function groupReport(cls,occasion,records){
 const selected=selectedCriterionSet(cls,records);records=selected.records;
 const rank=criterionMeans(cls,records);
 const format=r=>r.title+' · '+r.mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+'/2';
 const observed=new Set(records.map(r=>r.seller)).size;
 return [cls.name,...(selected.groups.length>1?[selected.label+' · elkülönített összesítés']:[]),modeName(occasion.mode)+' · '+occasion.name,'Összesítés ideje: '+new Date().toLocaleString('hu-HU'),'Megfigyelt résztvevők: '+observed+'/'+cls.roster.length,'Beküldések: '+records.length,'',...(rank.length?['Legmagasabb értékelések',...rank.filter(r=>Math.abs(r.mean-rank[0].mean)<1e-9).map(format),'','Legalacsonyabb értékelések',...rank.filter(r=>Math.abs(r.mean-rank.at(-1).mean)<1e-9).map(format),'','Minden szempont',...rank.map(format)]:[selected.unresolved?'Az eredeti szempontlista hiányzik; szempontonkénti összesítés nem készíthető.':'Még nincs beküldés.'])].join('\n');
}

let adminTab='overview', refreshTimer=null, dashboardRequest=0, adminActive=false, refreshedAt=null, rosterDirty=false;
function leaveRoster(){return !rosterDirty||confirm('A névsor módosításai még nincsenek mentve. Elhagyod ezt a nézetet?');}
function localStamp(value){return new Date(value).toLocaleString('hu-HU',{timeZone:'Europe/Budapest'});}
function modal(title,body){
 const dialog=document.createElement('dialog');dialog.className='admin-dialog';
 dialog.innerHTML='<div class="dialog-head"><h2>'+esc(title)+'</h2><button class="secondary" data-close>Bezárás</button></div>'+body;
 document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();return dialog;
}
function criterionChart(cls,records){
 const rank=criterionMeans(cls,records);
 if(!rank.length)return '<p class="empty">A szempontok összesítése az első beküldés után jelenik meg.</p>';
 return '<p class="muted">Átlag 0–2 pont között · minden megfigyelt értékesítő azonos súllyal szerepel</p><div class="criteria">'+rank.map((r,i)=>'<div class="criterion"><span>'+esc(r.title)+'</span><div class="bar"><i style="width:'+r.mean*50+'%"></i></div><b>'+r.mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+'</b></div>').join('')+'</div>';
}
function adminOverview(cls,occasion,records,readOnly=false){
 const picker=criterionSetPicker(cls,records),selected=selectedCriterionSet(cls,records);records=selected.records;
 const observed=new Set(records.map(r=>r.seller)).size,rank=criterionMeans(cls,records);
 const score=r=>ToyStats.total(r.scores);
 const stats='<div class="stats"><section class="panel"><span>Megfigyelt résztvevők</span><b class="metric">'+observed+'<small> / '+cls.roster.length+'</small></b></section><section class="panel"><span>Beküldött értékelések</span><b class="metric">'+records.length+'</b></section><section class="panel"><span>'+(occasion.mode==='exam'?'25 pontot elérő értékelések':'Résztvevők pontátlaga')+'</span><b class="metric">'+(occasion.mode==='exam'?records.filter(r=>score(r)>=25).length+'<small> / '+records.length+'</small>':records.length?(ToyStats.meanTotal(cls.roster,records)).toLocaleString('hu-HU',{maximumFractionDigits:1})+'<small> / 40</small>':'—')+'</b></section></div>';
 if(selected.unresolved)return picker+stats+examSummaryLink(occasion)+'<section class="panel"><h2>Az eredeti szempontlista nem azonosítható</h2><p>A pontszámok megmaradtak, de a szempontok címét nem helyettesítjük egy másik listával.</p><button class="secondary" id="seeResults">Értékelések megtekintése</button></section>';
 if(!rank.length)return picker+stats+examSummaryLink(occasion)+'<section class="panel waiting-state"><span class="waiting-dot"></span><h2>Várjuk az első értékelést</h2><p>'+(readOnly?'Az összesítés az első beküldés után jelenik meg.':'Vetítsd ki a QR-kódot. A beérkezett eredmények itt automatikusan megjelennek.')+'</p></section><button hidden id="seeResults">Eredmények</button>';
 const equal=Math.abs(rank[0].mean-rank.at(-1).mean)<1e-9;
 function highlight(title,items,style){
 const displayed=items.slice(0,3),ties=items.filter(r=>Math.abs(r.mean-displayed.at(-1).mean)<1e-9).length-displayed.filter(r=>Math.abs(r.mean-displayed.at(-1).mean)<1e-9).length;
 return '<section class="panel '+style+'"><h2>'+title+'</h2><ul class="topthree-list">'+displayed.map(r=>'<li><span>'+esc(r.title)+'</span><b>'+r.mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+'<small> / 2</small></b></li>').join('')+'</ul>'+(ties?'<p class="muted">+'+ties+' szempont azonos értékkel</p>':'')+(items.length>3?'<details class="ranking-more" id="ranking-'+style+'"><summary>További '+(items.length-3)+' szempont</summary><ul class="topthree-list">'+items.slice(3).map(r=>'<li><span>'+esc(r.title)+'</span><b>'+r.mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+'<small> / 2</small></b></li>').join('')+'</ul></details>':'')+'</section>';
 }
 const highlights=equal?'<section class="panel summary-neutral"><b>Minden szempont átlaga azonos · '+rank[0].mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+' / 2</b><p>A részleteket a szempontok megoszlásában nézheted meg.</p></section>':'<div class="highlights">'+highlight('Erősségek',rank,'strong')+highlight('Fejlesztési fókuszok',[...rank].sort((a,b)=>a.mean-b.mean),'weak')+'</div>';
 return picker+stats+examSummaryLink(occasion)+'<div class="overview-work"><section class="panel participant-status"><div class="section-head"><h2>Résztvevők állapota</h2><button class="text-button" id="seeResults">Részletek →</button></div>'+participantStatusTable(cls,occasion,records)+'</section><aside>'+highlights+'</aside></div><details class="panel all-criteria" id="allCriteria"><summary>Mind a 20 szempont részletesen</summary>'+criterionChart(cls,records)+'</details>';

}

function participantStatusTable(cls,occasion,records){
 return '<div class="table-scroll"><table class="participant-table"><thead><tr><th>Értékesítő</th><th>Db</th><th>Pontok / 40</th><th>Megfigyelők</th><th>Legutóbb</th></tr></thead><tbody>'+cls.roster.map(name=>{
 const rows=records.filter(r=>r.seller===name).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 if(!rows.length)return '<tr><td>'+esc(name)+'</td><td>0</td><td colspan="3" class="missing">Még nincs beküldés</td></tr>';
 return '<tr><td><button class="text-button" data-person="'+esc(name)+'">'+esc(name)+'</button></td><td><span class="record-count">'+rows.length+'</span></td><td class="score-values">'+rows.map(r=>ToyStats.total(r.scores)).join(' · ')+'</td><td class="observers">'+[...new Set(rows.map(r=>esc(r.observers.name)))].join(', ')+'</td><td><time title="'+localStamp(rows[0].created_at)+'">'+new Date(rows[0].created_at).toLocaleTimeString('hu-HU',{timeZone:'Europe/Budapest',hour:'2-digit',minute:'2-digit',second:'2-digit'})+'</time></td></tr>';
 }).join('')+'</tbody></table></div>';
}

function resultsTable(cls,occasion,records,includeMissing=true){
 const editable=appRole==='admin';
 const rows=records.map(r=>{
 const total=ToyStats.total(r.scores);
 return '<tr><td><button class="text-button" data-person="'+esc(r.seller)+'">'+esc(r.seller)+'</button></td><td>'+esc(r.observers.name)+'</td><td><b>'+total+'/40</b></td><td>'+(occasion.mode==='exam'?'<span class="pill '+(total>=25?'ok':'low')+'">'+(total>=25?'Megfelelt':'Nem felelt meg')+'</span>':'Megfigyelés')+'</td><td>'+localStamp(r.created_at)+'</td>'+(editable?'<td><button class="text-button danger-action" data-withdraw-record="'+esc(r.id)+'" aria-label="Értékelés törlése · '+esc(r.seller)+' · '+esc(r.observers.name)+'">Törlés</button></td>':'')+'</tr>';
 });
 if(includeMissing)for(const name of cls.roster)if(!records.some(r=>r.seller===name))rows.push('<tr><td>'+esc(name)+'</td><td colspan="'+(editable?5:4)+'" class="muted">Még nincs beküldés</td></tr>');
 return '<div class="table-scroll"><table><thead><tr><th>Értékesítő</th><th>Megfigyelő</th><th>Pontszám</th><th>'+(occasion.mode==='exam'?'Pontküszöb':'Típus')+'</th><th>Beküldés időpontja</th>'+(editable?'<th>Művelet</th>':'')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
async function dashboard(){
 if(appRole==='viewer')return viewerDashboard();
 adminActive=true;document.body.classList.add('admin-mode');
 const restoreControls=Boolean($('projectionControlPanel'));
 const request=++dashboardRequest;
 const loaded=await api('/rest/v1/classes?select=*&order=created_at.desc');
 if(request!==dashboardRequest)return;
 classes=loaded;if(!classes.some(c=>c.id===classId))classId=classes[0]?.id||'';
 const cls=classes.find(c=>c.id===classId);
 const loadedOcc=cls?await api('/rest/v1/occasions?class_id=eq.'+classId+'&order=created_at.desc'):[];
 if(request!==dashboardRequest)return;
 occasions=loadedOcc;if(!occasions.some(a=>a.id===occasionId))occasionId=occasions[0]?.id||'';
 const occasion=occasions.find(a=>a.id===occasionId);
 const [loadedEntries,loadedExam]=await Promise.all([occasion?readEntries(occasionId):[],readExamResults(occasion)]);
 if(request!==dashboardRequest)return;
 entries=loadedEntries;examData=loadedExam;refreshedAt=new Date();if(cls&&occasion)feedProjection(cls,occasion,entries);
 $('bottom').classList.add('hidden');
 $('app').innerHTML='<aside class="admin-sidebar"><div class="eyebrow">Adminisztráció</div><h2>Osztályok</h2><button class="primary" id="newClass">+ Új osztály</button><nav aria-label="Osztályok">'+classes.map(c=>'<button data-class="'+c.id+'" class="'+(c.id===classId?'selected':'')+'"><b>'+esc(c.name)+'</b><small>'+exams[c.kind].name+' · '+c.roster.length+' fő'+(c.closed_at?' · Lezárva':'')+'</small></button>').join('')+'</nav><button class="secondary" id="logout">Kilépés</button></aside><div class="admin-work"><div class="admin-heading"><div><div class="eyebrow">'+(cls?exams[cls.kind].name:'Toyota')+'</div><h1>'+esc(cls?.name||'Hozd létre az első osztályt')+'</h1></div>'+(cls?'<details class="more-menu class-menu"><summary>Osztály beállításai</summary><div><button id="viewerAccess">Betekintő hozzáférés</button><button id="toggleClassClosed">'+(cls.closed_at?'Osztály újranyitása':'Osztály lezárása')+'</button><button id="deleteClass" class="danger-action">Osztály törlése</button></div></details>':'')+'</div>'+(cls?'<div class="admin-session-tools"><div class="occasion-row"><label>Aktuális alkalom<select id="occasions">'+selectOptions(occasions.map(a=>({...a,name:modeName(a.mode)+' · '+a.name})),occasionId)+'</select></label><span id="liveStatus" class="muted" role="status">Automatikusan frissül · '+new Date(refreshedAt).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})+'</span><button class="secondary icon-refresh" id="refresh" aria-label="Eredmények frissítése" title="Frissítés">↻</button></div>':'')+(occasion?'<div class="toolbar"><button class="secondary" id="newOcc" '+(cls.closed_at?'disabled':'')+'>+ Új alkalom</button><button class="primary" id="showQr" '+(cls.closed_at||occasion.closed_at?'disabled':'')+'>'+(cls.closed_at||occasion.closed_at?'Lezárt QR-kód':'Csatlakozás · QR-kód')+'</button><button class="secondary" id="projectSummary">Eredmények kivetítése</button><details class="more-menu"><summary>További műveletek</summary><div><a href="./#occasion='+occasion.id+'&preview=1" target="_blank" rel="noopener">Megfigyelői előnézet ↗</a><button id="toggleOccasionClosed">'+(occasion.closed_at?'Alkalom újranyitása':'Alkalom lezárása')+'</button><button id="copyOcc">Csatlakozási link másolása</button><button id="mailSummary">Összesítés e-mailben</button><button id="withdrawnObservations">Törölt értékelések</button></div></details></div>':'')+(cls?'</div><nav class="admin-tabs" aria-label="Osztály nézetei">'+[['overview','Áttekintés'],['results','Értékelések'],['roster','Névsor'],...(occasion?.mode==='exam'?[['exam','Vizsgaeredmények']]:[])].map(([key,name])=>'<button data-tab="'+key+'" aria-current="'+(key===adminTab?'page':'false')+'">'+name+'</button>').join('')+'</nav><div id="adminContent"></div>':'<section class="panel empty"><h2>Az osztályból indul a közös munka</h2><p>Adj nevet az osztálynak, illeszd be a névsort, majd válaszd ki a megfigyelést vagy a vizsgát. A közös QR-kód rögtön elkészül.</p><p><a href="./#preview=1&kind=fleet" target="_blank" rel="noopener">Flottás előnézet ↗</a> · <a href="./#preview=1&kind=passenger" target="_blank" rel="noopener">Személyautós előnézet ↗</a></p></section>')+'</div>';
 $('newClass').onclick=()=>{if(leaveRoster())createClassDialog();};
 action('logout',async()=>{if(!leaveRoster())return;adminActive=false;clearTimeout(refreshTimer);try{await api('/auth/v1/logout',{});}finally{clearAdminSession();location.replace('./#admin');location.reload();}});
 if(cls){
 action('deleteClass',async()=>{if(leaveRoster())await deleteClassDialog(cls);});
 if($('newOcc'))$('newOcc').onclick=()=>{if(leaveRoster())createOccasionDialog(cls);};
 action('viewerAccess',()=>viewerAccessDialog(cls));
 $('toggleClassClosed').onclick=()=>closureDialog('class',cls);
 if(cls.closed_at){$('app').querySelector('.admin-heading h1').insertAdjacentHTML('afterend','<span class="closed-label">Lezárt osztály · eredmények megtekinthetők</span>');}
 $('occasions').onchange=e=>{if(!leaveRoster()){e.target.value=occasionId;return;}rosterDirty=false;occasionId=e.target.value;dashboard().catch(alertError);};
 action('refresh',async()=>{if(leaveRoster()){rosterDirty=false;await dashboard();}});
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(!leaveRoster())return;rosterDirty=false;adminTab=b.dataset.tab;renderAdminContent(cls,occasion);});
 renderAdminContent(cls,occasion);
 }
 document.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{if(!leaveRoster())return;rosterDirty=false;classId=b.dataset.class;occasionId='';adminTab='overview';dashboard().catch(alertError);});
 if(occasion){
 const link=location.origin+location.pathname+'#occasion='+occasion.id;
 $('showQr').onclick=()=>{const d=modal(cls.name+' · '+modeName(occasion.mode),'<p>'+esc(occasion.name)+'</p><canvas id="projectQr" aria-label="Az alkalom közös QR-kódja"></canvas><p>Olvasd be, add meg a saját neved, majd válaszd ki, kit figyelsz meg.</p>');d.classList.add('projection');drawQr(d.querySelector('canvas'),link);};
 action('copyOcc',async()=>{try{await navigator.clipboard.writeText(link);$('copyOcc').textContent='Kimásolva';setTimeout(()=>{if($('copyOcc'))$('copyOcc').textContent='Csatlakozási link másolása';},2500);}catch{prompt('Másold ki a linket:',link);}});
 $('projectSummary').onclick=()=>projectionControls(cls,occasion);
 $('toggleOccasionClosed').onclick=()=>closureDialog('occasion',occasion,cls);
 $('toggleOccasionClosed').disabled=Boolean(cls.closed_at);
 if(cls.closed_at||occasion.closed_at)$('liveStatus').textContent=(cls.closed_at?'Lezárt osztály':'Lezárt alkalom')+' · új beküldést nem fogad';
 if(restoreControls&&projectionSnapshot?.classId===cls.id&&projectionSnapshot?.occasionId===occasion.id)projectionControls(cls,occasion,false);
 $('mailSummary').onclick=()=>emailSummary(cls,occasion,entries);
 action('withdrawnObservations',()=>withdrawnObservationsDialog(cls,occasion));
 }
 scheduleRefresh();
}
function drawQr(canvas,link){
 const qr=new ToyotaQRCode(-1,0);qr.addData(link);qr.make();const n=qr.getModuleCount();
 canvas.width=canvas.height=(n+8)*12;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))ctx.fillRect((x+4)*12,(y+4)*12,12,12);
}
function emailSummary(cls,occasion,records){
 const recipients=cls.roster.map(n=>cls.contacts?.[n]).filter(Boolean),subject=cls.name+' · '+modeName(occasion.mode)+' · '+occasion.name;
 const body=groupReport(cls,occasion,records);
 const dialog=modal('Összesítés küldése','<p>'+recipients.length+' címzett. A címek titkos másolatba kerülnek.</p><label>A levél szövege<textarea id="mailBody" rows="14"></textarea></label><p><button class="primary" id="openMail">Megnyitás a levelezőben</button></p>');
 dialog.querySelector('textarea').value=body;
 dialog.querySelector('#openMail').onclick=()=>{location.href='mailto:?bcc='+encodeURIComponent(recipients.join(','))+'&subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(dialog.querySelector('textarea').value);};
}
function renderAdminContent(cls,occasion){
 if(adminTab==='exam'&&occasion?.mode!=='exam')adminTab='overview';
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===adminTab?'page':'false'));
 const content=$('adminContent');
 if(adminTab==='roster'&&cls.closed_at){content.innerHTML='<section class="panel"><h2>Névsor · lezárt osztály</h2><p>A névsor szerkesztéséhez előbb nyisd újra az osztályt.</p><table><thead><tr><th>Név</th><th>E-mail-cím</th></tr></thead><tbody>'+cls.roster.map(name=>'<tr><td>'+esc(name)+'</td><td>'+esc(cls.contacts?.[name]||'—')+'</td></tr>').join('')+'</tbody></table></section>';return;}
 if(adminTab==='roster'){
 content.innerHTML='<section class="panel"><div class="section-head"><h2>Névsor · '+cls.roster.length+' fő</h2><button class="secondary" id="pasteRoster">Névsor beillesztése</button></div><p class="muted">A név módosítása a korábbi értékeléseknél is érvényesül.</p><div class="table-scroll"><table><thead><tr><th>Név</th><th>E-mail-cím</th></tr></thead><tbody id="rosterRows"></tbody></table></div><p><button class="secondary" id="addPerson">+ Résztvevő</button> <button class="primary" id="saveRoster">Névsor mentése</button></p></section>';
 let draft=cls.roster.map(name=>({original:name,name,email:cls.contacts?.[name]||''}));
 const draw=()=>{$('rosterRows').innerHTML=draft.map((p,i)=>'<tr><td><input aria-label="Név '+(i+1)+'" data-name="'+i+'" value="'+esc(p.name)+'"></td><td><input aria-label="E-mail '+(i+1)+'" type="email" data-email="'+i+'" value="'+esc(p.email)+'"></td></tr>').join('');document.querySelectorAll('[data-name]').forEach(el=>el.oninput=()=>{draft[Number(el.dataset.name)].name=el.value;rosterDirty=true;});document.querySelectorAll('[data-email]').forEach(el=>el.oninput=()=>{draft[Number(el.dataset.email)].email=el.value;rosterDirty=true;});};
 draw();$('addPerson').onclick=()=>{draft.push({original:null,name:'',email:''});rosterDirty=true;draw();};
 $('pasteRoster').onclick=()=>{const d=modal('Névsor beillesztése','<p>Soronként egy név és opcionális e-mail-cím. Excelből két oszlopot is bemásolhatsz. A meglévő e-mail-címek megmaradnak, ha csak neveket illesztesz be. Megadott új címmel frissítheted őket.</p><textarea id="pasteText" rows="10"></textarea><p><button class="primary" id="applyPaste">Beillesztés</button></p>');d.querySelector('#applyPaste').onclick=()=>{try{const p=parseRoster(d.querySelector('textarea').value);for(const name of p.names){const existing=draft.find(x=>x.name===name);if(existing){if(Object.hasOwn(p.contacts,name))existing.email=p.contacts[name];}else draft.push({original:null,name,email:p.contacts[name]||''});}rosterDirty=true;draw();d.close();}catch(e){alertError(e);}};};
 action('saveRoster',async()=>{const parsed=parseRoster(draft.map(p=>p.name.trim()+String.fromCharCode(9)+p.email.trim()).join(String.fromCharCode(10)));if(parsed.names.length!==draft.length)throw Error('Minden résztvevőnek adj nevet.');
 await api('/rest/v1/rpc/update_class_roster',{target:cls.id,changes:draft.map(p=>({original:p.original,name:p.name.trim(),email:p.email.trim()}))});rosterDirty=false;await dashboard();});
 return;
 }
 if(!occasion){content.innerHTML='<section class="panel"><h2>Hozz létre egy alkalmat</h2><p>A megfigyeléshez vagy vizsgához saját QR-kód és eredménylista tartozik.</p></section>';return;}
 if(adminTab==='exam'){content.innerHTML=examResultsPanel(cls,occasion);bindExamResults(cls,occasion);return;}
 if(adminTab==='overview'){
 const chartOpen=Boolean($('allCriteria')?.open),strongOpen=Boolean($('ranking-strong')?.open),weakOpen=Boolean($('ranking-weak')?.open);
 content.innerHTML=adminOverview(cls,occasion,entries);bindCriterionSetPicker(cls,entries,()=>{changeProjectionCriterionSet(cls,occasion);renderAdminContent(cls,occasion);},content);if($('allCriteria'))$('allCriteria').open=chartOpen;if($('ranking-strong'))$('ranking-strong').open=strongOpen;if($('ranking-weak'))$('ranking-weak').open=weakOpen;
 $('seeResults').onclick=()=>{adminTab='results';renderAdminContent(cls,occasion);};
 }else{
 content.innerHTML='<section class="panel"><div class="section-head"><h2>Egyéni eredmények</h2><select id="scope" aria-label="Eredmények köre"><option value="current">Aktuális alkalom</option><option value="practice">Az osztály összes megfigyelése</option><option value="exam">Az osztály összes vizsgája</option></select></div><p class="muted">Kattints az értékesítő nevére a megfigyelők értékeléseinek összehasonlításához.</p><div id="resultRecords">'+resultsTable(cls,occasion,entries)+'</div></section>';
 $('scope').onchange=async e=>{const scope=e.target.value,selectedClass=classId,selectedOccasion=occasionId;try{const records=scope==='current'?entries:(await Promise.all(occasions.filter(a=>a.mode===scope).map(a=>readEntries(a.id)))).flat();if(!$('resultRecords')||selectedClass!==classId||selectedOccasion!==occasionId||$('scope')?.value!==scope)return;$('resultRecords').innerHTML=resultsTable(cls,{mode:scope==='current'?occasion.mode:scope},records);bindPeople(cls,{mode:scope==='current'?occasion.mode:scope},records);}catch(err){alertError(err);}};
 }
 bindPeople(cls,occasion,entries);bindExamResults(cls,occasion);
}
function bindPeople(cls,occasion,records){document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>showPerson(cls,occasion,b.dataset.person,records));document.querySelectorAll('[data-withdraw-record]').forEach(b=>b.onclick=()=>withdrawObservationDialog(cls,records.find(r=>r.id===b.dataset.withdrawRecord)));}
async function deleteClassDialog(cls){
 const all=await api('/rest/v1/occasions?class_id=eq.'+cls.id);
 const records=(await Promise.all(all.map(async a=>(await Promise.all([readEntries(a.id),readWithdrawnEntries(a.id)])).flat()))).flat();
 const dialog=modal('Osztály törlése','<p><b>'+esc(cls.name)+'</b> · '+cls.roster.length+' résztvevő · '+all.length+' alkalom · '+records.length+' beküldött értékelés</p><p>Az osztály és az összes hozzá tartozó névsor, alkalom, értékelés végleg törlődik. A QR-kódjai ezután nem használhatók.</p><label>A törléshez írd be az osztály nevét<input id="deleteConfirmation" autocomplete="off"></label><p><button class="primary" id="confirmDelete" disabled>Osztály végleges törlése</button></p>');
 dialog.querySelector('#deleteConfirmation').oninput=e=>{dialog.querySelector('#confirmDelete').disabled=e.target.value!==cls.name;};
 action('confirmDelete',async()=>{await api('/rest/v1/rpc/delete_observation_class',{target:cls.id,confirmation:dialog.querySelector('#deleteConfirmation').value});rosterDirty=false;classId='';occasionId='';adminTab='overview';dialog.close();await dashboard();});
}

function createClassDialog(){
 const d=modal('Új osztály','<label>Osztály neve<input id="className" placeholder="Például Toyota · november"></label><div class="fields"><label>Értékesítés típusa<select id="kind"><option value="fleet">Flotta</option><option value="passenger">Személyautó</option></select></label><label>Első alkalom<select id="firstMode"><option value="practice">Megfigyelés</option><option value="exam">Vizsga</option></select></label></div><label>Névsor<textarea id="roster" rows="8" placeholder="Név és opcionális e-mail-cím · soronként egy résztvevő"></textarea></label><p class="muted">Excelből két oszlop is beilleszthető.</p><label>Vagy TXT / CSV feltöltése<input id="file" type="file" accept=".txt,.csv"></label><p><button class="primary" id="saveClass">Osztály és QR-kód létrehozása</button></p>');
 d.querySelector('#file').onchange=async e=>{if(e.target.files[0])d.querySelector('#roster').value=await decodeRosterFile(e.target.files[0]);};
 action('saveClass',async()=>{const name=$('className').value.trim(),p=parseRoster($('roster').value);if(!name||!p.names.length)throw Error('Adj nevet az osztálynak és illeszd be a névsort.');const result=await api('/rest/v1/rpc/create_observation_class',{class_name:name,class_kind:$('kind').value,names:p.names,emails:p.contacts,occasion_mode:$('firstMode').value});classId=result.class_id;occasionId=result.occasion_id;adminTab='overview';d.close();await dashboard();});
}
function createOccasionDialog(cls){
 const d=modal('Új alkalom · '+cls.name,'<label>Alkalom neve vagy dátuma<input id="occasionName" value="'+new Date().toLocaleDateString('hu-HU')+'"></label><label>Cél<select id="mode"><option value="practice">Megfigyelés</option><option value="exam">Vizsga</option></select></label><p><button class="primary" id="saveOcc">Alkalom és QR-kód létrehozása</button></p>');
 action('saveOcc',async()=>{const name=$('occasionName').value.trim();if(!name)throw Error('Adj nevet az alkalomnak.');const id=crypto.randomUUID();await api('/rest/v1/occasions',{id,class_id:cls.id,name,mode:$('mode').value});occasionId=id;adminTab='overview';d.close();await dashboard();});
}
function scheduleRefresh(){
 clearTimeout(refreshTimer);
 refreshTimer=setTimeout(async()=>{
 if(!adminActive)return;
 const target=occasionId,cls=classes.find(c=>c.id===classId),occasion=occasions.find(a=>a.id===target);
 if((!document.hidden||(projectorWindow&&!projectorWindow.closed))&&occasion){
 try{const [loaded,loadedExam]=await Promise.all([readEntries(target),readExamResults(occasion)]);if(target===occasionId){
 entries=loaded;examData=loadedExam;refreshedAt=new Date();feedProjection(cls,occasion,entries);if($('liveStatus'))$('liveStatus').textContent=(cls.closed_at?'Lezárt osztály':occasion.closed_at?'Lezárt alkalom':'Automatikusan frissül')+' · '+new Date(refreshedAt).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})+'';
 if(!document.querySelector('dialog[open]')&&['overview','exam'].includes(adminTab))renderAdminContent(cls,occasion);
 if(!document.querySelector('dialog[open]')&&adminTab==='results'&&$('scope')?.value==='current')renderAdminContent(cls,occasion);
 }}catch(err){if($('liveStatus'))$('liveStatus').textContent='A frissítés nem sikerült. Próbáld a Frissítés gombbal.';}
 }scheduleRefresh();
 },20000);
}

async function readEntries(id){
 const all=[];for(let offset=0;;offset+=500){const page=await api('/rest/v1/observations?select=*,observers!inner(occasion_id,name)&observers.occasion_id=eq.'+id+'&withdrawn_at=is.null&order=created_at,id&limit=500&offset='+offset);all.push(...page);if(page.length<500)return all;}
}
async function decodeRosterFile(file){
 const bytes=await file.arrayBuffer();
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}
 catch{return new TextDecoder('windows-1250').decode(bytes);}
}
window.addEventListener('beforeunload',e=>{if(rosterDirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('click',e=>{document.querySelectorAll('.more-menu[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false;});});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.more-menu[open]').forEach(menu=>menu.open=false);});
window.addEventListener('toyota-session-expired',()=>{
 if(!adminActive)return;
 adminActive=false;clearTimeout(refreshTimer);
 const existing=document.querySelector('#sessionExpired');if(existing)return;
 const d=modal('A belépés lejárt','<p>Az utoljára betöltött eredmények megmaradtak a képernyőn, de most nem frissülnek. Lépj be újra a folytatáshoz.</p><p><button class="primary" id="reenterAdmin">Újra belépek</button></p>');d.id='sessionExpired';
 if($('liveStatus'))$('liveStatus').textContent='A belépés lejárt · az adatok nem frissülnek';
 $('reenterAdmin').onclick=()=>{if(!leaveRoster())return;d.close();loginScreen();};
 sendProjection();
});

function closureDialog(type,item,cls){
 if(!leaveRoster())return;
 const isClass=type==='class',closed=Boolean(item.closed_at),noun=isClass?'Osztály':'Alkalom';
 const d=modal(noun+(closed?' újranyitása':' lezárása'),'<p><b>'+esc(item.name)+'</b></p><p>'+(closed?'Az újranyitás után ismét fogadhat értékeléseket. Az egyenként lezárt alkalmak lezárva maradnak.':isClass?'Az osztály minden alkalma leállítja az új értékelések fogadását. A névsor és minden eredmény megmarad, visszanézhető és kivetíthető. Később újranyithatod.':'Új értékelést már nem fogadunk ehhez az alkalomhoz. Az eredmények megmaradnak, és az osztályban indíthatsz új alkalmat.')+'</p><p><button class="primary" id="confirmClosure">'+noun+(closed?' újranyitása':' lezárása')+'</button></p>');
 action('confirmClosure',async()=>{await api('/rest/v1/rpc/set_observation_closed',{target:item.id,target_type:type,closed:!closed});rosterDirty=false;d.close();await dashboard();});
}
