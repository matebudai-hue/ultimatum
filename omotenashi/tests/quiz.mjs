import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const root=process.env.GITHUB_WORKSPACE||'/workspace/scratch/d8c16b0e4375';
const dir=process.env.OMOTENASHI_APP_DIR||root+'/omotenashi';
const base='http://127.0.0.1:8771/omotenashi/';
const server=http.createServer(async(req,res)=>{
 try{
  let pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=dir+pathname.replace(/^\/omotenashi/,'');
  const body=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':'text/html;charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(8771,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 const page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>navigator.serviceWorker.controller);
 assert.equal(await page.locator('a[href="./kviz.html"]').count(),1);
 await page.locator('a[href="./kviz.html"]').click();
 assert.equal(new URL(page.url()).pathname,'/omotenashi/kviz.html');
 const questions=await page.evaluate(()=>QUESTIONS.map(q=>({a:q[3],options:q[2].length,why:q[4],term:q[0]})));
 assert.equal(questions.length,30);
 assert.ok(questions.every(q=>q.options===4&&q.why.length>50));
 assert.equal(new Set(questions.map(q=>q.term)).size>=16,true);
 await page.locator('#mode').selectOption('pair');
 await page.locator('#team').fill('Teszt páros');
 await page.locator('#start').click();
 assert.ok((await page.textContent('main')).includes('0 megválaszolva'));
 assert.equal(await page.locator('#review').count(),0);
 await page.locator('[data-choice="1"]').click();
 await page.reload();
 assert.equal(await page.locator('[data-choice="1"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.map button.done').count(),1);
 // Ensure unfinished quiz cannot be scored and missing answers are located.
 await page.locator('[data-jump="29"]').click();
 await page.locator('#next-q').click();
 assert.ok((await page.textContent('main')).includes('1 / 30. kérdés')||await page.locator('.map button.current').textContent()==='2');
 // Fill all; deliberately miss only one question to test feedback.
 for(let i=0;i<questions.length;i++){
  await page.locator('[data-jump="'+i+'"]').click();
  const selected=i===5?(questions[i].a+1)%4:questions[i].a;
  await page.locator('[data-choice="'+selected+'"]').click();
 }
 assert.equal(await page.locator('.map button.done').count(),30);
 assert.equal(await page.locator('#review').count(),0);
 await page.screenshot({path:root+'/build/omotenashi_qa/06_quiz_question.png',fullPage:true});
 page.once('dialog',d=>d.accept());
 await page.locator('#next-q').click();
 assert.ok((await page.textContent('main')).includes('29 / 30'));
 assert.equal(await page.locator('article.review').count(),30);
 assert.equal(await page.locator('.review .wrong').count(),1);
 assert.equal(await page.locator('.review .correct').count(),29);
 assert.ok(!(await page.textContent('main')).includes('Hibátlan eredmény.'));
 await page.screenshot({path:root+'/build/omotenashi_qa/07_quiz_result.png',fullPage:true});
 await page.reload();
 assert.equal(await page.locator('article.review').count(),30);
 assert.equal(await page.locator('[data-choice]').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile horizontal overflow');
 const notebook=await page.evaluate(()=>localStorage.getItem('toyota-omotenashi-notebook-v1'));
 // The new game only resets quiz data.
 page.once('dialog',d=>d.accept());
 await page.locator('#restart').click();
 assert.ok(await page.locator('#start').isVisible());
 assert.equal(await page.evaluate(()=>localStorage.getItem('toyota-omotenashi-notebook-v1')),notebook);
 await page.locator('#start').click();
 // New game can reach the highest category.
 for(let i=0;i<questions.length;i++){
  await page.locator('[data-jump="'+i+'"]').click();
  await page.locator('[data-choice="'+questions[i].a+'"]').click();
 }
 page.once('dialog',d=>d.accept());await page.locator('#next-q').click();
 assert.ok((await page.textContent('main')).includes('30 / 30'));
 assert.ok((await page.textContent('main')).includes('Hibátlan eredmény.'));
 // Offline reload of the same in-app quiz page.
 await page.evaluate(async()=>{
  await OmotSafety.mirror('quiz',JSON.stringify(game));
  localStorage.removeItem('toyota-omotenashi-quiz-v1');
 });
 await ctx.setOffline(true);
 await page.reload();
 await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('toyota-omotenashi-quiz-v1')||'null')?.finished===true;}catch{return false;}});
 assert.ok((await page.textContent('main')).includes('30 / 30'));
 assert.equal(errors.length,0,errors.join('\n'));
 await ctx.close();
 console.log(JSON.stringify({status:'pass',quizQuestions:30,verified:['quiz link','individual team mode','draft persistence','cannot finish incomplete','no early answer leakage','final score','all explanations','perfect score and neutral result text','restart isolation','offline reopen','IndexedDB quiz rescue','mobile overflow','no JS runtime errors']}));
}finally{if(browser)await browser.close();server.close();}
