'use strict';
const ROLE = 'teacher';
AREAS.forEach(a => { $('fArea').append(h('option', { value: a, text: areaLabel(a) })); $('tarea').append(h('option', { value: a, text: areaLabel(a) })); });

$('login').addEventListener('submit', async e => {
  e.preventDefault();
  busy($('enter'), true, '확인 중…');
  try { const r = await api('login', { role: 'teacher', password: $('pw').value }); Session.set(ROLE, r.token); $('pw').value = ''; await load(); }
  catch (err) { msg($('lmsg'), err.message, 'err'); }
  busy($('enter'), false);
});
$('logout').onclick = async () => { try { await api('logout', { token: Session.get(ROLE) }); } catch (e) { /* 무시 */ } Session.clear(ROLE); location.reload(); };
document.querySelectorAll('.tab[data-tab]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab[data-tab]').forEach(x => x.classList.toggle('on', x === b));
  $('tab-list').classList.toggle('hidden', b.dataset.tab !== 'list'); $('tab-reply').classList.toggle('hidden', b.dataset.tab !== 'reply');
});
['fArea', 'fMe', 'fQ'].forEach(id => $(id).addEventListener('input', render));
$('tname').addEventListener('input', fillAcc);
$('reload').onclick = () => load();

async function load() {
  try {
    Dash.data = await api('teacherList', { token: Session.get(ROLE) });
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    render(); fillAcc();
  } catch (err) {
    if (err.relogin) { Session.clear(ROLE); $('app').classList.add('hidden'); $('login').classList.remove('hidden'); }
    msg($('lmsg'), err.message, 'err');
  }
}
function render() {
  Dash.stats($('stats'));
  Dash.table($('teams'), Dash.filter(Dash.data.teams, { area: $('fArea').value, me: $('fMe').value.trim(), q: $('fQ').value.trim() }),
    { download: (f, btn) => Dash.download(ROLE, f, btn) });
  Dash.replies($('replies'));
  Dash.classes($('classes'));
}
function accSelects() { return Array.from(document.querySelectorAll('#accs select')); }
function addAcc() {
  const sel = h('select', { class: 'acc mt8' });
  sel.append(h('option', { value: '', text: '선택 안 함' }));
  $('accs').append(sel);
  fillAcc();
  return sel;
}
function fillAcc() {
  const me = $('tname').value.trim();
  const replies = (Dash.data && Dash.data.replies) || [];
  const mineRep = replies.find(r => r.name === me);
  const mine = mineRep ? mineRep.accepted : [];
  const byOther = {};
  replies.forEach(r => { if (r.name !== me) r.accepted.forEach(id => { byOther[id] = r.name; }); });
  if (!accSelects().length) { addAcc(); addAcc(); return; }
  accSelects().forEach(sel => {
    const keep = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    ((Dash.data && Dash.data.teams) || []).forEach(t => {
      const star = me && (t.t1 === me || t.t2 === me) ? '★ ' : '';
      const tag = mine.includes(t.id) ? '(내가 이미 수락) ' : byOther[t.id] ? '(수락됨) ' : '';
      const opt = h('option', { value: t.id, text: `${star}${tag}${t.area} · ${t.members.map(m => m.id + m.name).join(', ')} · ${t.topic}` });
      if (mine.includes(t.id)) opt.disabled = true;
      sel.append(opt);
    });
    sel.value = keep;
  });
  const team = id => { const t = ((Dash.data && Dash.data.teams) || []).find(x => x.id === id); return t ? t.members.map(m => m.id + m.name).join(', ') : id; };
  $('mine').textContent = mine.length ? `이미 수락한 팀 ${mine.length}개: ${mine.map(team).join(' / ')} → 여기에 새로 고른 팀이 더해집니다.` : '';
}
$('addAcc').addEventListener('click', () => addAcc().focus());
$('rf').addEventListener('submit', async e => {
  e.preventDefault();
  const radio = n => (document.querySelector(`input[name=${n}]:checked`) || {}).value || '';
  const acc = accSelects().map(s => s.value).filter(Boolean);
  if (!$('tname').value.trim() || !$('subject').value.trim() || !$('tarea').value) { msg($('rmsg'), '성함, 담당 교과, 지도 분야를 입력해 주세요.', 'err'); return; }
  if (new Set(acc).size !== acc.length) { msg($('rmsg'), '같은 팀을 두 번 선택했습니다.', 'err'); return; }
  if (!radio('extra') || !radio('judge')) { msg($('rmsg'), '추가 배정과 심사 참여 여부를 선택해 주세요.', 'err'); return; }
  busy($('rsend'), true, '보내는 중…');
  try {
    const res = await api('reply', { token: Session.get(ROLE), name: $('tname').value.trim(), subject: $('subject').value.trim(), area: $('tarea').value,
      accepted: acc, extra: radio('extra'), judge: radio('judge'), memo: $('rmemo').value.trim() });
    msg($('rmsg'), res && res.total ? `회신이 접수되었습니다. 지금까지 수락한 팀은 모두 ${res.total}팀입니다. 감사합니다.` : '회신이 접수되었습니다. 감사합니다.', 'ok'); $('rf').reset(); $('accs').textContent = ''; await load();
  } catch (err) { msg($('rmsg'), err.message, 'err'); }
  busy($('rsend'), false);
});
if (Session.get(ROLE)) load();
