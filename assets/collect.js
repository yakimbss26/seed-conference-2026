'use strict';
const $=id=>document.getElementById(id);
const S={teams:new Map(),teachers:new Map(),files:0,skipped:[]};
const AREAS=['물리','화학','생물','지구 및 환경','산업 및 에너지'];
const str=x=>x==null?'':String(x).trim();
const esc=s=>str(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const MAX_FILES=300;
async function addFiles(list){
  for(const f of list){
    if(S.files+S.skipped.length>=MAX_FILES){S.skipped.push(f.name+' (파일 수 제한 '+MAX_FILES+'개 초과)');continue}
    if(!/\.xlsx$/i.test(f.name)){S.skipped.push(f.name+' (xlsx 아님)');continue}
    try{
      const rows=await SEEDREAD.read(f);
      let used=false;
      for(const r of rows){
        const kind=str(r['양식']);
        if(kind==='SEED-팀신청'){const k=str(r['팀장 학번']);if(!/^\d{5}$/.test(k))continue;const o=S.teams.get(k);if(!o||str(o['제출일시'])<=str(r['제출일시'])){r._file=f.name;S.teams.set(k,r)}used=true}
        else if(kind==='SEED-교사회신'){const k=str(r['교사명']);if(!k)continue;const o=S.teachers.get(k);if(!o||str(o['제출일시'])<=str(r['제출일시'])){r._file=f.name;S.teachers.set(k,r)}used=true}
      }
      if(used)S.files++;else S.skipped.push(f.name+' (SEED 양식 아님)');
    }catch(e){S.skipped.push(f.name+' (읽기 실패: '+e.message+')')}
  }
  render();
}

function analyze(){
  const teams=[...S.teams.values()].sort((a,b)=>(AREAS.indexOf(str(a['연구분야']))-AREAS.indexOf(str(b['연구분야'])))||str(a['팀장 학번']).localeCompare(str(b['팀장 학번'])));
  const teachers=[...S.teachers.values()].sort((a,b)=>(AREAS.indexOf(str(a['지도분야']))-AREAS.indexOf(str(b['지도분야'])))||str(a['교사명']).localeCompare(str(b['교사명'])));
  const accepted=new Map(); // 팀장학번 -> [교사명]
  teachers.forEach(t=>[1,2].forEach(i=>{const s=str(t[`수락${i} 팀장 학번`]);if(s){if(!accepted.has(s))accepted.set(s,[]);accepted.get(s).push(str(t['교사명']))}}));
  const warns=[];
  const seen=new Map();
  teams.forEach(t=>[['팀장 학번','팀장 이름'],['팀원1 학번','팀원1 이름'],['팀원2 학번','팀원2 이름']].forEach(([sk,nk])=>{const s=str(t[sk]);if(!s)return;if(seen.has(s))warns.push(`학번 ${s}(${str(t[nk])}) 학생이 두 팀에 들어 있습니다: 팀장 ${seen.get(s)} 팀, 팀장 ${str(t['팀장 학번'])} 팀`);else seen.set(s,str(t['팀장 학번']))}));
  accepted.forEach((ts,s)=>{if(ts.length>1)warns.push(`팀장 ${s} 팀을 여러 교사가 수락했습니다: ${ts.join(', ')}`);if(!S.teams.has(s))warns.push(`${ts.join(', ')} 선생님이 수락한 팀장 ${s} 팀의 신청서가 없습니다.`)});
  const match=teams.map((t,i)=>{const s=str(t['팀장 학번']);const ts=accepted.get(s)||[];
    const members=[[t['팀장 학번'],t['팀장 이름']],[t['팀원1 학번'],t['팀원1 이름']],[t['팀원2 학번'],t['팀원2 이름']]].filter(m=>str(m[0])).map(m=>`${str(m[0])} ${str(m[1])}`).join(', ');
    return {'번호':i+1,'학년':str(t['학년']),'연구분야':str(t['연구분야']),'연구주제(가제)':str(t['연구주제(가제)']),'팀원':members,'인원':str(t['인원']),
      '1지망':str(t['희망 지도교사(1지망)']),'2지망':str(t['희망 지도교사(2지망)']),'매칭 교사':ts.join(', '),'상태':ts.length===1?'매칭 완료':ts.length>1?'중복 수락':'미매칭'}});
  return {teams,teachers,match,warns};
}

function table(rows,cols){
  if(!rows.length)return '<p class="muted">자료 없음</p>';
  return '<table><thead><tr>'+cols.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>`<td>${esc(r[c])}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
}

function render(){
  const A=analyze();
  const done=A.match.filter(m=>m['상태']==='매칭 완료').length;
  $('stats').innerHTML=[['팀 신청',A.teams.length+'팀'],['참가 학생',A.teams.reduce((n,t)=>n+Number(t['인원']||0),0)+'명'],['교사 회신',A.teachers.length+'명'],['매칭 완료',done+'팀'],['미매칭',A.match.filter(m=>m['상태']==='미매칭').length+'팀']]
    .map(([k,v])=>`<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
  const w=[...A.warns];S.skipped.forEach(s=>w.push('불러오지 않은 파일: '+s));
  $('warns').innerHTML=w.length?`<div class="warn"><b>확인 필요 ${w.length}건</b><ul>${w.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
  $('tblMatch').innerHTML=table(A.match,['번호','학년','연구분야','연구주제(가제)','팀원','1지망','2지망','매칭 교사','상태']);
  $('tblTeacher').innerHTML=table(A.teachers,['교사명','담당교과','지도분야','수락 팀 수','수락1 팀장 학번','수락1 팀장 이름','수락2 팀장 학번','수락2 팀장 이름','추가 배정 가능','심사 참여']);
  $('save').disabled=!(A.teams.length||A.teachers.length);
}

function sheet(rows,widths){const ws=XLSX.utils.json_to_sheet(rows);if(widths)ws['!cols']=widths.map(w=>({wch:w}));return ws}
$('save').onclick=()=>{
  const A=analyze();
  const clean=r=>{const o={...r};delete o._file;delete o['양식'];return o};
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheet(A.match.length?A.match:[{'번호':''}],[6,6,18,36,40,6,12,12,14,10]),'매칭현황');
  XLSX.utils.book_append_sheet(wb,sheet(A.teams.length?A.teams.map((r,i)=>({'번호':i+1,...clean(r)})):[{'번호':''}],[6,16,6,18,36,50,10,10,10,10,10,10,6,16,16,24]),'학생 팀신청');
  XLSX.utils.book_append_sheet(wb,sheet(A.teachers.length?A.teachers.map(clean):[{'교사명':''}],[16,10,10,18,8,12,10,30,12,10,30,10,8,24]),'지도교사 회신');
  const w=[...A.warns,...S.skipped.map(s=>'불러오지 않은 파일: '+s)];
  XLSX.utils.book_append_sheet(wb,sheet(w.length?w.map((x,i)=>({'번호':i+1,'확인 필요 사항':x})):[{'번호':'','확인 필요 사항':'없음'}],[6,90]),'확인필요');
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  saveXlsx(wb,`SEED_취합_${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`);
  $('msg').className='msg ok';$('msg').textContent='취합 엑셀 파일을 저장했습니다.';
};
$('clear').onclick=()=>{S.teams.clear();S.teachers.clear();S.files=0;S.skipped=[];$('msg').textContent='';render();$('tblMatch').innerHTML=$('tblTeacher').innerHTML='<p class="muted">아직 불러온 파일이 없습니다.</p>'};
$('file').onchange=e=>{addFiles([...e.target.files]);e.target.value=''};
const dz=$('drop');
['dragenter','dragover'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add('on')}));
['dragleave','drop'].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.remove('on')}));
dz.addEventListener('drop',e=>addFiles([...e.dataTransfer.files]));
