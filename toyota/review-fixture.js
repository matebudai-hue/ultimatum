'use strict';
// Isolated visual review uses sample data and never makes an API request.
startApp=async function(){
 const names=['Kiss Dóra','Farkas András','Tóth Péter','Szabó Réka','Nagy Ágnes','Varga Bálint','Molnár Eszter','Balogh Gábor','Horváth Zsófia','Papp Tamás','Kovács Nóra','Fekete Levente'];
 const cls={id:'sample-class',name:'Novemberi osztály',kind:'passenger',roster:names,contacts:{}};
 const occ={id:'sample-occasion',class_id:cls.id,name:'November 6. · Első gyakorlás',mode:'practice'};
 const records=names.slice(0,9).flatMap((name,i)=>Array.from({length:i<5?2:1},(_,j)=>({
  id:'sample-'+i+'-'+j,seller:name,observers:{name:names[(i+j+1)%names.length]},
  scores:exams.passenger.items.map((_,k)=>k===19?(i%3===0?0:1):k===14?(i%2===0?0:1):k===11?2:(i+k+j)%7===0?0:(i+k)%3===0?1:2),
  notes:'A bemutató közben az ügyfél válaszaiból indult tovább. A következő lépést érdemes pontosabban egyeztetni.',
  created_at:new Date(Date.UTC(2026,10,6,9,42-i,j*15)).toISOString()
 })));
 api=async(path,body)=>{
  if(body!==undefined)throw Error('Ez mintaadatokkal működő előnézet. A módosításokhoz az éles alkalmazást használd.');
  if(path.includes('/classes'))return [cls];
  if(path.includes('/occasions'))return [occ];
  if(path.includes('/observations'))return records;
  return [];
 };
 const params=new URLSearchParams(location.search),page=params.get('screen')||'admin';
 if(params.get('closed')==='class')cls.closed_at=new Date().toISOString();
 if(params.get('closed')==='occasion')occ.closed_at=new Date().toISOString();
 if(page==='participant'||page==='result'){
  context={className:cls.name,kind:'passenger',mode:'practice',occasion:occ.name,roster:names};
  state=fresh('passenger');state.observer='Farkas András';state.seller='Kiss Dóra';state.step=1;state.scores[5]=2;
  if(page==='result'){state.scores=records[0].scores.slice();state.notes=records[0].notes;state.done=true;}
  choosing=false;render();
 }else await dashboard();
};

