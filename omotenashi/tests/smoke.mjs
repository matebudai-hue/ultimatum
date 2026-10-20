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
await page.goto(url);assert.equal(await page.getByText('Progrész kiválasztása').count(),0);assert.equal(await page.locator('#stage[aria-label="Navigáció a programban"]').count(),1);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);
await field('road.expectation').fill('Szeretném megkönnyíteni a kollégáim munkáját.');
await page.locator('[data-focus="2"]').check();await field('road.other').fill('Kiszámítható átadási folyamat.');
assert.equal(await page.locator('#ichigo-link').count(),1);
await page.locator('#ichigo-link').click();
assert.equal(new URL(page.url()).pathname,'/omotenashi/ichigo-ichie.html');
assert.equal(await page.locator('article.story').count(),5);

assert.equal(await page.locator('[data-workshop-case^="M"]').count(),6);
for(const id of ['M1','M2','M3','M4','M5','M6']){
 await page.locator('[data-workshop-case="'+id+'"]').click();
 assert.equal(await page.locator('#workshop-case-code').textContent(),id);
 assert.ok(await page.locator('#workshop-case-dialog').evaluate(el=>el.open),'M case modal not open: '+id);
 assert.ok((await page.locator('#workshop-case-story').textContent()).length>70);
 await page.locator('#workshop-case-close').click();
}
await page.locator('[data-workshop-case="M1"]').click();
await page.locator('#workshop-answer-one').fill('Először az ügyfél egyedi helyzetére kérdezünk rá.');
await page.locator('#workshop-answer-two').fill('A tanuló kolléga kipróbálja, utána visszajelzünk.');
assert.ok((await page.locator('#workshop-case-save-status').textContent()).includes('Mentve'));
await page.locator('#workshop-case-close').click();
await page.reload();
await page.locator('[data-workshop-case="M1"]').click();
assert.equal(await page.locator('#workshop-answer-one').inputValue(),'Először az ügyfél egyedi helyzetére kérdezünk rá.');
assert.equal(await page.locator('#workshop-answer-two').inputValue(),'A tanuló kolléga kipróbálja, utána visszajelzünk.');
await page.locator('#workshop-case-close').click();
assert.ok((await page.locator('#jelentes').textContent()).includes('egy élet, egy találkozás'));
assert.ok((await page.locator('#tortenet-2').textContent()).includes('Az értékesítő mindent tudott a korábbi vásárlóról.'));
assert.ok((await page.locator('#tortenet-3').textContent()).includes('Két ügyfél ugyanazt a Toyota Corollát veszi át.'));
assert.ok((await page.locator('#tortenet-4').textContent()).includes('a feleségét aznap reggel kórházba vitték'));
assert.ok((await page.locator('#tortenet-5').textContent()).includes('A vezető a korábbi találkozásokból alkotott képével dolgozott.'));
assert.ok((await page.locator('#torteneti').textContent()).includes('dokuza kannen'));
assert.ok((await page.locator('#omotenashi').textContent()).includes('Figyelmes, előrelátó gondoskodás'));
assert.ok((await page.locator('#kerdesek').textContent()).includes('A figyelem minősége azon is múlik, hogyan viszonyulunk a megszokotthoz.'));
assert.equal(await page.locator('#kerdesek .reflection-list li').count(),3);
assert.equal(await page.locator('#kerdesek .reflection-list li').nth(0).textContent(),"Mikor fordult elő, hogy egy visszatérő ügyfélről vagy munkatársról azt hitted, már tudod, mire van szüksége?");
assert.equal(await page.locator('#kerdesek .reflection-list li').nth(1).textContent(),"Mi derült ki csak később, amit egy jól feltett kérdéssel hamarabb megérthettél volna?");
assert.equal(await page.locator('#kerdesek .reflection-list li').nth(2).textContent(),"Kivel fogsz legközelebb tudatosan másként beszélgetni, és mit kérdezel meg tőle?");
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Ichigo mobile horizontal overflow');
await page.screenshot({path:root+'/build/omotenashi_qa/08_ichigo_mobile.png',fullPage:true});
await page.locator('.back').click();
assert.equal(await field('road.expectation').inputValue(),'Szeretném megkönnyíteni a kollégáim munkáját.');
assert.equal(await field('road.other').inputValue(),'Kiszámítható átadási folyamat.');
assert.equal(await page.locator('#andon-link').count(),1);
assert.equal(await page.locator('#standard-link').count(),1);
await page.locator('#andon-link').click();
assert.equal(new URL(page.url()).pathname,'/omotenashi/andon.html');
assert.equal(await page.locator('section.panel').count(),5);
assert.ok((await page.locator('#jelentes').textContent()).includes('Jidoka'));
assert.ok((await page.locator('#mukodes').textContent()).includes('Jelzés.'));
assert.ok((await page.locator('#pelda').textContent()).includes('Tíz perc múlva érkezik az ügyfél'));
assert.ok((await page.locator('#vezeto').textContent()).includes('Milyen eltérést'));
assert.ok(!(await page.locator('body').textContent()).includes('A workshopon a vezető és a munkatárs röviden eljátssza a jelzést és az első reakciót.'));

