'use strict';
// 교사·관리자 화면이 함께 쓰는 표 그리기
const Dash = {
  data: null,
  matched(teamId) { return (this.data.replies || []).filter(r => r.accepted.includes(teamId)).map(r => r.name); },
  status(t) { const m = this.matched(t.id); return m.length === 1 ? '매칭 완료' : m.length > 1 ? '중복 수락' : '미매칭'; },
  filter(list, f) {
    return list.filter(t => {
      if (f.area && t.area !== f.area) return false;
      if (f.me && !this.matched(t.id).includes(f.me)) return false; // 매칭(수락)된 교사만
      if (f.q) { const s = [t.id, t.topic, ...this.matched(t.id), ...t.members.map(m => m.id + m.name)].join(' '); if (!s.includes(f.q)) return false; }
      return true;
    });
  },
  stats(el) {
    const d = this.data, n = d.teams.length;
    const items = [['신청 팀', n + '팀'], ['참가 학생', d.teams.reduce((a, t) => a + t.members.length, 0) + '명'], ['교사 회신', d.replies.length + '명'],
      ['매칭 완료', d.teams.filter(t => this.status(t) === '매칭 완료').length + '팀']];
    d.stages.forEach(s => items.push([s.name, d.teams.filter(t => t.files[s.key]).length + ' / ' + n]));
    clear(el).append(...items.map(([k, v]) => h('div', { class: 'stat' }, h('span', { text: k }), h('b', { text: v }))));
  },
  table(el, list, opt) {
    const d = this.data;
    if (!list.length) { clear(el).append(h('p', { class: 'muted', text: '해당하는 팀이 없습니다.' })); return; }
    const head = ['분야', '학년', '팀원', '연구 주제', '희망 교사', '매칭', ...d.stages.map(s => s.name)];
    if (opt.admin) head.unshift('팀 코드');
    if (opt.admin) head.push('관리');
    const rows = list.map(t => {
      const m = this.matched(t.id);
      const cells = [
        h('td', { text: t.area }), h('td', { text: t.grade }),
        h('td', null, ...t.members.map((x, i) => [i ? h('br') : null, x.id + ' ' + x.name])),
        h('td', { title: t.question || '' , text: t.topic }),
        h('td', { text: t.t1 + (t.t2 ? ' / ' + t.t2 : '') }),
        h('td', { class: m.length === 1 ? 'good' : m.length > 1 ? 'warnc' : 'muted', text: m.length ? m.join(', ') : '미매칭' }),
        ...d.stages.map(s => {
          const f = t.files[s.key];
          if (!f) return h('td', { class: 'muted', text: '미제출' });
          const td = h('td', null, h('button', { type: 'button', class: 'mini', text: '내려받기', title: f.name, onclick: e => opt.download(f, e.currentTarget) }),
            h('div', { class: 'tiny', text: f.at.slice(5, 16) + (f.late ? ' 기한 후' : '') }));
          if (opt.admin) td.append(h('button', { type: 'button', class: 'mini danger', text: '파일 삭제', onclick: () => opt.delFile(t, s) }));
          return td;
        })
      ];
      if (opt.admin) cells.unshift(h('td', { class: 'code', text: t.code }));
      if (opt.admin) cells.push(h('td', null, h('button', { type: 'button', class: 'mini danger', text: '팀 삭제', onclick: () => opt.delTeam(t) })));
      return h('tr', null, ...cells);
    });
    clear(el).append(h('table', null, h('thead', null, h('tr', null, ...head.map(x => h('th', { text: x })))), h('tbody', null, ...rows)));
  },
  replies(el, opt) {
    const r = this.data.replies;
    if (!r.length) { clear(el).append(h('p', { class: 'muted', text: '아직 회신이 없습니다.' })); return; }
    const team = id => { const t = this.data.teams.find(x => x.id === id); return t ? id + ' ' + t.members[0].name : id + '(삭제된 팀)'; };
    const head = ['교사명', '교과', '분야', '수락 팀', '추가 배정', '심사', '회신일시'];
    if (opt && opt.admin) head.push('관리');
    clear(el).append(h('table', null, h('thead', null, h('tr', null, ...head.map(x => h('th', { text: x })))),
      h('tbody', null, ...r.map(x => h('tr', null, h('td', { text: x.name }), h('td', { text: x.subject }), h('td', { text: x.area }),
        h('td', { text: x.accepted.map(team).join(', ') || '없음' }), h('td', { text: x.extra }), h('td', { text: x.judge }), h('td', { text: x.at }),
        opt && opt.admin ? h('td', null, h('button', { type: 'button', class: 'mini danger', text: '회신 삭제', onclick: () => opt.delReply(x) })) : null)))));
  },
  classes(el) {
    const cs = (this.data.classes || []);
    if (!cs.length) { clear(el).append(h('p', { class: 'muted', text: '명단이 아직 등록되지 않았습니다(구글 시트 roster 탭).' })); return; }
    clear(el).append(h('table', null, h('thead', null, h('tr', null, ...['반', '신청/전체', '미신청 학생'].map(x => h('th', { text: x })))),
      h('tbody', null, ...cs.map(c => h('tr', null, h('td', { text: c.grade + '학년 ' + c.cls + '반' }), h('td', { text: `${c.applied}/${c.total}` }),
        h('td', { class: c.missing.length ? '' : 'good', text: c.missing.length ? c.missing.map(m => m.id + ' ' + m.name).join(', ') : '모두 신청' }))))));
  },
  async download(role, f, btn) {
    busy(btn, true, '받는 중…');
    try { const r = await api('download', { token: Session.get(role), fileId: f.fileId }); saveBlob(b64ToBlob(r.data, r.mime), r.name); }
    catch (err) { const m = $('dmsg'); if (m) msg(m, err.message, 'err'); else alert(err.message); }
    busy(btn, false);
  }
};
