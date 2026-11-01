'use strict';
const ToyStats=Object.freeze({
 total(scores){return scores.reduce((sum,n)=>sum+(n??0),0);},
 meanTotal(roster,records){
  const people=roster.map(name=>records.filter(r=>r.seller===name)).filter(rows=>rows.length);
  return people.length?people.reduce((sum,rows)=>sum+rows.reduce((value,r)=>value+ToyStats.total(r.scores),0)/rows.length,0)/people.length:0;
 },
 criteria(items,roster,records){
  const people=roster.map(name=>records.filter(r=>r.seller===name)).filter(rows=>rows.length);
  if(!people.length)return [];
  return items.map((item,index)=>({...item,index,mean:people.reduce((sum,rows)=>sum+rows.reduce((value,r)=>value+r.scores[index],0)/rows.length,0)/people.length,counts:[0,1,2].map(score=>records.filter(r=>r.scores[index]===score).length)})).sort((a,b)=>b.mean-a.mean||a.index-b.index);
 },
 passed(scores){return ToyStats.total(scores)>=25;}
});
