'use strict';
(() => {
 const dataElement=document.getElementById('workshop-case-data');
 const dialog=document.getElementById('workshop-case-dialog');
 if(!dataElement||!dialog)return;
 const cards=JSON.parse(dataElement.textContent);
 const byId=Object.fromEntries(cards.map(c=>[c.id,c]));
 const key='toyota-omotenashi-workshop-cases-v1';
 const $=id=>document.getElementById(id);
 const title=$('workshop-case-title'),code=$('workshop-case-code'),story=$('workshop-case-story'),question=$('workshop-case-question'),questionBox=$('workshop-case-question-box');
 const label1=$('workshop-answer-one-label'),label2=$('workshop-answer-two-label'),answer1=$('workshop-answer-one'),answer2=$('workshop-answer-two');
 const status=$('workshop-case-save-status');
 let active=null;
 function read(){
  try{const raw=localStorage.getItem(key);const parsed=raw?JSON.parse(raw):{};return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch{return {};}
 }
 function currentAnswers(){
  const stored=read()[active?.id]||{};
  return {one:typeof stored.one==='string'?stored.one:'',two:typeof stored.two==='string'?stored.two:''};
 }
 function save(){
  if(!active)return;
  const all=read();
  all[active.id]={one:answer1.value,two:answer2.value};
  try{localStorage.setItem(key,JSON.stringify(all));status.textContent='Mentve ezen a telefonon.';status.classList.remove('warning');}
  catch{status.textContent='A böngésző nem engedi a mentést. Másold vagy oszd meg a megoldásodat a bezárás előtt.';status.classList.add('warning');}
 }
 function open(id){
  const card=byId[id];if(!card)return;
  active=card;code.textContent=card.id;title.textContent=card.title;story.textContent=card.text;
  if(card.question){question.textContent=card.question;questionBox.hidden=false;}else{question.textContent='';questionBox.hidden=true;}
  label1.textContent=card.label1;label2.textContent=card.label2;
  const v=currentAnswers();answer1.value=v.one;answer2.value=v.two;
  status.classList.remove('warning');status.textContent='A megoldás ezen a telefonon tárolódik. Nem kerül automatikusan a trénerhez.';
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 }
 document.querySelectorAll('[data-workshop-case]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.workshopCase)));
 answer1.addEventListener('input',save);answer2.addEventListener('input',save);
 $('workshop-case-close').addEventListener('click',()=>{
  save();if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');
 });
 dialog.addEventListener('click',event=>{if(event.target===dialog){save();dialog.close();}});
 dialog.addEventListener('close',()=>{active=null;});
 function responseText(){
  if(!active)return'';
  return active.id+' – '+active.title+'\n\n'+active.text+
   (active.question?'\n\n'+active.question:'')+'\n\n'+active.label1+'\n'+(answer1.value||'–')+
   '\n\n'+active.label2+'\n'+(answer2.value||'–');
 }
 $('workshop-case-share').addEventListener('click',async()=>{
  save();const text=responseText();
  try{
   if(typeof navigator.share==='function'){await navigator.share({title:'Toyota workshop – '+active.id,text});status.textContent='A megosztást a telefon kezeli.';return;}
   if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);status.textContent='A teljes megoldást a vágólapra másoltuk.';return;}
   throw Error('Unavailable');
  }catch(e){
   if(e?.name==='AbortError')return;
   try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);status.textContent='A teljes megoldást a vágólapra másoltuk.';return;}}catch{}
   status.textContent='A megosztás itt nem érhető el. A kitöltött szöveget jelöld ki és másold ki.';
  }
 });
})();