assert.equal(await page.locator('[data-workshop-case^="A"]').count(),4);
for(const id of ['A1','A2','A3','A4']){
 await page.locator('[data-workshop-case="'+id+'"]').click();
 assert.equal(await page.locator('#workshop-case-code').textContent(),id);
 assert.ok((await page.locator('#workshop-case-question').textContent()).startsWith('Te vagy a vezető.'));
 await page.locator('#workshop-case-close').click();
}
await page.locator('[data-workshop-case="A2"]').click();
await page.locator('#workshop-answer-one').fill('Az átadás előtt ellenőrizni kell a visszaigazolás tényét.');
await page.locator('#workshop-answer-two').fill('Köszönöm, hogy jelezted. Egyeztetek a felelőssel.');
await page.locator('#workshop-case-close').click();
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-workshop-cases-v1')).A2.one),'Az átadás előtt ellenőrizni kell a visszaigazolás tényét.');
{const overflow=await page.evaluate(()=>({window:innerWidth,scroll:document.documentElement.scrollWidth,x:scrollX,details:[...document.querySelectorAll('*')].map(el=>{let r=el.getBoundingClientRect();return {tag:el.tagName,cls:String(el.className).slice(0,35),id:el.id,text:el.textContent?.slice(0,36),right:Math.round(r.right+scrollX),left:Math.round(r.left+scrollX),client:el.clientWidth,scroll:el.scrollWidth,css:getComputedStyle(el).width};}).sort((a,b)=>b.right-a.right).slice(0,17)})); assert.ok(overflow.scroll<=overflow.window+1,'Andon mobile overflow: '+JSON.stringify(overflow));}
await page.screenshot({path:root+'/build/omotenashi_qa/09_andon_mobile.png',fullPage:true});
await page.locator('.back').click();
await page.locator('#standard-link').click();
assert.equal(new URL(page.url()).pathname,'/omotenashi/sztenderdizalas.html');
assert.equal(await page.locator('section.panel').count(),6);
assert.ok((await page.locator('#jelentes').textContent()).includes('taktidő'));
assert.equal(await page.locator('[data-workshop-case^="S"]').count(),3);
assert.ok((await page.locator('#elemek').textContent()).includes('megfigyelhető viselkedést'));
assert.ok((await page.locator('#pelda').textContent()).includes('biztonságos kipróbálásukra'));
assert.ok((await page.locator('#bevezetes').textContent()).includes('Megtanítod'));
assert.ok((await page.locator('#bevezetes').textContent()).includes('Kaizen'));

