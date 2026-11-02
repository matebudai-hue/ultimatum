
'use strict';
const screen=document.getElementById('screen');
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>n.toLocaleString('hu-HU',{maximumFractionDigits:2});
function segments(counts){
 const total=counts.reduce((a,b)=>a+b,0);
 return '<div class="stack">'+counts.map((count,i)=>count?'<span class="segment '+(['zero','one','two'][i])+'" style="width:'+count/total*100+'%" title="'+i+' pont · '+count+' értékelés">'+count+'</span>':'').join('')+'</div>';
}
function legend(){return '<div class="legend"><span><i class="dot"></i>0 · Nem látható</span><span><i class="dot one"></i>1 · Részben látható</span><span><i class="dot two"></i>2 · Rendben van</span></div>';}
function highlights(data){
 const ranked=[...data.items].sort((a,b)=>b.mean-a.mean||a.index-b.index);
 const equal=Math.abs(ranked[0].mean-ranked.at(-1).mean)<1e-9;
 const group=(title,rows,style)=>{
 const boundary=rows.at(-1).mean,extra=ranked.filter(r=>Math.abs(r.mean-boundary)<1e-9&&!rows.includes(r)).length;
 return '<section class="card '+style+'"><div class="card-head"><i class="marker"></i><div><h2>'+title+'</h2><small>'+(style==='develop'?'Relatív fókuszok · a három legalacsonyabb átlag':'A legmagasabb átlagú szempontok')+'</small></div></div><div class="rank-list">'+rows.map((r,i)=>'<div class="rank-item"><span class="rank-number">'+String(r.index+1).padStart(2,'0')+'</span><div><div class="rank-title">'+safe(r.title)+'</div><div class="mini-track"><i style="width:'+r.mean*50+'%"></i></div></div><span class="rank-score">'+number(r.mean)+'<small> / 2</small></span></div>').join('')+'</div>'+(extra?'<p class="ties">További '+extra+' szempont ugyanilyen határértékkel.</p>':'')+'</section>';
 };
 if(equal)return '<div class="note">Mind a 20 szempont átlaga azonos · '+number(ranked[0].mean)+' / 2. Az átlagok alapján most nincs elkülönülő erősség vagy fejlesztendő terület.</div><section class="card distribution">'+legend()+ranked.slice(0,3).map(r=>'<p>'+safe(r.title)+' · '+number(r.mean)+' / 2</p>').join('')+'<p class="muted">A megoszlás nézetben látható, milyen pontokból alakult ki az átlag.</p></section>';
 return '<div class="cards">'+group('Erősségek',ranked.slice(0,3),'strength')+group('Fejlesztési fókuszok',[...ranked].sort((a,b)=>a.mean-b.mean||a.index-b.index).slice(0,3),'develop')+'</div>';
}
function distribution(data){
 const items=data.items.slice(data.page*10,data.page*10+10);
 return legend()+'<section class="card distribution"><div class="distribution-head"><span>#</span><span>Megfigyelési szempont</span><span>Pontok megoszlása · darabszám</span><span style="text-align:right">Átlag</span></div>'+items.map(r=>'<div class="distribution-row"><span class="idx">'+String(r.index+1).padStart(2,'0')+'</span><span>'+safe(r.title)+'</span>'+segments(r.counts)+'<span class="mean">'+number(r.mean)+'<small> / 2</small></span></div>').join('')+'</section>';
}
function single(data){
 const r=data.items[data.selected];
 return '<div class="single"><section class="card criterion-info"><span class="number">SZEMPONT '+String(r.index+1).padStart(2,'0')+' / 20</span><h2>'+safe(r.title)+'</h2><p>'+safe(r.help)+'</p></section><section class="card single-score"><div class="eyebrow">'+(data.scope==='person'?'Egyéni átlag':'Osztályátlag')+'</div><div class="value">'+number(r.mean)+'<small> / 2</small></div>'+segments(r.counts)+'<div class="single-counts">'+r.counts.map((n,i)=>'<div><span><i class="dot '+(['zero','one','two'][i])+'"></i>'+safe(['Nem látható','Részben látható','Rendben van'][i])+'</span><b>'+n+'</b></div>').join('')+'</div></section></div>';
}
function namesPanel(data){
 if(!data.showNames||!Array.isArray(data.namedRecords)||!data.namedRecords.length)return '';
 const names=[...new Set(data.namedRecords.map(r=>r.seller))];
 if(data.view!=='single')return '<div class="name-strip"><b>Értékelt résztvevők</b><span>'+names.slice(0,10).map(safe).join(' · ')+(names.length>10?' · és további '+(names.length-10)+' fő':'')+'</span></div>';
 const pages=Math.ceil(data.namedRecords.length/6),page=Math.min(data.namedPage||0,pages-1),rows=data.namedRecords.slice(page*6,page*6+6);
 return '<section class="card named-results"><div class="card-head"><div><h2>Egyéni értékelések</h2><small>A kiválasztott szempontra adott pontok · '+(page+1)+' / '+pages+' oldal</small></div></div><div class="named-grid">'+rows.map(r=>'<div class="named-person"><b>'+safe(r.seller)+'</b><span class="named-score"><strong>'+r.scores[data.selected]+' / 2</strong><span>'+safe(r.observer)+'</span></span></div>').join('')+'</div></section>';
}
let lastData=null,lastReceived=0;
function updateConnection(){
 const badge=document.querySelector('.live');if(!badge||!lastData)return;
 const stale=!lastData.liveConnected||Date.now()-lastReceived>35000||Date.now()-(lastData.updatedAt||0)>60000;
 badge.classList.toggle('stale',!lastData.frozen&&stale);
 badge.innerHTML='<i></i>'+(lastData.frozen?'Kimerevítve':stale?'Nem frissül · utolsó adat':'Frissítve')+' · '+safe(lastData.updated);
}
setInterval(updateConnection,5000);
function render(data){
 screen.classList.toggle('with-names',Boolean(data.showNames&&data.view==='single'));
 const titles={highlights:'Erősségek és fejlesztendők',single:'Egy szempont közelebbről',distribution:'Milyen pontok érkeztek?'};
 const body=data.submissions?(data.view==='single'?single(data):data.view==='distribution'?distribution(data):highlights(data)):'<section class="card empty"><h2>Még nincs beküldött értékelés</h2><p>Az összesítés az első beküldés után jelenik meg.</p></section>';
 screen.innerHTML='<header class="top"><div class="brand"><img class="brand-emblem" src="./assets/toyota.svg" alt="Toyota"><span class="brand-copy">Közös eredmények<small>Értékesítői megfigyelés · Budai Máté</small></span></div><div class="context"><strong>'+safe(data.className)+'</strong><br>'+(data.scope==='person'?'<strong>'+safe(data.subject)+'</strong> · ':'')+safe(data.kind)+' · '+safe(data.mode)+' · '+safe(data.occasion)+'</div></header><div class="heading"><div><div class="eyebrow">'+(data.view==='distribution'?'Szempontok '+(data.page*10+1)+'–'+Math.min(data.page*10+10,20)+' / 20':(data.subject||'Teljes osztály'))+'</div><h1>'+titles[data.view]+'</h1></div><div class="meta"><span><b>'+data.observed+' / '+data.people+'</b> értékesítő</span><span><b>'+data.submissions+'</b> értékelés</span></div></div><div class="main">'+body+namesPanel(data)+'</div><footer class="footer"><span>'+(data.scope==='person'?'Átlagok · a résztvevőről kapott értékelések':'Átlagok · értékesítőnként azonos súly')+' &nbsp; / &nbsp; Megoszlás · minden beküldött értékelés</span><span class="live '+(data.frozen?'paused':'')+'"><i></i>'+(data.frozen?'Kimerevítve':'Frissítve')+' · '+safe(data.updated)+'</span></footer>';
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==window.opener||event.data?.type!=='toyota-projection-data')return;
 const data=event.data.payload;
 if(!data||!['highlights','single','distribution'].includes(data.view)||!Array.isArray(data.items)||data.items.length!==20)return;
 lastData=data;lastReceived=Date.now();render(data);updateConnection();
});
document.getElementById('full').onclick=async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}
};
function ready(){if(window.opener)window.opener.postMessage({type:'toyota-projection-ready'},location.origin);}
ready();
window.addEventListener('pageshow',ready);

