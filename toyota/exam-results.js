'use strict';
let examData=null;
const EXAM_OUTCOMES=Object.freeze({pending:'Még nincs döntés',passed:'Megfelelt',failed:'Nem felelt meg'});
async function readExamResults(occasion){return occasion?.mode==='exam'?api('/rest/v1/rpc/get_exam_results',{target:occasion.id}):null;}
function examResultRows(data){
 return data.roster.map(name=>({name,...data.decisions.find(d=>d.seller===name),status:data.decisions.find(d=>d.seller===name)?.status||'pending'}));
}
function examSummaryLink(occasion){
 if(occasion.mode!=='exam')return '';
 const data=examData?.occasion_id===occasion.id?examData:null,decided=data?examResultRows(data).filter(r=>r.status!=='pending').length:0;
 return '<section class="exam-summary"><div><b>Tréneri vizsgaeredmények</b><span>'+decided+' / '+(data?.roster.length||'—')+' döntés rögzítve · személyenként egy végső eredmény</span></div><button class="secondary" id="openExamResults">Vizsgaeredmények →</button></section>';
}
function examResultsPanel(cls,occasion,readOnly=false){
 const data=examData?.occasion_id===occasion.id?examData:null;
 if(!data)return '<section class="panel"><h2>Vizsgaeredmények</h2><p>A vizsgaeredmények még nem töltődtek be. Frissítsd az oldalt.</p></section>';
 const rows=examResultRows(data),passed=rows.filter(r=>r.status==='passed').length,failed=rows.filter(r=>r.status==='failed').length;
 return '<section class="panel exam-results-panel"><div class="section-head"><div><div class="eyebrow">'+esc(occasion.name)+'</div><h2>Vizsgaeredmények</h2></div>'+(!readOnly?'<button class="secondary" id="downloadExamReport">Riport letöltése · CSV</button>':'')+'</div><p class="muted">A végső eredményt a tréner rögzíti. A megfigyelők pontszámai külön, az Értékelések nézetében láthatók.</p><div class="exam-counts"><span><i class="exam-status-dot passed"></i><b>'+passed+'</b> megfelelt</span><span><i class="exam-status-dot failed"></i><b>'+failed+'</b> nem felelt meg</span><span><i class="exam-status-dot pending"></i><b>'+(rows.length-passed-failed)+'</b> döntésre vár</span></div><div class="table-scroll"><table class="exam-results-table"><thead><tr><th>Név</th><th>Vizsgaeredmény</th><th>Rögzítés / módosítás</th>'+(!readOnly?'<th></th>':'')+'</tr></thead><tbody>'+rows.map((r,i)=>'<tr><td><b>'+esc(r.name)+'</b></td><td><span class="exam-outcome '+r.status+'"><i class="exam-status-dot '+r.status+'"></i>'+EXAM_OUTCOMES[r.status]+'</span></td><td class="muted">'+(r.updated_at?localStamp(r.updated_at):'—')+'</td>'+(!readOnly?'<td><button class="text-button" data-exam-person="'+i+'">'+(r.status==='pending'?'Eredmény rögzítése':'Módosítás')+'</button></td>':'')+'</tr>').join('')+'</tbody></table></div><p id="examReportStatus" class="muted" role="status"></p></section>';
}
function bindExamResults(cls,occasion,readOnly=false){
 const content=$(readOnly?'viewerContent':'adminContent');
 if($('openExamResults'))$('openExamResults').onclick=()=>{adminTab='exam';if(readOnly)renderViewerContent(cls,occasion);else renderAdminContent(cls,occasion);};
 if(readOnly||appRole!=='admin'||occasion.mode!=='exam')return;
 content.querySelectorAll('[data-exam-person]').forEach(button=>button.onclick=()=>examDecisionDialog(cls,occasion,examResultRows(examData)[Number(button.dataset.examPerson)]));
 if($('downloadExamReport'))action('downloadExamReport',async()=>{
  // Always fetch a consistent, current roster and decisions before generating a report.
  const fresh=await readExamResults(occasion);
  downloadExamCSV(fresh);
  if(classId===cls.id&&occasionId===occasion.id){examData=fresh;renderAdminContent(cls,occasion);if($('examReportStatus'))$('examReportStatus').textContent='A riport elkészült. A döntésre várók „Még nincs döntés” jelöléssel szerepelnek.';}
 });
}
function examDecisionDialog(cls,occasion,row){
 if(appRole!=='admin'||occasion.mode!=='exam')return;
 const rosterRevision=examData?.roster_revision;
 const d=modal('Vizsgaeredmény · '+row.name,'<p class="muted">'+esc(cls.name)+' · '+esc(occasion.name)+'</p><label>Tréneri döntés<select id="examOutcome">'+Object.entries(EXAM_OUTCOMES).map(([value,label])=>'<option value="'+value+'" '+(row.status===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label><p class="muted">Ez lesz a név mellett szereplő végső vizsgaeredmény, és ez kerül a riportba. A döntést később módosíthatod.</p><button class="primary" id="saveExamDecision">Vizsgaeredmény mentése</button><p id="examDecisionStatus" role="status"></p>');
 d.classList.add('exam-decision-dialog');
 action('saveExamDecision',async()=>{
  const outcome=$('examOutcome').value;
  try{
   const saved=await api('/rest/v1/rpc/set_exam_result',{target:occasion.id,participant:row.name,outcome,expected_revision:row.revision||0,expected_roster_revision:rosterRevision});
   if(classId===cls.id&&occasionId===occasion.id&&examData?.occasion_id===occasion.id){examData={...examData,decisions:[...examData.decisions.filter(r=>r.seller!==saved.seller),saved]};adminTab='exam';renderAdminContent(cls,occasion);}
   d.close();d.remove();
   if(classId===cls.id&&occasionId===occasion.id&&$('examReportStatus'))$('examReportStatus').textContent=row.name+' · '+EXAM_OUTCOMES[outcome]+' · elmentve';
  }catch(err){if(!$('examDecisionStatus'))return alertError(err);$('examDecisionStatus').textContent=err.message+(err.definitive?'':' A mentés eredménye nem biztos. Próbáld újra ugyanazzal a döntéssel, vagy frissítsd a listát.');}
 });
}
function examCSV(data){
 const cell=value=>{let text=String(value??'');if(/^[\s\uFEFF]*[=+@\-]/u.test(text)||/^[\t\r\n]/u.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
 return '\ufeff'+[['Név','Vizsgaeredmény'],...examResultRows(data).map(r=>[r.name,EXAM_OUTCOMES[r.status]])].map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
function downloadExamCSV(data){
 const url=URL.createObjectURL(new Blob([examCSV(data)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
 const filePart=v=>String(v||'').replace(/[^\p{L}\p{N}_-]/gu,'_');
 a.href=url;a.download='Toyota_'+filePart(data.class_name)+'_'+filePart(data.occasion_name)+'_vizsgaeredmenyek.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
