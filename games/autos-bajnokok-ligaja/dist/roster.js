(function(root){
 'use strict';
 const E=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.Tournament;
 const KEY='autos-bl-cars-v1';
 function pack(pots){
  const cars=E.create(pots,0).cars;
  return {kind:'autos-bl-autolista',version:1,pots:[1,2,3,4].map(p=>cars.filter(c=>c.pot===p).map(c=>c.name))};
 }
 function validate(value){if(!value||value.kind!=='autos-bl-autolista'||value.version!==1)throw Error('Ez nem érvényes autólista.');return pack(value.pots);}
 function fromTournament(state){return pack([1,2,3,4].map(p=>state.cars.filter(c=>c.pot===p).map(c=>c.name)));}
 function save(storage,pots){const data=pack(pots);storage.setItem(KEY,JSON.stringify(data));return data;}
 function load(storage){const raw=storage.getItem(KEY);return raw?validate(JSON.parse(raw)):null;}
 const api={KEY,pack,validate,fromTournament,save,load};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CarRoster=api;
})(typeof globalThis!=='undefined'?globalThis:this);
