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
 if(!invitation&&(route.has('admin')||new URLSearchParams(location.search).has('admin')||route.has('access_token'))){history.replaceState(null,'',location.pathname+'#admin');await restoreAdmin();return;}
 if(!invitation){render();return;}
 try{
  context=demo?{className:'Mintaosztály',occasion:'Bemutató alkalom',kind:route.get('kind')==='passenger'?'passenger':'fleet',mode:'practice',roster:['Minta Anna','Minta Péter']}:await api(occasionLink?'/rest/v1/rpc/occasion_context':'/rest/v1/rpc/observation_context',{link:invitation});
  if(!context)throw Error('Ez a meghívó nem érvényes.');
  if(!state.type)state=fresh(context.kind);
  state.observer=context.observer||state.observer;
  choosing=false;render();
 }catch(err){$('app').textContent='A megfigyelés nem nyitható meg. '+err.message;}
}
function loginScreen(){
 document.body.classList.remove('admin-mode');
 $('bottom').classList.add('hidden');
 $('app').innerHTML=`<h1>Adminbelépés</h1><div class="panel"><form id="adminForm"><label>E-mail<input id="mail" type="email" autocomplete="username" required></label><label>Jelszó<input id="pw" type="password" autocomplete="current-password" required></label><button class="primary" type="submit" id="login">Belépés</button></form><p id="authMsg" role="status"></p><details id="activation"><summary>Fiók aktiválása</summary><p>Ha már regisztráltál, erősítsd meg a címed a regisztrációs levélben. Ezután itt léphetsz be a megadott jelszóval.</p><button class="secondary" id="resend">Új megerősítő levél kérése</button><details><summary>A levélben lévő gomb nem működik</summary><p>Másold ki a legutóbbi levél megerősítő gombjának hivatkozását, és illeszd ide.</p><label>Megerősítő hivatkozás<input id="confirmUrl" type="password" autocomplete="off"></label><button id="verify">Cím megerősítése</button></details></details><details><summary>Első regisztráció</summary><p>Add meg fent az adminisztrátori e-mail-címed és a választott jelszót.</p><button id="register">Fiók létrehozása</button></details></div><a href="./">Megfigyelés indítása</a>`;
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
 async function enter(session){
  access=session.access_token;
  if(!await api('/rest/v1/rpc/toyota_admin_access',{})){clearAdminSession();throw Error('Ehhez a fiókhoz nincs adminjog.');}
  rememberAdminSession(session);
  await dashboard();
 }
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
function criterionMeans(cls,records){return ToyStats.criteria(exams[cls.kind].items,cls.roster,records);}
function groupReport(cls,occasion,records){
 const rank=criterionMeans(cls,records);
 const format=r=>r.title+' · '+r.mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+'/2';
 const observed=new Set(records.map(r=>r.seller)).size;
 return [cls.name,modeName(occasion.mode)+' · '+occasion.name,'Összesítés ideje: '+new Date().toLocaleString('hu-HU'),'Megfigyelt résztvevők: '+observed+'/'+cls.roster.length,'Beküldések: '+records.length,'',...(rank.length?['Legmagasabb értékelések',...rank.filter(r=>Math.abs(r.mean-rank[0].mean)<1e-9).map(format),'','Legalacsonyabb értékelések',...rank.filter(r=>Math.abs(r.mean-rank.at(-1).mean)<1e-9).map(format),'','Minden szempont',...rank.map(format)]:['Még nincs beküldés.'])].join('\n');
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
function adminOverview(cls,occasion,records){
 const observed=new Set(records.map(r=>r.seller)).size,rank=criterionMeans(cls,records);
 const score=r=>ToyStats.total(r.scores);
 const stats='<div class="stats"><section class="panel"><span>Megfigyelt résztvevők</span><b class="metric">'+observed+'<small> / '+cls.roster.length+'</small></b></section><section class="panel"><span>Beküldött értékelések</span><b class="metric">'+records.length+'</b></section><section class="panel"><span>'+(occasion.mode==='exam'?'Megfelelt értékelések':'Értékelések átlaga')+'</span><b class="metric">'+(occasion.mode==='exam'?records.filter(r=>score(r)>=25).length+'<small> / '+records.length+'</small>':records.length?(ToyStats.meanTotal(cls.roster,records)).toLocaleString('hu-HU',{maximumFractionDigits:1})+'<small> / 40</small>':'—')+'</b></section></div>';
 if(!records.length)return stats+'<section class="panel waiting-state"><span class="waiting-dot"></span><h2>Várjuk az első értékelést</h2><p>Vetítsd ki a QR-kódot. A beérkezett eredmények itt automatikusan megjelennek.</p></section><button hidden id="seeResults">Eredmények</button>';
 const equal=Math.abs(rank[0].mean-rank.at(-1).mean)<1e-9;
 function highlight(title,items,style){
 const displayed=items.slice(0,3),ties=items.filter(r=>Math.abs(r.mean-displayed.at(-1).mean)<1e-9).length-displayed.filter(r=>Math.abs(r.mean-displayed.at(-1).mean)<1e-9).length;
 return '<section class="panel '+style+'"><h2>'+title+'</h2><ul class="topthree-list">'+displayed.map(r=>'<li><span>'+esc(r.title)+'</span><b>'+r.mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+'<small> / 2</small></b></li>').join('')+'</ul>'+(ties?'<p class="muted">+'+ties+' szempont azonos értékkel</p>':'')+(items.length>3?'<details class="ranking-more" id="ranking-'+style+'"><summary>További '+(items.length-3)+' szempont</summary><ul class="topthree-list">'+items.slice(3).map(r=>'<li><span>'+esc(r.title)+'</span><b>'+r.mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+'<small> / 2</small></b></li>').join('')+'</ul></details>':'')+'</section>';
 }
 const highlights=equal?'<section class="panel summary-neutral"><b>Minden szempont átlaga azonos · '+rank[0].mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+' / 2</b><p>A részleteket a szempontok megoszlásában nézheted meg.</p></section>':'<div class="highlights">'+highlight('Erősségek',rank,'strong')+highlight('Fejlesztési fókuszok',[...rank].sort((a,b)=>a.mean-b.mean),'weak')+'</div>';
 return stats+'<div class="overview-work"><section class="panel participant-status"><div class="section-head"><h2>Résztvevők állapota</h2><button class="text-button" id="seeResults">Részletek →</button></div>'+participantStatusTable(cls,occasion,records)+'</section><aside>'+highlights+'</aside></div><details class="panel all-criteria" id="allCriteria"><summary>Mind a 20 szempont részletesen</summary>'+criterionChart(cls,records)+'</details>';

}

function participantStatusTable(cls,occasion,records){
 return '<div class="table-scroll"><table class="participant-table"><thead><tr><th>Értékesítő</th><th>Db</th><th>Pontok / 40</th><th>Megfigyelők</th><th>Legutóbb</th></tr></thead><tbody>'+cls.roster.map(name=>{
 const rows=records.filter(r=>r.seller===name).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 if(!rows.length)return '<tr><td>'+esc(name)+'</td><td>0</td><td colspan="3" class="missing">Még nincs beküldés</td></tr>';
 return '<tr><td><button class="text-button" data-person="'+esc(name)+'">'+esc(name)+'</button></td><td><span class="record-count">'+rows.length+'</span></td><td class="score-values">'+rows.map(r=>ToyStats.total(r.scores)).join(' · ')+'</td><td class="observers">'+[...new Set(rows.map(r=>esc(r.observers.name)))].join(', ')+'</td><td><time title="'+localStamp(rows[0].created_at)+'">'+new Date(rows[0].created_at).toLocaleTimeString('hu-HU',{timeZone:'Europe/Budapest',hour:'2-digit',minute:'2-digit',second:'2-digit'})+'</time></td></tr>';
 }).join('')+'</tbody></table></div>';
}

function resultsTable(cls,occasion,records,includeMissing=true){
 const rows=records.map(r=>{
 const total=ToyStats.total(r.scores);
 return '<tr><td><button class="text-button" data-person="'+esc(r.seller)+'">'+esc(r.seller)+'</button></td><td>'+esc(r.observers.name)+'</td><td><b>'+total+'/40</b></td><td>'+(occasion.mode==='exam'?'<span class="pill '+(total>=25?'ok':'low')+'">'+(total>=25?'Megfelelt':'Nem felelt meg')+'</span>':'Megfigyelés')+'</td><td>'+localStamp(r.created_at)+'</td></tr>';
 });
 if(includeMissing)for(const name of cls.roster)if(!records.some(r=>r.seller===name))rows.push('<tr><td>'+esc(name)+'</td><td colspan="4" class="muted">Még nincs beküldés</td></tr>');
 return '<div class="table-scroll"><table><thead><tr><th>Értékesítő</th><th>Megfigyelő</th><th>Pontszám</th><th>Eredmény</th><th>Beküldés időpontja</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
function showPerson(cls,occasion,name,records){
 const rows=records.filter(r=>r.seller===name),items=rows[0]?.criteria_snapshot||exams[cls.kind].items;
 const heads=rows.map(r=>'<th>'+esc(r.observers.name)+'<br><small>'+localStamp(r.created_at)+'</small></th>').join('');
 modal(name+' · értékelések összehasonlítása','<div class="table-scroll"><table><thead><tr><th>Szempont</th>'+heads+'</tr></thead><tbody>'+items.map((it,i)=>'<tr><th>'+esc(it.title)+'</th>'+rows.map(r=>'<td>'+r.scores[i]+' / 2'+(r.criteria_snapshot?.[i]?.title&&r.criteria_snapshot[i].title!==it.title?'<br><small>'+esc(r.criteria_snapshot[i].title)+'</small>':'')+'<br><small>'+LABELS[r.scores[i]]+'</small></td>').join('')+'</tr>').join('')+'<tr><th>Összesen</th>'+rows.map(r=>{const n=ToyStats.total(r.scores);return '<td><b>'+n+'/40</b>'+(occasion.mode==='exam'?'<br>'+(n>=25?'Megfelelt':'Nem felelt meg'):'')+'</td>';}).join('')+'</tr><tr><th>Szöveges visszajelzés</th>'+rows.map(r=>'<td class="feedback">'+esc(r.notes||'—')+'</td>').join('')+'</tr></tbody></table></div>');
}
async function dashboard(){
 adminActive=true;document.body.classList.add('admin-mode');
 const request=++dashboardRequest;
 const loaded=await api('/rest/v1/classes?select=*&order=created_at.desc');
 if(request!==dashboardRequest)return;
 classes=loaded;if(!classes.some(c=>c.id===classId))classId=classes[0]?.id||'';
 const cls=classes.find(c=>c.id===classId);
 const loadedOcc=cls?await api('/rest/v1/occasions?class_id=eq.'+classId+'&order=created_at.desc'):[];
 if(request!==dashboardRequest)return;
 occasions=loadedOcc;if(!occasions.some(a=>a.id===occasionId))occasionId=occasions[0]?.id||'';
 const occasion=occasions.find(a=>a.id===occasionId);
 const loadedEntries=occasion?await readEntries(occasionId):[];
 if(request!==dashboardRequest)return;
 entries=loadedEntries;refreshedAt=new Date();if(cls&&occasion)feedProjection(cls,occasion,entries);
 $('bottom').classList.add('hidden');
 $('app').innerHTML='<aside class="admin-sidebar"><div class="eyebrow">Adminisztráció</div><h2>Osztályok</h2><button class="primary" id="newClass">+ Új osztály</button><nav aria-label="Osztályok">'+classes.map(c=>'<button data-class="'+c.id+'" class="'+(c.id===classId?'selected':'')+'"><b>'+esc(c.name)+'</b><small>'+exams[c.kind].name+' · '+c.roster.length+' fő</small></button>').join('')+'</nav><button class="secondary" id="logout">Kilépés</button></aside><div class="admin-work"><div class="admin-heading"><div><div class="eyebrow">'+(cls?exams[cls.kind].name:'Toyota')+'</div><h1>'+esc(cls?.name||'Hozd létre az első osztályt')+'</h1></div>'+(cls?'<details class="more-menu class-menu"><summary>Osztály beállításai</summary><div><button id="newOcc">Új megfigyelés vagy vizsga</button><button id="deleteClass" class="danger-action">Osztály törlése</button></div></details>':'')+'</div>'+(cls?'<div class="admin-session-tools"><div class="occasion-row"><label>Aktuális alkalom<select id="occasions">'+selectOptions(occasions.map(a=>({...a,name:modeName(a.mode)+' · '+a.name})),occasionId)+'</select></label><span id="liveStatus" class="muted" role="status">Automatikusan frissül · '+new Date(refreshedAt).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})+'</span><button class="secondary icon-refresh" id="refresh" aria-label="Eredmények frissítése" title="Frissítés">↻</button></div>':'')+(occasion?'<div class="toolbar"><button class="primary" id="showQr">Csatlakozás · QR-kód</button><button class="secondary" id="projectSummary">Eredmények kivetítése</button><details class="more-menu"><summary>További műveletek</summary><div><a href="./#occasion='+occasion.id+'&preview=1" target="_blank" rel="noopener">Megfigyelői előnézet ↗</a><button id="copyOcc">Csatlakozási link másolása</button><button id="mailSummary">Összesítés e-mailben</button></div></details></div>':'')+(cls?'</div><nav class="admin-tabs" aria-label="Osztály nézetei">'+[['overview','Áttekintés'],['results','Eredmények'],['roster','Névsor']].map(([key,name])=>'<button data-tab="'+key+'" aria-current="'+(key===adminTab?'page':'false')+'">'+name+'</button>').join('')+'</nav><div id="adminContent"></div>':'<section class="panel empty"><h2>Az osztályból indul a közös munka</h2><p>Adj nevet az osztálynak, illeszd be a névsort, majd válaszd ki a megfigyelést vagy a vizsgát. A közös QR-kód rögtön elkészül.</p><p><a href="./#preview=1&kind=fleet" target="_blank" rel="noopener">Flottás előnézet ↗</a> · <a href="./#preview=1&kind=passenger" target="_blank" rel="noopener">Személyautós előnézet ↗</a></p></section>')+'</div>';
 $('newClass').onclick=()=>createClassDialog();
 action('logout',async()=>{adminActive=false;clearTimeout(refreshTimer);try{await api('/auth/v1/logout',{});}finally{clearAdminSession();location.replace('./#admin');location.reload();}});
 if(cls){
 action('deleteClass',async()=>{if(leaveRoster())await deleteClassDialog(cls);});
 $('newOcc').onclick=()=>createOccasionDialog(cls);
 $('occasions').onchange=e=>{if(!leaveRoster()){e.target.value=occasionId;return;}rosterDirty=false;occasionId=e.target.value;dashboard().catch(alertError);};
 action('refresh',async()=>{if(leaveRoster()){rosterDirty=false;await dashboard();}});
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(!leaveRoster())return;rosterDirty=false;adminTab=b.dataset.tab;renderAdminContent(cls,occasion);});
 renderAdminContent(cls,occasion);
 }
 document.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{if(!leaveRoster())return;rosterDirty=false;classId=b.dataset.class;occasionId='';adminTab='overview';dashboard().catch(alertError);});
 if(occasion){
 const link=location.origin+location.pathname+'#occasion='+occasion.id;
 $('showQr').onclick=()=>{const d=modal(cls.name+' · '+modeName(occasion.mode),'<p>'+esc(occasion.name)+'</p><canvas id="projectQr" aria-label="Az alkalom közös QR-kódja"></canvas><p>Olvasd be, add meg a saját neved, majd válaszd ki, kit figyelsz meg.</p>');d.classList.add('projection');drawQr(d.querySelector('canvas'),link);};
 action('copyOcc',async()=>{try{await navigator.clipboard.writeText(link);$('copyOcc').textContent='Kimásolva';}catch{prompt('Másold ki a linket:',link);}});
 $('projectSummary').onclick=()=>projectionControls(cls,occasion);
 $('mailSummary').onclick=()=>emailSummary(cls,occasion,entries);
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
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===adminTab?'page':'false'));
 const content=$('adminContent');
 if(adminTab==='roster'){
 content.innerHTML='<section class="panel"><div class="section-head"><h2>Névsor · '+cls.roster.length+' fő</h2><button class="secondary" id="pasteRoster">Névsor beillesztése</button></div><p class="muted">A név módosítása a korábbi értékeléseknél is érvényesül.</p><div class="table-scroll"><table><thead><tr><th>Név</th><th>E-mail-cím</th></tr></thead><tbody id="rosterRows"></tbody></table></div><p><button class="secondary" id="addPerson">+ Résztvevő</button> <button class="primary" id="saveRoster">Névsor mentése</button></p></section>';
 let draft=cls.roster.map(name=>({original:name,name,email:cls.contacts?.[name]||''}));
 const draw=()=>{$('rosterRows').innerHTML=draft.map((p,i)=>'<tr><td><input aria-label="Név '+(i+1)+'" data-name="'+i+'" value="'+esc(p.name)+'"></td><td><input aria-label="E-mail '+(i+1)+'" type="email" data-email="'+i+'" value="'+esc(p.email)+'"></td></tr>').join('');document.querySelectorAll('[data-name]').forEach(el=>el.oninput=()=>{draft[Number(el.dataset.name)].name=el.value;rosterDirty=true;});document.querySelectorAll('[data-email]').forEach(el=>el.oninput=()=>{draft[Number(el.dataset.email)].email=el.value;rosterDirty=true;});};
 draw();$('addPerson').onclick=()=>{draft.push({original:null,name:'',email:''});rosterDirty=true;draw();};
 $('pasteRoster').onclick=()=>{const d=modal('Névsor beillesztése','<p>Soronként egy név és opcionális e-mail-cím. Excelből két oszlopot is bemásolhatsz. A már meglévő nevekhez tartozó e-mail-címek frissülnek.</p><textarea id="pasteText" rows="10"></textarea><p><button class="primary" id="applyPaste">Beillesztés</button></p>');d.querySelector('#applyPaste').onclick=()=>{try{const p=parseRoster(d.querySelector('textarea').value);for(const name of p.names){const existing=draft.find(x=>x.name===name);if(existing)existing.email=p.contacts[name]||'';else draft.push({original:null,name,email:p.contacts[name]||''});}rosterDirty=true;draw();d.close();}catch(e){alertError(e);}};};
 action('saveRoster',async()=>{const parsed=parseRoster(draft.map(p=>p.name.trim()+String.fromCharCode(9)+p.email.trim()).join(String.fromCharCode(10)));if(parsed.names.length!==draft.length)throw Error('Minden résztvevőnek adj nevet.');
 await api('/rest/v1/rpc/update_class_roster',{target:cls.id,changes:draft.map(p=>({original:p.original,name:p.name.trim(),email:p.email.trim()}))});rosterDirty=false;await dashboard();});
 return;
 }
 if(!occasion){content.innerHTML='<section class="panel"><h2>Hozz létre egy alkalmat</h2><p>A megfigyeléshez vagy vizsgához saját QR-kód és eredménylista tartozik.</p></section>';return;}
 if(adminTab==='overview'){
 const chartOpen=Boolean($('allCriteria')?.open),strongOpen=Boolean($('ranking-strong')?.open),weakOpen=Boolean($('ranking-weak')?.open);
 content.innerHTML=adminOverview(cls,occasion,entries);if($('allCriteria'))$('allCriteria').open=chartOpen;if($('ranking-strong'))$('ranking-strong').open=strongOpen;if($('ranking-weak'))$('ranking-weak').open=weakOpen;
 $('seeResults').onclick=()=>{adminTab='results';renderAdminContent(cls,occasion);};
 }else{
 content.innerHTML='<section class="panel"><div class="section-head"><h2>Egyéni eredmények</h2><select id="scope" aria-label="Eredmények köre"><option value="current">Aktuális alkalom</option><option value="practice">Az osztály összes megfigyelése</option><option value="exam">Az osztály összes vizsgája</option></select></div><p class="muted">Kattints az értékesítő nevére a megfigyelők értékeléseinek összehasonlításához.</p><div id="resultRecords">'+resultsTable(cls,occasion,entries)+'</div></section>';
 $('scope').onchange=async e=>{const scope=e.target.value,selectedClass=classId,selectedOccasion=occasionId;try{const records=scope==='current'?entries:(await Promise.all(occasions.filter(a=>a.mode===scope).map(a=>readEntries(a.id)))).flat();if(!$('resultRecords')||selectedClass!==classId||selectedOccasion!==occasionId||$('scope')?.value!==scope)return;$('resultRecords').innerHTML=resultsTable(cls,{mode:scope==='current'?occasion.mode:scope},records);bindPeople(cls,{mode:scope==='current'?occasion.mode:scope},records);}catch(err){alertError(err);}};
 }
 bindPeople(cls,occasion,entries);
}
function bindPeople(cls,occasion,records){document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>showPerson(cls,occasion,b.dataset.person,records));}
async function deleteClassDialog(cls){
 const all=await api('/rest/v1/occasions?class_id=eq.'+cls.id);
 const records=(await Promise.all(all.map(a=>readEntries(a.id)))).flat();
 const dialog=modal('Osztály törlése','<p><b>'+esc(cls.name)+'</b> · '+cls.roster.length+' résztvevő · '+all.length+' alkalom · '+records.length+' beküldött értékelés</p><p>Az osztály és az összes hozzá tartozó névsor, alkalom, értékelés végleg törlődik. A QR-kódjai ezután nem használhatók.</p><label>A törléshez írd be az osztály nevét<input id="deleteConfirmation" autocomplete="off"></label><p><button class="primary" id="confirmDelete" disabled>Osztály végleges törlése</button></p>');
 dialog.querySelector('#deleteConfirmation').oninput=e=>{dialog.querySelector('#confirmDelete').disabled=e.target.value!==cls.name;};
 action('confirmDelete',async()=>{await api('/rest/v1/rpc/delete_observation_class',{target:cls.id,confirmation:dialog.querySelector('#deleteConfirmation').value});rosterDirty=false;classId='';occasionId='';adminTab='overview';dialog.close();await dashboard();});
}