assert.ok((await page.locator('#sztenderd-helyzetek').textContent()).includes('PDCA'));
for(const [id,keyword] of [['S1','Ajánlat elküldve'],['S2','Mindjárt jön'],['S3','heti Kaizen-megbeszélésen']]){
 await page.locator('[data-workshop-case="'+id+'"]').click();
 assert.equal(await page.locator('#workshop-case-code').textContent(),id);
 assert.ok(await page.locator('#workshop-case-dialog').evaluate(el=>el.open));
 assert.ok((await page.locator('#workshop-case-story').textContent()).includes(keyword),'case text missing: '+id);
 assert.ok((await page.locator('#workshop-case-question').textContent()).includes('PDCA')||(await page.locator('#workshop-case-question').textContent()).includes('Kaizen'));
 await page.locator('#workshop-case-close').click();
}
await page.locator('[data-workshop-case="S2"]').click();
await page.locator('#workshop-answer-one').fill('A várakozás közbeni ügyfélélmény megfigyelése és közös gyakorlás.');
await page.locator('#workshop-answer-two').fill('PDCA: egy műszak próba, ügyfél-visszajelzés és heti Kaizen-egyeztetés.');
await page.locator('#workshop-case-close').click();
await page.reload();
await page.locator('[data-workshop-case="S2"]').click();
assert.equal(await page.locator('#workshop-answer-one').inputValue(),'A várakozás közbeni ügyfélélmény megfigyelése és közös gyakorlás.');
assert.equal(await page.locator('#workshop-answer-two').inputValue(),'PDCA: egy műszak próba, ügyfél-visszajelzés és heti Kaizen-egyeztetés.');
await page.locator('#workshop-case-close').click();

assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Standard mobile overflow');
await page.screenshot({path:root+'/build/omotenashi_qa/10_sztenderd_mobile.png',fullPage:true});
await page.locator('.back').click();
assert.equal(await field('road.expectation').inputValue(),'Szeretném megkönnyíteni a kollégáim munkáját.');


