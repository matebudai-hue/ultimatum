/* Local, second-copy storage for Omotenashi notebook and quiz.
   IndexedDB is independent of localStorage, but both can be evicted together.
   A downloaded user-owned backup is still necessary for long-term safety. */
(function(){
 'use strict';
 const DB_NAME='toyota-omotenashi-rescue-v1',STORE='snapshots';
 let openPromise;
 function db(){
  if(openPromise)return openPromise;
  openPromise=new Promise((resolve,reject)=>{
   if(!('indexedDB' in window)){reject(Error('IndexedDB unavailable'));return;}
   let req;
   try{req=indexedDB.open(DB_NAME,1);}catch(e){reject(e);return;}
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
   req.onsuccess=()=>{const database=req.result;database.onversionchange=()=>database.close();resolve(database);};
   req.onerror=()=>reject(req.error||Error('IndexedDB open failed'));
   req.onblocked=()=>reject(Error('IndexedDB blocked'));
  }).catch(e=>{openPromise=null;throw e;});
  return openPromise;
 }
 async function write(name,value){
  const database=await db();
  return new Promise((resolve,reject)=>{
   let tx;
   try{tx=database.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,name);}
   catch(e){reject(e);return;}
   tx.oncomplete=()=>resolve(true);
   tx.onabort=()=>reject(tx.error||Error('Backup transaction aborted'));
   tx.onerror=()=>reject(tx.error||Error('Backup transaction failed'));
  });
 }
 async function read(name){
  const database=await db();
  return new Promise((resolve,reject)=>{
   let tx,request;
   try{tx=database.transaction(STORE,'readonly');request=tx.objectStore(STORE).get(name);}
   catch(e){reject(e);return;}
   request.onsuccess=()=>resolve(request.result||null);
   request.onerror=()=>reject(request.error||Error('Backup read failed'));
   tx.onabort=()=>reject(tx.error||Error('Backup read aborted'));
  });
 }
 const queues=new Map();
 function mirror(name,value){
  const previous=queues.get(name)||Promise.resolve();
  const pending=previous.catch(()=>{}).then(()=>write(name,value));
  queues.set(name,pending);
  return pending;
 }
 async function requestPersistence(){
  if(!navigator.storage?.persist)return 'unsupported';
  try{
   if(await navigator.storage.persisted?.())return 'granted';
   return await navigator.storage.persist()?'granted':'denied';
  }catch{return 'unsupported';}
 }
 window.OmotSafety=Object.freeze({mirror,read,requestPersistence});
})();
