'use strict';
const v = id => $(id).value.trim();
document.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('input', () => el.classList.remove('invalid')));
let payload = null;
// 팀 신청 마감(한국 시각). 서버(Code.gs APPLY_CLOSE)와 같게 유지
const APPLY_CLOSE = { '1': '2026-10-22T00:00:00+09:00', '2': '2026-10-26T13:30:00+09:00', '3': '2026-10-22T00:00:00+09:00' };
const isOpen = g => Date.now() < Date.parse(APPLY_CLOSE[g]);
function checkClose() {
  Array.from($('grade').options).forEach(o => { if (o.value) { o.disabled = !isOpen(o.value); o.textContent = o.value + (o.disabled ? ' (마감)' : ''); } });
  if ($('grade').value && !isOpen($('grade').value)) $('grade').value = '';
  if (!Object.keys(APPLY_CLOSE).some(isOpen) && $('done').classList.contains('hidden')) {
    $('f').classList.add('hidden'); $('closed').classList.remove('hidden');
  }
}
checkClose(); setInterval(checkClose, 30000);

$('f').addEventListener('submit', e => {
  e.preventDefault();
  const errs = [], bad = id => $(id).classList.add('invalid');
  checkClose();
  if ($('f').classList.contains('hidden')) return;
  ['grade', 'area', 'topic', 'question', 't1'].forEach(id => { if (!v(id)) { bad(id); errs.push('필수 항목을 모두 입력해 주세요.'); } });
  const g = v('grade'), members = [];
  for (const i of [1, 2, 3]) {
    const s = v('s' + i), n = v('n' + i);
    if (i === 3 && !s && !n) continue;
    if (!s || !n) { if (!s) bad('s' + i); if (!n) bad('n' + i); errs.push((i === 1 ? '팀장' : '팀원') + '의 학번과 이름을 모두 입력해 주세요.'); continue; }
    if (!/^\d{4}$/.test(s)) { bad('s' + i); errs.push('학번은 숫자 4자리로 입력해 주세요. (예: 1211)'); continue; }
    if (g && s[0] !== g) { bad('s' + i); errs.push(`학번 ${s}은(는) ${g}학년 학번이 아닙니다. 팀은 같은 학년으로 구성합니다.`); }
    if (!/^[가-힣A-Za-z ]+$/.test(n)) { bad('n' + i); errs.push('이름은 한글 또는 영문으로 입력해 주세요.'); }
    members.push({ id: s, name: n });
  }
  const ids = members.map(m => m.id);
  if (new Set(ids).size !== ids.length) errs.push('같은 학번이 두 번 입력되었습니다.');
  if (v('t2') && v('t1') === v('t2')) { bad('t2'); errs.push('1지망과 2지망 선생님이 같습니다.'); }
  if (errs.length) { msg($('msg'), [...new Set(errs)].join('\n'), 'err'); return; }
  msg($('msg'), '');
  payload = { grade: g, area: v('area'), topic: v('topic'), question: v('question'), members, t1: v('t1'), t2: v('t2'), memo: v('memo') };
  const p = clear($('preview'));
  p.append(h('table', null, h('tbody', null,
    h('tr', null, h('th', { text: '학년·분야' }), h('td', { text: `${g}학년 · ${payload.area}` })),
    h('tr', null, h('th', { text: '연구 주제' }), h('td', { text: payload.topic })),
    h('tr', null, h('th', { text: '팀원' }), h('td', { text: members.map(m => m.id + ' ' + m.name).join(', ') })),
    h('tr', null, h('th', { text: '희망 지도교사' }), h('td', { text: payload.t1 + (payload.t2 ? ' / ' + payload.t2 : '') })))));
  $('confirm').classList.remove('hidden'); $('mainActions').classList.add('hidden');
  $('confirm').scrollIntoView({ behavior: 'smooth' });
});
$('back').onclick = () => { $('confirm').classList.add('hidden'); $('mainActions').classList.remove('hidden'); };
$('go').onclick = async () => {
  if (!payload) return;
  busy($('go'), true, '접수 중…'); $('back').disabled = true;
  try {
    const r = await api('apply', payload);
    $('f').classList.add('hidden');
    $('code').textContent = r.code;
    $('doneInfo').textContent = `팀장 학번 ${r.teamId} · 접수 이름 SEED_팀신청_${r.fileLabel}`;
    $('done').classList.remove('hidden');
    window.scrollTo(0, 0);
  } catch (err) {
    msg($('msg'), err.message, 'err');
    busy($('go'), false); $('back').disabled = false;
  }
};