await page.screenshot({path:root+'/build/omotenashi_qa/01_road.png',fullPage:true});
await stage(1);
assert.equal(await page.locator('.pair-card').count(),1);
assert.equal(await page.locator('.pair-card').first().locator('.pair-question').count(),4);
assert.ok((await page.locator('.pair-card').first().textContent()).includes('Mi ebben a te vezetői szereped?'));
assert.ok((await page.locator('.pair-card').first().textContent()).includes('Mit próbáltál már, és mi történt?'));
assert.ok((await page.locator('.pair-card').first().textContent()).includes('Milyen kérdésre keresnél választ a gyárlátogatáson'));
await page.locator('.pair-card').first().locator('summary').click();
await field('pairs.0.partner').fill('Teszt Anna');
await field('pairs.0.note').fill('Kulcsokat keresünk az átadás előtt.');
await page.click('#add-pair');
assert.equal(await page.locator('.pair-card').count(),2);
assert.equal(await page.locator('.pair-card').last().locator('.pair-question').count(),4);
await field('pairs.1.note').fill('Második párcsere.');
await page.reload();assert.ok(await page.locator('#storage-warning').isHidden());await stage(2);
assert.equal(await page.locator('.focus-choice').count(),10);
assert.equal(await page.locator('[data-field="observations.4.evidence"]').count(),0); // Bus: selection only
await page.locator('[data-point-focus="4"]').check();
await page.locator('[data-point-focus="1"]').check();
assert.ok((await page.textContent('#focus-count')).includes('2 szempont kiválasztva'));
await page.reload();assert.equal(await page.locator('.focus-choice').first().locator('input').isChecked(),true);
assert.ok((await page.textContent('#focus-count')).includes('2 szempont kiválasztva'));
await page.locator('#next').click();
assert.equal(await page.locator('section.observation-entry').count(),2);
assert.ok(await page.locator('[data-observation="4"]').isVisible());
await page.locator('[data-observation-source="4"][data-source-value="1"]').click();
await field('observations.4.evidence').fill(evidence);
await page.reload();assert.equal(await field('observations.4.evidence').inputValue(),evidence);
assert.equal(await page.locator('[data-observation-source="4"][data-source-value="1"]').getAttribute('aria-pressed'),'true');
// Legacy notes on unselected topics and earlier connection data must remain accessible.
await page.evaluate(()=>{state.observations[8].evidence='Korábbi, most nem kijelölt megfigyelés.';state.observations[8].source=2;state.observations[4].connection='Az átadás előtti hiány legyen látható.';save();});
await page.reload();
assert.ok((await page.textContent('main')).includes('Korábbi jegyzetek más szempontokhoz (1)'));
await page.getByText('Korábbi jegyzetek más szempontokhoz (1)').click();
assert.equal(await field('observations.8.evidence').inputValue(),'Korábbi, most nem kijelölt megfigyelés.');
await stage(2);
await page.locator('#manage-points > summary').click();
await page.locator('[data-edit-point="4"]').click();
await field('observations.4.title').fill('Saját Andon-fókusz');
await field('observations.4.question').fill('Ki reagál, amikor segítséget kérnek?');
await page.click('#add-point');
await field('observations.10.title').fill('Átadási pont <script>window.bad=true</script>');
await field('observations.10.question').fill('Minden adat odaér?');
await page.locator('[data-edit-point="10"]').click();
assert.equal(await page.locator('.focus-choice').count(),11);
assert.ok((await page.textContent('#focus-count')).includes('3 szempont kiválasztva'));
await page.screenshot({path:root+'/build/omotenashi_qa/02_observations.png',fullPage:true});
page.once('dialog',d=>d.accept());await page.locator('[data-delete-point="0"]').click();
assert.equal(await page.locator('.focus-choice').count(),10);
await page.locator('#next').click();
assert.equal(await page.locator('section.observation-entry').filter({visible:true}).count(),3);
assert.ok((await page.textContent('main')).includes('Saját Andon-fókusz'));
assert.equal(await field('observations.3.evidence').inputValue(),evidence); // shifted after deletion
await field('observations.9.evidence').fill('Közös tábla mutatja a következő lépést.');
await page.getByText('Összegzés a látogatás után',{exact:true}).click();
await field('reflection.fact').fill('A probléma azonnal látszott.');
await field('reflection.meaning').fill('A kolléga nem maradt egyedül.');
await field('reflection.expectation').fill('Az ügyfélre több figyelem maradhat.');
await stage(4);for(const [p,v]of Object.entries({idea:'Látható jelzés',where:'Szervizfelvétel',trial:'Egy műszakban közös átadási lap',signal:'Kevesebb keresgélés'}))await field('kaizen.'+p).fill(v);
await page.screenshot({path:root+'/build/omotenashi_qa/03_kaizen.png',fullPage:true});
await stage(5);assert.equal(await page.locator('textarea.compact-answer').count(),7);for(let i=0;i<7;i++)await field('plan.'+i).fill('Terv '+(i+1)+' – konkrét változtatás');
await stage(6);assert.ok((await page.locator('section.panel').first().textContent()).includes('Segítő kérdések'));await page.getByText('Beszélgetőtársam',{exact:true}).click();await field('coaching.partner').fill('Teszt Béla');for(let i=0;i<4;i++)await field('coaching.answers.'+i).fill('Pontosítás '+(i+1));await field('plan.6').fill('Hétfőn 9-kor két kollégával kipróbálom.');
await page.screenshot({path:root+'/build/omotenashi_qa/04_coaching.png',fullPage:true});
await stage(7);assert.ok(await page.locator('#share-main').isVisible());assert.ok(await page.locator('#backup').isVisible());assert.ok(await page.locator('#report-preview').isHidden());await field('name').fill('Teszt résztvevő');
assert.equal(await page.evaluate(()=>typeof window.OmotSafety?.mirror),'function');
await page.evaluate(async()=>{await OmotSafety.mirror('notebook',JSON.stringify(state));});
const mirrored=await page.evaluate(async()=>JSON.parse(await OmotSafety.read('notebook')));
assert.equal(mirrored.road.expectation,'Szeretném megkönnyíteni a kollégáim munkáját.');
await page.getByText('Visszatöltés és haladó beállítások',{exact:true}).click();await page.click('#protect-data');
assert.ok((await page.textContent('#protect-feedback')).length>30);
const quizFixture={version:1,started:true,finished:false,current:2,mode:'pair',team:'Teszt páros',answers:Array(30).fill(null),finishedAt:''};quizFixture.answers[0]=1;
await page.evaluate(q=>localStorage.setItem('toyota-omotenashi-quiz-v1',JSON.stringify(q)),quizFixture);

