'use strict';
let cred = null;
const MAX = 15 * 1024 * 1024;

$('login').addEventListener('submit', async e => {
  e.preventDefault();
  const lid = $('lid').value.trim(), code = $('code').value.trim().toUpperCase();
  if (!/^\d{4}$/.test(lid) || !/^[A-Z0-9]{6}$/.test(code)) { msg($('lmsg'), '팀장 학번 4자리와 팀 코드 6자리를 입력해 주세요.', 'err'); return; }
  busy($('enter'), true, '확인 중…');
  try {
    const r = await api('teamStatus', { leaderId: lid, code });
    cred = { leaderId: lid, code };
    show(r.team, r.stages, r.mentors);
    $('login').classList.add('hidden'); $('team').classList.remove('hidden'); msg($('lmsg'), '');
  } catch (err) { msg($('lmsg'), err.message, 'err'); }
  busy($('enter'), false);
});
$('out').onclick = () => { cred = null; $('code').value = ''; $('team').classList.add('hidden'); $('login').classList.remove('hidden'); };

function mentorCell(list) {
  if (!Array.isArray(list)) return h('td', { text: '-' });
  if (list.length === 1) return h('td', { class: 'good', text: '✓ ' + list[0].name + ' 선생님 (' + list[0].subject + ')' });
  if (list.length > 1) return h('td', { text: '담당 선생님이 확인 중입니다. (' + list.map(m => m.name).join(', ') + ' 선생님께서 수락)' });
  return h('td', { class: 'muted', text: '매칭 중입니다. 희망 선생님께 연구 계획을 설명드려 보세요.' });
}
function show(team, stages, mentors) {
  clear($('teamInfo')).append(h('table', null, h('tbody', null,
    h('tr', null, h('th', { text: '지도교사' }), mentorCell(mentors)),
    h('tr', null, h('th', { text: '연구 주제' }), h('td', { text: team.topic })),
    h('tr', null, h('th', { text: '분야' }), h('td', { text: team.grade + '학년 · ' + team.area })),
    h('tr', null, h('th', { text: '팀원' }), h('td', { text: membersText(team) })))));
  const box = clear($('stages'));
  stages.forEach(s => {
    const row = h('div', { class: 'stage' + (s.submitted ? ' done' : '') },
      h('div', { class: 'stage-head' }, h('b', { text: s.name }), h('span', { class: 'muted', text: ' 기한 ' + fmtDue(s.due) })));
    if (s.submitted) {
      row.append(h('div', { class: 'ok' }, '✓ 제출 완료 · ', s.fileName, ' · ', s.at, s.late ? ' (기한 후 제출)' : ''));
    } else {
      const inp = h('input', { type: 'file', accept: s.ext.map(x => '.' + x).join(',') });
      const btn = h('button', { type: 'button', class: 'primary', text: '제출하기' });
      btn.addEventListener('click', () => upload(s, inp, btn));
      row.append(h('div', { class: 'hint', text: '가능한 파일: ' + s.ext.join(', ') }), h('div', { class: 'upl' }, inp, btn));
    }
    box.append(row);
  });
}

async function upload(s, inp, btn) {
  const f = inp.files && inp.files[0];
  if (!f) { msg($('smsg'), '제출할 파일을 선택해 주세요.', 'err'); return; }
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!s.ext.includes(ext)) { msg($('smsg'), `${s.name}은(는) ${s.ext.join(', ')} 파일만 낼 수 있습니다.`, 'err'); return; }
  if (f.size > MAX) { msg($('smsg'), '파일은 15MB 이하만 낼 수 있습니다.', 'err'); return; }
  busy(btn, true, '올리는 중…'); inp.disabled = true;
  try {
    const data = await fileToB64(f);
    const r = await api('upload', Object.assign({ stage: s.key, fileName: f.name, data }, cred));
    msg($('smsg'), `"${r.fileName}"(으)로 제출했습니다.`, 'ok');
    const t = await api('teamStatus', cred);
    show(t.team, t.stages, t.mentors);
  } catch (err) { msg($('smsg'), err.message, 'err'); busy(btn, false); inp.disabled = false; }
}
