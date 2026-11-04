import {doc,onSnapshot,setDoc,updateDoc,deleteDoc} from 'firebase/firestore';
import {ensureFirebaseUser,firestore} from './firebaseClient';
import {makeUuid,connectionDeadline} from './browserCompat';
// An unguessable, short-lived rendezvous address. The public document contains
// only the requesting anonymous UID, never a player name, game state or token.
// Existing rules let only its creator write it; only the game trainer can grant
// ownership of the actual player document. No name-based ownership takeover.
export async function issueRecovery(code:string,playerId:string,onRestored:()=>void,onError:(message:string)=>void){
 await ensureFirebaseUser();
 const token=makeUuid()+'-'+makeUuid(),expiresAt=Date.now()+300000;
 const mailbox=doc(firestore,'publicGames','recovery-'+token);
 let used=false;let unsubscribe=()=>{};
 const stop=()=>{used=true;unsubscribe();window.clearTimeout(timer);};
 const timer=window.setTimeout(stop,300000);
 unsubscribe=onSnapshot(mailbox,snapshot=>{
  if(used||Date.now()>=expiresAt||!snapshot.exists())return;
  const data=snapshot.data();if(data.recoveryRequest!==true||typeof data.trainerUid!=='string'||!data.trainerUid)return;
  stop();
  void updateDoc(doc(firestore,'games',code.toUpperCase(),'players',playerId),{authUid:data.trainerUid,commands:{}})
   .then(onRestored).catch(()=>onError('A visszacsatlakoztatás nem sikerült. Készíts új QR-linket.'));
 },()=>{stop();onError('A visszacsatlakozási kapcsolat megszakadt. Készíts új QR-linket.');});
 const url=new URL(window.location.href);url.search='';url.searchParams.set('role','player');url.searchParams.set('code',code);url.searchParams.set('recover',token);url.searchParams.set('recoverPlayer',playerId);
 return {url:url.toString(),expiresAt,stop};
}
export async function requestRecovery(code:string,playerId:string,token:string,resume:()=>Promise<{session:import('./gameTypes').GameSession;name:string}|null>){
 if(!/^[a-f0-9-]{73}$/i.test(token)||!playerId)throw new Error('Érvénytelen visszacsatlakozási link.');
 const user=await ensureFirebaseUser(),mailbox=doc(firestore,'publicGames','recovery-'+token);
 try{
  await connectionDeadline(setDoc(mailbox,{trainerUid:user.uid,recoveryRequest:true,createdAt:new Date().toISOString()}));
  const deadline=Date.now()+65000;
  while(Date.now()<deadline){
   try{const result=await connectionDeadline(resume());if(result)return result;}catch{/* Ownership transfer may still be in progress. */}
   await new Promise(resolve=>window.setTimeout(resolve,1000));
  }
  throw new Error('Nem érkezett tréneri visszaigazolás. A tréner oldalán készítsetek új visszacsatlakozási QR-kódot.');
 }finally{void deleteDoc(mailbox).catch(()=>undefined);}
}
