"""생활·복지 부속 사이트(sites/dorm.py 등)가 함께 쓰는 도우미. 사이트 파일이 아니다(PAGES 없음).

학교 CMS 부속 사이트는 모두 같은 틀이다.
  - 메뉴 페이지: 본문 id="cms-content", <title> 은 '사이트 | 메뉴 | 상위메뉴'
  - 게시글(mode=view): 본문 class="fr-view", 제목 span.b-title
  - FAQ 게시판 목록: 질문 a.b-title + 답 div.fr-view 가 펼쳐져 있다
"""
import html, re

BLOCK_END = re.compile(r'<(?:br|/p|/div|/li|/h[1-6]|/tr|/dd|/dt)\b[^>]*>', re.I)


def text_lines(fragment):
    """HTML 조각 → 줄 목록(블록 끝·<br> 마다 끊는다)."""
    s = re.sub(r'(?is)<(script|style)\b.*?</\1>', '', fragment)
    s = re.sub(r'(?i)</t[dh]>', ' ', s)
    s = BLOCK_END.sub('\n', s)
    s = html.unescape(re.sub(r'<[^>]+>', '', s)).replace('\xa0', ' ')
    out = []
    for line in s.split('\n'):
        line = re.sub(r'\s+', ' ', line).strip()
        if line and line not in ('-', '·'):
            out.append(line)
    return out


def is_heading(line):
    """'[기숙사 입사 전 취소]', '유의사항', '1. 이용 안내' 같은 짧은 제목 줄."""
    if re.fullmatch(r'\[[^\]]{2,30}\]', line) or re.fullmatch(r'<[^>]{2,30}>', line):
        return True
    if re.fullmatch(r'\d\.\s?[^.,:()]{2,18}', line):
        return True
    return len(line) <= 12 and not re.search(r'[.:,()?~0-9]', line) and re.search(r'(사항|안내|방법|절차|대상|기간|수칙|시간)$', line) is not None


def sections_from_lines(lines, first_title=''):
    secs = [{'title': first_title, 'items': [], 'ordered': False}]
    for line in lines:
        if is_heading(line):
            title = line.strip('[]<> ')
            if secs[-1]['items'] or secs[-1]['title']:
                secs.append({'title': title, 'items': [], 'ordered': False})
            else:
                secs[-1]['title'] = title
        else:
            secs[-1]['items'].append(line)
    return [s for s in secs if s['items']]


def article(raw):
    """게시글(mode=view) → (제목, sections)."""
    m = re.search(r'<span class="b-title">(.*?)</span>', raw, re.S)
    title = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', m.group(1)))).strip() if m else ''
    i = raw.find('<div class="fr-view">')
    if i < 0:
        return title, []
    ends = [k for k in (raw.find('<div class="b-file', i), raw.find('<div class="b-pager-box"', i)) if k > 0]
    body = raw[i:min(ends) if ends else i + 60000]
    return title, sections_from_lines(text_lines(body))


def faq_list(raw):
    """FAQ 게시판 목록 → [(질문, sections)]."""
    out = []
    pat = r'<a class="b-title"[^>]*>(.*?)</a>.*?<div class="fr-view">(.*?)</div>\s*(?:</div>\s*)*</td>'
    for m in re.finditer(pat, raw, re.S):
        q = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', m.group(1)))).strip()
        out.append((q, sections_from_lines(text_lines(m.group(2)))))
    return out


def menu_title(raw):
    """'기숙사(서울) | 입사 안내 | 입사/퇴사안내' → '입사 안내'."""
    m = re.search(r'<title>(.*?)</title>', raw, re.S)
    parts = [p.strip() for p in html.unescape(m.group(1)).split('|')] if m else []
    if len(parts) > 1:
        return parts[1].replace(' 게시판목록', '')
    return parts[0] if parts else ''


def _cells(tr):
    return re.findall(r'(?is)<t([dh])\b([^>]*)>(.*?)</t\1>', tr)


