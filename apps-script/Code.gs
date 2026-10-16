/**
 * 2026학년도 제1회 SEED Conference 제출 시스템 - 서버(Google Apps Script)
 *
 * 설치: 구글 시트 > 확장 프로그램 > Apps Script 에 이 코드를 붙여넣고
 *       시트 메뉴 [SEED 관리]에서 초기 설정과 비밀번호 설정을 한 뒤 웹 앱으로 배포합니다.
 *       (자세한 방법은 저장소의 SETUP.md 참고)
 *
 * 보안 요약
 *  - 비밀번호는 원문을 저장하지 않고 솔트+SHA-256 해시만 스크립트 속성에 저장
 *  - 로그인 성공 시 6시간짜리 임의 토큰 발급, 로그인 10회 실패 시 10분 잠금
 *  - 학생 산출물 제출은 팀장 학번 + 팀 코드(신청 시 발급)로만 가능
 *  - 모든 입력은 서버에서 다시 검사(학번 4자리, 분야 목록, 글자 수, 파일 형식·크기·서명)
 *  - 시트에 쓰는 값은 모두 텍스트로 저장(수식 주입 방지)
 *  - 제출 파일은 공유하지 않는 드라이브 폴더에 저장하고, 로그인한 교사에게만 내려줌
 *  - 같은 학생·같은 단계 중복 제출 금지, 다시 내려면 관리자가 삭제해야 함
 */

const AREAS = ['물리', '화학', '생물', '지구 및 환경', '산업 및 에너지'];
const STAGES = {
  s1: { name: '선행연구 검토 보고서', short: '선행연구', due: '2026-10-27', ext: ['hwp', 'hwpx', 'pdf'] },
  s2: { name: '연구계획서', short: '연구계획서', due: '2026-11-02', ext: ['hwp', 'hwpx', 'pdf'] },
  s3: { name: '작품제작계획서', short: '작품제작계획서', due: '2026-11-02', ext: ['hwp', 'hwpx', 'pdf'] },
  s4: { name: '발표 자료', short: '발표', due: '2026-11-04', ext: ['pptx', 'ppt', 'pdf'] }
};
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const TOKEN_TTL = 6 * 60 * 60;      // 6시간
const LOCK_FAILS = 10, LOCK_SEC = 600;

const SHEETS = {
  teams: ['팀ID', '팀코드', '신청일시', '학년', '연구분야', '연구주제', '연구질문·동기',
          '팀장 학번', '팀장 이름', '팀원1 학번', '팀원1 이름', '팀원2 학번', '팀원2 이름', '인원',
          '희망 지도교사(1지망)', '희망 지도교사(2지망)', '비고'],
  files: ['팀ID', '단계', '단계명', '파일명', '원래 파일명', '크기(바이트)', '제출일시', '기한 후 제출', '파일ID'],
  replies: ['교사명', '담당교과', '지도분야', '수락 팀 수', '수락1 팀ID', '수락2 팀ID', '추가 배정 가능', '심사 참여', '비고', '회신일시'],
  log: ['일시', '구분', '내용'],
  roster: ['학번', '이름']   // 학년 명렬(현황판·신청 확인용). 시트에 직접 붙여넣기
};

/* ───────────── 시트 메뉴 (설치·비밀번호) ───────────── */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('SEED 관리')
    .addItem('1. 초기 설정(시트·드라이브 폴더 만들기)', 'setup')
    .addItem('2. 교사용 비밀번호 설정', 'setTeacherPassword')
    .addItem('3. 관리자 비밀번호 설정', 'setAdminPassword')
    .addItem('4. 명단 확인', 'checkRoster')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (key) {
    let sh = ss.getSheetByName(key);
    if (!sh) sh = ss.insertSheet(key);
    if (sh.getLastRow() === 0 || key !== 'roster') sh.getRange(1, 1, 1, SHEETS[key].length).setValues([SHEETS[key]]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@'); // 모두 텍스트
    sh.setFrozenRows(1);
  });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FOLDER_ID')) {
    const folder = DriveApp.createFolder('SEED Conference 제출 파일 (공유 금지)');
    props.setProperty('FOLDER_ID', folder.getId());
  }
  SpreadsheetApp.getUi().alert('초기 설정이 끝났습니다. 이어서 교사용·관리자 비밀번호를 설정하세요.');
}

