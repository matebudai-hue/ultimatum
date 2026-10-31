// No recipient address is sent to or stored by the game service.
export function personalReportEmail(to:string,text:string) {
  const address=to.trim();
  if(address.length>254||!/^([^\s@,;<>]+)@([^\s@,;<>]+)\.([^\s@,;<>]+)$/.test(address)) throw new Error('Adj meg egy érvényes e-mail-címet.');
  const base='mailto:'+encodeURIComponent(address)+'?subject='+encodeURIComponent('Kreditjáték – a saját történetem');
  const complete=base+'&body='+encodeURIComponent(text);
  // Mail apps disagree on URL size limits. Never silently truncate a report.
  return complete.length<=1800 ? {href:complete,copyRequired:false} : {href:base,copyRequired:true};
}
