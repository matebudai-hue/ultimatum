import {score,uid,dayCredit} from './engine.mjs?v=14';
export const PRACTICE_MAX=7;
const clone=x=>JSON.parse(JSON.stringify(x));
export const testKey=d=>d.id+'/'+(d.quizVersion||'v1');
const itemsFor=d=>d.questions.map(q=>({key:d.id+'/'+q.id,dayId:d.id,q:clone(q)}));
const time=()=>new Date().toISOString();
export function validAnswer(q,v,submission=false){
 if(submission&&q.type==='match'&&Array.isArray(v)&&new Set(v).size!==v.length)throw Error('Mindegyik módszert pontosan egyszer használd.');
 if(!Array.isArray(v)||new Set(v).size!==v.length&&!q.rows)throw Error('Érvénytelen válasz.');
 if(q.type==='multi'&&v.length!==(q.choose??q.correct.length))throw Error('Pontosan '+(q.choose??q.correct.length)+' választ jelölj.');
 return score(q,v);
}
function resultItems(items,values,practice=false){return items.map(i=>({...clone(i),value:[...values[i.key]],score:Math.round(validAnswer(i.q,values[i.key])*(practice?PRACTICE_MAX/i.q.max:1)),max:practice?PRACTICE_MAX:i.q.max}));}
export function migrateTests(s,catalog){
 s.testing??={version:1,tests:{},practice:{credit:{},attempts:[],draft:null}};
 for(const d of catalog.days.filter(d=>d.questions.length)){
  const key=testKey(d);if(s.testing.tests[key])continue;
  const items=itemsFor(d),values={},credit={};
  for(const i of items){const a=s.answers[i.key];if(a){values[i.key]=[...a.current.value];credit[i.key]=a.best;}}
  const t=s.testing.tests[key]={credit,attempts:[],draft:null,legacyReserve:Math.max(0,dayCredit(s,d.id)-Object.values(credit).reduce((a,b)=>a+b,0))};
  if(Object.keys(values).length===items.length){
   const firstValues=Object.fromEntries(items.map(i=>[i.key,s.answers[i.key].first.value]));
   const first=resultItems(items,firstValues),latest=resultItems(items,values);
   const snapshot=(entries,label)=>({id:uid(),at:null,legacy:true,label,items:entries,score:entries.reduce((n,i)=>n+i.score,0),max:entries.reduce((n,i)=>n+i.max,0),delta:0});
   t.attempts.push(snapshot(first,'Korábbi első válaszok'));
   if(items.some(i=>s.answers[i.key].attempts>1))t.attempts.push(snapshot(latest,'Átvett legutóbbi válaszok'));
  }else if(Object.keys(values).length)t.draft={id:uid(),startedAt:time(),items,values,legacy:true};
 }
 for(const target of [...Object.values(s.testing.tests),s.testing.practice])if(target.draft){const d=target.draft;for(const i of d.items)if(Object.hasOwn(d.values,i.key)){try{validAnswer(i.q,d.values[i.key],true);}catch{d.scratch??={};d.scratch[i.key]=d.values[i.key];delete d.values[i.key];}}}
 return s;
}
export function getTest(s,d){return s.testing.tests[testKey(d)];}
export function startTest(s,d){const t=getTest(s,d);if(!d.open||!d.questions.length)throw Error('Ez a teszt még nem érhető el.');if(!t.draft)t.draft={id:uid(),startedAt:time(),items:itemsFor(d),values:{}};return t.draft;}
export function saveAnswer(draft,key,value){const item=draft?.items.find(i=>i.key===key);if(!item)throw Error('Nincs aktív feladat.');validAnswer(item.q,value,true);draft.values[key]=[...value];}
export const isComplete=draft=>{try{return !!draft&&draft.items.length>0&&draft.items.every(i=>Object.hasOwn(draft.values,i.key)&&(validAnswer(i.q,draft.values[i.key],true)>=0));}catch{return false;}};
export function finalize(s,target,practice=false){
 const draft=target.draft;if(!isComplete(draft))throw Error('A lezáráshoz minden feladatot tölts ki és ments el.');
 const items=resultItems(draft.items,draft.values,practice);let improvement=0;
 for(const i of items)improvement+=Math.max(0,i.score-(target.credit[i.key]||0));
 const absorbed=practice?0:Math.min(target.legacyReserve||0,improvement),delta=improvement-absorbed;
 const attempt={id:draft.id,startedAt:draft.startedAt,at:time(),items,score:items.reduce((n,i)=>n+i.score,0),max:items.reduce((n,i)=>n+i.max,0),delta};
 for(const i of items){target.credit[i.key]=Math.max(target.credit[i.key]||0,i.score);if(!practice){const old=s.answers[i.key];s.answers[i.key]={first:old?.first??{value:[...i.value],score:i.score},current:{value:[...i.value],score:i.score},best:Math.max(old?.best||0,i.score),attempts:(old?.attempts||0)+1,revision:i.q.revision||'v1'};}}
 if(!practice)target.legacyReserve=(target.legacyReserve||0)-absorbed;
 target.attempts.push(attempt);target.draft=null;s.earned+=delta;return attempt;
}
export function practicePool(s,catalog){return catalog.days.filter(d=>d.open).flatMap(itemsFor);}
export function rewardLeft(s,item){return Math.max(0,PRACTICE_MAX-(s.testing.practice.credit[item.key]||0));}
export function startPractice(s,catalog,random=Math.random){
 const p=s.testing.practice;if(p.draft)return p.draft;
 const pool=practicePool(s,catalog);if(pool.length<10)throw Error('Legalább 10 elérhető kérdés kell a gyakorláshoz.');
 const seen={};for(const a of p.attempts)for(const i of a.items)seen[i.key]=(seen[i.key]||0)+1;
 const weighted=pool.map(i=>{const learned=s.answers[i.key]?.current.score??0;const weight=1+rewardLeft(s,i)/7*3+(1-learned/i.q.max)*2+2/(1+(seen[i.key]||0));return {i,rank:-Math.log(Math.max(Number.MIN_VALUE,random()))/weight};}).sort((a,b)=>a.rank-b.rank);
 p.draft={id:uid(),startedAt:time(),items:weighted.slice(0,10).map(x=>x.i),values:{}};return p.draft;
}
export function validateTesting(s){
 const t=s.testing;if(t===undefined)return;if(!t||t.version!==1||!t.tests||Array.isArray(t.tests)||typeof t.tests!=='object'||!t.practice)throw Error('Hibás tesztmentés.');
 const validateItems=(items,values,practice,finalized)=>{
  if(!Array.isArray(items)||items.length<1||items.length>500||practice&&items.length!==10||new Set(items.map(i=>i.key)).size!==items.length)throw Error('Hibás feladatsor.');
  for(const i of items){if(!i||typeof i!=='object')throw Error('Hibás feladat.');const q=i.q;if(typeof i.key!=='string'||!q||!Array.isArray(q.options)||q.options.length<2||!Array.isArray(q.correct)||!Number.isInteger(q.max)||q.max<1||q.max>100||typeof q.title!=='string'||!['single','multi','match','classify'].includes(q.type)||q.options.some(o=>typeof o!=='string')||q.correct.some(n=>!Number.isInteger(n)||n<0||n>=q.options.length)||!q.correct.length||(['match','classify'].includes(q.type)?!Array.isArray(q.rows)||!q.rows.length||q.rows.some(r=>typeof r!=='string')||q.correct.length!==q.rows.length:!!q.rows)||q.type==='single'&&q.correct.length!==1||q.type==='multi'&&((q.choose??q.correct.length)!==q.correct.length||new Set(q.correct).size!==q.correct.length))throw Error('Hibás kérdés.');
   if(finalized){const n=Math.round(validAnswer(q,i.value)*(practice?7/q.max:1));if(i.score!==n||i.max!==(practice?7:q.max))throw Error('Hibás eredmény.');}
   else if(Object.hasOwn(values,i.key))validAnswer(q,values[i.key]);
  }
 };
 for(const [mode,target]of [...Object.values(t.tests).map(x=>[false,x]),[true,t.practice]]){
  if(!target||!target.credit||!Array.isArray(target.attempts)||target.attempts.length>10000||!Object.values(target.credit).every(n=>Number.isFinite(n)&&n>=0&&n<=(mode?7:100)))throw Error('Hibás pontnapló.');
  if(!mode&&(!Number.isFinite(target.legacyReserve)||target.legacyReserve<0))throw Error('Hibás átvett pont.');
  if(target.draft){const d=target.draft;if(!d.values||typeof d.values!=='object'||Array.isArray(d.values)||typeof d.id!=='string')throw Error('Hibás folyamatban lévő teszt.');validateItems(d.items,d.values,mode,false);for(const [key,value]of Object.entries(d.scratch||{})){const q=d.items.find(i=>i.key===key)?.q;if(!q||!Array.isArray(value)||value.length>(q.rows?.length||q.options.length)||value.some(n=>n!==null&&(!Number.isInteger(n)||n<0||n>=q.options.length)))throw Error('Hibás félkész válasz.');}}
  for(const a of target.attempts){validateItems(a.items,null,mode,true);if(a.score!==a.items.reduce((n,i)=>n+i.score,0)||a.max!==a.items.reduce((n,i)=>n+i.max,0)||!Number.isFinite(a.delta)||a.delta<0||a.delta>a.max)throw Error('Hibás összesítés.');}
 }
}
