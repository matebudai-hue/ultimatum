import type {GameSession} from './gameTypes';

export const STANDINGS_PAGE_SIZE = 10;

export function buildCreditStandings(session: GameSession) {
  const rows = session.players.filter(player => !player.isBot).map(player => {
    const amounts = {ultimatum:0,dictator:0,trust:0,publicGoods:0};
    for (const entry of session.transactions.filter(t => t.playerId === player.id)) {
      if (entry.reason === 'manual_balance_correction' || entry.reason === 'post_report_restart_floor') continue;
      if (entry.roundKey === '1a' || entry.roundKey === '1b') amounts.ultimatum += entry.amount;
      else if (entry.roundKey === '2a' || entry.roundKey === '2b') amounts.dictator += entry.amount;
      else if (entry.roundKey === '3a' || entry.roundKey === '3b') amounts.trust += entry.amount;
      else if (entry.roundKey === '4') amounts.publicGoods += entry.amount;
    }
    const adjustment = player.currentBalance - Object.values(amounts).reduce((sum,n) => sum+n,0);
    return {id:player.id,name:player.name,total:player.currentBalance,...amounts,adjustment,rank:0};
  }).sort((a,b) => b.total-a.total || a.name.localeCompare(b.name,'hu'));
  rows.forEach((row,index) => row.rank = index > 0 && row.total === rows[index-1].total ? rows[index-1].rank : index+1);
  return rows;
}

export function renderCreditStandings(target: Window, session: GameSession, page=0) {
  const rows = buildCreditStandings(session);
  const pages = Math.max(1,Math.ceil(rows.length/STANDINGS_PAGE_SIZE));
  const currentPage = Math.max(0,Math.min(pages-1,page));
  const adjustmentVisible = rows.some(row => row.adjustment !== 0);
  const doc=target.document;
  doc.title='Kreditjáték – Végeredmény';
  doc.head.replaceChildren();
  const style=doc.createElement('style');
  style.textContent=`
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
    body{font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;background:#f1f5f9;color:#10213a;padding:3vh 3vw}
    main{height:100%;display:flex;flex-direction:column;gap:2vh;max-width:1800px;margin:auto}
    header{display:flex;align-items:end;justify-content:space-between;gap:20px}header p{margin:0;color:#52727c;font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    h1{font-size:clamp(30px,4vw,58px);line-height:1.05;margin:6px 0 0;letter-spacing:-.04em}header>strong{font-size:clamp(16px,1.8vw,26px);color:#267e7e}
    .table-card{background:#fff;border:1px solid #dce5ec;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px #10213a09}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:clamp(14px,1.55vw,24px);font-variant-numeric:tabular-nums}
    th{background:#10213a;color:#fff;font-size:.78em;padding:12px 10px;text-align:right}td{padding:clamp(6px,1vh,12px) 10px;border-bottom:1px solid #e7edf2;text-align:right;white-space:nowrap}
    th:first-child,td:first-child{width:5%;text-align:center;color:#708596}th:nth-child(2),td:nth-child(2){width:22%;text-align:left;overflow:hidden;text-overflow:ellipsis}th:nth-child(3),td:nth-child(3){width:18%;background:#e8f5f2;color:#105e59;font-weight:900;font-size:1.12em}
    tbody tr:nth-child(even){background:#f8fafc}tbody tr:last-child td{border-bottom:0}.negative{color:#b03a36}.positive{color:#16806c}.rank{font-size:.8em;font-weight:900}
    footer{margin-top:auto;display:flex;justify-content:space-between;gap:20px;color:#52657b;font-size:clamp(12px,1.05vw,17px);line-height:1.45}footer p{margin:0}footer strong{white-space:nowrap;color:#10213a}
    .empty{padding:40px;text-align:center;color:#64748b}
  `;
  doc.head.appendChild(style);
  const main=doc.createElement('main');
  const header=doc.createElement('header');
  const heading=doc.createElement('div');
  const eyebrow=doc.createElement('p');eyebrow.textContent='Kreditjáték · résztvevői eredmények';
  const title=doc.createElement('h1');title.textContent=session.status==='finished'?'Végeredmény':'Aktuális kreditállás';
  heading.append(eyebrow,title);
  const meta=doc.createElement('strong');meta.textContent=rows.length+' résztvevő';
  header.append(heading,meta);main.appendChild(header);
  const card=doc.createElement('section');card.className='table-card';
  const table=doc.createElement('table');table.setAttribute('aria-label','Résztvevők kreditje játékonként');
  const thead=doc.createElement('thead'),headRow=doc.createElement('tr');
  const headings=['#','Résztvevő','Összes kredit','Ultimátum','Diktátor','Bizalom','Közös kassza',...(adjustmentVisible?['Korrekció / feltöltés']:[])];
  for(const label of headings){const th=doc.createElement('th');th.scope='col';th.textContent=label;headRow.appendChild(th);}
  thead.appendChild(headRow);table.appendChild(thead);
  const tbody=doc.createElement('tbody');
  const format=(n:number)=>new Intl.NumberFormat('hu-HU',{maximumFractionDigits:0}).format(n);
  for(const row of rows.slice(currentPage*STANDINGS_PAGE_SIZE,(currentPage+1)*STANDINGS_PAGE_SIZE)){
    const tr=doc.createElement('tr');
    const values=[String(row.rank),row.name,format(row.total),format(row.ultimatum),format(row.dictator),format(row.trust),(row.publicGoods>0?'+':'')+format(row.publicGoods),...(adjustmentVisible?[(row.adjustment>0?'+':'')+format(row.adjustment)]:[])];
    values.forEach((value,index)=>{const td=doc.createElement('td');td.textContent=value;if(index===1)td.title=row.name;if(index===0)td.className='rank';if(index===6)td.className=row.publicGoods<0?'negative':row.publicGoods>0?'positive':'';tr.appendChild(td);});
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);card.appendChild(table);
  if(rows.length===0){const empty=doc.createElement('p');empty.className='empty';empty.textContent='Még nincs résztvevő a játékban.';card.appendChild(empty);}
  main.appendChild(card);
  const footer=doc.createElement('footer'),note=doc.createElement('p'),paging=doc.createElement('strong');
  note.textContent='Minden érték kreditben. A játékok oszlopai a már könyvelt nettó eredményt mutatják. A közös kassza eredménye veszteség is lehet.';
  if(session.pairings.some(pair=>pair.playerA==='BOT'||pair.playerB==='BOT'))note.textContent+=' A tartalékjátékos nem gyűjt saját kreditet.';
  paging.textContent=(currentPage+1)+' / '+pages+' · Összesen '+format(rows.reduce((sum,row)=>sum+row.total,0))+' kredit';
  footer.append(note,paging);main.appendChild(footer);doc.body.replaceChildren(main);
  return true;
}
