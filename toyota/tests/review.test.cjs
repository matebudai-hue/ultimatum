'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=f=>fs.readFileSync(path.join(root,f),'utf8');
function context(){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{id,textContent:'',innerHTML:'',hidden:false,disabled:false,value:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},insertAdjacentHTML(position,html){this.innerHTML=position==='afterbegin'?html+this.innerHTML:this.innerHTML+html;},addEventListener(){},reportValidity(){return true;},focus(){},select(){}});return elements.get(id);};
 const events=[];
 const env={console,URLSearchParams,URL,TextDecoder,AbortController,Blob,TypeError,Date,crypto:require('node:crypto').webcrypto,location:{hash:'',search:'',origin:'https://example.test',pathname:'/toyota/',href:'https://example.test/toyota/#admin'},navigator:{},history:{replaceState(){}},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},document:{getElementById:element,addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];},body:{classList:{remove(){},add(){}},append(){}},createElement:()=>element('temporary')},setTimeout:()=>0,clearTimeout(){},setInterval(){},Event,window:{addEventListener(){},dispatchEvent(e){events.push(e.type);},scrollTo(){},print(){}}};
 const c=vm.createContext(env);c.events=events;c.el=element;return c;
}
function load(c,...files){for(const f of files)vm.runInContext(source(f),c,{filename:f});}
function ui(hash=''){const c=context();c.location.hash=hash;load(c,'stats.js','criteria.js','criteria-history.js','api.js','roster-actions.js','admin.js','exam-results.js','comparison.js','projector-controller.js','viewer.js','auth-recovery.js','observation-admin.js');vm.runInContext(source('observation.js').replace(/startApp\(\);\s*$/,''),c);return c;}
test('names-only paste retains mail, UTF-8 and Windows-1250 import preserve Hungarian characters',async()=>{
 const c=ui();
 const csv='Árvíztűrő Tükörfúrógép;t@example.hu';
 c.file={arrayBuffer:async()=>new TextEncoder().encode(csv).buffer};
 assert.equal(await vm.runInContext('decodeRosterFile(file)',c),csv);
 c.file={arrayBuffer:async()=>Uint8Array.from([84,243,116,104,32,80,233,116,101,114]).buffer};
 assert.equal(await vm.runInContext('decodeRosterFile(file)',c),'Tóth Péter');
 // Exercise the actual paste handler with a roster draft and an existing email.
 vm.runInContext(`modal=()=>({querySelector:selector=>selector==='textarea'?{value:'Tóth Péter'}:$('applyPaste'),close(){}});adminTab='roster';renderAdminContent({roster:['Tóth Péter'],contacts:{'Tóth Péter':'old@example.hu'}},null);$('pasteRoster').onclick();$('applyPaste').onclick();api=async(path,body)=>{captured=body;};dashboard=async()=>{};`,c);
 await c.el('saveRoster').onclick({currentTarget:c.el('saveRoster')});
 assert.equal(vm.runInContext('captured.changes[0].email',c),'old@example.hu');
});
test('result has explicit unsubmitted status, one submit primary, neutral practice styling',()=>{
 const c=ui();vm.runInContext(`context={mode:'practice'};state=fresh('passenger');state.done=true;state.scores.fill(2);result();`,c);
 const html=c.el('app').innerHTML;
 assert.match(html,/még nincs beküldve/);assert.match(html,/Még egy lépés/);assert.doesNotMatch(html,/result pass/);
 assert.match(html,/class="secondary" id="email"/);assert.match(html,/class="secondary" id="reset"/);assert.equal(c.el('sendGroup').textContent,'Beküldés az osztályhoz');
});
test('definitive rejection unlocks editing; uncertain delivery preserves UUID for retry',async()=>{
 for(const definitive of [true,false]){
  const c=ui();c.definitive=definitive;
  vm.runInContext(`context={mode:'practice'};state=fresh('passenger');state.done=true;state.scores.fill(2);state.seller='Minta Anna';state.observer='Minta Péter';api=async()=>{const e=Error('Teszt');e.definitive=definitive;throw e;};alertError=()=>{};result();`,c);
  await c.el('sendGroup').onclick({currentTarget:c.el('sendGroup')});
  assert.equal(vm.runInContext('state.startedSending',c),!definitive);
  assert.equal(c.el('edit').hidden,!definitive);
  assert.equal(vm.runInContext('Boolean(state.submission)',c),!definitive);
 }
});
test('request errors distinguish rejected writes from timeouts and proxy replies',async()=>{
 const c=ui();c.fetch=async()=>({ok:false,status:400,text:async()=>JSON.stringify({code:'P0001',message:'Ez az alkalom lezárult.'})});
 await assert.rejects(()=>vm.runInContext("rawApi('/rest/v1/rpc/test',{},'')",c),e=>e.definitive&&e.status===400);
 c.fetch=async()=>({ok:false,status:502,text:async()=>'<html>Bad gateway</html>'});
 await assert.rejects(()=>vm.runInContext("rawApi('/rest/v1/rpc/test',{},'')",c),e=>!e.definitive&&/szokatlan/.test(e.message));
 c.fetch=async()=>{const e=Error();e.name='AbortError';throw e;};
 await assert.rejects(()=>vm.runInContext("rawApi('/rest/v1/rpc/test',{},'')",c),e=>!e.definitive&&/túl sokáig/.test(e.message));
});
test('expired session never silently falls back to anonymous admin reads',async()=>{
 const c=ui();vm.runInContext('adminActive=true',c);let fetched=false;c.fetch=async()=>{fetched=true;};
 await assert.rejects(()=>vm.runInContext("api('/rest/v1/classes')",c),e=>e.status===401);
 assert.equal(fetched,false);assert.ok(c.events.includes('toyota-session-expired'));
});
test('projector sends names only on request and marks detached selection as disconnected',()=>{
 const c=ui();vm.runInContext(`projectionSnapshot={classId:'c',occasionId:'a',namedRecords:[{seller:'Minta Anna',observer:'Minta Péter',scores:Array(20).fill(2)}],roster:['Minta Anna'],items:[],submissions:1};classId='c';occasionId='a';adminActive=true;`,c);
 assert.equal(vm.runInContext('Object.hasOwn(selectedProjectionData(),"namedRecords")',c),false);
 vm.runInContext('projectionSettings.showNames=true',c);assert.equal(vm.runInContext('selectedProjectionData().namedRecords.length',c),1);
 vm.runInContext("occasionId='other'",c);assert.equal(vm.runInContext('selectedProjectionData().liveConnected',c),false);
});
test('named projector pages contain at most six forms and escape names',()=>{
 const c=ui();load(c,'projection.js');
 c.data={showNames:true,view:'single',selected:0,namedPage:1,namedRecords:Array.from({length:14},(_,i)=>({seller:'Minta <Anna> '+i,observer:'Péter',scores:Array(20).fill(i%3)}))};
 const html=vm.runInContext('namesPanel(data)',c);
 assert.equal((html.match(/class="named-person"/g)||[]).length,6);
 assert.match(html,/2 \/ 3 oldal/);assert.match(html,/&lt;Anna&gt;/);assert.doesNotMatch(html,/Minta <Anna>/);
});

