let projectorWindow=null,projectionSnapshot=null;
const projectionSettings={view:'highlights',selected:0,page:0,frozen:false,showNames:false,scope:'class',seller:'',namedPage:0};
function projectionData(cls,occasion,records){
 const group=selectedCriterionSet(cls,records),means=group.unresolved?[]:ToyStats.criteria(group.items,cls.roster,group.records),stamp=refreshedAt||new Date();records=group.records;
 return {
 classId:cls.id,occasionId:occasion.id,className:cls.name,kind:exams[cls.kind].name,mode:modeName(occasion.mode),occasion:occasion.name,
 criteriaKey:group.key,criteriaLabel:group.groups.length>1?group.label:'',unresolved:group.unresolved,sourceIds:records.map(r=>r.id),roster:cls.roster,people:cls.roster.length,observed:new Set(records.map(r=>r.seller)).size,submissions:records.length,updated:localStamp(stamp),updatedAt:new Date(stamp).getTime(),
 namedRecords:records.map(r=>({seller:r.seller,observer:r.observers.name,scores:r.scores})),
 items:group.items.map((it,index)=>({index,title:it.title,help:it.help,mean:means.find(r=>r.id===it.id)?.mean||0,counts:[0,1,2].map(n=>records.filter(r=>r.scores[index]===n).length)}))
 };
}
function selectedProjectionData(){
 const {namedRecords,roster,sourceIds,criteriaKey,...aggregate}=projectionSnapshot;
 const {seller,...settings}=projectionSettings;
 let records=namedRecords;
 if(settings.scope==='person'){
 records=namedRecords.filter(r=>r.seller===seller);
 aggregate.people=1;aggregate.observed=records.length?1:0;aggregate.submissions=records.length;
 aggregate.items=aggregate.items.map(it=>({...it,mean:records.length?records.reduce((sum,r)=>sum+r.scores[it.index],0)/records.length:0,counts:[0,1,2].map(n=>records.filter(r=>r.scores[it.index]===n).length)}));
 }
 return {...aggregate,...settings,liveConnected:adminActive&&classId===projectionSnapshot.classId&&occasionId===projectionSnapshot.occasionId,subject:settings.scope==='person'?(settings.showNames?seller:'Egy résztvevő'):'Teljes osztály',...(settings.showNames?{namedRecords:records}:{})};
}
function sendProjection(){
 if(!projectorWindow||projectorWindow.closed||!projectionSnapshot)return;
 projectorWindow.postMessage({type:'toyota-projection-data',payload:selectedProjectionData()},location.origin);
}
function feedProjection(cls,occasion,records){
 if(!projectionSnapshot||projectionSettings.frozen||cls.id!==projectionSnapshot.classId||occasion.id!==projectionSnapshot.occasionId)return;
 projectionSnapshot=projectionData(cls,occasion,records);sendProjection();
 const status=$('projectionStatus');
 if(status)status.textContent=selectedProjectionData().submissions+' értékelés';
}
window.addEventListener('message',event=>{
 if(event.origin===location.origin&&event.source===projectorWindow&&event.data?.type==='toyota-projection-ready')sendProjection();
});
function openProjector(){
 if(projectorWindow&&!projectorWindow.closed){projectorWindow.focus();sendProjection();return;}
 projectorWindow=window.open('./projection.html','toyota-results-projector','popup,width=1440,height=900');
 if(!projectorWindow){alert('A böngésző blokkolta az új ablakot. Engedélyezd az oldal felugró ablakait, majd kattints újra.');return;}
 sendProjection();
}
function projectionControlPanel(title,body){
 document.getElementById('projectionControlPanel')?.remove();
 const panel=document.createElement('section');panel.id='projectionControlPanel';panel.className='panel projection-admin-panel';
 panel.innerHTML='<div class="section-head"><h2>'+esc(title)+'</h2><button class="text-button" id="hideProjectionControls">Elrejtés</button></div>'+body;
 document.querySelector('.toolbar').after(panel);
 panel.querySelector('#hideProjectionControls').onclick=()=>panel.remove();
 return panel;
}
function projectionControls(cls,occasion){
 if(!projectionSnapshot||projectionSnapshot.classId!==cls.id||projectionSnapshot.occasionId!==occasion.id){
 projectionSettings.frozen=false;projectionSettings.showNames=false;projectionSettings.scope='class';projectionSettings.seller=cls.roster[0]||'';projectionSnapshot=projectionData(cls,occasion,entries);
 }else if(!projectionSettings.frozen)projectionSnapshot=projectionData(cls,occasion,entries);
 const panel=projectionControlPanel('Kivetítés',criterionSetPicker(cls,entries,'projectCriteriaSet')+'<div class="compact-projector"><div class="projector-choices"><label>Tartalom<select id="projectionView"><option value="highlights">Erősségek és fejlesztendők</option><option value="single">Egy szempont</option><option value="distribution">0–1–2 megoszlás</option></select></label><label>Kinek az eredménye?<select id="projectionAudience"><option value="-1">Teljes osztály</option><optgroup label="Résztvevők">'+projectionSnapshot.roster.map((name,i)=>'<option value="'+i+'">'+esc(name)+'</option>').join('')+'</optgroup></select></label></div><div id="projectionOptions"></div><div class="projector-switches"><label><input type="checkbox" id="projectionNames" '+(projectionSettings.showNames?'checked':'')+'> Nevek</label><label><input type="checkbox" id="freezeProjection" '+(projectionSettings.frozen?'checked':'')+'> Kimerevítés</label><span class="muted" id="projectionStatus"></span><button class="text-button" id="openProjector">Kivetítőablak megnyitása ↗</button></div></div>');
 bindCriterionSetPicker(cls,entries,()=>{changeProjectionCriterionSet(cls,occasion);if(appRole==='viewer')renderViewerContent(cls,occasion);else renderAdminContent(cls,occasion);},panel);
 const status=()=>{panel.querySelector('#projectionStatus').textContent=(projectionSettings.frozen?'Kimerevítve · ':'')+selectedProjectionData().submissions+' értékelés';};
 const redraw=()=>{
 panel.querySelector('#projectionView').value=projectionSettings.view;
 panel.querySelector('#projectionAudience').value=projectionSettings.scope==='class'?'-1':String(projectionSnapshot.roster.indexOf(projectionSettings.seller));
 const options=panel.querySelector('#projectionOptions');
 if(projectionSnapshot.unresolved){options.innerHTML='<p class="muted">Az eredeti lista hiányzik; szempontonkénti diagram nem vetíthető.</p>';}else if(projectionSettings.view==='single'){
 options.innerHTML='<div class="compact-criterion"><button class="secondary" id="previousCriterion" aria-label="Előző szempont" '+(projectionSettings.selected===0?'disabled':'')+'>←</button><label>Szempont<select id="projectedCriterion">'+projectionSnapshot.items.map(it=>'<option value="'+it.index+'" '+(it.index===projectionSettings.selected?'selected':'')+'>'+String(it.index+1).padStart(2,'0')+' · '+esc(it.title)+'</option>').join('')+'</select></label><button class="secondary" id="nextCriterion" aria-label="Következő szempont" '+(projectionSettings.selected===19?'disabled':'')+'>→</button></div>';
 options.querySelector('select').onchange=e=>{projectionSettings.selected=Number(e.target.value);projectionSettings.namedPage=0;redraw();sendProjection();};
 options.querySelector('#previousCriterion').onclick=()=>{projectionSettings.selected=Math.max(0,projectionSettings.selected-1);projectionSettings.namedPage=0;redraw();sendProjection();};
 options.querySelector('#nextCriterion').onclick=()=>{projectionSettings.selected=Math.min(19,projectionSettings.selected+1);projectionSettings.namedPage=0;redraw();sendProjection();};
 }else if(projectionSettings.view==='distribution'){
 options.innerHTML='<div class="projection-pages">'+[0,1].map(page=>'<button data-page="'+page+'" aria-pressed="'+(projectionSettings.page===page)+'">'+(page===0?'01–10. szempont':'11–20. szempont')+'</button>').join('')+'</div>';
 options.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{projectionSettings.page=Number(b.dataset.page);redraw();sendProjection();});
 }else options.innerHTML='';
 if(!projectionSnapshot.unresolved&&projectionSettings.view==='single'&&projectionSettings.showNames){
  const rows=selectedProjectionData().namedRecords||[],pages=Math.max(1,Math.ceil(rows.length/6));projectionSettings.namedPage=Math.min(projectionSettings.namedPage,pages-1);
  options.insertAdjacentHTML('beforeend','<div class="projection-pages"><button id="previousNames" '+(projectionSettings.namedPage===0?'disabled':'')+'>← Előző nevek</button><span>Nevek · '+(projectionSettings.namedPage+1)+' / '+pages+'</span><button id="nextNames" '+(projectionSettings.namedPage===pages-1?'disabled':'')+'>Következő nevek →</button></div>');
  options.querySelector('#previousNames').onclick=()=>{projectionSettings.namedPage--;redraw();sendProjection();};
  options.querySelector('#nextNames').onclick=()=>{projectionSettings.namedPage++;redraw();sendProjection();};
 }
 status();
 };
 panel.querySelector('#projectionView').onchange=e=>{projectionSettings.view=e.target.value;redraw();sendProjection();};
 panel.querySelector('#projectionAudience').onchange=e=>{const index=Number(e.target.value);projectionSettings.scope=index<0?'class':'person';projectionSettings.seller=index<0?'':projectionSnapshot.roster[index];projectionSettings.namedPage=0;redraw();sendProjection();};
 panel.querySelector('#projectionNames').onchange=e=>{projectionSettings.showNames=e.target.checked;redraw();sendProjection();};
 panel.querySelector('#freezeProjection').onchange=e=>{projectionSettings.frozen=e.target.checked;if(!projectionSettings.frozen)projectionSnapshot=projectionData(cls,occasion,entries);status();sendProjection();};
 panel.querySelector('#openProjector').onclick=openProjector;
 redraw();sendProjection();
}


// Heartbeats preserve the data timestamp: a live window is not necessarily fresh data.
setInterval(sendProjection,10000);

function changeProjectionCriterionSet(cls,occasion){
 if(!projectionSnapshot||projectionSnapshot.classId!==cls.id||projectionSnapshot.occasionId!==occasion.id)return;
 projectionSettings.frozen=false;projectionSettings.selected=0;projectionSettings.page=0;projectionSettings.namedPage=0;
 projectionSnapshot=projectionData(cls,occasion,entries);sendProjection();
 if($('projectionControlPanel'))projectionControls(cls,occasion);
}
