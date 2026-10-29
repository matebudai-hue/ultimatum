import type { GameSession, StrategicRound } from './gameTypes';
import { publicGoodsPlayerPayout } from './gameEngine';
import { buildSelfReport } from './debriefEngine';

export const JOURNEY_QUESTION = 'Amikor ezt a döntést meghoztad, melyik korábbi találkozás volt még benned?';
export const JOURNEY_ROUNDS: StrategicRound[] = ['1a','1b','2a','2b','3a','3b'];
const credits = (n:number) => Math.round(n).toLocaleString('hu-HU') + ' kr';
const name = (s:GameSession,id:string) => id==='BOT' ? 'Tartalékjátékos' : s.players.find(p=>p.id===id)?.name ?? 'Ismeretlen résztvevő';
export const ratio = (part:number,whole:number):number|null => whole>0 ? part/whole*100 : null;
export type JourneyComment = {author:string;comment:string;own:boolean};
export function buildParticipantJourney(session:GameSession, playerId:string) {
  const report = buildSelfReport(session,playerId);
  const commentsFor = (ids:{playerId:string;decisionId:string}[]):JourneyComment[] => (session.reflections??[])
    .filter(r=>r.comment.trim() && ids.some(id=>id.playerId===r.playerId && id.decisionId===r.decisionId))
    .map(r=>({author:name(session,r.playerId),comment:r.comment,own:r.playerId===playerId}));
  const encounters=JOURNEY_ROUNDS.map(roundKey=> {
    const pair=session.pairings.find(p=>p.roundKey===roundKey && (p.playerA===playerId||p.playerB===playerId));
    const closed=session.closedRounds.includes(roundKey);
    const game=roundKey[0]==='1'?'Ultimátum':roundKey[0]==='2'?'Diktátor':'Bizalom';
    if(!pair || !closed) return {id:roundKey,roundKey,game,ready:false,partnerId:undefined,partner:'',role:'',action:closed?'Nincs párosítás':'Még nincs lezárva',response:'',outcome:'',net:null,flow:[] as {label:string;amount:number}[],comments:[] as JourneyComment[],markers:[] as string[]};
    const isA=pair.playerA===playerId, partnerId=isA?pair.playerB:pair.playerA;
    const ds=session.decisions.filter(d=>d.pairingId===pair.id);
    const own=report.find(r=>r.pairingId===pair.id);
    const other=partnerId==='BOT'?undefined:buildSelfReport(session,partnerId).find(r=>r.pairingId===pair.id);
    const markers:string[]=[];
    if(partnerId==='BOT'||ds.some(d=>d.isBotDecision)) markers.push('Tartalékjátékos / automatikus döntés');
    if(ds.some(d=>d.timedOutRole||d.type==='ultimatum_timeout')) markers.push('Időtúllépés');
    if(ds.some(d=>d.submissionSource==='manual_correction')||session.manualCorrections?.some(c=>c.pairingId===pair.id)) markers.push('Kézi rögzítés');
    const technical=session.strategicTechnicalIssues?.some(i=>i.pairingId===pair.id && !i.resolvedAt);
    if(technical) markers.push('Technikai elakadás');
    let role='',action='',response='',outcome='',net:number|null=null;
    let flow:{label:string;amount:number}[]=[];
    if(pair.gameId==='ultimatum') {
      role=isA?'Ajánlatot tettél':'Ajánlatot kaptál';
      const offer=ds.find(d=>d.type==='ultimatum_offer');
      const answer=ds.find(d=>d.type==='ultimatum_response');
      const timedOut=ds.some(d=>d.type==='ultimatum_timeout');
      const amount=offer?.amount;
      action=amount===undefined?'Nem érkezett ajánlat':(isA?'Felajánlottál ':'Felajánlott neked ')+credits(amount);
      response=timedOut?'Időtúllépés':answer ? (isA?'Ő ':'Te ')+(answer.accepted?'elfogadta'+(isA?'':'d'):'elutasította'+(isA?'':'d')) : 'Nem érkezett válasz';
      if(answer||timedOut){net=answer?.accepted && amount!==undefined ? (isA?session.startingCredit-amount:amount) : 0;outcome=answer?.accepted?'A megállapodás létrejött':'Mindketten 0 kreditet kaptatok';}
      flow=amount===undefined?[]:[{label:isA?'felajánlottad':'felajánlotta',amount}];
    } else if(pair.gameId==='dictator') {
      role=isA?'Te osztottál':'Te kaptál';
      const amount=ds.find(d=>d.type==='dictator_give')?.amount;
      action=amount===undefined?'Nem érkezett döntés':(isA?'Átadtál ':'Kaptál ')+credits(amount);
      response=isA?'Ő nem utasíthatta vissza':'Nem szólhattál bele';
      net=amount===undefined?null:(isA?session.startingCredit-amount:amount);
      outcome=isA && amount!==undefined?'Megtartottál '+credits(session.startingCredit-amount):'A másik döntése érvényesült';
      flow=amount===undefined?[]:[{label:isA?'átadtad':'megkaptad',amount}];
    } else {
      role=isA?'Te küldtél':'Te adtál vissza';
      const sent=ds.find(d=>d.type==='trust_send')?.amount;
      const returned=ds.find(d=>d.type==='trust_return')?.amount;
      action=sent===undefined?'Nem érkezett küldés':(isA?'Küldtél ':'Küldött neked ')+credits(sent);
      response=returned===undefined?'Nem érkezett visszaadás':(isA?'Visszakaptál ':'Visszaadtál ')+credits(returned);
      if(sent!==undefined && returned!==undefined)net=isA?session.startingCredit-sent+returned:sent*3-returned;
      outcome=sent===undefined?'':'Bank után: '+credits(sent*3);
      flow=sent===undefined?[]:[{label:isA?'küldted':'ő küldte',amount:sent},{label:'bank után',amount:sent*3},...(returned===undefined?[]:[{label:isA?'visszakaptad':'visszaadtad',amount:returned}])];
    }
    // Distinguish recorded/automatic actions from voluntary participant choices.
    const recorded=(type:string)=>ds.some(d=>d.type===type&&(d.isBotDecision||d.submissionSource==='manual_correction'||d.submissionSource==='missing_default'));
    const amountFor=(type:string)=>credits(ds.find(d=>d.type===type)?.amount??0);
    if(pair.gameId==='ultimatum') {
      if(recorded('ultimatum_offer'))action='Rögzített ajánlat: '+amountFor('ultimatum_offer');
      if(recorded('ultimatum_response'))response='Rögzített válasz: '+(ds.find(d=>d.type==='ultimatum_response')?.accepted?'elfogadva':'elutasítva');
    } else if(pair.gameId==='dictator'&&recorded('dictator_give'))action=(isA?'Rögzített átadás: ':'Rögzítve kaptál ')+amountFor('dictator_give');
    else if(pair.gameId==='trust') {
      if(recorded('trust_send'))action='Rögzített küldés: '+amountFor('trust_send');
      if(recorded('trust_return'))response='Rögzített visszaadás: '+amountFor('trust_return');
    }
    return {id:pair.id,roundKey,game,ready:true,partnerId,partner:name(session,partnerId),role,action,response,outcome,net,flow,markers,
      comments:commentsFor([...(own?[{playerId,decisionId:own.id}]:[]),...(other?[{playerId:partnerId,decisionId:other.id}]:[])])};
  });
  const pools=session.publicGoodsRounds.filter(r=>r.status==='settled'&&r.memberIds.includes(playerId)).sort((a,b)=>a.roundNumber-b.roundNumber).map(round=> {
    const amount=round.contributions[playerId]??0,payout=publicGoodsPlayerPayout(round,playerId),start=round.startingPlayerWealth?.[playerId];
    const net=payout-amount;
    const item=report.find(r=>r.publicGoodsRound===round.roundNumber&&r.groupId===round.groupId);
    const decision=session.decisions.find(d=>d.type==='public_goods_contribution'&&d.playerId===playerId&&d.publicGoodsRound===round.roundNumber&&d.groupId===round.groupId);
    return {id:round.id,roundNumber:round.roundNumber,label:item?.roundLabel??`${round.roundNumber}. kör`,group:session.groups.find(g=>g.id===round.groupId)?.name??'Csoport',
      amount,payout,start:start??null,ownPercent:start===undefined?null:ratio(amount,start),potPercent:ratio(amount,round.totalContribution),net,netPercent:start===undefined?null:ratio(net,start),
      success:round.success===true,minimum:round.minimumAmount??null,wiped:start!==undefined&&start>0&&start+net<=0,
      markers:[...(decision?.submissionSource==='missing_default'?['Nem érkezett döntés · automatikus 0']:[]),...(decision?.isBotDecision?['Automatikus döntés']:[]),...(decision?.submissionSource==='manual_correction'?['Kézi rögzítés']:[])],
      comments:commentsFor(item?[{playerId,decisionId:item.id}]:[]),learning:session.publicGoodsContinuation!==undefined&&round.roundNumber>=session.publicGoodsContinuation.firstContinuationRoundNumber};
  });
  return {playerId,name:name(session,playerId),encounters,pools};
}
export type ParticipantJourney=ReturnType<typeof buildParticipantJourney>;
// The opening slide retains all six encounters and up to ten pool rounds.
export function journeyPage(journey:ParticipantJourney,page:number) {
  const pageCount=Math.max(1,Math.ceil(journey.pools.length/10));
  const safePage=Math.max(0,Math.min(page,pageCount-1));
  return {page:safePage,pageCount,encounters:safePage===0?journey.encounters:[],pools:journey.pools.slice(safePage*10,safePage*10+10)};
}
