'use strict';
function activeRoster(cls){return cls.roster.filter(name=>!cls.inactive_roster?.includes(name));}
function inactiveRosterSection(cls){
 const names=cls.roster.filter(name=>cls.inactive_roster?.includes(name));
 if(!names.length)return '';
 return '<details class="inactive-roster"><summary>Eltávolított résztvevők · '+names.length+'</summary><p class="muted">Új megfigyelésnél nem választhatók. A korábbi értékeléseik és rögzített vizsgaeredményeik megmaradtak.</p><ul>'+names.map(name=>'<li><span>'+esc(name)+'</span><button class="text-button" data-restore-person="'+esc(name)+'">Visszaállítás</button></li>').join('')+'</ul></details>';
}
function participantActiveDialog(cls,name,active=false){
 if(appRole!=='admin')return;
 if(rosterDirty){alertError(Error('Előbb mentsd el a névsor módosításait, majd próbáld újra.'));return;}
 const d=modal(active?'Résztvevő visszaállítása':'Résztvevő eltávolítása','<p><b>'+esc(name)+'</b><br>'+esc(cls.name)+'</p><p>'+(active?'A résztvevő ismét kiválasztható lesz az osztály megfigyeléseinél.':'Új megfigyeléshez már nem lehet kiválasztani. A korábbi értékelései és rögzített vizsgaeredményei megmaradnak. Az eltávolított résztvevők között később visszaállíthatod.')+'</p><button class="primary" id="confirmParticipantActive">'+(active?'Visszaállítás a névsorba':'Eltávolítás az osztályból')+'</button><p role="status" id="participantActiveStatus"></p>');
 d.classList.add('participant-action-dialog');
 action('confirmParticipantActive',async()=>{
  try{await api('/rest/v1/rpc/set_class_participant_active',{target:cls.id,participant:name,active,expected_roster_revision:cls.roster_revision||0});}
  catch(err){if($('participantActiveStatus'))$('participantActiveStatus').textContent=err.message;return;}
  d.close();d.remove();
  try{await dashboard();}catch(err){alertError(Error('A névsor változását elmentettük, de a frissítés nem sikerült. Frissítsd az oldalt.'));}
 });
}
