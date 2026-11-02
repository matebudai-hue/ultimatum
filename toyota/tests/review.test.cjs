'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=f=>fs.readFileSync(path.join(root,f),'utf8');
function context(){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{id,textContent:'',innerHTML:'',hidden:false,disabled:false,value:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},insertAdjacentHTML(position,html){this.innerHTML=position==='afterbegin'?html+this.innerHTML:this.innerHTML+html;},addEventListener(){}});return elements.get(id);};
 const events=[];
 const env={console,URLSearchParams,URL,TextDecoder,AbortController,Blob,TypeError,Date,crypto:require('node:crypto').webcrypto,location:{hash:'',search:'',origin:'https://example.test',pathname:'/toyota/'},navigator:{},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},document:{getElementById:element,addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];},body:{classList:{remove(){},add(){}},append(){}},createElement:()=>element('temporary')},setTimeout:()=>0,clearTimeout(){},setInterval(){},Event,window:{addEventListener(){},dispatchEvent(e){events.push(e.type);},scrollTo(){},print(){}}};
 const c=vm.createContext(env);c.events=events;c.el=element;return c;
}
function load(c,...files){for(const f of files)vm.runInContext(source(f),c,{filename:f});}
function ui(){const c=context();load(c,'stats.js','criteria.js','api.js','admin.js','projector-controller.js','viewer.js');vm.runInContext(source('observation.js').replace(/startApp\(\);\s*$/,''),c);return c;}
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