function viewerFixture(c){
 c.fixture={classes:[{id:'class-a',name:'Minta osztály',kind:'passenger',roster:['Résztvevő 01'],show_names:false,access_expires_at:null}],occasions:[{id:'opaque-occasion',name:'Első kör',mode:'practice'}],class_id:'class-a',occasion_id:'opaque-occasion',entries:[{id:'r1',seller:'Résztvevő 01',observers:{name:'Megfigyelő 01'},scores:Array(20).fill(2),created_at:'2026-11-02T08:00:00Z',notes:''}]};
}
test('viewer workspace exposes result tools without admin mutations or roster contacts',async()=>{
 const c=ui();viewerFixture(c);vm.runInContext("appRole='viewer';api=async()=>fixture;",c);
 await vm.runInContext('dashboard()',c);
 const html=c.el('app').innerHTML;
 assert.match(html,/Csak olvasási hozzáférés/);assert.match(html,/viewerProject/);
 assert.doesNotMatch(html,/id="(?:newClass|newOcc|deleteClass|showQr|viewerAccess|saveRoster|toggleClassClosed)"/);
 assert.equal(vm.runInContext('appRole',c),'viewer');
});
test('viewer revocation clears loaded data, details and projector even when frozen',async()=>{
 const c=ui();viewerFixture(c);c.messages=[];
 vm.runInContext("appRole='viewer';adminActive=true;classes=fixture.classes;classId='class-a';entries=fixture.entries;projectionSettings.frozen=true;projectionSnapshot={classId:'class-a'};projectorWindow={closed:false,postMessage:m=>messages.push(m)};api=async()=>{throw requestError('A hozzáférést visszavonták.',403,true);};",c);
 await vm.runInContext('viewerDashboard()',c);
 assert.equal(vm.runInContext('entries.length+classes.length',c),0);
 assert.equal(vm.runInContext('projectionSnapshot',c),null);
 assert.ok(c.messages.some(m=>m.type==='toyota-projection-cleared'));
 assert.match(c.el('app').innerHTML,/nincs megnyitható eredmény/);
});
test('hiding names invalidates a frozen named projection on the next permission check',async()=>{
 const c=ui();viewerFixture(c);c.messages=[];
 vm.runInContext("appRole='viewer';classId='class-a';classes=[{...fixture.classes[0],show_names:true}];projectionSettings.frozen=true;projectionSnapshot={classId:'class-a',namedRecords:[{seller:'Titkos Anna'}]};projectorWindow={closed:false,postMessage:m=>messages.push(m)};api=async()=>fixture;",c);
 await vm.runInContext('viewerDashboard()',c);
 assert.equal(vm.runInContext('projectionSnapshot',c),null);
 assert.ok(c.messages.some(m=>m.type==='toyota-projection-cleared'));
 assert.doesNotMatch(c.el('app').innerHTML,/Titkos Anna/);
});
test('pagination rejects a changed permission scope rather than merging older named records',async()=>{
 const c=ui();viewerFixture(c);
 vm.runInContext("calls=0;api=async()=>{calls++;return {...fixture,classes:calls===1?fixture.classes:[{...fixture.classes[0],show_names:true}],entries:calls===1?Array(500).fill(fixture.entries[0]):[]};};",c);
 await assert.rejects(()=>vm.runInContext('loadViewerWorkspace()',c),e=>e.status===403);
});
test('verified sessions route admins and viewers through the same login without granting new roles',async()=>{
 for(const role of ['admin','viewer',null]){
  const c=ui();c.role=role;vm.runInContext("rawApi=async()=>role;rememberAdminSession=()=>{};dashboard=async()=>{openedRole=appRole;};",c);
  if(role){await vm.runInContext("acceptAppSession({access_token:'synthetic-test-token'})",c);assert.equal(vm.runInContext('openedRole',c),role);}
  else await assert.rejects(()=>vm.runInContext("acceptAppSession({access_token:'synthetic-test-token'})",c),/nincs engedélyezett hozzáférés/);
 }
});