function checkRoster() {
  const ros = roster_(), by = {};
  Object.keys(ros).forEach(function (id) { const k = id[0] + '학년 ' + Number(id[1]) + '반'; by[k] = (by[k] || 0) + 1; });
  const keys = Object.keys(by).sort();
  SpreadsheetApp.getUi().alert(keys.length ? '명단 ' + Object.keys(ros).length + '명\n' + keys.map(function (k) { return k + ': ' + by[k] + '명'; }).join('\n')
    : 'roster 시트에 명단이 없습니다. A열 학번, B열 이름으로 2행부터 붙여넣으세요.');
}

function setTeacherPassword() { askPassword_('TEACHER', '교사용'); }
function setAdminPassword() { askPassword_('ADMIN', '관리자'); }

function askPassword_(role, label) {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt(label + ' 비밀번호 설정', '10자 이상, 영문·숫자를 섞어 입력하세요. (교사용과 관리자 비밀번호는 서로 다르게)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const pw = r.getResponseText();
  if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) { ui.alert('10자 이상, 영문과 숫자를 섞어 주세요.'); return; }
  const salt = Utilities.getUuid();
  const props = PropertiesService.getScriptProperties();
  props.setProperty(role + '_SALT', salt);
  props.setProperty(role + '_HASH', hash_(salt + pw));
  props.setProperty(role + '_VER', String(Date.now())); // 비밀번호 바꾸면 기존 로그인 무효
  ui.alert(label + ' 비밀번호를 저장했습니다.');
}

