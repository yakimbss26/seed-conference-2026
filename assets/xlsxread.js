'use strict';
// SEED 양식 엑셀(.xlsx)만 읽는 작은 전용 리더.
// 외부 라이브러리의 읽기 기능(알려진 취약점이 있었던 부분)을 쓰지 않고,
// 크기·개수 제한을 두어 조작된 파일(압축 폭탄 등)에도 안전하게 동작하도록 만들었다.
const SEEDREAD = (() => {
  const LIMIT = { fileBytes: 2 * 1024 * 1024, entries: 200, xmlBytes: 4 * 1024 * 1024, rows: 300, cols: 40, cell: 2000 };
  const ALLOWED = new Set(['양식','제출일시','학년','연구분야','연구주제(가제)','연구질문·동기','팀장 학번','팀장 이름','팀원1 학번','팀원1 이름','팀원2 학번','팀원2 이름','인원','희망 지도교사(1지망)','희망 지도교사(2지망)','비고',
    '교사명','담당교과','지도분야','수락 팀 수','수락1 팀장 학번','수락1 팀장 이름','수락1 연구주제','수락2 팀장 학번','수락2 팀장 이름','수락2 연구주제','추가 배정 가능','심사 참여']);
  const td = new TextDecoder('utf-8');

  function entries(buf) {
    const dv = new DataView(buf), n = buf.byteLength;
    let eocd = -1;
    for (let i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('zip 아님');
    const count = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    if (count > LIMIT.entries) throw new Error('항목 과다');
    const out = new Map(); let p = cdOff;
    for (let k = 0; k < count; k++) {
      if (p + 46 > n || dv.getUint32(p, true) !== 0x02014b50) throw new Error('목록 손상');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = td.decode(new Uint8Array(buf, p + 46, nl));
      out.set(name, { method, csize, usize, lho });
      p += 46 + nl + el + cl;
    }
    return out;
  }

  async function readEntry(buf, e) {
    if (!e) return null;
    const dv = new DataView(buf);
    if (e.lho + 30 > buf.byteLength || dv.getUint32(e.lho, true) !== 0x04034b50) throw new Error('항목 손상');
    const start = e.lho + 30 + dv.getUint16(e.lho + 26, true) + dv.getUint16(e.lho + 28, true);
    if (start + e.csize > buf.byteLength) throw new Error('항목 손상');
    const data = new Uint8Array(buf, start, e.csize);
    if (e.method === 0) { if (e.csize > LIMIT.xmlBytes) throw new Error('너무 큼'); return td.decode(data); }
    if (e.method !== 8) throw new Error('지원하지 않는 압축');
    if (typeof DecompressionStream === 'undefined') throw new Error('브라우저가 오래됨(크롬·엣지 최신 버전 사용)');
    const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const parts = []; let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > LIMIT.xmlBytes) { reader.cancel(); throw new Error('압축 해제 크기 초과'); }
      parts.push(value);
    }
    const all = new Uint8Array(total); let o = 0; for (const x of parts) { all.set(x, o); o += x.length; }
    return td.decode(all);
  }

  function xml(text) {
    const d = new DOMParser().parseFromString(text, 'application/xml');
    if (d.getElementsByTagName('parsererror').length) throw new Error('XML 오류');
    return d;
  }
  const kids = (el, tag) => Array.from(el.children).filter(c => c.localName === tag);
  const textOf = el => Array.from(el.getElementsByTagNameNS('*', 't')).map(t => t.textContent).join('');
  function colIndex(ref) { const m = /^([A-Z]{1,3})/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }

  // 반환: 허용된 열 이름만 담은 행 객체 배열 (프로토타입 없는 객체)
  async function read(file) {
    if (file.size > LIMIT.fileBytes) throw new Error('파일이 너무 큼');
    const buf = await file.arrayBuffer();
    const ents = entries(buf);
    const sheetName = [...ents.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0];
    if (!sheetName) throw new Error('시트 없음');
    let shared = [];
    const sst = await readEntry(buf, ents.get('xl/sharedStrings.xml'));
    if (sst) shared = kids(xml(sst).documentElement, 'si').map(textOf);
    const doc = xml(await readEntry(buf, ents.get(sheetName)));
    const rows = Array.from(doc.getElementsByTagNameNS('*', 'row')).slice(0, LIMIT.rows + 1);
    const grid = rows.map(r => {
      const line = [];
      for (const c of kids(r, 'c')) {
        const i = colIndex(c.getAttribute('r')); if (i < 0 || i >= LIMIT.cols) continue;
        const t = c.getAttribute('t'), v = kids(c, 'v')[0];
        let val = '';
        if (t === 's') val = shared[parseInt(v ? v.textContent : '-1', 10)] ?? '';
        else if (t === 'inlineStr') { const is = kids(c, 'is')[0]; val = is ? textOf(is) : ''; }
        else val = v ? v.textContent : '';
        line[i] = String(val).slice(0, LIMIT.cell);
      }
      return line;
    });
    if (!grid.length) return [];
    const header = grid[0].map(h => (h || '').trim());
    return grid.slice(1).map(line => {
      const o = Object.create(null);
      header.forEach((h, i) => { if (ALLOWED.has(h)) o[h] = (line[i] ?? '').trim(); });
      return o;
    });
  }
  return { read, LIMIT };
})();