test('recovery accepts only project recovery links and explicitly supported local redirects',()=>{
 const c=ui();
 const valid='https://wmhyreahavyslxcqlqli.supabase.co/auth/v1/verify?token=synthetic-hash&type=recovery';
 c.link=valid;assert.equal(vm.runInContext('parseRecoveryLink(link).tokenHash',c),'synthetic-hash');
 for(const bad of [valid.replace('wmhyreahavyslxcqlqli','other-project'),valid.replace('recovery','signup'),'javascript:alert(1)']){c.link=bad;assert.throws(()=>vm.runInContext('parseRecoveryLink(link)',c));}
 c.link='http://localhost:3000/#access_token=synthetic&refresh_token=synthetic&type=recovery';
 assert.equal(vm.runInContext('parseRecoveryLink(link).session.access_token',c),'synthetic');
});
test('recovery callbacks never open the dashboard or persist the recovery session',async()=>{
 const c=ui('#access_token=synthetic&refresh_token=synthetic&type=recovery');
 vm.runInContext("started=false;startPasswordRecovery=async s=>{started=s.access_token;};acceptAppSession=async()=>{throw Error('Dashboard must not open');};",c);
 await vm.runInContext('startApp()',c);assert.equal(vm.runInContext('started',c),'synthetic');assert.equal(vm.runInContext('adminSession',c),null);
});
test('requesting recovery does not require the old password or send the admin bearer',async()=>{
 const c=ui();c.calls=[];vm.runInContext("rawApi=async(...args)=>{calls.push(args);return {};};recoveryRequestScreen('minta@example.invalid');",c);
 c.el('recoveryEmail').value='minta@example.invalid';
 await c.el('recoveryRequest').onsubmit({preventDefault(){}});
 assert.equal(c.calls[0][2],'');assert.match(c.calls[0][0],/^\/auth\/v1\/recover\?redirect_to=/);
 assert.equal(c.calls[0][1].email,'minta@example.invalid');assert.match(c.el('recoveryMessage').textContent,/Ha ehhez a címhez tartozik fiók/);
});
test('new password uses only the verified recovery token and rejects mismatched entries',async()=>{
 const c=ui();c.calls=[];
 vm.runInContext("access='existing-admin-token';rawApi=async(...args)=>{calls.push(args);return {id:'sample-user',email:'minta@example.invalid'};};",c);
 await vm.runInContext("startPasswordRecovery({access_token:'recovery-token'})",c);
 assert.equal(vm.runInContext('adminSession',c),null);
 c.el('newPassword').value='Synthetic phrase for testing';c.el('repeatPassword').value='Different synthetic phrase';
 await c.el('newPasswordForm').onsubmit({preventDefault(){}});assert.equal(c.calls.filter(x=>x[3]==='PUT').length,0);
 c.el('repeatPassword').value=c.el('newPassword').value;
 await c.el('newPasswordForm').onsubmit({preventDefault(){}});
 const put=c.calls.find(x=>x[3]==='PUT');assert.equal(put[2],'recovery-token');assert.equal(put[0],'/auth/v1/user');
 assert.equal(vm.runInContext('recoverySession',c),null);assert.equal(c.el('newPassword').value,'');assert.match(c.el('authMsg').textContent,/elmentettük/);
});
test('uncertain password write explains trying the new login without claiming success',async()=>{
 const c=ui();vm.runInContext("rawApi=async(path,body,token,method)=>{if(method==='PUT')throw requestError('timeout',0);return {id:'sample-user'};};",c);
 await vm.runInContext("startPasswordRecovery({access_token:'recovery-token'})",c);
 c.el('newPassword').value='Synthetic test phrase';c.el('repeatPassword').value='Synthetic test phrase';
 await c.el('newPasswordForm').onsubmit({preventDefault(){}});
 assert.match(c.el('passwordMessage').textContent,/Próbálj belépni az új jelszóval/);assert.doesNotMatch(c.el('passwordMessage').textContent,/elmentettük/);
});
test('only admins see per-record withdrawal actions',()=>{
 const c=ui();viewerFixture(c);
 vm.runInContext("appRole='viewer';",c);assert.doesNotMatch(vm.runInContext('resultsTable(fixture.classes[0],fixture.occasions[0],fixture.entries)',c),/data-withdraw-record/);
 vm.runInContext("appRole='admin';",c);assert.match(vm.runInContext('resultsTable(fixture.classes[0],fixture.occasions[0],fixture.entries)',c),/data-withdraw-record="r1"/);
});
test('withdrawn source records invalidate frozen viewer projections, and internal IDs are never projected',async()=>{
 const c=ui();viewerFixture(c);
 vm.runInContext("appRole='viewer';classId='class-a';occasionId='opaque-occasion';classes=fixture.classes;projectionSettings.frozen=true;projectionSnapshot={classId:'class-a',occasionId:'opaque-occasion',sourceIds:['r1','removed-id']};api=async()=>fixture;",c);
 await vm.runInContext('viewerDashboard()',c);
 assert.equal(vm.runInContext('projectionSettings.frozen',c),false);assert.equal(vm.runInContext('Object.hasOwn(selectedProjectionData(),"sourceIds")',c),false);
});

