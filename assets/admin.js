'use strict';
const ROLE = 'admin';
AREAS.forEach(a => $('fArea').append(h('option', { text: a })));
const tok = () => Session.get(ROLE);

$('login').addEventListener('submit', async e => {
  e.preventDefault();
  busy($('enter'), true, '확인 중…');
  try { const r = await api('login', { role: 'admin', password: $('pw').value }); Session.set(ROLE, r.token); $('pw').value = ''; await load(); }
  catch (err) { msg($('lmsg'), err.message, 'err'); }
  busy($('enter'), false);
});
$('logout').onclick = async () => { try { await api('logout', { token: tok() }); } catch (e) { /* 무시 */ } Session.clear(ROLE); location.reload(); };
$('reload').onclick = () => load();
['fArea', 'fQ'].forEach(id => $(id).addEventListener('input', render));

async function load() {
  try {
    Dash.data = await api('adminList', { token: tok() });
    $('login').classList.add('hidden'); $('app').classList.remove('hidden'); render();
  } catch (err) {
    if (err.relogin) { Session.clear(ROLE); $('app').classList.add('hidden'); $('login').classList.remove('hidden'); }
    msg($('lmsg'), err.message, 'err');
  }
}
function render() {
  Dash.stats($('stats'));
  Dash.table($('teams'), Dash.filter(Dash.data.teams, { area: $('fArea').value, q: $('fQ').value.trim() }), {
    admin: true, download: (f, btn) => Dash.download(ROLE, f, btn),
    delTeam: t => act(`팀장 ${t.id} 팀(${membersText(t)})의 신청과 제출 파일을 모두 삭제할까요?`, 'deleteTeam', { teamId: t.id }),
    delFile: (t, s) => act(`팀장 ${t.id} 팀의 「${s.name}」 파일을 삭제할까요? 삭제하면 다시 제출할 수 있습니다.`, 'deleteFile', { teamId: t.id, stage: s.key })
  });
  Dash.classes($('classes'));
  Dash.replies($('replies'), { admin: true, delReply: x => act(`${x.name} 선생님의 회신을 삭제할까요?`, 'deleteReply', { name: x.name }) });
}
async function act(question, action, payload) {
  if (!confirm(question)) return;
  try { await api(action, Object.assign({ token: tok() }, payload)); msg($('dmsg'), '삭제했습니다.', 'ok'); await load(); }
  catch (err) { msg($('dmsg'), err.message, 'err'); }
}
$('xlsx').onclick = () => {
  const d = Dash.data, st = d.stages;
  const wb = XLSX.utils.book_new();
  const sheet = (rows, w) => { const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '자료': '없음' }]); if (w) ws['!cols'] = w.map(x => ({ wch: x })); return ws; };
  const mem = (t, i) => t.members[i] || { id: '', name: '' };
  XLSX.utils.book_append_sheet(wb, sheet(d.teams.map((t, i) => {
    const m = Dash.matched(t.id);
    const o = { '번호': i + 1, '학년': t.grade, '연구분야': t.area, '연구주제(가제)': t.topic, '팀원': membersText(t), '인원': t.members.length,
      '1지망': t.t1, '2지망': t.t2, '매칭 교사': m.join(', '), '상태': Dash.status(t) };
    st.forEach(s => { o[s.name] = t.files[s.key] ? '제출' + (t.files[s.key].late ? '(기한 후)' : '') : '미제출'; });
    return o;
  }), [6, 6, 16, 36, 40, 6, 10, 10, 14, 10, 14, 12, 14, 12]), '매칭·제출현황');
  XLSX.utils.book_append_sheet(wb, sheet(d.teams.map((t, i) => ({ '번호': i + 1, '신청일시': t.at, '팀 코드': t.code, '학년': t.grade, '연구분야': t.area,
    '연구주제(가제)': t.topic, '연구질문·동기': t.question, '팀장 학번': mem(t, 0).id, '팀장 이름': mem(t, 0).name, '팀원1 학번': mem(t, 1).id, '팀원1 이름': mem(t, 1).name,
    '팀원2 학번': mem(t, 2).id, '팀원2 이름': mem(t, 2).name, '인원': t.members.length, '희망 지도교사(1지망)': t.t1, '희망 지도교사(2지망)': t.t2, '비고': t.memo })),
    [6, 18, 9, 6, 16, 36, 50, 9, 10, 9, 10, 9, 10, 6, 14, 14, 24]), '학생 팀신청');
  const files = [];
  d.teams.forEach(t => st.forEach(s => { const f = t.files[s.key]; if (f) files.push({ '팀장 학번': t.id, '팀원': membersText(t), '단계': s.name, '파일명': f.name, '제출일시': f.at, '기한 후 제출': f.late ? 'Y' : '', '크기': fmtSize(f.size) }); }));
  XLSX.utils.book_append_sheet(wb, sheet(files, [9, 40, 18, 60, 18, 10, 8]), '산출물 제출');
  XLSX.utils.book_append_sheet(wb, sheet(d.replies.map(x => ({ '교사명': x.name, '담당교과': x.subject, '지도분야': x.area, '수락 팀(팀장 학번)': x.accepted.join(', '),
    '추가 배정 가능': x.extra, '심사 참여': x.judge, '비고': x.memo, '회신일시': x.at })), [10, 10, 16, 20, 10, 8, 30, 18]), '지도교사 회신');
  const n = new Date(), p = v => String(v).padStart(2, '0');
  saveXlsx(wb, `SEED_취합_${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}.xlsx`);
};
if (tok()) load();
