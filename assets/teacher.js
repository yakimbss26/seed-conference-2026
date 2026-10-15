'use strict';
const $ = id => document.getElementById(id);
const v = id => $(id).value.trim();
const radio = n => (document.querySelector(`input[name=${n}]:checked`)||{}).value||'';
function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`}
document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>el.classList.remove('invalid')));
$('none').addEventListener('change',()=>{['a1s','a1n','a1t','a2s','a2n','a2t'].forEach(id=>{$(id).disabled=$('none').checked;if($('none').checked){$(id).value='';$(id).classList.remove('invalid')}})});
$('reset').onclick=()=>{$('f').reset();$('none').dispatchEvent(new Event('change'));$('msg').textContent=''};
$('f').addEventListener('submit',e=>{
  e.preventDefault();
  const errs=[], bad=id=>$(id).classList.add('invalid');
  ['tname','subject','area'].forEach(id=>{if(!v(id)){bad(id);errs.push('교사 정보를 모두 입력해 주세요.')}});
  const teams=[];
  if(!$('none').checked){
    for(const i of [1,2]){
      const s=v(`a${i}s`),n=v(`a${i}n`),t=v(`a${i}t`);
      if(!s&&!n&&!t) continue;
      if(!/^\d{5}$/.test(s)){bad(`a${i}s`);errs.push(`수락 팀 ${i}의 팀장 학번을 숫자 5자리로 입력해 주세요.`);continue}
      if(!n){bad(`a${i}n`);errs.push(`수락 팀 ${i}의 팀장 이름을 입력해 주세요.`);continue}
      teams.push([s,n,t]);
    }
    if(!teams.length && !errs.length) errs.push('수락한 팀을 입력하거나 "수락할 팀이 없습니다"에 표시해 주세요.');
    if(teams.length===2 && teams[0][0]===teams[1][0]) errs.push('같은 팀이 두 번 입력되었습니다.');
  }
  if(!radio('extra')) errs.push('추가 배정 가능 여부를 선택해 주세요.');
  if(!radio('judge')) errs.push('심사 참여 여부를 선택해 주세요.');
  if(errs.length){$('msg').className='msg err';$('msg').textContent=[...new Set(errs)].join('\n');return}
  const row={'양식':'SEED-교사회신','제출일시':stamp(),'교사명':v('tname'),'담당교과':v('subject'),'지도분야':v('area'),'수락 팀 수':teams.length,
    '수락1 팀장 학번':teams[0]?teams[0][0]:'','수락1 팀장 이름':teams[0]?teams[0][1]:'','수락1 연구주제':teams[0]?teams[0][2]:'',
    '수락2 팀장 학번':teams[1]?teams[1][0]:'','수락2 팀장 이름':teams[1]?teams[1][1]:'','수락2 연구주제':teams[1]?teams[1][2]:'',
    '추가 배정 가능':radio('extra'),'심사 참여':radio('judge'),'비고':v('memo')};
  const ws=XLSX.utils.json_to_sheet([row]);
  ws['!cols']=[8,16,10,10,18,8,12,10,30,12,10,30,10,8,24].map(w=>({wch:w}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'SEED교사회신');
  const fname=`SEED_지도교사회신_${safeName(v('tname'))}.xlsx`;
  saveXlsx(wb,fname);
  $('msg').className='msg ok';
  $('msg').textContent=`"${fname}" 파일을 저장했습니다.\n다운로드 폴더에서 파일을 찾아 장혜은 선생님께 팀즈로 보내 주세요.`;
});