test('saved IDs align reordered snapshots without changing original records',()=>{
 const c=ui();
 vm.runInContext(`const baseline=CRITERIA_BASELINE.passenger;const scores=baseline.map((_,i)=>i%3);const original={scores,criteria_snapshot:baseline,criteria_version:'toyota-2026-11-v1'};const reordered={scores:[...scores].reverse(),criteria_snapshot:[...baseline].reverse(),criteria_version:'toyota-2026-11-v1'};const before=JSON.stringify(reordered);const aligned=CriterionSets.groups('passenger',[original,reordered]);`,c);
 assert.equal(vm.runInContext('aligned.length',c),1);
 assert.equal(vm.runInContext('JSON.stringify(aligned[0].records[0].scores)===JSON.stringify(aligned[0].records[1].scores)',c),true);
 assert.equal(vm.runInContext('JSON.stringify(reordered)===before',c),true);
});
test('changed definitions and unknown originals cannot silently join the current criteria',()=>{
 const c=ui();vm.runInContext(`const scores=Array(20).fill(2),base={scores,criteria_version:'toyota-2026-11-v1'};const modified=CRITERIA_BASELINE.passenger.map(it=>({...it}));modified[0].title='Megváltozott szempont';const duplicate=modified.map(it=>({...it,id:'duplicate'}));const mixed=CriterionSets.groups('passenger',[base,{scores},{...base,criteria_snapshot:modified},{...base,criteria_version:'future-v2'},{...base,criteria_snapshot:duplicate}]);`,c);
 assert.equal(vm.runInContext('mixed.length',c),4);
 assert.equal(vm.runInContext('mixed.find(g=>g.original).records.length',c),2);
 assert.equal(vm.runInContext('mixed.filter(g=>g.unresolved).length',c),2);
 assert.equal(vm.runInContext("CriterionSets.definition('passenger',{scores:[NaN]})",c),null);
});
test('selected version drives both admin and projection values and keeps keys internal',()=>{
 const c=ui();vm.runInContext(`const cls={id:'c',kind:'passenger',name:'Minta',roster:['Anna']},occ={id:'a',name:'Első',mode:'practice'};occasionId='a';const items=CRITERIA_BASELINE.passenger.map(it=>({...it}));items[0].title='Új cím';const records=[{id:'one',seller:'Anna',observers:{name:'Péter'},scores:Array(20).fill(0),created_at:'2026-01-01'},{id:'two',seller:'Anna',observers:{name:'Dóra'},scores:Array(20).fill(2),criteria_version:'v2',criteria_snapshot:items,created_at:'2026-02-01'}];projectionSnapshot=projectionData(cls,occ,records);`,c);
 assert.equal(vm.runInContext('projectionSnapshot.submissions',c),1);
 assert.equal(vm.runInContext('projectionSnapshot.items[0].title',c),'Új cím');
 assert.equal(vm.runInContext('criterionMeans(cls,records)[0].mean',c),2);
 assert.equal(vm.runInContext('Object.hasOwn(selectedProjectionData(),"criteriaKey")',c),false);
 vm.runInContext("criteriaSelections.set('c:a',CriterionSets.groups('passenger',records).find(g=>g.original).key);projectionSnapshot=projectionData(cls,occ,records);",c);
 assert.equal(vm.runInContext('projectionSnapshot.items[0].mean',c),0);
 assert.equal(vm.runInContext('projectionSnapshot.submissions',c),1);
});
test('comparison puts escaped feedback first and only differing criteria before the full sheet',()=>{
 const c=ui();vm.runInContext(`const cls={kind:'passenger'},occ={mode:'practice'};appRole='admin';const records=[{id:'1',seller:'Anna',scores:Array(20).fill(2),observers:{name:'Péter'},notes:'<script>teszt</script>',created_at:'2026-01-01'},{id:'2',seller:'Anna',scores:[0,...Array(19).fill(2)],observers:{name:'Dóra'},notes:'Pontosítsa a következő lépést.',created_at:'2026-01-01'}];const html=comparisonContent(cls,occ,records);`,c);
 const html=vm.runInContext('html',c);
 assert.ok(html.indexOf('Szöveges visszajelzések')<html.indexOf('Hol tértek el'));
 assert.match(html,/&lt;script&gt;teszt/);assert.doesNotMatch(html,/<script>/);
 assert.match(html,/1 \/ 20 szempont/);assert.match(html,/2 pont eltérés/);
 assert.match(html,/<details class="comparison-more"><summary>Mind a 20 szempont/);
 vm.runInContext("appRole='viewer';cls.show_names=false;",c);
 const hidden=vm.runInContext('comparisonContent(cls,occ,records)',c);
 assert.doesNotMatch(hidden,/teszt|data-withdraw-record/);assert.match(hidden,/nincs megosztva/);
});
test('original archive matches today but remains independent of later current-list edits',()=>{
 const c=ui();
 assert.equal(vm.runInContext('CriterionSets.canonical(exams.passenger.items)===CriterionSets.canonical(CRITERIA_BASELINE.passenger)',c),true);
 vm.runInContext("exams.passenger.items[0].title='Jövőbeli cím';",c);
 assert.equal(vm.runInContext('CRITERIA_BASELINE.passenger[0].title',c),'A hívás indítása');
});
test('unknown list shows no fabricated labels or per-criterion named scores on projection',()=>{
 const c=ui();load(c,'projection.js');c.data={items:[],unresolved:true,submissions:1,view:'single',showNames:true,namedRecords:[{seller:'Anna',observer:'Péter',scores:Array(20).fill(2)}],className:'Minta',mode:'Megfigyelés',occasion:'Első',scope:'class',observed:1,people:1,updated:'Most'};
 vm.runInContext('render(data)',c);
 assert.match(c.el('screen').innerHTML,/eredeti szempontlista hiányzik/);
 assert.doesNotMatch(c.el('screen').innerHTML,/named-person|Anna|A hívás indítása/);
});
test('person projection uses selected version scores and exact distribution',()=>{
 const c=ui();vm.runInContext(`const cls={id:'c',name:'Minta',kind:'passenger',roster:['Anna','Péter']},occ={id:'a',name:'Első',mode:'practice'};occasionId='a';const records=[{id:'1',seller:'Anna',observers:{name:'Péter'},scores:Array(20).fill(2)},{id:'2',seller:'Anna',observers:{name:'Dóra'},scores:Array(20).fill(0)},{id:'3',seller:'Péter',observers:{name:'Anna'},scores:Array(20).fill(2)}];projectionSnapshot=projectionData(cls,occ,records);projectionSettings.scope='person';projectionSettings.seller='Anna';const payload=selectedProjectionData();`,c);
 assert.equal(vm.runInContext('payload.items[0].mean',c),1);
 assert.equal(vm.runInContext('JSON.stringify(payload.items[0].counts)',c),'[1,0,1]');
 assert.equal(vm.runInContext('payload.submissions',c),2);
});

