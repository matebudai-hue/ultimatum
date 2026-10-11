const {JSDOM}=require('jsdom');
const test=require('node:test');
const fs=require('node:fs');const assert=require('node:assert/strict');
const base=require('node:path').join(__dirname,'../dist/');
const E=require(base+'engine.js');const R=require(base+'roster.js');
const pots=Array.from({length:4},(_,p)=>Array.from({length:8},(_,i)=>`Autó ${p+1}–${i+1}`));
function page(storage={}){
 const dom=new JSDOM(fs.readFileSync(base+'index.html','utf8'),{url:'https://autos-bajnokok-ligaja.mbudai.chatgpt.site',runScripts:'outside-only'}),w=dom.window,d=w.document;
 const timers=new Map();let tid=0;const errors=[];let captured=null;
 w.setTimeout=(fn,ms)=>{timers.set(++tid,{fn,ms});return tid;};w.clearTimeout=id=>timers.delete(id);w.scrollTo=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.Blob=Blob;w.URL.createObjectURL=blob=>{captured=blob;return 'blob:test';};w.URL.revokeObjectURL=()=>{};
 d.addEventListener('click',e=>{if(e.target.tagName==='A')e.preventDefault();});
 w.addEventListener('error',e=>errors.push(e.error));for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
 for(const file of ['engine.js','roster.js','app.js'])w.eval(fs.readFileSync(base+file,'utf8'));
 const get=id=>d.getElementById(id);const flush=()=>{for(const [id,t] of [...timers])if(t.ms<=450){timers.delete(id);t.fn();}};
 function click(selector){const el=selector.startsWith('#')?get(selector.slice(1)):d.querySelector(selector);assert(el,selector+' is present');assert(!el.disabled,selector+' is enabled');el.click();assert.deepEqual(errors,[]);return el;}
 function fill(values=pots){values.forEach((p,k)=>p.forEach((n,i)=>{get('setupForm').elements['car-'+k+'-'+i].value=n;}));get('setupForm').dispatchEvent(new w.Event('input',{bubbles:true}));}
 const state=()=>JSON.parse(w.localStorage.getItem('autos-bl-v1'));
 const snapshot=()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return [k,w.localStorage.getItem(k)];}));
 function start(){get('setupForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(get('setupError'),null);assert(state());}
 return {w,d,get,click,fill,flush,state,snapshot,start,errors,blob:()=>captured,close:()=>dom.window.close()};
}
async function tick(){await Promise.resolve();await Promise.resolve();}
test('A felület gombjai: mentés, visszatöltés, új játék, teljes torna és több lap szinkronja',async()=>{
 let p=page();assert.equal(p.d.querySelectorAll('#setupForm input').length,32);p.fill();p.click('#setupSaveRoster');assert.deepEqual(R.load(p.w.localStorage).pots,pots);assert.equal(p.get('totalCount').textContent,'32 / 32 autó megadva');
 let stored=p.snapshot();p.close();p=page(stored);assert.equal(p.get('setupForm').elements['car-3-7'].value,pots[3][7]);p.start();
 const first=p.state();const match=E.derive(first).match;p.click('[data-winner="'+match.a+'"]');assert.equal(p.state().events.length,1);assert.equal(p.d.querySelectorAll('[data-winner]')[0].disabled,true);p.d.querySelectorAll('[data-winner]')[0].click();assert.equal(p.state().events.length,1);p.flush();p.click('[data-view="table"]');assert.match(p.get('main').textContent,/Tabella/);assert.equal(p.d.querySelectorAll('tbody tr').length,32);p.click('[data-car="'+match.a+'"]');assert.match(p.get('main').textContent,/2 pont/);p.click('#backTable');p.click('[data-view="play"]');p.click('#undoButton');assert.equal(p.state().events.length,0);
 p.click('[data-winner]');p.flush();stored=p.snapshot();p.close();p=page(stored);assert.equal(p.state().events.length,1);assert.equal(p.state().seed,first.seed);assert.equal(p.d.querySelector('[data-winner]').dataset.winner,E.derive(p.state()).match.a);
 p.click('#newButton');assert.equal(p.get('confirmDialog').open,true);p.click('#dialogCancel');await tick();assert.equal(p.state().events.length,1);p.click('#newButton');p.click('#dialogOK');await tick();assert.equal(p.state(),null);assert.equal(p.get('setupForm').elements['car-0-0'].value,pots[0][0]);p.start();assert.equal(p.state().events.length,0);assert.deepEqual(p.state().cars,first.cars);p.close();
 console.log('PASS: 32 autó mentése, újranyitás, eredménybevitel, dupla kattintás, tabella, adatlap, visszavonás, új bajnokság és megerősítés.');
 p=page();p.fill();p.click('#exportRosterButton');const exported=JSON.parse(await p.blob().text());assert.deepEqual(exported.pots,pots);p.start();const game=JSON.stringify(p.state());
 async function importFile(raw){const input=p.get('importFile');Object.defineProperty(input,'files',{configurable:true,value:[{size:JSON.stringify(raw).length,text:async()=>JSON.stringify(raw)}]});input.dispatchEvent(new p.w.Event('change'));await tick();}
 const other=pots.map(x=>x.map(n=>'Másik '+n));await importFile(R.pack(other));p.click('#dialogCancel');await tick();assert.equal(JSON.stringify(p.state()),game);
 await importFile(R.pack(other));p.click('#dialogOK');await tick();assert.equal(p.state(),null);assert.equal(p.get('setupForm').elements['car-2-4'].value,other[2][4]);p.click('#setupSaveRoster');p.get('setupForm').elements['car-2-4'].value='módosítva';p.click('#setupLoadRoster');assert.equal(p.get('setupForm').elements['car-2-4'].value,other[2][4]);
 await importFile({version:1});assert.match(p.get('toast').textContent,/Nem sikerült betölteni/);p.start();p.click('#exportButton');assert.equal(JSON.parse(await p.blob().text()).cars.length,32);p.close();
 console.log('PASS: autólista és bajnokság letöltése, betöltés elfogadása/elutasítása, elmentett autók visszaállítása, sérült fájl elutasítása.');
 p=page();p.fill();p.start();let games=0;while(true){const d=E.derive(p.state());if(d.champion)break;if(d.match){const t=d.match,win=d.current.need>1&&t.wins.length<2*(d.current.need-1)?(t.wins.length%2?t.b:t.a):t.a;p.click('[data-winner="'+win+'"]');p.flush();games++;}else p.click('#advanceButton');if(games>175)throw Error('Túl sok mérkőzés.');}
 assert.equal(games,175);assert(p.get('restartChampion'));p.click('[data-view="schedule"]');assert.equal(p.d.querySelectorAll('[data-edit]').length,151);p.click('[data-view="bracket"]');assert.equal(p.d.querySelectorAll('.tie-card').length,23);p.click('[data-view="play"]');p.click('#restartChampion');p.click('#dialogOK');await tick();assert.equal(p.state(),null);assert.equal(p.get('totalCount').textContent,'32 / 32 autó megadva');p.close();
 console.log('PASS: a tényleges gombkezelőkkel végigvitt 175 meccses torna, 2/3/5 győzelmes párharcok, meccslista, kieséses ág és döntő utáni új játék.');
 p=page();p.fill();p.start();const sameSeed=E.create(other,p.state().seed);const file=p.get('importFile');Object.defineProperty(file,'files',{value:[{size:JSON.stringify(sameSeed).length,text:async()=>JSON.stringify(sameSeed)}]});file.dispatchEvent(new p.w.Event('change'));await tick();p.click('#dialogOK');await tick();assert.deepEqual(R.load(p.w.localStorage).pots,other,'A beolvasott bajnokság autóit azonos sorsolási seed esetén is menteni kell.');p.close();
 console.log('PASS: másik bajnokság importja azonos sorsolási azonosítóval is frissíti az autólistát.');
 // A másik megnyitott lapban új bajnokságot kezdenek: a régi állás ne maradjon kattintható.
 p=page();p.fill();p.start();p.w.localStorage.removeItem('autos-bl-v1');p.w.dispatchEvent(new p.w.StorageEvent('storage',{key:'autos-bl-v1',newValue:null}));assert(p.get('setupForm'),'Másik lapból törölt bajnokságnál a kezdőlapnak kell megjelennie.');p.close();
 console.log('PASS: több megnyitott lap állapotváltása.');
});
