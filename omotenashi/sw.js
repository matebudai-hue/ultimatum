'use strict';
// Only this app's shell cache changes between releases. Never touch localStorage.
const CACHE='toyota-omotenashi-shell-20261020-1';
const ROOT=new URL('./',self.location.href).href;
const INDEX=new URL('./index.html',self.location.href).href;
const QUIZ=new URL('./kviz.html',self.location.href).href;
const SAFETY=new URL('./data-safety.js',self.location.href).href;
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll([ROOT,INDEX,QUIZ,SAFETY]);})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('toyota-omotenashi-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(ROOT)||event.request.mode!=='navigate'&&!url.pathname.endsWith('/data-safety.js'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const network=fetch(event.request).then(async response=>{if(!response.ok)throw Error('Unavailable');await cache.put(url.pathname.endsWith('/kviz.html')?QUIZ:url.pathname.endsWith('/data-safety.js')?SAFETY:INDEX,response.clone());return response;});
  event.waitUntil(network.catch(()=>{}));
  try{return await Promise.race([network,new Promise((_,reject)=>setTimeout(()=>reject(Error('Timeout')),3500))]);}
  catch{const cached=await cache.match(url.pathname.endsWith('/kviz.html')?QUIZ:url.pathname.endsWith('/data-safety.js')?SAFETY:INDEX)||await cache.match(ROOT);return cached||new Response('Az első megnyitáshoz internetkapcsolat szükséges. Nyisd meg újra az oldalt, amikor van kapcsolat.',{status:503,headers:{'Content-Type':url.pathname.endsWith('/data-safety.js')?'application/javascript;charset=utf-8':'text/plain;charset=utf-8'}});}
 })());
});
