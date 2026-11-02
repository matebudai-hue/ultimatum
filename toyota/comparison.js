'use strict';
function comparisonTable(group,items){
 const heads=group.records.map((r,i)=>'<th scope="col"><span class="comparison-ref">'+(i+1)+'</span> '+esc(r.observers.name)+'<small>'+localStamp(r.created_at)+'</small></th>').join('');
 return '<div class="table-scroll comparison-table"><table><thead><tr><th scope="col">Megfigyelési szempont</th>'+heads+'</tr></thead><tbody>'+items.map(it=>{
  const values=group.records.map(r=>r.scores[it.index]),spread=Math.max(...values)-Math.min(...values);
  return '<tr class="'+(spread?'has-difference':'')+'"><th scope="row"><span class="comparison-index">'+String(it.index+1).padStart(2,'0')+'</span>'+esc(it.title)+(spread?'<small>'+spread+' pont eltérés</small>':'')+'</th>'+values.map(n=>'<td><span class="comparison-score score-'+n+'"><b>'+n+'</b><span>'+esc(LABELS[n])+'</span></span></td>').join('')+'</tr>';
 }).join('')+'</tbody></table></div>';
}
function comparisonContent(cls,occasion,rows){
 if(!rows.length)return '<p>Ehhez a résztvevőhöz még nincs értékelés.</p>';
 const groups=CriterionSets.groups(cls.kind,rows),notesShared=appRole!=='viewer'||cls.show_names===true;
 const card=(r,i)=>{
  const source=occasions.find(o=>o.id===r.observers.occasion_id)||occasion,total=ToyStats.total(r.scores);
  return '<article class="comparison-note"><div class="comparison-note-head"><span class="comparison-ref">'+(i+1)+'</span><div><b>'+esc(r.observers.name)+'</b><small>'+localStamp(r.created_at)+' · '+esc(source.name||'')+'</small></div><span class="comparison-total">'+total+'<small> / 40</small></span></div>'+(notesShared?'<p class="feedback">'+esc(r.notes?.trim()||'Nem írt szöveges visszajelzést.')+'</p>':'<p class="muted">A szöveges visszajelzés nincs megosztva ezzel a hozzáféréssel.</p>')+'<div class="comparison-note-foot"><span>'+esc(modeName(source.mode))+(source.mode==='exam'?' · '+(ToyStats.passed(r.scores)?'Megfelelt':'Nem felelt meg'):'')+'</span>'+(appRole==='admin'?'<button class="text-button danger-action" data-withdraw-record="'+esc(r.id)+'">Értékelés törlése</button>':'')+'</div></article>';
 };
 return '<p class="muted comparison-intro">'+rows.length+' értékelés · a pontok a megfigyelők saját értékelései. Az eltérés beszélgetési kiindulópont, önmagában nem hiba.</p>'+groups.map(group=>{
  const differences=CriterionSets.differences(group),all=group.items.map((it,index)=>({...it,index}));
  return '<section class="comparison-group">'+(groups.length>1?'<div class="comparison-group-head"><h3>'+esc(group.label)+'</h3><span>'+group.records.length+' értékelés</span></div>':'')+'<h3>Szöveges visszajelzések</h3><div class="comparison-notes">'+group.records.slice(0,2).map(card).join('')+'</div>'+(group.records.length>2?'<details class="comparison-more"><summary>További '+(group.records.length-2)+' értékelés és visszajelzés</summary><div class="comparison-notes">'+group.records.slice(2).map((r,i)=>card(r,i+2)).join('')+'</div></details>':'')+(group.unresolved?'<p class="notice">Az eredeti szempontlista nem azonosítható. Az összpontszám és a visszajelzés megmaradt, de szempontonként nem hasonlítjuk össze másik listával.</p>':'<div class="comparison-section-head"><h3>Hol tértek el a megfigyelések?</h3><span>'+differences.length+' / 20 szempont</span></div>'+(differences.length?comparisonTable(group,differences):'<p class="comparison-agreement">'+(group.records.length===1?'Egy értékelés érkezett. Összehasonlításhoz legalább kettő szükséges.':'Mind a 20 szempontra azonos pontszámok érkeztek.')+'</p>')+'<details class="comparison-more"><summary>Mind a 20 szempont</summary>'+comparisonTable(group,all)+'</details>')+'</section>';
 }).join('');
}
function showPerson(cls,occasion,name,records){
 const dialog=modal(name+' · értékelések összehasonlítása',comparisonContent(cls,occasion,records.filter(r=>r.seller===name)));
 dialog.classList.add('comparison-dialog');
 dialog.querySelectorAll('[data-withdraw-record]').forEach(button=>button.onclick=()=>withdrawObservationDialog(cls,records.find(r=>r.id===button.dataset.withdrawRecord)));
}