test('exam CSV contains each roster member once, explicit decisions, and pending without score inference',()=>{
 const c=ui();c.reportData={roster:['Kiss Dóra','Tóth Péter','Minta Anna'],decisions:[{seller:'Kiss Dóra',status:'failed'},{seller:'Tóth Péter',status:'passed'},{seller:'Régi Név',status:'passed'}]};
 const csv=vm.runInContext('examCSV(reportData)',c);
 assert.equal(csv,'\ufeff"Név";"Vizsgaeredmény"\r\n"Kiss Dóra";"Nem felelt meg"\r\n"Tóth Péter";"Megfelelt"\r\n"Minta Anna";"Még nincs döntés"\r\n');
 assert.doesNotMatch(csv,/Régi Név|@|Pont/);
});
test('CSV quotes Hungarian names and neutralizes spreadsheet formulas',()=>{
 const c=ui();c.reportData={roster:['=SUM(1;2)',' +képlet','Kiss "Dóra";teszt'],decisions:[]};const csv=vm.runInContext('examCSV(reportData)',c);
 assert.match(csv,/"'=SUM\(1;2\)"/);assert.match(csv,/"' \+képlet"/);assert.match(csv,/"Kiss ""Dóra"";teszt"/);
});
test('trainer result is independent of observer totals and read-only viewers cannot edit or export',()=>{
 const c=ui();vm.runInContext(`const cls={name:'Minta',roster:['Anna']},occ={id:'a',mode:'exam',name:'Vizsga'};examData={occasion_id:'a',roster:['Anna'],decisions:[]};entries=[{seller:'Anna',scores:Array(20).fill(2)}];appRole='admin';`,c);
 const html=vm.runInContext('examResultsPanel(cls,occ)',c);assert.match(html,/Még nincs döntés/);assert.match(html,/data-exam-person="0"/);assert.match(html,/downloadExamReport/);assert.doesNotMatch(html,/>Megfelelt</);
 const readonly=vm.runInContext('examResultsPanel(cls,occ,true)',c);assert.doesNotMatch(readonly,/data-exam-person|downloadExamReport/);
});
test('saving sends the captured participant and revision; persists only after server success',async()=>{
 const c=ui();c.el('adminContent').querySelectorAll=()=>[];
 vm.runInContext(`appRole='admin';classId='c';occasionId='a';const cls={id:'c',name:'Minta'},occ={id:'a',name:'Vizsga',mode:'exam'};examData={occasion_id:'a',roster_revision:2,roster:['Anna'],decisions:[{seller:'Anna',status:'failed',revision:3}]};modal=()=>({classList:{add(){}},close(){},remove(){}});renderAdminContent=()=>{};api=async(path,body)=>{captured=body;return {seller:'Anna',status:body.outcome,revision:4,updated_at:'2026-11-02T12:00:00Z'};};examDecisionDialog(cls,occ,examResultRows(examData)[0]);$('examOutcome').value='passed';`,c);
 await c.el('saveExamDecision').onclick({currentTarget:c.el('saveExamDecision')});
 assert.equal(vm.runInContext('captured.expected_revision',c),3);assert.equal(vm.runInContext('captured.expected_roster_revision',c),2);assert.equal(vm.runInContext('captured.participant',c),'Anna');assert.equal(vm.runInContext('examData.decisions[0].status',c),'passed');
 vm.runInContext(`api=async()=>{const e=Error('A döntést közben módosították.');e.definitive=true;throw e;};examDecisionDialog(cls,occ,examResultRows(examData)[0]);$('examOutcome').value='failed';`,c);
 await c.el('saveExamDecision').onclick({currentTarget:c.el('saveExamDecision')});
 assert.equal(vm.runInContext('examData.decisions[0].status',c),'passed');assert.match(c.el('examDecisionStatus').textContent,/közben/);
});
test('report download reads fresh server decisions and practice makes no result request',async()=>{
 const c=ui();c.el('adminContent').querySelectorAll=()=>[];
 vm.runInContext(`appRole='admin';classId='c';occasionId='a';const cls={id:'c'},occ={id:'a',mode:'exam'};examData={occasion_id:'a',roster:['Anna'],decisions:[]};let reads=0;api=async()=>{reads++;return {occasion_id:'a',roster:['Anna'],decisions:[{seller:'Anna',status:'passed'}]};};downloadExamCSV=data=>{exported=data;};renderAdminContent=()=>{};bindExamResults(cls,occ);`,c);
 await c.el('downloadExamReport').onclick({currentTarget:c.el('downloadExamReport')});
 assert.equal(vm.runInContext('exported.decisions[0].status',c),'passed');assert.equal(vm.runInContext('reads',c),1);
 assert.equal(await vm.runInContext("readExamResults({id:'p',mode:'practice'})",c),null);assert.equal(vm.runInContext('reads',c),1);
});

