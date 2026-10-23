export const uid=()=>globalThis.crypto?.randomUUID?.()??Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join("-");
import{products,buy,migrateRoom}from'./room-engine.mjs?v=6';
export{products,buy};
export const empty=()=>migrateRoom({version:1,name:'',answers:{},earned:0,spent:0,items:[],roomName:'Az én tréningtermem'});
export function instruction(q){if(q.type==='match')return 'Minden állításhoz válassz egy módszert. Mindegyik módszert egyszer használd.';if(q.type==='classify')return 'Minden állításnál jelöld a megfelelő kategóriát.';if(q.type==='multi')return `Pontosan ${q.choose??q.correct.length} választ jelölj. A téves jelölés csökkenti a feladat pontját.`;return 'Egy választ jelölj.';}
export function describeAnswer(q,a){return q.rows?q.rows.map((row,i)=>`${row} → ${q.options[a[i]]??'Nincs válasz'}`):a.map(v=>q.options[v]??'Nincs válasz');}
export function score(q,a){
 if(!Array.isArray(a)||a.some(x=>!Number.isInteger(x)||x<0||x>=q.options.length))throw Error('Érvénytelen válasz');
 if(q.rows){if(a.length!==q.rows.length)throw Error('Minden állításhoz válassz választ.');return Math.round(q.max*a.filter((v,i)=>v===q.correct[i]).length/q.rows.length);}
 const selected=[...new Set(a)];if(q.type==='single'&&selected.length!==1)throw Error('Egy választ jelölj.');
 const good=selected.filter(x=>q.correct.includes(x)).length,bad=selected.length-good;return Math.max(0,Math.round(q.max*(good-bad)/q.correct.length));
}
// A rewritten quiz shares the day's reward budget with its older versions.
export function dayCredit(s,day){const totals={};for(const [key,a]of Object.entries(s.answers)){if(!key.startsWith(day+'/'))continue;const rev=a.revision??'v1';totals[rev]=(totals[rev]||0)+a.best;}return Math.max(0,...Object.values(totals));}
export function answer(s,day,q,a){const key=day+'/'+q.id,n=score(q,a),old=s.answers[key],before=dayCredit(s,day),best=Math.max(old?.best||0,n);s.answers[key]={first:old?.first??{value:[...a],score:n},current:{value:[...a],score:n},best,attempts:(old?.attempts||0)+1,revision:q.revision??old?.revision??'v1'};const delta=Math.max(0,dayCredit(s,day)-before);s.earned+=delta;return delta;}
