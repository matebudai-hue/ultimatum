'use strict';
let joinProjectorWindow=null,joinProjectorData=null;
function sendJoinProjection(){
 if(joinProjectorWindow&&!joinProjectorWindow.closed&&joinProjectorData)joinProjectorWindow.postMessage({type:'toyota-join-data',payload:joinProjectorData},location.origin);
}
function openJoinProjector(cls,occasion){
 if(cls.closed_at||occasion.closed_at)return;
 joinProjectorData={classId:cls.id,occasionId:occasion.id,className:cls.name,occasion:occasion.name,mode:modeName(occasion.mode),link:location.origin+location.pathname.replace(/[^/]*$/,'')+'#occasion='+occasion.id,closed:false};
 if(joinProjectorWindow&&!joinProjectorWindow.closed){sendJoinProjection();joinProjectorWindow.focus();return;}
 joinProjectorWindow=window.open('./join.html','toyota-join-projector','popup,width=1100,height=900');
 if(!joinProjectorWindow){alertError(Error('A böngésző blokkolta a QR-kód külön ablakát. Engedélyezd az oldal felugró ablakait, majd kattints újra.'));return;}
 sendJoinProjection();
}
function syncJoinProjection(){
 if(!joinProjectorData)return;
 const cls=classes.find(c=>c.id===joinProjectorData.classId),occasion=occasions.find(a=>a.id===joinProjectorData.occasionId);
 if(!cls){joinProjectorData={...joinProjectorData,closed:true};sendJoinProjection();return;}
 if(occasion)joinProjectorData={...joinProjectorData,className:cls.name,occasion:occasion.name,mode:modeName(occasion.mode),closed:Boolean(cls.closed_at||occasion.closed_at)};
 else if(cls.closed_at)joinProjectorData={...joinProjectorData,closed:true};
 sendJoinProjection();
}
window.addEventListener('message',event=>{
 if(event.origin===location.origin&&event.source===joinProjectorWindow&&event.data?.type==='toyota-join-ready')sendJoinProjection();
});
