'use strict';
// 다른 사이트의 iframe 안에 넣어 속이는 것(클릭재킹) 방지
if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.textContent = ''; } }
// 엑셀 파일을 서버로 보내지 않고 브라우저에서 바로 내려받기
function saveXlsx(wb, name) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if (window.navigator && navigator.msSaveOrOpenBlob) { navigator.msSaveOrOpenBlob(blob, name); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
// 파일 이름에 쓸 수 없는 문자 제거
function safeName(s) { return String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 40) || '이름없음'; }