test('inactive participants stay in history but disappear from editable roster and gain restore action',()=>{
 const c=ui();vm.runInContext(`appRole='admin';adminTab='roster';const cls={id:'c',roster:['Anna','Béla'],inactive_roster:['Anna'],contacts:{Anna:'a@example.invalid'}};renderAdminContent(cls,null);`,c);
 assert.equal(vm.runInContext('JSON.stringify(activeRoster(cls))',c),'["Béla"]');
 assert.doesNotMatch(c.el('rosterRows').innerHTML,/value="Anna"/);assert.match(c.el('rosterRows').innerHTML,/value="Béla"/);assert.match(c.el('rosterRows').innerHTML,/data-remove-person/);
 assert.match(c.el('adminContent').innerHTML,/data-restore-person="Anna"/);
 assert.equal(vm.runInContext('cls.roster.length',c),2);
});
test('participant removal saves only an explicit target and guards unsaved roster edits',async()=>{
 const c=ui();vm.runInContext(`appRole='admin';rosterDirty=true;let opened=0;modal=()=>{opened++;return {classList:{add(){}},close(){},remove(){}};};alertError=e=>{message=e.message;};const cls={id:'c',name:'Minta',roster_revision:4};participantActiveDialog(cls,'Anna');`,c);
 assert.equal(vm.runInContext('opened',c),0);assert.match(vm.runInContext('message',c),/mentsd el/);
 vm.runInContext(`rosterDirty=false;api=async(path,body)=>{captured=body;};dashboard=async()=>{};participantActiveDialog(cls,'Anna');`,c);
 await c.el('confirmParticipantActive').onclick({currentTarget:c.el('confirmParticipantActive')});
 assert.equal(vm.runInContext('captured.participant',c),'Anna');assert.equal(vm.runInContext('captured.active',c),false);assert.equal(vm.runInContext('captured.expected_roster_revision',c),4);
 vm.runInContext(`participantActiveDialog(cls,'Anna',true);`,c);await c.el('confirmParticipantActive').onclick({currentTarget:c.el('confirmParticipantActive')});assert.equal(vm.runInContext('captured.active',c),true);
});
