'use strict';
// Isolated visual review uses sample data and never makes an API request.
startApp=async function(){
 const params=new URLSearchParams(location.search),page=params.get('screen')||'admin';
 const names=['Kiss Dóra','Farkas András','Tóth Péter','Szabó Réka','Nagy Ágnes','Varga Bálint','Molnár Eszter','Balogh Gábor','Horváth Zsófia','Papp Tamás','Kovács Nóra','Fekete Levente'];
 const cls={id:'sample-class',name:'Novemberi osztály',kind:'passenger',roster:names,contacts:{}};
 const occ={id:'sample-occasion',class_id:cls.id,name:'November 6. · Első gyakorlás',mode:'practice'};
 const records=names.slice(0,9).flatMap((name,i)=>Array.from({length:i<5?2:1},(_,j)=>({
  id:'sample-'+i+'-'+j,seller:name,observers:{name:names[(i+j+1)%names.length],occasion_id:occ.id},
  scores:exams.passenger.items.map((_,k)=>k===19?(i%3===0?0:1):k===14?(i%2===0?0:1):k===11?2:(i+k+j)%7===0?0:(i+k)%3===0?1:2),
  notes:'A bemutató közben az ügyfél válaszaiból indult tovább. A következő lépést érdemes pontosabban egyeztetni.',
  created_at:new Date(Date.UTC(2026,10,6,9,42-i,j*15)).toISOString()
 })));
 if(params.get('versions')==='1'){
  const items=exams.passenger.items.map(it=>({...it}));items[0].title='A hívás indítása és az alkalmas időpont egyeztetése';items.reverse();
  const original=records[1];records.push({...original,id:'sample-future',criteria_version:'sample-future-v2',criteria_snapshot:items,scores:items.map((_,i)=>i%3),notes:'Másik szempontlista: ezt az értékelést külön összesítjük.',created_at:'2026-11-06T10:00:00.000Z'});
 }
 if(params.get('unresolved')==='1')records.push({...records[0],id:'sample-unknown',criteria_version:'unknown-v9',criteria_snapshot:null,created_at:'2026-11-06T11:00:00.000Z'});
 if(params.get('exam')==='1'){occ.mode='exam';occ.name='November 6. · Vizsga';}
 let sampleDecisions=names.slice(0,7).map((seller,i)=>({seller,status:i===3?'failed':'passed',revision:1,updated_at:'2026-11-06T12:30:00Z'}));
 const sampleExamData=()=>({occasion_id:occ.id,roster_revision:0,class_name:cls.name,occasion_name:occ.name,kind:cls.kind,roster:names,decisions:sampleDecisions});
 const viewerOccasions=[{...occ},{id:'sample-exam',class_id:cls.id,name:'November 6. · Vizsga',mode:'exam'}];
 let grants=[{id:'sample-grant',email:'katalin.kovacs@example.invalid',show_names:false,expires_at:new Date(Date.now()+30*86400000).toISOString(),created_at:new Date().toISOString(),revoked_at:null}];
 rawApi=async(path,body,token,method)=>{if(path.startsWith('/auth/v1/recover'))return {};if(path==='/auth/v1/user'&&method!=='PUT')return {id:'sample-user',email:'minta@example.invalid'};if(path==='/auth/v1/user'&&method==='PUT')return {id:'sample-user'};if(path.startsWith('/auth/v1/logout'))return {};throw Error('Mintaadatokkal működő előnézet; valódi fiókművelet nem történik.');};
 api=async(path,body)=>{
  if(path.endsWith('/set_class_participant_active')){cls.inactive_roster=body.active?(cls.inactive_roster||[]).filter(n=>n!==body.participant):[...new Set([...(cls.inactive_roster||[]),body.participant])];cls.roster_revision=(cls.roster_revision||0)+1;return true;}

  if(path.endsWith('/get_exam_results'))return sampleExamData();
  if(path.endsWith('/set_exam_result')){const previous=sampleDecisions.find(r=>r.seller===body.participant);if((previous?.revision||0)!==body.expected_revision&&previous?.status!==body.outcome)throw Error('A vizsgaeredményt közben módosították.');const saved={seller:body.participant,status:body.outcome,revision:(previous?.revision||0)+1,updated_at:new Date().toISOString()};sampleDecisions=[...sampleDecisions.filter(r=>r.seller!==body.participant),saved];return saved;}

  if(path.endsWith('/list_withdrawn_observations'))return body.row_offset?[]:records.filter(r=>r.withdrawn_at);
  if(path.endsWith('/set_observation_withdrawn')){const record=records.find(r=>r.id===body.target);record.withdrawn_at=body.withdrawn?new Date().toISOString():null;record.withdrawn_reason=body.reason;return true;}
  if(path.endsWith('/list_viewer_access'))return grants;
  if(path.endsWith('/manage_viewer_access')){const row={id:'sample-grant-'+grants.length,email:body.recipient,show_names:body.names_visible,expires_at:body.lifetime_days?new Date(Date.now()+body.lifetime_days*86400000).toISOString():null,created_at:new Date().toISOString(),revoked_at:null};grants=[row,...grants.filter(r=>r.email!==row.email)];return row.id;}
  if(path.endsWith('/revoke_viewer_access')){grants.find(r=>r.id===body.target).revoked_at=new Date().toISOString();return true;}
  if(path.endsWith('/viewer_workspace')){
   const showNames=params.get('names')==='1',selected=body.target_occasion||occ.id;
   const roster=showNames?names:names.map((_,i)=>'Résztvevő '+String(i+1).padStart(2,'0'));
   return {exam_results:viewerOccasions.find(a=>a.id===selected)?.mode==='exam'?{roster,decisions:sampleDecisions.map(r=>({...r,seller:showNames?r.seller:roster[names.indexOf(r.seller)]}))}:null,classes:[{...cls,contacts:undefined,show_names:showNames,access_expires_at:grants[0].expires_at,roster:showNames?names:names.map((_,i)=>'Résztvevő '+String(i+1).padStart(2,'0'))}],occasions:viewerOccasions,class_id:cls.id,occasion_id:selected,
   entries:body.row_offset?[]:records.filter(r=>!r.withdrawn_at).map(r=>({...r,seller:showNames?r.seller:'Résztvevő '+String(names.indexOf(r.seller)+1).padStart(2,'0'),observers:{name:showNames?r.observers.name:'Megfigyelő minta',occasion_id:selected},scores:selected==='sample-exam'?r.scores.map((n,i)=>i%5===0?0:n):r.scores,notes:showNames?r.notes:''}))};
  }
  if(body!==undefined)throw Error('Ez mintaadatokkal működő előnézet. A módosításokhoz az éles alkalmazást használd.');
  if(path.includes('/classes'))return [cls];
  if(path.includes('/occasions'))return [occ];
  if(path.includes('/observations'))return records.filter(r=>!r.withdrawn_at);
  return [];
 };
 if(params.get('closed')==='class')cls.closed_at=new Date().toISOString();
 if(params.get('closed')==='occasion')occ.closed_at=new Date().toISOString();
 if(page==='login'){loginScreen();return;}
 if(page==='recover'){recoveryRequestScreen();return;}
 if(page==='new-password'){await startPasswordRecovery({access_token:'sample-only-no-token'});return;}
 if(page==='participant'||page==='result'){
  context={className:cls.name,kind:'passenger',mode:'practice',occasion:occ.name,roster:names};
  state=fresh('passenger');state.observer='Farkas András';state.seller='Kiss Dóra';state.step=1;state.scores[5]=2;
  if(page==='result'){state.scores=records[0].scores.slice();state.notes=records[0].notes;state.done=true;}
  choosing=false;render();
 }else if(page==='viewer'){appRole='viewer';await viewerDashboard();}
 else{appRole='admin';if(page==='exam-results')adminTab='exam';if(page==='roster')adminTab='roster';await dashboard();if(page==='access')await viewerAccessDialog(cls);}
};

