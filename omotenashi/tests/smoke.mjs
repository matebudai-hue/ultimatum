import {chromium,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import http from 'node:http';
const root=process.env.GITHUB_WORKSPACE||'/workspace/scratch/d8c16b0e4375',url='http://127.0.0.1:8768/omotenashi/';
const key='toyota-omotenashi-notebook-v1',evidence='Sárga jelzésnél a kolléga segítséget kért; a vezető odament.';
const APP_DIR=process.env.OMOTENASHI_APP_DIR||root+'/build/omotenashi';
const profile=root+'/build/omotenashi_test_profile';
const server=http.createServer(async(req,res)=>{try{let pathname=new URL(req.url,'http://localhost').pathname;if(pathname.endsWith('/'))pathname+='index.html';const file=APP_DIR+pathname.replace(/^\/omotenashi/,'');const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':'text/html;charset=utf-8','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(8768,'127.0.0.1',resolve));
await fs.mkdir(root+'/build/omotenashi_qa',{recursive:true});
let ctx=await chromium.launchPersistentContext(profile,{headless:true,args:['--no-sandbox'],viewport:{width:390,height:844},acceptDownloads:true});
let page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const stage=async i=>page.selectOption('#stage',String(i));
const field=p=>page.locator(`[data-field="${p}"]`);
await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);
await field('road.expectation').fill('Szeretném megkönnyíteni a kollégáim munkáját.');
await page.locator('[data-focus="2"]').check();await field('road.other').fill('Kiszámítható átadási folyamat.');
await page.screenshot({path:root+'/build/omotenashi_qa/01_road.png',fullPage:true});
await stage(1);await field('pairs.0.partner').fill('Teszt Anna');await field('pairs.0.note').fill('Kulcsokat keresünk az átadás előtt.');
await field('pairs.1.note').fill('Egy egyértelmű közös hely kell.');await field('pairs.2.note').fill('Honnan látszik a munka állapota?');
await page.click('#add-pair');await field('pairs.3.note').fill('Negyedik párcsere.');
await page.reload();assert.ok(await page.locator('#storage-warning').isHidden());await stage(2);assert.equal(await page.locator('details.point').count(),10);
await page.locator('details.point').nth(4).locator('summary').click();
await page.locator('[data-point-focus="4"]').check();await field('observations.4.source').selectOption('1');await field('observations.4.evidence').fill(evidence);await field('observations.4.connection').fill('Az átadás előtti hiány legyen látható.');
await page.locator('[data-edit-point="4"]').click();await field('observations.4.title').fill('Saját Andon-fókusz');await field('observations.4.question').fill('Ki reagál, amikor segítséget kérnek?');
await page.click('#add-point');await field('observations.10.title').fill('Átadási pont <script>window.bad=true</script>');await field('observations.10.question').fill('Minden adat odaér?');await field('observations.10.evidence').fill('Közös tábla mutatja a következő lépést.');
await page.locator('[data-edit-point="10"]').click();await page.click('#focused-points');assert.equal(await page.locator('details.point').count(),2);
await page.screenshot({path:root+'/build/omotenashi_qa/02_observations.png',fullPage:true});
await page.click('#all-points');await page.locator('details.point').first().locator('summary').click();page.once('dialog',d=>d.accept());await page.locator('[data-delete-point="0"]').click();assert.equal(await page.locator('details.point').count(),10);
await stage(3);await field('reflection.fact').fill('A probléma azonnal látszott.');await field('reflection.meaning').fill('A kolléga nem maradt egyedül.');await field('reflection.expectation').fill('Az ügyfélre több figyelem maradhat.');
await stage(4);for(const [p,v]of Object.entries({idea:'Látható jelzés',where:'Szervizfelvétel',trial:'Egy műszakban közös átadási lap',signal:'Kevesebb keresgélés'}))await field('kaizen.'+p).fill(v);
await page.screenshot({path:root+'/build/omotenashi_qa/03_kaizen.png',fullPage:true});
await stage(5);for(let i=0;i<7;i++)await field('plan.'+i).fill('Terv '+(i+1)+' – konkrét változtatás');
await stage(6);await field('coaching.partner').fill('Teszt Béla');for(let i=0;i<4;i++)await field('coaching.answers.'+i).fill('Pontosítás '+(i+1));await field('plan.6').fill('Hétfőn 9-kor két kollégával kipróbálom.');
await page.screenshot({path:root+'/build/omotenashi_qa/04_coaching.png',fullPage:true});
await stage(7);await field('name').fill('Teszt résztvevő');
let [dl]=await Promise.all([page.waitForEvent('download'),page.click('#backup')]);await dl.saveAs(root+'/build/omotenashi_qa/backup.json');
const exported=JSON.parse(await fs.readFile(root+'/build/omotenashi_qa/backup.json','utf8'));assert.equal(exported.state.observations.length,10);assert.equal(exported.state.pairs.length,4);assert.equal(exported.state.plan[6],'Hétfőn 9-kor két kollégával kipróbálom.');
let [txt]=await Promise.all([page.waitForEvent('download'),page.click('#download-txt')]);await txt.saveAs(root+'/build/omotenashi_qa/report.txt');
const report=await fs.readFile(root+'/build/omotenashi_qa/report.txt','utf8');assert.ok(report.includes(evidence));assert.ok(report.includes('Negyedik párcsere.'));assert.ok(report.includes('Hétfőn 9-kor'));assert.ok(report.includes('Szeretném megkönnyíteni'));
await page.click('#email');assert.ok(await page.locator('#email-help').isVisible()); // full long note is never silently truncated
await page.evaluate(()=>{window.print=()=>{window.didPrint=true;};});await page.click('#print');assert.equal(await page.evaluate(()=>window.didPrint),true);assert.ok((await page.textContent('#print-area')).includes(evidence));
assert.equal(await page.evaluate(()=>window.bad),undefined);
for(let i=0;i<8;i++){await stage(i);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile horizontal overflow on '+i);}
// Page closure, offline reopen and a second edit while offline.
await page.close();await ctx.setOffline(true);page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-notebook-v1')).road.expectation),'Szeretném megkönnyíteni a kollégáim munkáját.');
await stage(4);await field('kaizen.trial').fill('Offline is megmaradó próba');await page.reload();assert.equal(await field('kaizen.trial').inputValue(),'Offline is megmaradó próba');
await ctx.close();
// Full browser restart uses the same persistent browser profile.
ctx=await chromium.launchPersistentContext(profile,{headless:true,args:['--no-sandbox'],viewport:{width:390,height:844},acceptDownloads:true});await ctx.setOffline(true);page=await ctx.newPage();await page.goto(url);assert.equal(await field('kaizen.trial').inputValue(),'Offline is megmaradó próba');await ctx.setOffline(false);
// An updated app shell must retain edited, deleted and custom observation points.
const htmlPath=APP_DIR+'/index.html',original=await fs.readFile(htmlPath,'utf8');
try{await fs.writeFile(htmlPath,original.replace("APP_VERSION='2026.10.16.2'","APP_VERSION='2026.10.16.3'"));await page.reload();assert.equal(await page.evaluate(()=>APP_VERSION),'2026.10.16.3');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-notebook-v1')));assert.ok(!saved.observations.some(x=>x.template==='work'));assert.ok(saved.observations.some(x=>x.title==='Saját Andon-fókusz'));assert.ok(saved.observations.some(x=>x.question==='Minden adat odaér?'));assert.equal(saved.coaching.answers[0],'Pontosítás 1');}finally{await fs.writeFile(htmlPath,original);}
await stage(7);await page.setInputFiles('#import-file',{name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"invalid":true}')});await page.waitForFunction(()=>document.getElementById('import-message').textContent.length>0);assert.ok((await page.textContent('#import-message')).includes('nem érvényes'));assert.ok((await page.textContent('#report-preview')).includes('Offline is megmaradó próba'));
page.once('dialog',d=>d.accept());await page.setInputFiles('#import-file',root+'/build/omotenashi_qa/backup.json');await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('visszatöltöttük'));assert.ok((await page.textContent('#report-preview')).includes('Egy műszakban közös átadási lap'));
const second=await ctx.newPage();await second.goto(url);await stage(0);await field('road.expectation').fill('Az első lap legfrissebb jegyzete.');await second.locator('#storage-warning').waitFor({state:'visible'});await second.close();await page.reload();assert.equal(await field('road.expectation').inputValue(),'Az első lap legfrissebb jegyzete.');await ctx.close();
// Fresh desktop and quota error path.
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const isolated=await browser.newContext({viewport:{width:1280,height:900}});const desktop=await isolated.newPage();await desktop.goto(url);await desktop.selectOption('#stage','2');await desktop.screenshot({path:root+'/build/omotenashi_qa/05_desktop.png',fullPage:true});
await desktop.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};});await desktop.selectOption('#stage','0');await desktop.locator('[data-field="road.expectation"]').fill('Ez mentési hiba mellett is exportálható.');assert.ok((await desktop.textContent('#storage-warning')).includes('nem engedi'));await desktop.selectOption('#stage','7');assert.ok((await desktop.textContent('#report-preview')).includes('Ez mentési hiba mellett is exportálható.'));await browser.close();
if(errors.length)throw Error(errors.join('\n'));
let safari='not available';try{const b=await webkit.launch({headless:true});const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const pg=await c.newPage();await pg.goto(url);await pg.locator('[data-field="road.expectation"]').fill('Safari megmaradó jegyzet');await pg.reload();assert.equal(await pg.locator('[data-field="road.expectation"]').inputValue(),'Safari megmaradó jegyzet');await pg.selectOption('#stage','2');await pg.locator('details.point').first().locator('summary').click();await pg.locator('[data-field="observations.0.source"]').selectOption('2');await pg.reload();assert.equal(await pg.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-notebook-v1')).observations[0].source),2);await b.close();safari='passed';}catch(error){if(!error.message.includes('Executable doesn\'t exist'))throw error;}
console.log(JSON.stringify({status:'pass',checks:['all 8 modules','3 pair questions and added round','editable/addable/deletable observations','all plan and coaching fields','automatic local save','offline page reopen','full browser restart','app update preserves notes and custom/deleted points','JSON roundtrip and invalid import protection','TXT export','long email fallback','print report','mobile no overflow','HTML escaping','storage failure visible'],webkit:safari}));
server.close();
