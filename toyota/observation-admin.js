'use strict';
async function readWithdrawnEntries(id){
 const records=[];for(let offset=0;;offset+=500){const page=await api('/rest/v1/rpc/list_withdrawn_observations',{target:id,row_offset:offset});records.push(...page);if(page.length<500)return records;}
}
async function refreshProjectionAfterWithdrawal(cls){
 if(!projectionSnapshot||projectionSnapshot.classId!==cls.id)return;
 const projected=occasions.find(a=>a.id===projectionSnapshot.occasionId);projectionSnapshot=null;
 if(projectorWindow&&!projectorWindow.closed)projectorWindow.postMessage({type:'toyota-projection-cleared',reason:'updated'},location.origin);
 if(!projected)return;
 const rows=await readEntries(projected.id);refreshedAt=new Date();projectionSettings.frozen=false;projectionSnapshot=projectionData(cls,projected,rows);sendProjection();
}
function withdrawObservationDialog(cls,record,restore=false){
 if(appRole!=='admin')return;
 const occasion=occasions.find(a=>a.id===record.observers.occasion_id);
 const d=modal(restore?'Értékelés visszaállítása':'Értékelés törlése az eredmények közül','<dl class="record-identity"><div><dt>Megfigyelt értékesítő</dt><dd>'+esc(record.seller)+'</dd></div><div><dt>Megfigyelő</dt><dd>'+esc(record.observers.name)+'</dd></div><div><dt>Beküldés</dt><dd>'+localStamp(record.created_at)+'</dd></div><div><dt>Pontszám</dt><dd>'+ToyStats.total(record.scores)+' / 40</dd></div><div><dt>Osztály és alkalom</dt><dd>'+esc(cls.name)+(occasion?' · '+modeName(occasion.mode)+' · '+esc(occasion.name):'')+'</dd></div></dl><p>'+(restore?'Az értékelés ismét bekerül a résztvevő és az osztály eredményeibe.':'Ez az egy értékelés kikerül az összesítésből és a kivetítésből. A Törölt értékelések között később visszaállíthatod.')+'</p>'+(restore?'':'<label>Törlés oka · opcionális<textarea id="withdrawalReason" rows="2" maxlength="1000" placeholder="Például tévesen kiválasztott értékesítő"></textarea></label>')+'<p><button class="primary" id="confirmWithdrawal">'+(restore?'Értékelés visszaállítása':'Értékelés törlése az eredmények közül')+'</button></p>');
 d.classList.add('record-action-dialog');
 action('confirmWithdrawal',async()=>{
  const scope=$('scope')?.value||'current';
  await api('/rest/v1/rpc/set_observation_withdrawn',{target:record.id,withdrawn:!restore,expected_created_at:record.created_at,expected_seller:record.seller,reason:restore?'':$('withdrawalReason').value.trim()});
  document.querySelectorAll('dialog').forEach(dialog=>{dialog.close();dialog.remove();});
  try{await refreshProjectionAfterWithdrawal(cls);await dashboard();}catch(err){alertError(Error('Az értékelés állapotát elmentettük, de az összesítés frissítése nem sikerült. Frissítsd az oldalt.'));return;}
  if(adminTab==='results'&&$('scope')&&scope!=='current'){$('scope').value=scope;await $('scope').onchange({target:$('scope')});}
  const status=document.createElement('p');status.className='notice';status.setAttribute('role','status');status.textContent=restore?'Az értékelést visszaállítottad. Az összesítés frissült.':'Az értékelést törölted az eredmények közül. A Törölt értékelések alatt visszaállíthatod.';document.querySelector('#adminContent')?.prepend(status);
 });
}
async function withdrawnObservationsDialog(cls,occasion){
 if(appRole!=='admin')return;
 const records=await readWithdrawnEntries(occasion.id);
 const d=modal('Törölt értékelések · '+occasion.name,'<p>Az itt szereplő értékelések nem számítanak bele az eredményekbe. Visszaállítás után ismét megjelennek az összesítésben.</p>'+(records.length?'<div class="table-scroll"><table class="withdrawn-table"><thead><tr><th>Értékesítő</th><th>Megfigyelő</th><th>Pont</th><th>Beküldés / törlés</th><th>Indok</th><th></th></tr></thead><tbody>'+records.map(r=>'<tr><td>'+esc(r.seller)+'</td><td>'+esc(r.observers.name)+'</td><td>'+ToyStats.total(r.scores)+'/40</td><td>'+localStamp(r.created_at)+'<br><span class="muted">Törölve: '+localStamp(r.withdrawn_at)+'</span></td><td>'+esc(r.withdrawn_reason||'—')+'</td><td><button class="secondary" data-restore-record="'+esc(r.id)+'">Visszaállítás</button></td></tr>').join('')+'</tbody></table></div>':'<p class="empty">Ebben az alkalomban nincs törölt értékelés.</p>'));
 d.classList.add('withdrawn-dialog');
 d.querySelectorAll('[data-restore-record]').forEach(b=>b.onclick=()=>withdrawObservationDialog(cls,records.find(r=>r.id===b.dataset.restoreRecord),true));
}