let [dl]=await Promise.all([page.waitForEvent('download'),page.click('#backup')]);await dl.saveAs(root+'/build/omotenashi_qa/backup.json');
const exported=JSON.parse(await fs.readFile(root+'/build/omotenashi_qa/backup.json','utf8'));assert.equal(exported.state.observations.length,10);assert.equal(exported.state.pairs.length,2);assert.equal(exported.state.plan[6],'Hétfőn 9-kor két kollégával kipróbálom.');assert.equal(exported.quiz.answers[0],1);
assert.equal(exported.workshop.M1.one,'Először az ügyfél egyedi helyzetére kérdezünk rá.');
assert.equal(exported.workshop.A2.one,'Az átadás előtt ellenőrizni kell a visszaigazolás tényét.');
assert.equal(exported.workshop.S2.two,'PDCA: egy műszak próba, ügyfél-visszajelzés és heti Kaizen-egyeztetés.');
await page.getByText('További megosztási lehetőségek',{exact:true}).click();let [txt]=await Promise.all([page.waitForEvent('download'),page.click('#download-txt')]);await txt.saveAs(root+'/build/omotenashi_qa/report.txt');
const report=await fs.readFile(root+'/build/omotenashi_qa/report.txt','utf8');assert.ok(report.includes(evidence));assert.ok(report.includes('Második párcsere.'));assert.ok(report.includes('Hétfőn 9-kor'));assert.ok(report.includes('Szeretném megkönnyíteni'));
await page.click('#email');assert.ok(await page.locator('#email-help').isVisible()); // full long note is never silently truncated
await page.evaluate(()=>{window.print=()=>{window.didPrint=true;};});await page.click('#print');assert.equal(await page.evaluate(()=>window.didPrint),true);assert.ok((await page.textContent('#print-area')).includes(evidence));
assert.equal(await page.evaluate(()=>window.bad),undefined);
for(let i=0;i<8;i++){await stage(i);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile horizontal overflow on '+i);}
// Page closure, offline reopen and a second edit while offline.
await page.close();await ctx.setOffline(true);page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-notebook-v1')).road.expectation),'Szeretném megkönnyíteni a kollégáim munkáját.');
await page.locator('#ichigo-link').click();
assert.equal(await page.locator('article.story').count(),5);
await page.locator('[data-workshop-case="M1"]').click();
assert.equal(await page.locator('#workshop-answer-one').inputValue(),'Először az ügyfél egyedi helyzetére kérdezünk rá.');
await page.locator('#workshop-case-close').click();
assert.ok((await page.locator('#torteneti').textContent()).includes('Ii Naosuke'));
await page.locator('.back').click();
assert.ok((await page.locator('a[href="./andon.html"]').count())>=1);
await page.locator('a[href="./andon.html"]').last().click();
assert.ok((await page.locator('#jelentes').textContent()).includes('Jidoka'));
await page.locator('.back').click();
await page.locator('#standard-link').click();
assert.ok((await page.locator('#elemek').textContent()).includes('Mikor?'));
await page.locator('[data-workshop-case="S2"]').click();
assert.equal(await page.locator('#workshop-answer-two').inputValue(),'PDCA: egy műszak próba, ügyfél-visszajelzés és heti Kaizen-egyeztetés.');
await page.locator('#workshop-case-close').click();
await page.locator('.back').click();

assert.equal(await page.locator('#stage').inputValue(),'7'); // Return to the existing program stage.
await stage(0);
assert.equal(await field('road.expectation').inputValue(),'Szeretném megkönnyíteni a kollégáim munkáját.');

await stage(4);await field('kaizen.trial').fill('Offline is megmaradó próba');await page.reload();assert.equal(await field('kaizen.trial').inputValue(),'Offline is megmaradó próba');
await ctx.close();
// Full browser restart uses the same persistent browser profile.
ctx=await chromium.launchPersistentContext(profile,{headless:true,args:['--no-sandbox'],viewport:{width:390,height:844},acceptDownloads:true});await ctx.setOffline(true);page=await ctx.newPage();await page.goto(url);assert.equal(await field('kaizen.trial').inputValue(),'Offline is megmaradó próba');await ctx.setOffline(false);
// An updated app shell must retain edited, deleted and custom observation points.
const htmlPath=APP_DIR+'/index.html',original=await fs.readFile(htmlPath,'utf8');
try{await fs.writeFile(htmlPath,original.replace("APP_VERSION='2026.10.20.9'","APP_VERSION='2026.10.20.10'"));await page.reload();assert.equal(await page.evaluate(()=>APP_VERSION),'2026.10.20.10');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-notebook-v1')));assert.ok(!saved.observations.some(x=>x.template==='work'));assert.ok(saved.observations.some(x=>x.title==='Saját Andon-fókusz'));assert.ok(saved.observations.some(x=>x.question==='Minden adat odaér?'));assert.equal(saved.coaching.answers[0],'Pontosítás 1');}finally{await fs.writeFile(htmlPath,original);}
await stage(7);await page.setInputFiles('#import-file',{name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"invalid":true}')});await page.waitForFunction(()=>document.getElementById('import-message').textContent.length>0);assert.ok((await page.textContent('#import-message')).includes('nem érvényes'));assert.ok((await page.textContent('#report-preview')).includes('Offline is megmaradó próba'));
await page.evaluate(()=>{localStorage.removeItem('toyota-omotenashi-quiz-v1');localStorage.removeItem('toyota-omotenashi-workshop-cases-v1');});page.once('dialog',d=>d.accept());await page.setInputFiles('#import-file',root+'/build/omotenashi_qa/backup.json');await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('visszatöltöttük'));assert.ok((await page.textContent('#report-preview')).includes('Egy műszakban közös átadási lap'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-quiz-v1')).answers[0]),1);
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-workshop-cases-v1')).S2.two),'PDCA: egy műszak próba, ügyfél-visszajelzés és heti Kaizen-egyeztetés.');
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-workshop-cases-v1')).M1.one),'Először az ügyfél egyedi helyzetére kérdezünk rá.');
const second=await ctx.newPage();await second.goto(url);await stage(0);await field('road.expectation').fill('Az első lap legfrissebb jegyzete.');await second.locator('#storage-warning').waitFor({state:'visible'});await second.close();await page.reload();assert.equal(await field('road.expectation').inputValue(),'Az első lap legfrissebb jegyzete.');
await page.evaluate(async()=>{await OmotSafety.mirror('notebook',JSON.stringify(state));localStorage.removeItem('toyota-omotenashi-notebook-v1');});
await page.reload();
await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('toyota-omotenashi-notebook-v1')||'null')?.road.expectation==='Az első lap legfrissebb jegyzete.';}catch{return false;}});
await stage(0);assert.equal(await field('road.expectation').inputValue(),'Az első lap legfrissebb jegyzete.');
await ctx.close();
// Fresh desktop and quota error path.
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});

