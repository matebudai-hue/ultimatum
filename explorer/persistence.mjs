import {validateRoomState} from './room-engine.mjs?v=14';
import {validateTesting} from './attempts.mjs?v=8';
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateState(s){
 if(!record(s)||typeof s.name!=='string'||typeof s.roomName!=='string'||!record(s.answers)||![s.earned,s.spent].every(v=>Number.isSafeInteger(v)&&v>=0)||s.spent>s.earned)throw Error('Hibás résztvevői mentés.');
 validateRoomState(s);validateTesting(s);
 for(const a of Object.values(s.answers))if(!record(a)||!a.first||!a.current||!Array.isArray(a.first.value)||!Array.isArray(a.current.value)||![a.first.score,a.current.score,a.best,a.attempts].every(v=>Number.isSafeInteger(v)&&v>=0))throw Error('Hibás válasznapló.');
 if(s.caseNotes!==undefined&&(!record(s.caseNotes)||Object.values(s.caseNotes).some(notes=>!record(notes)||Object.values(notes).some(v=>typeof v!=='string'))))throw Error('Hibás jegyzetek.');
 return s;
}
// Compare the saved snapshot before every write: an older tab must never overwrite a newer one.
export function createPersistence(storage,key='explorer-state'){
 let baseline=storage.getItem(key);
 return {raw:baseline,save(state){const current=storage.getItem(key);if(current!==baseline){const error=Error('Másik böngészőfül módosította a mentést.');error.code='conflict';throw error;}const next=JSON.stringify(state);storage.setItem(key,next);baseline=next;},changed(){return storage.getItem(key)!==baseline;}};
}
export function exportFilename(name='',date=new Date()){
 const safe=name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
 return `explorer-${safe||'eredmeny'}-${date.toISOString().replace(/[:.]/g,'-')}.json`;
}