function createClassDialog(){
 const d=modal('Új osztály','<label>Osztály neve<input id="className" placeholder="Például Toyota · november"></label><div class="fields"><label>Értékesítés típusa<select id="kind"><option value="fleet">Flotta</option><option value="passenger">Személyautó</option></select></label><label>Első alkalom<select id="firstMode"><option value="practice">Megfigyelés</option><option value="exam">Vizsga</option></select></label></div><label>Névsor<textarea id="roster" rows="8" placeholder="Név és opcionális e-mail-cím · soronként egy résztvevő"></textarea></label><p class="muted">Excelből két oszlop is beilleszthető.</p><label>Vagy TXT / CSV feltöltése<input id="file" type="file" accept=".txt,.csv"></label><p><button class="primary" id="saveClass">Osztály és QR-kód létrehozása</button></p>');
 d.querySelector('#file').onchange=async e=>{if(e.target.files[0])d.querySelector('#roster').value=await e.target.files[0].text();};
 action('saveClass',async()=>{const name=$('className').value.trim(),p=parseRoster($('roster').value);if(!name||!p.names.length)throw Error('Adj nevet az osztálynak és illeszd be a névsort.');const result=await api('/rest/v1/rpc/create_observation_class',{class_name:name,class_kind:$('kind').value,names:p.names,emails:p.contacts,occasion_mode:$('firstMode').value});classId=result.class_id;occasionId=result.occasion_id;adminTab='overview';d.close();await dashboard();});
}
function createOccasionDialog(cls){
 const d=modal('Új alkalom · '+cls.name,'<label>Alkalom neve vagy dátuma<input id="occasionName" value="'+new Date().toLocaleDateString('hu-HU')+'"></label><label>Cél<select id="mode"><option value="practice">Megfigyelés</option><option value="exam">Vizsga</option></select></label><p><button class="primary" id="saveOcc">Alkalom és QR-kód létrehozása</button></p>');
 action('saveOcc',async()=>{const id=crypto.randomUUID();await api('/rest/v1/occasions',{id,class_id:cls.id,name:$('occasionName').value.trim(),mode:$('mode').value});occasionId=id;adminTab='overview';d.close();await dashboard();});
}
function scheduleRefresh(){
 clearTimeout(refreshTimer);
 refreshTimer=setTimeout(async()=>{
 if(!adminActive)return;
 const target=occasionId,cls=classes.find(c=>c.id===classId),occasion=occasions.find(a=>a.id===target);
 if((!document.hidden||(projectorWindow&&!projectorWindow.closed))&&occasion){
 try{const loaded=await readEntries(target);if(target===occasionId){
 entries=loaded;refreshedAt=new Date();feedProjection(cls,occasion,entries);if($('liveStatus'))$('liveStatus').textContent='Automatikusan frissül · '+new Date(refreshedAt).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})+'';
 if(!document.querySelector('dialog[open]')&&adminTab==='overview')renderAdminContent(cls,occasion);
 if(!document.querySelector('dialog[open]')&&adminTab==='results'&&$('scope')?.value==='current')renderAdminContent(cls,occasion);
 }}catch(err){if($('liveStatus'))$('liveStatus').textContent='A frissítés nem sikerült. Próbáld a Frissítés gombbal.';}
 }scheduleRefresh();
 },20000);
}

