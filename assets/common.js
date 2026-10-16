'use strict';
// 다른 사이트의 iframe 안에 넣어 속이는 것(클릭재킹) 방지
if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.textContent = ''; } }

const $ = id => document.getElementById(id);

// 요소 만들기 (innerHTML을 쓰지 않아 입력값이 HTML로 실행되지 않음)
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

// 서버 호출. text/plain으로 보내 불필요한 사전 요청 없이 Apps Script로 전달
async function api(action, payload) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(SEED_API_URL)) throw new Error('서버 주소가 아직 설정되지 않았습니다. 담당 선생님께 문의하세요.');
  let res;
  try {
    res = await fetch(SEED_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, payload || {})), redirect: 'follow', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
  } catch (e) { throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'); }
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
  if (!data.ok) { const err = new Error(data.error || '요청을 처리하지 못했습니다.'); if (/로그인/.test(err.message)) err.relogin = true; throw err; }
  return data;
}

// 로그인 토큰: 탭을 닫으면 사라지는 sessionStorage에만 보관
const Session = {
  get(role) { try { return sessionStorage.getItem('seed_tok_' + role) || ''; } catch (e) { return ''; } },
  set(role, t) { try { sessionStorage.setItem('seed_tok_' + role, t); } catch (e) { /* 무시 */ } },
  clear(role) { try { sessionStorage.removeItem('seed_tok_' + role); } catch (e) { /* 무시 */ } }
};

function msg(el, text, kind) { el.className = 'msg ' + (kind || ''); el.textContent = text || ''; }
function busy(btn, on, label) { if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || '처리 중…'; btn.disabled = true; } else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; } }

// 엑셀 내려받기 (관리자용)
function saveXlsx(wb, name) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
}
function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function b64ToBlob(b64, mime) {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || 'application/octet-stream' });
}
function fileToB64(file) {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => fail(new Error('파일을 읽지 못했습니다.'));
    r.readAsDataURL(file);
  });
}
function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
function membersText(t) { return t.members.map(m => m.id + ' ' + m.name).join(', '); }
const AREAS = ['물리', '화학', '생물', '지구 및 환경', '산업 및 에너지'];
function fmtDue(d) { const [, m, day] = String(d).split('-'); return `${+m}. ${+day}.`; }
