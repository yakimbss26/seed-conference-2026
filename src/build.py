import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
       "connect-src https://script.google.com https://script.googleusercontent.com; "
       "form-action 'none'; base-uri 'none'; object-src 'none'; manifest-src 'none'")
PAGES = {
  'index':   ('SEED Conference 제출 페이지', [], False),
  'student': ('SEED 팀 신청', ['student.js'], False),
  'submit':  ('SEED 산출물 제출', ['submit.js'], False),
  'board':   ('SEED 참가 현황판', ['board.js'], False),
  'teacher': ('SEED 지도교사', ['dash.js', 'teacher.js'], True),
  'admin':   ('SEED 담당자 관리', ['xlsx-0.18.5.mini.min.js', 'dash.js', 'admin.js'], True),
}
for name, (title, js, wide) in PAGES.items():
    body = (ROOT / 'src' / f'{name}.body.html').read_text()
    scripts = ''.join(f'<script src="assets/{x}" defer></script>\n' for x in ['config.js', 'common.js'] + js)
    nav = '' if name == 'index' else '<p class="muted"><a href="./">← SEED 제출 페이지 처음으로</a></p>\n'
    html = f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="assets/common.css">
{scripts}</head><body><div class="wrap{' wide' if wide else ''}">
{nav}{body}</div></body></html>
'''
    assert 'style=' not in html, name
    (ROOT / f'{name}.html').write_text(html)
    print('built', name)
