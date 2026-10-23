import {resultsHTML} from './quiz-results.mjs?v=10';
import {describeAnswer} from './engine.mjs?v=14';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function resultGroups(s,catalog){
 const groups=Object.entries(s.testing.tests).map(([id,target])=>{const day=catalog.days.find(d=>id===d.id+'/'+(d.quizVersion||'v1')||id.startsWith(d.id+'/'));return {id,title:day?.title||'Korábbi teszt',dayId:day?.id,practice:false,target};});
 groups.push({id:'practice',title:'Gyakorlótesztek',practice:true,target:s.testing.practice});
 return groups.filter(g=>g.target.attempts.length||g.target.draft);
}
function groupCard(g,index){
 const {attempts,draft}=g.target,first=attempts[0],last=attempts.at(-1),best=attempts.reduce((a,b)=>!a||b.score/b.max>a.score/a.max?b:a,null);
 return `<article class="card result-group"><h3>${esc(g.title)}</h3>${last?`<dl class="group-scores"><div><dt>Elsőre</dt><dd>${first.score}<small> / ${first.max}</small></dd></div><div><dt>Legutóbb</dt><dd>${last.score}<small> / ${last.max}</small></dd></div><div><dt>Legjobb</dt><dd>${best.score}<small> / ${best.max}</small></dd></div></dl><p class="small muted">${attempts.filter(a=>!a.legacy).length} lezárt kitöltés${attempts.some(a=>a.legacy)?' · korábbi eredmények is megőrizve':''}</p><button class="primary" data-open-result="${index}">Válaszok és megoldások</button>`:'<p class="small muted">Még nincs lezárt kitöltés.</p>'}${draft?`<p class="small muted">Folyamatban: ${Object.keys(draft.values).length} / ${draft.items.length} válasz mentve.</p><button data-continue-result="${index}">Folytatom a kitöltést</button>`:''}</article>`;
}
function notesHTML(s,catalog){
 const notes=Object.entries(s.caseNotes||{}).map(([key,values])=>{const [dayId,id]=key.split('/'),c=catalog.days.find(d=>d.id===dayId)?.cases?.find(c=>c.id===id);if(!c||!Object.values(values).some(Boolean))return '';return `<details><summary>${esc(c.title)}</summary><div>${catalog.casePrompts.map((p,n)=>`<p><strong>${esc(p)}</strong></p><p class="case-text">${esc(values[n]||'Még nincs válasz.')}</p>`).join('')}</div></details>`;}).filter(Boolean);
 return notes.length?`<details><summary>Esettanulmányos jegyzeteim · ${notes.length} eset</summary><div>${notes.join('')}</div></details>`:'';
}
function archivesHTML(s,catalog){
 const archives=catalog.days.flatMap(d=>(d.questionArchives||[]).map(a=>{const qs=a.questions.filter(q=>s.answers[d.id+'/'+q.id]);if(!qs.length)return '';return `<details><summary>${esc(d.title)} · ${esc(a.title)}</summary><div><p class="small muted">A korábbi rendszerben rögzített válaszaid. Ezek nem egyben lezárt tesztkörök.</p>${qs.map(q=>{const a=s.answers[d.id+'/'+q.id];return `<details><summary>${esc(q.title)}</summary><div><p class="small">Elsőre: ${a.first.score} · Legutóbb: ${a.current.score} · Legjobb: ${a.best} / ${q.max} pont</p><p><strong>Első válaszod</strong><br>${describeAnswer(q,a.first.value).map(esc).join('<br>')}</p><p><strong>Legutóbbi válaszod</strong><br>${describeAnswer(q,a.current.value).map(esc).join('<br>')}</p></div></details>`;}).join('')}</div></details>`;})).filter(Boolean);
 return archives.length?`<details><summary>Korábbi kérdéssorok</summary><div>${archives.join('')}</div></details>`:'';
}
export function mountResults(root,s,catalog,{exportResult,restoreResult,goToTest}){
 const groups=resultGroups(s,catalog);let opened=null,attemptIndex=-1,selected=-1;
 const find=id=>root.querySelector('#'+id);
 const draw=()=>{
  if(opened!==null){
   const g=groups[opened],attempt=g.target.attempts[attemptIndex];
   root.innerHTML=`<button id="back-results" class="results-back">← Összes eredmény</button><h2 class="results-title">${esc(g.title)}</h2><label class="field result-attempt-picker">Melyik kitöltést nézed?<select id="result-attempt">${g.target.attempts.map((a,n)=>`<option value="${n}" ${n===attemptIndex?'selected':''}>${a.legacy?esc(a.label||'Átvett korábbi eredmény'):n+1+'. kitöltés'}${!a.legacy&&n===0?' · első':''}${n===g.target.attempts.length-1?' · legutóbbi':''} · ${a.score}/${a.max}</option>`).join('')}</select></label>${attempt.legacy?'<p class="small muted">Korábbi válaszokból átvett összesítés; a lezárás időpontja nem ismert.</p>':`<p class="small muted">${esc(new Date(attempt.at).toLocaleString('hu-HU'))}</p>`}${resultsHTML(attempt,selected,{practice:g.practice,actions:false,rewardLabel:attempt.legacy?'Átvételkor jóváírt jutalom':'Ebben a körben kapott jutalom'})}`;
   find('back-results').onclick=()=>{opened=null;draw();root.scrollIntoView({block:'start'})};
   find('result-attempt').onchange=e=>{attemptIndex=+e.target.value;selected=-1;draw()};
   root.querySelectorAll('[data-result-index]').forEach(b=>b.onclick=()=>{selected=+b.dataset.resultIndex;draw();find('solution-title').focus({preventScroll:true});find('result-detail').scrollIntoView({block:'nearest'})});return;
  }
  root.innerHTML=`<h2 class="results-title">Eredményeim</h2><dl class="card results-wallet"><div><dt>Megszereztem</dt><dd>${s.earned}</dd></div><div><dt>Elköltöttem</dt><dd>${s.spent}</dd></div><div><dt>Elkölthetem</dt><dd>${s.earned-s.spent}</dd></div></dl>${groups.length?groups.map(groupCard).join(''):'<div class="card"><p>Még nincs teszteredményed. A Napok fülön indíthatsz tesztet.</p><button id="first-test" class="primary">Megnézem a teszteket</button></div>'}${notesHTML(s,catalog)}${archivesHTML(s,catalog)}<details><summary>Mentés és átvitel</summary><div><p class="small muted">Töltsd le az eredményeidet és a termedet egy fájlban. Ezt átadhatod a trénernek, vagy visszatöltheted másik eszközön.</p><div class="actions"><button id="export" class="primary">Mentés letöltése</button><label class="btn">Mentés visszatöltése<input id="restore" type="file" accept=".json" hidden></label></div></div></details>`;
  find('export').onclick=exportResult;
  find('restore').onchange=async e=>{const file=e.target.files[0];if(file)await restoreResult(file);e.target.value='';};
  if(find('first-test'))find('first-test').onclick=()=>goToTest(catalog.days[0].id,false);
  root.querySelectorAll('[data-open-result]').forEach(b=>b.onclick=()=>{opened=+b.dataset.openResult;attemptIndex=groups[opened].target.attempts.length-1;selected=-1;draw();root.scrollIntoView({block:'start'})});
  root.querySelectorAll('[data-continue-result]').forEach(b=>b.onclick=()=>{const g=groups[+b.dataset.continueResult];goToTest(g.dayId||catalog.days[0].id,g.practice)});
 };
 draw();
}
