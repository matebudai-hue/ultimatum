'use strict';
{
 const names=['Kiss Dóra','Farkas András','Tóth Péter','Szabó Réka','Nagy Ágnes','Varga Bálint','Molnár Eszter','Balogh Gábor','Horváth Zsófia'];
 const records=names.flatMap((name,i)=>Array.from({length:i<5?2:1},(_,j)=>({seller:name,scores:exams.passenger.items.map((_,k)=>k===19?(i%3===0?0:1):k===14?(i%2===0?0:1):k===11?2:(i+k+j)%7===0?0:(i+k)%3===0?1:2)})));
 const ranked=ToyStats.criteria(exams.passenger.items,names,records);
 render({className:'Novemberi osztály',kind:'Személyautó',mode:'Megfigyelés',occasion:'November 6. · Első gyakorlás',scope:'class',subject:'Teljes osztály',view:'highlights',page:0,selected:11,showNames:false,frozen:true,observed:9,people:12,submissions:14,updated:'2026. 11. 06. 10:42',items:exams.passenger.items.map((it,index)=>({...it,index,...ranked.find(r=>r.index===index)}))});
}