async function readEntries(id){
 const all=[];for(let offset=0;;offset+=500){const page=await api('/rest/v1/observations?select=*,observers!inner(occasion_id,name)&observers.occasion_id=eq.'+id+'&order=created_at,id&limit=500&offset='+offset);all.push(...page);if(page.length<500)return all;}
}
function overview(cls,occasion,records){
 const items=exams[cls.kind].items, sums=Array(20).fill(0);let observed=0;
 const people=cls.roster.map(name=>{
  const rows=records.filter(r=>r.seller===name);
  if(rows.length){observed++;items.forEach((_,i)=>sums[i]+=rows.reduce((sum,r)=>sum+r.scores[i],0)/rows.length);}
  return `<details class="card"><summary>${esc(name)} · ${rows.length} megfigyelés</summary>${rows.map(r=>{
   const total=ToyStats.total(r.scores);
   return `<details><summary>${esc(r.observers.name)} · ${total}/40${occasion.mode==='exam'?' · '+(total>=25?'Megfelelt':'Nem felelt meg'):''}</summary><p>${new Date(r.created_at).toLocaleString('hu-HU')}${cls.kind==='passenger'?' · Telefon: '+r.scores.slice(0,5).reduce((a,b)=>a+b,0)+'/10 · Bemutatás: '+r.scores.slice(5).reduce((a,b)=>a+b,0)+'/30':''}</p><ol>${items.map((it,i)=>`<li>${esc(it.title)} · ${r.scores[i]}/2</li>`).join('')}</ol><p class="feedback">${esc(r.notes)}</p></details>`}).join('')}</details>`;
 });
 const rank=items.map((it,i)=>({title:it.title,mean:sums[i]/observed})).sort((a,b)=>b.mean-a.mean);
 const level=r=>r.mean.toLocaleString('hu-HU',{maximumFractionDigits:2})+'/2';
 const ties=target=>rank.filter(r=>Math.abs(r.mean-target)<1e-9).map(r=>esc(r.title)).join(', ');
 return `<div class="panel"><h2>${modeName(occasion.mode)} · beérkezett eredmények</h2><p>Frissítve: ${new Date().toLocaleString("hu-HU")}</p><p>${observed}/${cls.roster.length} értékesítő · ${records.length} beküldés</p>${observed?`<p><b>Legmagasabb · ${level(rank[0])}</b><br>${ties(rank[0].mean)}</p><p><b>Legalacsonyabb · ${level(rank[19])}</b><br>${ties(rank[19].mean)}</p><details><summary>Mind a 20 szempont átlaga</summary><p>Minden megfigyelt értékesítő azonos súllyal szerepel.</p><ol>${rank.map(r=>`<li>${esc(r.title)} · ${level(r)}</li>`).join('')}</ol></details>`:'Még nincs beküldés.'}</div>${people.join('')}`;
}