def expand_spans(raw):
    """표의 rowspan·colspan 칸을 풀어 아래 줄·옆 칸에 같은 내용을 채운다(칸이 왼쪽으로 밀리지 않게)."""
    def fix_table(m):
        table = m.group(0)
        rows = re.findall(r'(?is)<tr\b[^>]*>.*?</tr>', table)
        pending = {}  # 열 번호 → [남은 줄 수, 칸 HTML]
        out_rows = []
        for tr in rows:
            cells, col, new = _cells(tr), 0, []
            queue = list(cells)
            while queue or any(c >= col for c in pending):
                if col in pending:
                    left, html_cell = pending[col]
                    new.append(html_cell)
                    pending[col][0] -= 1
                    if pending[col][0] <= 0:
                        del pending[col]
                    col += 1
                    continue
                if not queue:
                    break
                tag, attrs, body = queue.pop(0)
                span_c = int((re.search(r'colspan="?(\d+)', attrs) or [0, 1])[1])
                span_r = int((re.search(r'rowspan="?(\d+)', attrs) or [0, 1])[1])
                cell = f'<t{tag}>{body}</t{tag}>'
                for k in range(span_c):
                    new.append(cell if k == 0 or span_r > 1 else f'<t{tag}></t{tag}>')
                    if span_r > 1:
                        pending[col + k] = [span_r - 1, cell]
                col += span_c
            out_rows.append('<tr>' + ''.join(new) + '</tr>')
        return '<table>' + ''.join(out_rows) + '</table>'
    return re.sub(r'(?is)<table\b[^>]*>.*?</table>', fix_table, raw)


def reextract(raw, content=None, h1=True, spans=False):
    """extract.py 의 본문 파서로 다시 뽑는다. h1 → h2(제목으로), spans → 표 칸 풀기."""
    import extract  # scripts/ask/extract.py (sys.path 에 ROOT 가 있다)
    if h1:
        raw = re.sub(r'(?i)<(/?)h1\b', r'<\1h2', raw)
    if spans:
        raw = expand_spans(raw)
    class Parser(extract.P):
        # 표 뒤에 오는 글은 표와 같은 덩어리에 붙이지 않고 새 덩어리로(표 아래 연락처 줄이 표 앞에 보이지 않게).
        def handle_endtag(self, tag):
            had = self.inside and tag == 'table' and self.table is not None and bool(self.table)
            super().handle_endtag(tag)
            if had and self.cur is not None and self.cur.get('table'):
                self.cur = {'title': '', 'items': [], 'ordered': False}
                self.sections.append(self.cur)

    p = Parser(content)
    p.feed(raw)
    p.end_text()
    secs = []
    for s in p.sections:
        items = [i for i in s['items'] if i.strip() and i.strip() not in ('-', '·')]
        tab = s.get('table')
        if tab:
            w = max(len(r) for r in tab)
            tab = [r + [''] * (w - len(r)) for r in tab]
        if not items and not tab and not s['title']:
            continue
        secs.append({'title': s['title'], 'items': items, 'ordered': s['ordered'], **({'table': tab} if tab else {})})
    return secs


def drop_empty_titles(secs):
    """항목·표 없이 제목만 있는 덩어리(다음 덩어리의 큰 제목)는 다음 덩어리 제목 앞에 붙인다."""
    out, carry = [], ''
    for s in secs:
        if not s['items'] and not s.get('table'):
            carry = s['title']
            continue
        if carry:
            s = {**s, 'title': f"{carry} · {s['title']}" if s['title'] else carry}
            carry = ''
        elif not s['title'] and out and out[-1]['title']:
            s = {**s, 'title': out[-1]['title']}  # 표 뒤에 이어지는 글은 앞 덩어리 제목을 잇는다
        out.append(s)
    return out


def clean_title(title):
    """'[공지]장기외박신청서' → '장기외박신청서', '[정신건강 … 안내]' → '정신건강 … 안내'."""
    t = title.strip()
    if re.fullmatch(r'\[[^\]]+\]', t):
        return t[1:-1].strip()
    return re.sub(r'^\[[^\]]*\]\s*', '', t) or t


