import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {empty} from '../engine.mjs';
import {migrateTests,startTest,saveAnswer,finalize,getTest} from '../attempts.mjs';
import {verdict,resultsHTML,solutionCard} from '../quiz-results.mjs';
const catalog=JSON.parse(readFileSync(new URL('../content.json',import.meta.url))),day=catalog.days[0];
test('all correct answers stay uncredited until explicit finalization of the entire test',()=>{
 const s=migrateTests(empty(),catalog),d=startTest(s,day),t=getTest(s,day);
 for(const i of d.items){saveAnswer(d,i.key,i.q.correct);assert.equal(s.earned,0);assert.equal(Object.keys(s.answers).length,0);assert.equal(t.attempts.length,0);}
 assert.equal(finalize(s,t).delta,200);assert.equal(s.earned,200);assert.throws(()=>finalize(s,t));assert.equal(s.earned,200);
});
test('completed result map distinguishes full, partial and zero in both reward scales',()=>{
 for(const max of [7,10]){assert.equal(verdict({score:max,max}).kind,'correct');assert.equal(verdict({score:1,max}).kind,'partial');assert.equal(verdict({score:0,max}).kind,'wrong');}
 const items=[{score:10,max:10},{score:4,max:10},{score:0,max:10}],html=resultsHTML({score:14,max:30,delta:4,items});
 assert.equal((html.match(/data-result-index=/g)||[]).length,3);assert.match(html,/1\. feladat: Helyes/);assert.match(html,/2\. feladat: Részben helyes/);assert.match(html,/3\. feladat: Helytelen/);assert.match(html,/A teszt eredménye/);assert.match(html,/Most jóváírt jutalom/);assert.doesNotMatch(html,/<form|<details|disabled|aria-pressed="true"/);
});
test('solutions compare row answers, supply corrections and escape question content',()=>{
 const q={title:'<script>kérdés</script>',rows:['Első','Második'],options:['A','B'],correct:[0,1],explanation:'Az A & B indoka.'},item={q,value:[0,0],score:5,max:10};
 const html=solutionCard(item,0);assert.match(html,/Részben helyes/);assert.match(html,/Helyes:<\/strong> B/);assert.equal((html.match(/Helyes:<\/strong>/g)||[]).length,1);assert.match(html,/&lt;script&gt;/);assert.match(html,/Az A &amp; B indoka/);assert.doesNotMatch(html,/<input|<select|<form/);
 const attempt={items:[item],score:5,max:10,delta:5};assert.match(resultsHTML(attempt,0),/aria-pressed="true"/);assert.match(resultsHTML(attempt,0),/Miért\?/);
});
