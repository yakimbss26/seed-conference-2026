# 보안 설계

## 데이터 흐름
- 페이지는 GitHub Pages(HTTPS)에서 제공되는 정적 파일뿐입니다.
- 입력값은 서버로 전송되지 않습니다. CSP의 `connect-src 'none'`, `form-action 'none'`으로 네트워크 전송 자체를 막아 두었습니다.
- 엑셀 파일은 브라우저에서 Blob으로 만들어 바로 내려받습니다.

## 브라우저 보안 정책 (모든 페이지)
- Content-Security-Policy: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`
  - 인라인 스크립트·인라인 스타일, 외부 CDN, eval을 쓰지 않습니다.
- `referrer: no-referrer`, `robots: noindex, nofollow, noarchive`, `robots.txt` 전체 차단
- 다른 사이트의 iframe 안에 삽입되면 최상위 창으로 빠져나옵니다(클릭재킹 방지).

## 외부 라이브러리
- SheetJS `xlsx` 0.18.5 (Apache-2.0) 를 저장소에 직접 포함했습니다(`assets/xlsx-0.18.5.mini.min.js`). npm 레지스트리 무결성 값과 일치함을 확인했습니다.
  - sha512 (npm tarball): `dmg3LCjBPHZnQp5/F/+nnTa+miPJxUXB6vtk42YjBBKayDNagxGEeIdWApkYPOf3Z3pm3k62Knjzp7lMeTEtFQ==`
- 이 버전의 **읽기 기능**에는 알려진 취약점(CVE-2023-30533 프로토타입 오염, CVE-2024-22363 ReDoS)이 있어, 사용하지 않습니다. 쓰기(엑셀 저장)에만 사용합니다.

## 취합 페이지의 파일 읽기 (`assets/xlsxread.js`)
- SEED 양식 전용으로 직접 만든 읽기 코드입니다.
- 제한: 파일 2MB, ZIP 항목 200개, 압축 해제 4MB(압축 폭탄 방지), 300행, 40열, 셀당 2,000자, 한 번에 파일 300개
- 허용된 열 이름만 받아들이고, 프로토타입이 없는 객체에 담습니다.
- 수식(`<f>`)은 실행하거나 옮기지 않습니다. 저장할 때 모든 값은 문자열/숫자로만 기록됩니다.
- 화면에 표시하는 모든 값은 HTML 이스케이프합니다.

## 운영 시 유의사항
- 저장소에 엑셀 제출 파일, 명단 등 개인정보를 커밋하지 마세요.
- GitHub 계정에 2단계 인증을 켜 두세요.
- 행사가 끝나면 저장소를 Archive 하거나 Pages를 끄는 것을 권장합니다.