def faq_as_sections(raw):
    """FAQ 게시판 목록 → 질문마다 덩어리 하나(제목=질문, 항목=답)."""
    out = []
    for q, secs in faq_list(raw):
        items = [re.sub(r'^A\d*\.\s*', '', i) for s in secs for i in ([s['title']] if s['title'] else []) + s['items']]
        out.append({'title': re.sub(r'^Q\d*\.\s*', '', q), 'items': items, 'ordered': False})
    return out


def site_postprocess(pages, faq_keys=(), pick=None, fix=None):
    """사이트 파일의 postprocess 를 만든다.
    메뉴 페이지는 <h1> 을 제목으로 읽고 표 칸을 풀어 다시 뽑는다. 게시글(mode=view)은 fr-view 본문.
    faq_keys 의 페이지는 질문마다 덩어리 하나. pick={키: 질문} 은 FAQ 목록에서 질문 하나만.
    fix(key, page) 로 사이트별 손질을 더한다."""
    pick = pick or {}

    def postprocess(key, page, raw):
        if key in pick:
            hit = [secs for q, secs in faq_list(raw) if q.strip() == pick[key]]
            page['title'], page['sections'] = pick[key], (hit[0] if hit else [])
        elif key in faq_keys:
            page['title'], page['sections'] = menu_title(raw), faq_as_sections(raw)
        elif 'mode=view' in pages[key]:
            title, secs = article(raw)
            page['title'], page['sections'] = clean_title(title), secs
        else:
            page['title'] = menu_title(raw)
            page['sections'] = drop_empty_titles(reextract(raw, None, h1=True, spans=True))
        if fix:
            page = fix(key, page) or page
        return page
    return postprocess


def table_lists(raw):
    """칸 안에 목록(<li>)이 든 표 → [(첫 칸 글, [목록 줄…])]. '이런 문제는 …' 같은 분류표용."""
    out = []
    for tr in re.findall(r'(?is)<tr\b[^>]*>.*?</tr>', raw):
        cells = _cells(tr)
        if len(cells) < 2:
            continue
        head = ' '.join(text_lines(cells[0][2]))
        lis = [' '.join(text_lines(li)) for li in re.findall(r'(?is)<li\b[^>]*>(.*?)</li>', ''.join(c[2] for c in cells[1:]))]
        if head and lis:
            out.append((head, [x for x in lis if x]))
    return out


SEJONG = re.compile(r'세종')


def drop_sejong(page):
    """서울캠퍼스 학부생 챗봇이라 '세종 …' 줄·덩어리·표 줄은 뺀다."""
    out = []
    for s in page['sections']:
        if SEJONG.search(s['title']):
            continue
        s = {**s, 'items': [i for i in s['items'] if not re.match(r'\s*[\[(]?세종', i)]}
        if s.get('table'):
            s['table'] = [r for r in s['table'] if not any(re.match(r'\s*[\[(]?세종', c) for c in r[:1])]
        if s['items'] or s.get('table'):
            out.append(s)
    page['sections'] = out
    return page


NUM_HEAD = re.compile(r'^(\d{1,2}\.|[가-하]\.)\s*\S')


def split_numbered(page, max_len=36):
    """'1. 학사 지원(우선 수강신청)' 같은 번호 붙은 짧은 줄을 덩어리 제목으로 올린다.
    표는 덩어리 끝에 붙어 있으므로(본문 순서) 마지막 조각에 남긴다."""
    out = []
    for s in page['sections']:
        pieces = [{'title': s['title'], 'items': [], 'ordered': False}]
        for it in s['items']:
            core = it.strip()
            if NUM_HEAD.match(core) and len(core) <= max_len and ':' not in core and not it.startswith(' '):
                if pieces[-1]['items'] or pieces[-1]['title']:
                    pieces.append({'title': core, 'items': [], 'ordered': False})
                else:
                    pieces[-1]['title'] = core
            else:
                pieces[-1]['items'].append(it)
        if s.get('table'):
            pieces[-1]['table'] = s['table']
        out += [p for p in pieces if p['items'] or p.get('table') or p['title']]
    page['sections'] = drop_empty_titles(out)
    return page
