const dialog=document.querySelector('#points-help');
const openButton=document.querySelector('#points-help-open');
openButton.addEventListener('click',()=>{
 dialog.showModal();
 document.body.classList.add('points-help-open');
 dialog.querySelector('.points-help-content').scrollTop=0;
 dialog.querySelector('h2').focus();
});
dialog.querySelector('#points-help-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{
 if(dialog.open)return;
 document.body.classList.remove('points-help-open');
 openButton.focus();
});
dialog.addEventListener('click',event=>{
 if(event.target!==dialog)return;
 const rect=dialog.getBoundingClientRect();
 if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
});
