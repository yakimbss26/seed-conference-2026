'use strict';
const $ = id => document.getElementById(id);
const v = id => $(id).value.trim();
function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`}
document.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',()=>el.classList.remove('invalid')));
$('reset').onclick=()=>{$('f').reset();$('msg').textContent='';document.querySelectorAll('.invalid').forEach(e=>e.classList.remove('invalid'))};
$('f').addEventListener('submit',e=>{
  e.preventDefault();
  const errs=[], bad=id=>$(id).classList.add('invalid');
  ['grade','area','topic','question','t1'].forEach(id=>{if(!v(id)){bad(id);errs.push('필수 항목을 모두 입력해 주세요.')}});
  const g=v('grade'), members=[];
  for(const i of [1,2,3]){
    const s=v('s'+i), n=v('n'+i);
    if(i<3 && (!s||!n)){ if(!s)bad('s'+i); if(!n)bad('n'+i); errs.push((i===1?'팀장':'팀원')+'의 학번과 이름을 입력해 주세요.'); continue; }
    if(i>1 && !s && !n) continue;
    if(i>1 && (!s||!n)){ if(!s)bad('s'+i); if(!n)bad('n'+i); errs.push('팀원은 학번과 이름을 모두 입력하거나 모두 비워 주세요.'); continue; }
    if(!/^\d{5}$/.test(s)){bad('s'+i);errs.push('학번은 숫자 5자리로 입력해 주세요. (예: 10211)');continue}
    if(g && s[0]!==g){bad('s'+i);errs.push(`학번 ${s}이(가) ${g}학년 학번이 아닙니다. 팀은 같은 학년으로 구성합니다.`)}
    members.push([s,n]);
  }
  const ids=members.map(m=>m[0]); if(new Set(ids).size!==ids.length) errs.push('같은 학번이 두 번 입력되었습니다.');
  if(v('t1') && v('t1')===v('t2')){bad('t2');errs.push('1지망과 2지망 선생님이 같습니다.')}
  if(errs.length){$('msg').className='msg err';$('msg').textContent=[...new Set(errs)].join('\n');return}
  const row={'양식':'SEED-팀신청','제출일시':stamp(),'학년':Number(g),'연구분야':v('area'),'연구주제(가제)':v('topic'),'연구질문·동기':v('question'),
    '팀장 학번':members[0][0],'팀장 이름':members[0][1],'팀원1 학번':members[1]?members[1][0]:'','팀원1 이름':members[1]?members[1][1]:'',
    '팀원2 학번':members[2]?members[2][0]:'','팀원2 이름':members[2]?members[2][1]:'','인원':members.length,
    '희망 지도교사(1지망)':v('t1'),'희망 지도교사(2지망)':v('t2'),'비고':v('memo')};
  const ws=XLSX.utils.json_to_sheet([row]);
  ws['!cols']=[8,16,6,18,36,50,10,10,10,10,10,10,6,16,16,24].map(w=>({wch:w}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'SEED팀신청');
  const fname=`SEED_팀신청_${members[0][0]}_${safeName(members[0][1])}.xlsx`;
  saveXlsx(wb,fname);
  $('msg').className='msg ok';
  $('msg').textContent=`"${fname}" 파일을 저장했습니다.\n다운로드 폴더에서 파일을 찾아 장혜은 선생님께 팀즈로 제출해 주세요.`;
});
