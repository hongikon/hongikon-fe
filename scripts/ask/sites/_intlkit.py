"""국제·유학생 사이트(oia·kle·intlwww)가 같이 쓰는 본문 다듬기. 사이트 파일이 아니다(이름이 _ 로 시작).

- 원문 HTML 을 조금 고친 뒤 extract.P 로 다시 읽는다:
  · 탭 이름 줄(nav-tabs)·아이콘 글자 제거
  · 접는 FAQ(card-header 버튼 + card-body)를 '질문 제목 → 답' 덩어리로
  · 왼쪽 칸이 항목 이름(th scope=row)이고 오른쪽 칸에 목록이 든 표를 '윗제목 · 항목 이름' 덩어리로
"""
import html as _html
import os
import re
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

ICON = re.compile(r'(open_in_new|keyboard_arrow_down|keyboard_arrow_left|keyboard_arrow_right|navigate_before|navigate_next|access_time|visibility|arrow_forward)\s*')
JUNK = ('-', '·', '＊', 'clear', '×', '*')


def text(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', _html.unescape(s)).strip()


def _strip_tabs(raw):
    # <ul class="nav nav-tabs …"> … </ul> (탭 이름) 제거. 중첩 ul 은 없다.
    return re.sub(r'<ul[^>]*class="[^"]*nav-tabs[^"]*"[^>]*>.*?</ul>', '', raw, flags=re.S)


def _faq(raw):
    def card(m):
        q = text(ICON.sub('', m.group(1)))
        return f'<h4>{_html.escape(q)}</h4><div>{m.group(2)}</div>'
    return re.sub(r'<div class="card-header"[^>]*>\s*<button[^>]*>(.*?)</button>\s*</div>\s*'
                  r'<div[^>]*class="collapse[^"]*"[^>]*>\s*<div class="card-body">(.*?)</div>\s*</div>',
                  card, raw, flags=re.S)


def _row_tables(raw):
    """th(scope=row) + td(목록) 표 → <h4>윗제목 · 항목</h4><div>내용</div>."""
    out, pos = [], 0
    head_re = re.compile(r'<(h3|h4)[^>]*>(.*?)</\1>', re.S)
    tables = list(re.finditer(r'<table\b.*?</table>', raw, re.S))
    # 표마다 바로 위 h3·h4 제목. 같은 h4 이름(예: '학점인정 안내')이 여러 표에 붙으면 h3 을 윗제목으로 쓴다.
    ctx, h3, h4, p = [], '', '', 0
    for m in tables:
        for tag, body in head_re.findall(raw[p:m.start()]):
            if tag == 'h3':
                h3, h4 = text(body), ''
            else:
                h4 = text(body)
        ctx.append((h3, h4))
        p = m.end()
    h4count = {}
    for _, b in ctx:
        h4count[b] = h4count.get(b, 0) + 1
    for m, (a, b) in zip(tables, ctx):
        parent = (a if (b and a and (h4count[b] > 1 or b.startswith(a + ' · '))) else (b or a))
        chunk = raw[pos:m.start()]
        out.append(chunk)
        tab = m.group(0)
        rows = re.findall(r'<tr\b[^>]*>(.*?)</tr>', tab, re.S)
        blocky = re.search(r'<td\b[^>]*>\s*(?:(?!</td>).)*?<(ul|ol|p|div)\b', tab, re.S)
        pairs = []
        for r in rows:
            cells = re.findall(r'<(th|td)\b([^>]*)>(.*?)</\1>', r, re.S)
            if len(cells) >= 2 and cells[0][0] == 'th' and 'row' in cells[0][1] and all(c[0] == 'td' for c in cells[1:]):
                pairs.append((text(cells[0][2]), ' '.join(c[2] for c in cells[1:])))
            else:
                pairs = None
                break
        if blocky and pairs:
            parts = []
            for label, body in pairs:
                title = f'{parent} · {label}' if parent and parent != label else label
                if not re.search(r'<(ul|ol|p|div)\b', body):
                    body = f'<p>{body}</p>'
                parts.append(f'<h4>{_html.escape(title)}</h4><div>{body}</div>')
            out.append(''.join(parts))
        else:
            out.append(tab)
        pos = m.end()
    out.append(raw[pos:])
    return ''.join(out)


def reparse(raw, content, extra=None):
    """원문 HTML → {'title', 'sections'} (extract.extract 와 같은 모양)."""
    import extract as X
    raw = re.sub(r'<!--.*?-->', '', raw, flags=re.S)
    if extra:
        raw = extra(raw)
    raw = _strip_tabs(raw)
    # 링크 글자('… 바로가기', '… 참조하기')는 답에서 누를 수 없으니 뺀다.
    raw = re.sub(r'<a\b[^>]*>(?:(?!</a>).)*?(?:바로가기|참조하기)(?:(?!</a>).)*?</a>', '', raw, flags=re.S)
    raw = _faq(raw)
    raw = _row_tables(raw)
    raw = _expand_spans(raw)
    p = X.P(content)
    p.feed(raw)
    p.end_text()
    t = re.search(r'<title>(.*?)</title>', raw, re.S)
    secs = []
    for s in p.sections:
        title = clean(s['title'])
        items = []
        for i in s['items']:
            ind = re.match(r'\s*', i).group(0)
            c = clean(i)
            c = re.sub(r'^(0\d)(?=[^\s\d.])', r'\1 ', c)
            if c and c not in JUNK:
                items.append(ind + c)
        tab = s.get('table')
        if tab:
            tab = [[clean(c) for c in r] for r in tab]
            w = max(len(r) for r in tab)
            tab = [r + [''] * (w - len(r)) for r in tab]
        if not items and not tab and not title:
            continue
        sec = {'title': title, 'items': items, 'ordered': s['ordered']}
        if tab:
            sec['table'] = tab
        secs.append(sec)
    return {'title': clean(_html.unescape(t.group(1))) if t else '', 'sections': secs}


def clean(s):
    s = re.sub(r'\s+', ' ', ICON.sub('', s)).strip()
    s = re.sub(r'\*\s*[^*]{0,30}기본 내용( 참조하기)?\s*', '', s)
    return s.strip()


def drop(sections, bad_title=(), bad_item=(), stop_title=()):
    """덩어리 거르기: 제목에 stop_title 이 나오면 거기서 끝, bad_* 낱말이 든 제목·줄은 뺀다."""
    out = []
    for s in sections:
        if any(w in s['title'] for w in stop_title):
            break
        if any(w in s['title'] for w in bad_title):
            continue
        s = dict(s, items=[i for i in s['items'] if not any(w in i for w in bad_item)])
        if s['items'] or s.get('table') or s['title']:
            out.append(s)
    # 내용 없이 제목만 남은 덩어리는 다음 덩어리 제목 앞에 붙이지 않고 그냥 둔다(소제목 역할).
    return out


def fold_parents(sections):
    """내용 없는 윗제목 덩어리 바로 뒤에 '윗제목 · …' 덩어리가 오면 윗제목 덩어리를 뺀다(겹쳐 보이지 않게)."""
    out = []
    for i, s in enumerate(sections):
        nxt = sections[i + 1] if i + 1 < len(sections) else None
        if (not s['items'] and not s.get('table') and nxt and nxt['title'].startswith(s['title'] + ' · ')):
            continue
        out.append(s)
    return out


def _expand_spans(raw):
    """rowspan·colspan 이 있는 표를 칸을 채운 평범한 표로 바꾼다(머리줄이 두 줄이면 위아래 글자를 이어 붙인다)."""
    def one(m):
        tab = m.group(0)
        if not re.search(r'(rowspan|colspan)=[\"\']?[2-9]', tab):
            return tab
        thead = re.search(r'<thead\b.*?</thead>', tab, re.S)
        nhead = len(re.findall(r'<tr\b', thead.group(0))) if thead else 0
        grid, pending = [], {}
        for r_i, r in enumerate(re.findall(r'<tr\b[^>]*>(.*?)</tr>', tab, re.S)):
            row, col = [], 0
            cells = re.findall(r'<(th|td)\b([^>]*)>(.*?)</\1>', r, re.S)
            ci = 0
            while ci < len(cells) or col in pending:
                if col in pending:
                    val, left = pending[col]
                    row.append(val)
                    if left <= 1:
                        del pending[col]
                    else:
                        pending[col] = (val, left - 1)
                    col += 1
                    continue
                tag, attrs, body = cells[ci]
                ci += 1
                rs = int((re.search(r'rowspan=[\"\']?(\d+)', attrs) or [0, 1])[1])
                cs = int((re.search(r'colspan=[\"\']?(\d+)', attrs) or [0, 1])[1])
                val = text(body)
                for k in range(cs):
                    row.append(val)
                    if rs > 1:
                        pending[col] = (val, rs - 1)
                    col += 1
            grid.append(row)
        if not grid:
            return tab
        w = max(len(r) for r in grid)
        grid = [r + [''] * (w - len(r)) for r in grid]
        if nhead > 1:
            head = []
            for c in range(w):
                parts = []
                for r in grid[:nhead]:
                    if r[c] and r[c] not in parts:
                        parts.append(r[c])
                head.append(' '.join(parts))
            grid = [head] + grid[nhead:]
        esc = _html.escape
        rows = ['<tr>' + ''.join(f'<{"th" if i == 0 and nhead else "td"}>{esc(c)}</{"th" if i == 0 and nhead else "td"}>' for c in r) + '</tr>'
                for i, r in enumerate(grid)]
        return '<table>' + ''.join(rows) + '</table>'
    return re.sub(r'<table\b.*?</table>', one, raw, flags=re.S)


def dedupe_titles(sections):
    """내용 없는 덩어리 바로 뒤에 (따옴표만 다른) 같은 제목 덩어리가 오면 앞의 것을 뺀다."""
    norm = lambda s: re.sub(r"[\s'‘’\"“”]", '', s)
    out = []
    for i, s in enumerate(sections):
        nxt = sections[i + 1] if i + 1 < len(sections) else None
        if not s['items'] and not s.get('table') and nxt and norm(nxt['title']) == norm(s['title']):
            continue
        out.append(s)
    return out


def prefix_headings(raw, generic=(), under_title_ment=False):
    """h4 제목 앞에 윗제목을 붙인다(같은 이름의 h4 가 프로그램마다 되풀이될 때 구분하려고).
    - <div class="title-ment">X</div>(프로그램 이름)는 <h3>X</h3> 로 바꾼다.
    - under_title_ment: title-ment 아래 h4 는 모두 'X · h4'.
    - generic: 이 이름의 h4 는 바로 위 h3 을 붙여 'h3 · h4'.
    """
    out, pos, h3, tm = [], 0, '', ''
    pat = re.compile(r'<div class="title-ment[^"]*"[^>]*>(.*?)</div>|<h3\b[^>]*>(.*?)</h3>|<h4\b([^>]*)>(.*?)</h4>', re.S)
    for m in pat.finditer(raw):
        out.append(raw[pos:m.start()])
        if m.group(1) is not None:
            tm = text(m.group(1))
            out.append(f'<h3>{_html.escape(tm)}</h3>')
            h3 = tm
        elif m.group(2) is not None:
            h3 = text(m.group(2))
            out.append(m.group(0))
        else:
            t = text(m.group(4))
            if under_title_ment and tm and not t.startswith(tm):
                t = f'{tm} · {t}'
            elif t in generic and h3:
                t = f'{h3} · {t}'
            out.append(f'<h4{m.group(3)}>{_html.escape(t)}</h4>')
        pos = m.end()
    out.append(raw[pos:])
    return ''.join(out)