/* ───────────── 웹 요청 처리 ───────────── */
function doGet() {
  return ContentService.createTextOutput('SEED Conference API').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  let res;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = ACTIONS[req.action];
    if (!fn || !Object.prototype.hasOwnProperty.call(ACTIONS, req.action)) throw userError_('알 수 없는 요청입니다.');
    res = fn(req);
    res.ok = true;
  } catch (err) {
    res = { ok: false, error: err && err.userMessage ? err.userMessage : '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
    if (!(err && err.userMessage)) log_('오류', String(err && err.stack || err).slice(0, 500));
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

const ACTIONS = {
  /* 공개 */
  stats: function () { return { stats: stats_() }; },
  apply: function (r) { return apply_(r); },
  teamStatus: function (r) { const t = teamAuth_(r); return { team: publicTeam_(t, true), stages: stageList_(t.id) }; },
  upload: function (r) { return upload_(r); },
  login: function (r) { return login_(r); },
  /* 교사 */
  teacherList: function (r) { auth_(r, ['TEACHER', 'ADMIN']); return listAll_(false); },
  reply: function (r) { auth_(r, ['TEACHER', 'ADMIN']); return reply_(r); },
  download: function (r) { auth_(r, ['TEACHER', 'ADMIN']); return download_(r); },
  /* 관리자 */
  adminList: function (r) { auth_(r, ['ADMIN']); return listAll_(true); },
  deleteTeam: function (r) { auth_(r, ['ADMIN']); return deleteTeam_(r); },
  deleteFile: function (r) { auth_(r, ['ADMIN']); return deleteFile_(r); },
  deleteReply: function (r) { auth_(r, ['ADMIN']); return deleteReply_(r); },
  logout: function (r) { CacheService.getScriptCache().remove('tok:' + String(r.token || '')); return {}; }
};

/* ───────────── 검사 도우미 ───────────── */
function userError_(msg) { const e = new Error(msg); e.userMessage = msg; return e; }
function str_(v, max, label, required) {
  const s = (v == null ? '' : String(v)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (required && !s) throw userError_(label + '을(를) 입력해 주세요.');
  if (s.length > max) throw userError_(label + '은(는) ' + max + '자 이내로 입력해 주세요.');
  return s;
}
function sid_(v, label) {
  const s = String(v == null ? '' : v).trim();
  if (!/^[1-3]\d{3}$/.test(s)) throw userError_(label + ' 학번은 4자리 숫자로 입력해 주세요. (예: 1101)');
  return s;
}
function name_(v, label) {
  const s = str_(v, 10, label + ' 이름', true);
  if (!/^[가-힣A-Za-z ]+$/.test(s)) throw userError_(label + ' 이름은 한글 또는 영문으로 입력해 주세요.');
  return s;
}
function now_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'); }
function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function safeEq_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// 시트에 넣을 값: 수식으로 해석되지 않도록 텍스트로
function cell_(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
function randomCode_() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random() + Date.now());
  let out = '';
  for (let i = 0; i < 6; i++) out += A[(bytes[i] & 0xff) % A.length];
  return out;
}
function tooMany_(key, limit, sec) {
  const c = CacheService.getScriptCache();
  const n = Number(c.get(key) || 0);
  if (n >= limit) return true;
  c.put(key, String(n + 1), sec);
  return false;
}

/* ───────────── 시트 읽기·쓰기 ───────────── */
function sheet_(key) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(key);
  if (!sh) throw userError_('아직 초기 설정이 되지 않았습니다. 담당 선생님께 문의하세요.');
  return sh;
}
function rows_(key) {
  const sh = sheet_(key), head = SHEETS[key];
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, head.length).getDisplayValues().map(function (r, i) {
    const o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  });
}
function append_(key, obj) {
  const sh = sheet_(key);
  const row = SHEETS[key].map(function (h) { return cell_(obj[h]); });
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
}
function deleteRows_(key, pred) {
  const sh = sheet_(key);
  const list = rows_(key).filter(pred).map(function (o) { return o._row; }).sort(function (a, b) { return b - a; });
  list.forEach(function (r) { sh.deleteRow(r); });
  return list.length;
}
function log_(kind, text) {
  try { append_('log', { '일시': now_(), '구분': kind, '내용': text }); } catch (e) { /* 무시 */ }
}
// 명렬: { 학번: 이름 } (학번 4자리만)
function roster_() {
  const out = {};
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('roster');
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    const id = String(r[0]).trim(), nm = String(r[1]).replace(/\s/g, '');
    if (/^[1-3]\d{3}$/.test(id) && nm) out[id] = nm;
  });
  return out;
}
// 명렬 기준 반별 현황. withNames=true면 미신청 학생 이름 포함(교사·관리자 전용)
function classStatus_(teams, files, withNames) {
  const ros = roster_();
  const inTeam = {}, teamOf = {};
  teams.forEach(function (t) { [t['팀장 학번'], t['팀원1 학번'], t['팀원2 학번']].forEach(function (s) { if (s) { inTeam[s] = 1; teamOf[s] = t['팀ID']; } }); });
  const done = {};  // 팀ID → {s1:1,...}
  files.forEach(function (f) { (done[f['팀ID']] = done[f['팀ID']] || {})[f['단계']] = 1; });
  const classes = {};
  Object.keys(ros).sort().forEach(function (id) {
    const key = id.slice(0, 2);
    const c = classes[key] || (classes[key] = { grade: id[0], cls: String(Number(id[1])), total: 0, applied: 0, stages: {}, missing: [] });
    Object.keys(STAGES).forEach(function (k) { c.stages[k] = c.stages[k] || 0; });
    c.total++;
    if (inTeam[id]) {
      c.applied++;
      const d = done[teamOf[id]] || {};
      Object.keys(STAGES).forEach(function (k) { if (d[k]) c.stages[k]++; });
    } else if (withNames) c.missing.push({ id: id, name: ros[id] });
  });
  return Object.keys(classes).sort().map(function (k) { const c = classes[k]; if (!withNames) delete c.missing; return c; });
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw userError_('제출이 몰려 있습니다. 잠시 후 다시 시도해 주세요.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ───────────── 인증 ───────────── */
function login_(r) {
  const role = r.role === 'admin' ? 'ADMIN' : r.role === 'teacher' ? 'TEACHER' : '';
  if (!role) throw userError_('잘못된 요청입니다.');
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty(role + '_SALT'), h = props.getProperty(role + '_HASH');
  if (!salt || !h) throw userError_('비밀번호가 아직 설정되지 않았습니다.');
  const failKey = 'fail:' + role;
  const c = CacheService.getScriptCache();
  if (Number(c.get(failKey) || 0) >= LOCK_FAILS) throw userError_('로그인 실패가 많아 10분 동안 잠겼습니다.');
  if (!safeEq_(hash_(salt + String(r.password || '')), h)) {
    c.put(failKey, String(Number(c.get(failKey) || 0) + 1), LOCK_SEC);
    log_('로그인 실패', role);
    throw userError_('비밀번호가 맞지 않습니다.');
  }
  const token = Utilities.getUuid() + Utilities.getUuid();
  c.put('tok:' + token, JSON.stringify({ role: role, ver: props.getProperty(role + '_VER') }), TOKEN_TTL);
  log_('로그인', role);
  return { token: token, role: role === 'ADMIN' ? 'admin' : 'teacher' };
}
function auth_(r, roles) {
  const t = String(r.token || '');
  if (!/^[0-9a-f-]{60,80}$/i.test(t)) throw userError_('다시 로그인해 주세요.');
  const raw = CacheService.getScriptCache().get('tok:' + t);
  if (!raw) throw userError_('로그인 시간이 지났습니다. 다시 로그인해 주세요.');
  const s = JSON.parse(raw);
  if (s.ver !== PropertiesService.getScriptProperties().getProperty(s.role + '_VER')) throw userError_('다시 로그인해 주세요.');
  if (roles.indexOf(s.role) < 0) throw userError_('권한이 없습니다.');
  return s.role;
}
function teamAuth_(r) {
  const id = sid_(r.leaderId, '팀장');
  const code = String(r.code || '').trim().toUpperCase();
  const failKey = 'cfail:' + id;
  const c = CacheService.getScriptCache();
  if (Number(c.get(failKey) || 0) >= LOCK_FAILS) throw userError_('입력 실패가 많아 10분 동안 잠겼습니다.');
  const t = rows_('teams').filter(function (x) { return x['팀ID'] === id; })[0];
  if (!t || !safeEq_(t['팀코드'], code)) {
    c.put(failKey, String(Number(c.get(failKey) || 0) + 1), LOCK_SEC);
    throw userError_('팀장 학번 또는 팀 코드가 맞지 않습니다.');
  }
  return teamObj_(t);
}

/* ───────────── 팀 신청 ───────────── */
function teamObj_(t) {
  const members = [[t['팀장 학번'], t['팀장 이름']], [t['팀원1 학번'], t['팀원1 이름']], [t['팀원2 학번'], t['팀원2 이름']]]
    .filter(function (m) { return m[0]; }).map(function (m) { return { id: m[0], name: m[1] }; });
  return { id: t['팀ID'], code: t['팀코드'], at: t['신청일시'], grade: t['학년'], area: t['연구분야'], topic: t['연구주제'],
           question: t['연구질문·동기'], members: members, t1: t['희망 지도교사(1지망)'], t2: t['희망 지도교사(2지망)'], memo: t['비고'] };
}
function publicTeam_(t, withQuestion) {
  const o = { id: t.id, at: t.at, grade: t.grade, area: t.area, topic: t.topic, members: t.members, t1: t.t1, t2: t.t2, memo: t.memo };
  if (withQuestion) o.question = t.question;
  return o;
}

function apply_(r) {
  if (tooMany_('apply-rate', 120, 60)) throw userError_('신청이 몰려 있습니다. 1분 뒤 다시 시도해 주세요.');
  const grade = String(r.grade || '');
  if (['1', '2', '3'].indexOf(grade) < 0) throw userError_('학년을 선택해 주세요.');
  const area = String(r.area || '');
  if (AREAS.indexOf(area) < 0) throw userError_('연구 분야를 선택해 주세요.');
  const topic = str_(r.topic, 100, '연구 주제', true);
  const question = str_(r.question, 500, '연구 질문', true);
  const t1 = str_(r.t1, 10, '희망 지도교사(1지망)', true);
  const t2 = str_(r.t2, 10, '희망 지도교사(2지망)', false);
  const memo = str_(r.memo, 200, '비고', false);
  const raw = Array.isArray(r.members) ? r.members.slice(0, 3) : [];
  const members = [];
  raw.forEach(function (m, i) {
    const label = i === 0 ? '팀장' : '팀원' + i;
    if (i === 2 && m && !m.id && !m.name) return;
    members.push({ id: sid_(m && m.id, label), name: name_(m && m.name, label) });
  });
  if (members.length < 2) throw userError_('팀은 2~3명으로 구성합니다.');
  const ids = members.map(function (m) { return m.id; });
  if (ids.some(function (s) { return s[0] !== grade; })) throw userError_('팀원은 모두 ' + grade + '학년이어야 합니다.');
  if (new Set(ids).size !== ids.length) throw userError_('같은 학번이 두 번 입력되었습니다.');
  if (t2 && t1 === t2) throw userError_('1지망과 2지망 선생님이 같습니다.');
  const ros = roster_();
  const hasGrade = Object.keys(ros).some(function (k) { return k[0] === grade; });
  if (hasGrade) members.forEach(function (m) {
    if (!ros[m.id]) throw userError_('학번 ' + m.id + '은(는) ' + grade + '학년 명단에 없습니다. 학번을 확인해 주세요.');
    if (ros[m.id] !== m.name.replace(/\s/g, '')) throw userError_('학번 ' + m.id + '의 이름이 명단과 다릅니다. 학번과 이름을 확인해 주세요.');
  });

  return withLock_(function () {
    const taken = {};
    rows_('teams').forEach(function (t) {
      [t['팀장 학번'], t['팀원1 학번'], t['팀원2 학번']].forEach(function (s) { if (s) taken[s] = t['팀ID']; });
    });
    const dup = ids.filter(function (s) { return taken[s]; });
    if (dup.length) throw userError_('이미 신청한 학생이 있습니다: ' + dup.join(', ') + '. 수정이 필요하면 담당 선생님께 삭제를 요청하세요.');
    const code = randomCode_();
    append_('teams', {
      '팀ID': ids[0], '팀코드': code, '신청일시': now_(), '학년': grade, '연구분야': area, '연구주제': topic, '연구질문·동기': question,
      '팀장 학번': ids[0], '팀장 이름': members[0].name, '팀원1 학번': ids[1] || '', '팀원1 이름': members[1] ? members[1].name : '',
      '팀원2 학번': ids[2] || '', '팀원2 이름': members[2] ? members[2].name : '', '인원': members.length,
      '희망 지도교사(1지망)': t1, '희망 지도교사(2지망)': t2, '비고': memo
    });
    log_('팀 신청', ids.join(','));
    return { teamId: ids[0], code: code, fileLabel: members.map(function (m) { return m.id + m.name; }).join('_') };
  });
}

/* ───────────── 산출물 제출 ───────────── */
function stageList_(teamId) {
  const files = rows_('files').filter(function (f) { return f['팀ID'] === teamId; });
  return Object.keys(STAGES).map(function (k) {
    const f = files.filter(function (x) { return x['단계'] === k; })[0];
    return { key: k, name: STAGES[k].name, due: STAGES[k].due, ext: STAGES[k].ext,
             submitted: !!f, fileName: f ? f['파일명'] : '', at: f ? f['제출일시'] : '', late: f ? f['기한 후 제출'] === 'Y' : false };
  });
}

function sniff_(bytes, ext) {
  const b = function (i) { return bytes[i] & 0xff; };
  const zip = b(0) === 0x50 && b(1) === 0x4b && b(2) === 0x03 && b(3) === 0x04;
  const ole = b(0) === 0xd0 && b(1) === 0xcf && b(2) === 0x11 && b(3) === 0xe0;
  const pdf = b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46;
  return { hwp: ole, ppt: ole, hwpx: zip, pptx: zip, pdf: pdf }[ext] === true;
}

function upload_(r) {
  if (tooMany_('upload-rate', 120, 60)) throw userError_('제출이 몰려 있습니다. 1분 뒤 다시 시도해 주세요.');
  const team = teamAuth_(r);
  const key = String(r.stage || '');
  if (!Object.prototype.hasOwnProperty.call(STAGES, key)) throw userError_('제출 단계를 선택해 주세요.');
  const st = STAGES[key];
  const orig = str_(r.fileName, 150, '파일 이름', true);
  const ext = (orig.split('.').pop() || '').toLowerCase();
  if (st.ext.indexOf(ext) < 0) throw userError_(st.name + '은(는) ' + st.ext.join(', ') + ' 파일만 낼 수 있습니다.');
  const data = String(r.data || '');
  if (data.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 8) throw userError_('파일은 15MB 이하만 낼 수 있습니다.');
  let bytes;
  try { bytes = Utilities.base64Decode(data); } catch (e) { throw userError_('파일을 읽지 못했습니다.'); }
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw userError_('파일은 15MB 이하만 낼 수 있습니다.');
  if (!sniff_(bytes, ext)) throw userError_('파일 내용이 확장자(' + ext + ')와 맞지 않습니다. 원본 파일을 그대로 내 주세요.');

  return withLock_(function () {
    const exists = rows_('files').some(function (f) { return f['팀ID'] === team.id && f['단계'] === key; });
    if (exists) throw userError_('이미 제출했습니다. 다시 내려면 담당 선생님께 삭제를 요청하세요.');
    const label = team.members.map(function (m) { return m.id + m.name; }).join('_');
    const fileName = 'SEED_' + st.short + '_' + label + '.' + ext;
    const mime = { hwp: 'application/x-hwp', hwpx: 'application/hwp+zip', pdf: 'application/pdf',
                   pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt: 'application/vnd.ms-powerpoint' }[ext];
    const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
    const file = folder.createFile(Utilities.newBlob(bytes, mime, fileName));
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    append_('files', { '팀ID': team.id, '단계': key, '단계명': st.name, '파일명': fileName, '원래 파일명': orig,
                       '크기(바이트)': bytes.length, '제출일시': now_(), '기한 후 제출': today > st.due ? 'Y' : '', '파일ID': file.getId() });
    log_('파일 제출', team.id + ' ' + key);
    return { fileName: fileName, stages: stageList_(team.id) };
  });
}

/* ───────────── 지도교사 회신 ───────────── */
function reply_(r) {
  const name = name_(r.name, '교사');
  const subject = str_(r.subject, 20, '담당 교과', true);
  const area = String(r.area || '');
  if (AREAS.indexOf(area) < 0) throw userError_('지도 분야를 선택해 주세요.');
  const acc = (Array.isArray(r.accepted) ? r.accepted : []).filter(function (x) { return x; }).map(function (x) { return sid_(x, '수락 팀 팀장'); });
  if (acc.length > 2) throw userError_('교사 1명은 최대 2팀까지 수락할 수 있습니다.');
  if (new Set(acc).size !== acc.length) throw userError_('같은 팀을 두 번 선택했습니다.');
  const extra = r.extra === '가능' ? '가능' : r.extra === '불가' ? '불가' : '';
  const judge = r.judge === '가능' ? '가능' : r.judge === '불가' ? '불가' : '';
  if (!extra || !judge) throw userError_('추가 배정과 심사 참여 여부를 선택해 주세요.');
  const memo = str_(r.memo, 200, '비고', false);
  return withLock_(function () {
    const teams = rows_('teams').map(function (t) { return t['팀ID']; });
    acc.forEach(function (id) { if (teams.indexOf(id) < 0) throw userError_('팀장 학번 ' + id + ' 팀은 신청 목록에 없습니다.'); });
    if (rows_('replies').some(function (x) { return x['교사명'] === name; }))
      throw userError_('이미 회신하셨습니다. 수정이 필요하면 담당 선생님께 삭제를 요청해 주세요.');
    append_('replies', { '교사명': name, '담당교과': subject, '지도분야': area, '수락 팀 수': acc.length, '수락1 팀ID': acc[0] || '',
                         '수락2 팀ID': acc[1] || '', '추가 배정 가능': extra, '심사 참여': judge, '비고': memo, '회신일시': now_() });
    log_('교사 회신', name);
    return {};
  });
}

/* ───────────── 목록·현황 ───────────── */
function listAll_(admin) {
  const teams = rows_('teams').map(teamObj_);
  const files = rows_('files');
  const replies = rows_('replies').map(function (x) {
    return { name: x['교사명'], subject: x['담당교과'], area: x['지도분야'], accepted: [x['수락1 팀ID'], x['수락2 팀ID']].filter(String),
             extra: x['추가 배정 가능'], judge: x['심사 참여'], memo: x['비고'], at: x['회신일시'] };
  });
  return {
    stages: Object.keys(STAGES).map(function (k) { return { key: k, name: STAGES[k].name, due: STAGES[k].due }; }),
    areas: AREAS,
    teams: teams.map(function (t) {
      const o = publicTeam_(t, true);
      if (admin) o.code = t.code;
      o.files = {};
      files.filter(function (f) { return f['팀ID'] === t.id; }).forEach(function (f) {
        o.files[f['단계']] = { name: f['파일명'], at: f['제출일시'], late: f['기한 후 제출'] === 'Y', size: Number(f['크기(바이트)']) || 0, fileId: f['파일ID'] };
      });
      return o;
    }),
    replies: replies,
    classes: classStatus_(rows_('teams'), files, true)
  };
}

function stats_() {
  const teams = rows_('teams'), files = rows_('files'), replies = rows_('replies');
  const byArea = {}, byGrade = { '1': 0, '2': 0, '3': 0 };
  AREAS.forEach(function (a) { byArea[a] = 0; });
  let students = 0;
  const byGradeStudents = { '1': 0, '2': 0, '3': 0 };
  teams.forEach(function (t) { byArea[t['연구분야']] = (byArea[t['연구분야']] || 0) + 1; byGrade[t['학년']] = (byGrade[t['학년']] || 0) + 1; students += Number(t['인원']) || 0; byGradeStudents[t['학년']] = (byGradeStudents[t['학년']] || 0) + (Number(t['인원']) || 0); });
  const ids = {}; teams.forEach(function (t) { ids[t['팀ID']] = 1; });
  const byStage = {};
  Object.keys(STAGES).forEach(function (k) { byStage[k] = { name: STAGES[k].name, due: STAGES[k].due, count: 0 }; });
  files.forEach(function (f) { if (byStage[f['단계']] && ids[f['팀ID']]) byStage[f['단계']].count++; });
  const matched = {};
  replies.forEach(function (x) { [x['수락1 팀ID'], x['수락2 팀ID']].forEach(function (s) { if (s && ids[s]) matched[s] = 1; }); });
  return { classes: classStatus_(teams, files, false), teams: teams.length, students: students, byGradeStudents: byGradeStudents, byArea: byArea, byGrade: byGrade, byStage: byStage,
           replies: replies.length, matched: Object.keys(matched).length, updated: now_() };
}

/* ───────────── 파일 내려받기 ───────────── */
function download_(r) {
  const id = String(r.fileId || '');
  const f = rows_('files').filter(function (x) { return x['파일ID'] === id; })[0];
  if (!f) throw userError_('파일을 찾을 수 없습니다.');
  const blob = DriveApp.getFileById(id).getBlob();
  return { name: f['파일명'], mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

/* ───────────── 관리자 삭제 ───────────── */
function deleteTeam_(r) {
  const id = sid_(r.teamId, '팀장');
  return withLock_(function () {
    rows_('files').filter(function (f) { return f['팀ID'] === id; }).forEach(function (f) {
      try { DriveApp.getFileById(f['파일ID']).setTrashed(true); } catch (e) { /* 이미 없음 */ }
    });
    const nf = deleteRows_('files', function (f) { return f['팀ID'] === id; });
    const nt = deleteRows_('teams', function (t) { return t['팀ID'] === id; });
    if (!nt) throw userError_('해당 팀이 없습니다.');
    log_('팀 삭제', id + ' (파일 ' + nf + '개)');
    return {};
  });
}
function deleteFile_(r) {
  const id = sid_(r.teamId, '팀장');
  const key = String(r.stage || '');
  if (!Object.prototype.hasOwnProperty.call(STAGES, key)) throw userError_('단계가 올바르지 않습니다.');
  return withLock_(function () {
    rows_('files').filter(function (f) { return f['팀ID'] === id && f['단계'] === key; }).forEach(function (f) {
      try { DriveApp.getFileById(f['파일ID']).setTrashed(true); } catch (e) { /* 이미 없음 */ }
    });
    const n = deleteRows_('files', function (f) { return f['팀ID'] === id && f['단계'] === key; });
    if (!n) throw userError_('삭제할 파일이 없습니다.');
    log_('파일 삭제', id + ' ' + key);
    return {};
  });
}
function deleteReply_(r) {
  const name = name_(r.name, '교사');
  return withLock_(function () {
    const n = deleteRows_('replies', function (x) { return x['교사명'] === name; });
    if (!n) throw userError_('해당 회신이 없습니다.');
    log_('회신 삭제', name);
    return {};
  });
}
