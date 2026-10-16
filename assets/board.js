'use strict';
function bars(el, items, max) {
  clear(el).append(...items.map(([label, n, sub]) => {
    const fill = h('div', { class: 'fill' });
    fill.style.width = (max ? Math.round(n / max * 100) : 0) + '%';
    return h('div', { class: 'bar' }, h('div', { class: 'bl' }, h('span', { text: label }), h('b', { text: sub || String(n) })), h('div', { class: 'track' }, fill));
  }));
}
function classTable(el, classes, stages) {
  const head = h('tr', null, h('th', { text: '반' }), h('th', { text: '참여' }), ...stages.map(s => h('th', { text: s.name })));
  const sum = { total: 0, applied: 0, st: {} };
  const rows = classes.map(c => {
    sum.total += c.total; sum.applied += c.applied;
    const cell = (n, tot) => { const pct = tot ? Math.round(n / tot * 100) : 0; const fill = h('div', { class: 'fill' }); fill.style.width = pct + '%';
      return h('td', null, h('div', { class: 'bl' }, h('b', { text: `${n}/${tot}` }), h('span', { class: 'muted', text: pct + '%' })), h('div', { class: 'track' }, fill)); };
    return h('tr', null, h('th', { text: c.cls + '반' }), cell(c.applied, c.total), ...stages.map(s => { sum.st[s.key] = (sum.st[s.key] || 0) + c.stages[s.key]; return cell(c.stages[s.key], c.total); }));
  });
  const pct = sum.total ? Math.round(sum.applied / sum.total * 100) : 0;
  clear(el).append(h('thead', null, head), h('tbody', null, ...rows,
    h('tr', { class: 'sum' }, h('th', { text: '전체' }), h('td', { text: `${sum.applied}/${sum.total} (${pct}%)` }), ...stages.map(s => h('td', { text: `${sum.st[s.key] || 0}/${sum.total}` })))));
  return { total: sum.total, applied: sum.applied, pct };
}
async function load() {
  try {
    const s = (await api('stats')).stats;
    const g1t = (s.classes || []).filter(c => c.grade === '1').reduce((a, c) => [a[0] + c.applied, a[1] + c.total], [0, 0]);
    clear($('big')).append(...[['신청 팀', s.teams + '팀'], ['참가 학생', s.students + '명'],
      g1t[1] ? ['1학년 참여율', Math.round(g1t[0] / g1t[1] * 100) + '%'] : ['지도교사 회신', s.replies + '명'],
      ['2·3학년 희망 참가', ((s.byGradeStudents || {})['2'] || 0) + ((s.byGradeStudents || {})['3'] || 0) + '명'], ['매칭된 팀', s.matched + '팀']]
      .map(([k, v]) => h('div', { class: 'stat' }, h('span', { text: k }), h('b', { text: v }))));
    const areas = Object.entries(s.byArea);
    bars($('areas'), areas.map(([k, n]) => [k, n, n + '팀']), Math.max(1, ...areas.map(a => a[1])));
    const grades = Object.entries(s.byGrade);
    bars($('grades'), grades.map(([k, n]) => [k + '학년', n, n + '팀']), Math.max(1, ...grades.map(a => a[1])));
    bars($('stages'), Object.values(s.byStage).map(x => [`${x.name} (기한 ${fmtDue(x.due)})`, x.count, `${x.count} / ${s.teams}팀`]), Math.max(1, s.teams));
    const g1 = (s.classes || []).filter(c => c.grade === '1');
    const stagesArr = Object.entries(s.byStage).map(([key, x]) => ({ key, name: x.name }));
    $('gradeCard').classList.toggle('hidden', !g1.length);
    if (g1.length) { const r = classTable($('cls'), g1, stagesArr); $('g1sum').textContent = `· 1학년 ${r.applied}/${r.total}명 신청 (${r.pct}%), 미신청 ${r.total - r.applied}명`; }
    $('updated').textContent = '마지막 갱신 ' + s.updated.slice(5, 16);
    msg($('msg'), '');
  } catch (err) { msg($('msg'), err.message, 'err'); }
}
load(); setInterval(load, 60000);
