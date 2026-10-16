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
function fillAcc() {
  const me = $('tname').value.trim();
  ['acc1', 'acc2'].forEach(id => {
    const sel = $(id), keep = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    Dash.data.teams.forEach(t => {
      const star = me && (t.t1 === me || t.t2 === me) ? '★ ' : '';
      sel.append(h('option', { value: t.id, text: `${star}${t.area} · ${t.members.map(m => m.id + m.name).join(', ')} · ${t.topic}` }));
    });
    sel.value = keep;
  });
}
$('rf').addEventListener('submit', async e => {
  e.preventDefault();
  const radio = n => (document.querySelector(`input[name=${n}]:checked`) || {}).value || '';
  const acc = [$('acc1').value, $('acc2').value].filter(Boolean);
  if (!$('tname').value.trim() || !$('subject').value.trim() || !$('tarea').value) { msg($('rmsg'), '성함, 담당 교과, 지도 분야를 입력해 주세요.', 'err'); return; }
  if (acc.length === 2 && acc[0] === acc[1]) { msg($('rmsg'), '같은 팀을 두 번 선택했습니다.', 'err'); return; }
  if (!radio('extra') || !radio('judge')) { msg($('rmsg'), '추가 배정과 심사 참여 여부를 선택해 주세요.', 'err'); return; }
  busy($('rsend'), true, '보내는 중…');
  try {
    await api('reply', { token: Session.get(ROLE), name: $('tname').value.trim(), subject: $('subject').value.trim(), area: $('tarea').value,
      accepted: acc, extra: radio('extra'), judge: radio('judge'), memo: $('rmemo').value.trim() });
    msg($('rmsg'), '회신이 접수되었습니다. 감사합니다.', 'ok'); $('rf').reset(); await load();
  } catch (err) { msg($('rmsg'), err.message, 'err'); }
  busy($('rsend'), false);
});
if (Session.get(ROLE)) load();