// Cross-device restore: a genuinely fresh browser context receives all 3 data groups.
{
 const bc=await browser.newContext({viewport:{width:390,height:844}});
 const bp=await bc.newPage();await bp.goto(url);
 assert.equal(await bp.evaluate(()=>localStorage.getItem('toyota-omotenashi-workshop-cases-v1')),null);
 await bp.selectOption('#stage','7');
 bp.once('dialog',d=>d.accept());
 await bp.setInputFiles('#import-file',root+'/build/omotenashi_qa/backup.json');
 await bp.waitForFunction(()=>document.getElementById('toast').textContent.includes('visszatöltöttük'));
 const backedUp=await bp.evaluate(()=>({
  notebook:JSON.parse(localStorage.getItem('toyota-omotenashi-notebook-v1')),
  quiz:JSON.parse(localStorage.getItem('toyota-omotenashi-quiz-v1')),
  workshop:JSON.parse(localStorage.getItem('toyota-omotenashi-workshop-cases-v1'))
 }));
 assert.equal(backedUp.notebook.plan[6],'Hétfőn 9-kor két kollégával kipróbálom.');
 assert.equal(backedUp.quiz.answers[0],1);
 assert.equal(backedUp.workshop.A2.one,'Az átadás előtt ellenőrizni kell a visszaigazolás tényét.');
 assert.equal(backedUp.workshop.S2.two,'PDCA: egy műszak próba, ügyfél-visszajelzés és heti Kaizen-egyeztetés.');
 await bp.locator('#standard-link').click();
 await bp.locator('[data-workshop-case="S2"]').click();
 assert.equal(await bp.locator('#workshop-answer-two').inputValue(),'PDCA: egy műszak próba, ügyfél-visszajelzés és heti Kaizen-egyeztetés.');
 await bp.locator('#workshop-case-close').click();await bp.locator('.back').click();
 // An older valid backup has no workshop section: do not erase newer local workshop notes.
 const older={format:'toyota-omotenashi-notebook',exportedAt:exported.exportedAt,state:exported.state,quiz:exported.quiz};
 bp.once('dialog',d=>d.accept());
 await bp.setInputFiles('#import-file',{name:'old-notebook.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(older))});
 await bp.waitForFunction(()=>document.getElementById('toast').textContent.includes('visszatöltöttük'));
 assert.equal(await bp.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-workshop-cases-v1')).S2.two),'PDCA: egy műszak próba, ügyfél-visszajelzés és heti Kaizen-egyeztetés.');
 // Corrupt workshop data must be rejected before overwriting any of the three datasets.
 const damaged={...older,workshop:{S2:{one:8,two:'malformed'}}};
 await bp.setInputFiles('#import-file',{name:'invalid-workshop.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(damaged))});
 await bp.waitForFunction(()=>document.getElementById('import-message').textContent.includes('workshopkártyák mentése érvénytelen'));
 assert.equal(await bp.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-workshop-cases-v1')).S2.two),'PDCA: egy műszak próba, ügyfél-visszajelzés és heti Kaizen-egyeztetés.');
 assert.equal(await bp.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-notebook-v1')).plan[6]),'Hétfőn 9-kor két kollégával kipróbálom.');
 await bc.close();
}
const isolated=await browser.newContext({viewport:{width:1280,height:900}});const desktop=await isolated.newPage();await desktop.goto(url);await desktop.selectOption('#stage','2');await desktop.screenshot({path:root+'/build/omotenashi_qa/05_desktop.png',fullPage:true});
await desktop.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};});await desktop.selectOption('#stage','0');await desktop.locator('[data-field="road.expectation"]').fill('Ez mentési hiba mellett is exportálható.');assert.ok((await desktop.textContent('#storage-warning')).includes('elsődleges helyi mentés sikertelen'));await desktop.selectOption('#stage','7');assert.ok((await desktop.textContent('#report-preview')).includes('Ez mentési hiba mellett is exportálható.'));
// Reopen previous releases: three pre-created blank cards become one, but authored notes survive.
{
 const lc=await browser.newContext({viewport:{width:390,height:844}});
 const lp=await lc.newPage();await lp.goto(url);
 await lp.evaluate(()=>{
  const old=fresh();
  const oldQuestions=[PAIR_QUESTIONS[0],'Mi ebben a te vezetői szereped? Mit próbáltál már, és mi történt?',PAIR_QUESTIONS[3]];
  old.pairs=oldQuestions.map(question=>({id:uid(),question,partner:'',note:''}));
  localStorage.setItem(KEY,JSON.stringify(old));
 });
 await lp.reload();await lp.selectOption('#stage','1');
 assert.equal(await lp.locator('.pair-card').count(),1);
 assert.equal(await lp.locator('.pair-question').count(),4);
 await lp.locator('[data-field="pairs.0.note"]').fill('A régi mentésből folytatott jegyzet.');
 await lp.reload();assert.equal(await lp.locator('[data-field="pairs.0.note"]').inputValue(),'A régi mentésből folytatott jegyzet.');
 await lc.close();
}
{
 const lc=await browser.newContext({viewport:{width:390,height:844}});
 const lp=await lc.newPage();await lp.goto(url);
 await lp.evaluate(()=>{
  const old=fresh();
  const oldQuestions=[PAIR_QUESTIONS[0],'Mi ebben a te vezetői szereped? Mit próbáltál már, és mi történt?',PAIR_QUESTIONS[3]];
  old.pairs=oldQuestions.map((question,i)=>({id:uid(),question,partner:i===1?'Páros kolléga':'',note:i===1?'Már korábban leírt fontos gondolat.':''}));
  localStorage.setItem(KEY,JSON.stringify(old));
 });
 await lp.reload();await lp.selectOption('#stage','1');
 assert.equal(await lp.locator('.pair-card').count(),1);
 assert.ok((await lp.locator('.pair-card').first().textContent()).includes('Korábbi jegyzet ehhez a kérdéshez'));
 assert.equal(await lp.locator('[data-field="pairs.0.note"]').inputValue(),'Már korábban leírt fontos gondolat.');
 await lp.locator('summary').last().click();
 assert.equal(await lp.locator('[data-field="pairs.0.partner"]').inputValue(),'Páros kolléga');
 await lc.close();
}

await browser.close();
if(errors.length)throw Error(errors.join('\n'));
let safari='not available';try{const b=await webkit.launch({headless:true});const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const pg=await c.newPage();await pg.goto(url);await pg.locator('[data-field="road.expectation"]').fill('Safari megmaradó jegyzet');await pg.reload();assert.equal(await pg.locator('[data-field="road.expectation"]').inputValue(),'Safari megmaradó jegyzet');await pg.selectOption('#stage','2');await pg.locator('[data-point-focus="0"]').check();await pg.selectOption('#stage','3');await pg.locator('[data-observation-source="0"][data-source-value="2"]').click();await pg.reload();assert.equal(await pg.evaluate(()=>JSON.parse(localStorage.getItem('toyota-omotenashi-notebook-v1')).observations[0].source),2);await b.close();safari='passed';}catch(error){if(!error.message.includes('Executable doesn\'t exist'))throw error;}
console.log(JSON.stringify({status:'pass',checks:['all 8 modules','compact auto-growing plan fields','coaching questions above collapsed plan','simple export actions','four prompts per discussion and added second partner','Ichigo theory and five stories online and offline','reading does not overwrite notes','Andon and standardized-work learning online and offline','bus selection transfers to factory notes','editable/addable/deletable observations','all plan and coaching fields','automatic local save','offline page reopen','IndexedDB rescue on missing primary save','full browser restart','app update preserves notes and custom/deleted points','JSON roundtrip and invalid import protection','TXT export','long email fallback','print report','mobile no overflow','HTML escaping','storage failure visible'],webkit:safari}));
server.close();
