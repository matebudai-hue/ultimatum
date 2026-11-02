'use strict';
function renderJoin(data){
 const link=new URL(data.link,location.href);
 if(link.origin!==location.origin||!/^#occasion=[0-9a-z-]+$/i.test(link.hash))return;
 document.getElementById('className').textContent=data.className;
 document.getElementById('occasion').textContent=data.occasion;
 document.getElementById('mode').textContent=data.mode;
 const canvas=document.getElementById('joinQr');canvas.hidden=Boolean(data.closed);
 document.getElementById('instruction').textContent=data.closed?'Ez az alkalom már nem fogad új értékelést.':'Olvasd be a QR-kódot.\nAdd meg a saját neved, majd válaszd ki, kit figyelsz meg.';
 if(data.closed)return;
 const qr=new ToyotaQRCode(-1,0);qr.addData(link.href);qr.make();const n=qr.getModuleCount();
 canvas.width=canvas.height=(n+8)*12;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))ctx.fillRect((x+4)*12,(y+4)*12,12,12);
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==window.opener||event.data?.type!=='toyota-join-data')return;
 const data=event.data.payload;if(!data||typeof data.link!=='string'||typeof data.className!=='string'||typeof data.occasion!=='string')return;
 try{renderJoin(data);}catch{document.getElementById('instruction').textContent='A QR-kód nem jeleníthető meg. Nyisd meg újra az adminfelületről.';}
});
document.getElementById('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};
function joinReady(){if(window.opener)window.opener.postMessage({type:'toyota-join-ready'},location.origin);}
joinReady();window.addEventListener('pageshow',joinReady);
