"""cache/ 의 HTML → data/pages.json(안내 페이지)·data/faq.json(게시판 FAQ). 사용: python3 -I scripts/ask/extract.py [--site 이름]
안내 페이지 본문(#cms-content)을 h3/h4 제목 → section, ol/ul → items, table → table, p → items 로 옮긴다.
"""
import glob, html, importlib, json, os, re, sys
from datetime import date
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, 'cache')
DATA = os.path.join(ROOT, 'data')

BLOCK_HEAD = {'h2', 'h3', 'h4', 'h5'}

class P(HTMLParser):
    def __init__(self, content=None):
        super().__init__(convert_charrefs=True)
        # 본문 상자: 속성 이름 → 값(class 는 여러 값 중 하나만 맞아도 된다). 학교 홈페이지는 id="cms-content".
        self.content = content or {'id': 'cms-content'}
        self.ctag = 'div'
        self.depth = 0; self.inside = False; self.cdepth = None
        self.sections = []; self.cur = None
        self.buf = []; self.mode = None  # 'head','li','p','cell'
        self.list_stack = []  # ordered flags
        self.li_depth = 0
        self.table = None; self.row = None
        self.links = []
        self.skip = 0
    def is_content(self, tag, a):
        for name, value in self.content.items():
            if name == 'tag':
                if tag != value: return False
            elif name == 'class':
                if value not in (a.get('class') or '').split(): return False
            elif a.get(name) != value:
                return False
        return True

    def sec(self):
        if self.cur is None:
            self.cur = {'title': '', 'items': [], 'ordered': False}
            self.sections.append(self.cur)
        return self.cur
    def flush(self):
        text = re.sub(r'\s+', ' ', ''.join(self.buf)).strip()
        self.buf = []
        return text
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if not self.inside:
            if self.is_content(tag, a): self.inside = True; self.cdepth = 0; self.ctag = tag
            return
        if tag in ('script', 'style'): self.skip += 1
        if tag in ('div','ul','ol','li','table','tr','td','th','p','h3','h4','h5','span','a','strong','b','em','tbody','thead','label','button','img','br','i','u','sup','sub','font','colgroup','col','dl','dt','dd','caption','section','iframe','hr','input','select','option'):
            pass
        if tag == self.ctag: self.cdepth += 1
        if tag in BLOCK_HEAD:
            self.end_text(); self.mode = 'head'
        elif tag in ('ol', 'ul'):
            self.end_text(); self.list_stack.append(tag == 'ol')
        elif tag == 'li':
            self.end_text(); self.mode = 'li'; self.li_depth = len(self.list_stack)
        elif tag == 'table':
            self.end_text(); self.table = []
        elif tag == 'tr' and self.table is not None:
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.buf = []; self.mode = 'cell'
        elif tag in ('p', 'dt', 'dd') and self.mode not in ('li', 'cell', 'head'):
            self.end_text(); self.mode = 'p'
        elif tag == 'br':
            self.buf.append(' ')
        elif tag == 'a' and a.get('href'):
            self.links.append(a['href'])
    def end_text(self):
        t = self.flush()
        if not t or self.mode is None: self.mode = None; return
        if self.mode == 'head':
            self.cur = {'title': t, 'items': [], 'ordered': False}; self.sections.append(self.cur)
        elif self.mode in ('li', 'p'):
            s = self.sec()
            if self.mode == 'li' and self.list_stack and self.list_stack[-1] and not s['items']: s['ordered'] = True
            prefix = '  ' * max(0, self.li_depth - 1) if self.mode == 'li' else ''
            s['items'].append(prefix + t)
        self.mode = None
    def handle_endtag(self, tag):
        if not self.inside: return
        if tag in ('script', 'style'): self.skip -= 1
        if tag == self.ctag:
            self.cdepth -= 1
            if self.cdepth < 0: self.end_text(); self.inside = False; return
        if tag in BLOCK_HEAD and self.mode == 'head': self.end_text()
        elif tag == 'li' and self.mode == 'li': self.end_text()
        elif tag in ('p', 'dt', 'dd') and self.mode == 'p': self.end_text()
        elif tag in ('ol', 'ul'):
            if self.mode == 'li': self.end_text()
            if self.list_stack: self.list_stack.pop()
        elif tag in ('td', 'th') and self.mode == 'cell':
            self.row.append(self.flush()); self.mode = None
        elif tag == 'tr' and self.row is not None:
            if any(c for c in self.row): self.table.append(self.row)
            self.row = None
        elif tag == 'table' and self.table is not None:
            if self.table:
                s = self.sec()
                if s.get('table'):
                    s = {'title': s['title'], 'items': [], 'ordered': False}; self.sections.append(s); self.cur = s
                s['table'] = self.table
            self.table = None
    def handle_data(self, data):
        if not self.inside or self.skip: return
        if self.mode is None:
            if data.strip(): self.mode = 'p'
            else: return
        self.buf.append(data)

def extract(path, content=None):
    raw = open(path, encoding='utf-8', errors='ignore').read()
    t = re.search(r'<title>(.*?)</title>', raw, re.S)
    p = P(content); p.feed(raw); p.end_text()
    secs = []
    for s in p.sections:
        items = [i for i in s['items'] if i.strip() and i.strip() not in ('-', '·')]
        tab = s.get('table')
        if tab:
            w = max(len(r) for r in tab)
            tab = [r + [''] * (w - len(r)) for r in tab]
        if not items and not tab and not s['title']: continue
        secs.append({'title': s['title'], 'items': items, 'ordered': s['ordered'], **({'table': tab} if tab else {})})
    return {'title': html.unescape(t.group(1)).strip() if t else '', 'sections': secs}

def contacts(path):
    raw = open(path, encoding='utf-8', errors='ignore').read()
    m = re.search(r'<p class="contact-title">담당부서</p>(.*?)</ul>', raw, re.S)
    if not m: return []
    out = []
    for li in re.findall(r'<li>(.*?)</li>', m.group(1), re.S):
        spans = [html.unescape(re.sub(r'<[^>]+>', '', s)).strip() for s in re.findall(r'<span>(.*?)</span>\s*(?=<span|$)', li + '<span', re.S)]
        txt = [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x))).strip() for x in re.split(r'</span>', li)]
        txt = [x for x in txt if x]
        out.append(txt)
    return out


def faq_items(path, board):
    t = open(path, encoding='utf-8').read()
    out = []
    pattern = r'<span class="b-m-cate">\[(.*?)\]\s*</span>\s*(.*?)\s*</a>.*?<div class="fr-view">(.*?)</div>\s*(?:<div class="b-file|</div>)'
    for m in re.finditer(pattern, t, re.S):
        cat, q, body = m.group(1), html.unescape(re.sub(r'<[^>]+>', '', m.group(2))).strip(), m.group(3)
        p = P(); p.feed('<div id="cms-content">' + body + '</div>'); p.end_text()
        secs = [s for s in p.sections if s['items'] or s.get('table')]
        out.append({'board': board, 'cat': cat, 'q': q, 'sections': secs})
    return out


def extract_site(name):
    """학교 부속 사이트 하나(sites/<name>.py) → data/pages-<name>.json."""
    sys.path.insert(0, ROOT)
    site = importlib.import_module(f'sites.{name}')
    pages = {}
    for key, url in site.PAGES.items():
        path = os.path.join(CACHE, name, key + '.html')
        if not os.path.exists(path):
            continue
        page = extract(path, getattr(site, 'CONTENT', None))
        hook = getattr(site, 'postprocess', None)
        if hook:
            page = hook(key, page, open(path, encoding='utf-8', errors='ignore').read())
        page['url'] = url
        page['source'] = site.LABEL
        page['contacts'] = []
        if page['sections']:
            pages[key] = page
    out = os.path.join(DATA, f'pages-{name}.json')
    json.dump({'crawledAt': date.today().isoformat(), 'pages': pages}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(name, 'pages', len(pages), 'of', len(site.PAGES))


if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[1] == '--site':
    extract_site(sys.argv[2])
elif __name__ == '__main__':
    meta = json.load(open(os.path.join(CACHE, 'meta.json'), encoding='utf-8'))
    pages = {}
    for path in sorted(glob.glob(os.path.join(CACHE, 'html', '*.html'))):
        key = os.path.basename(path)[:-5]
        page = extract(path)
        page['url'] = meta.get(key, {}).get('url', '')
        page['contacts'] = contacts(path)
        if page['sections']:
            pages[key] = page
    faq = []
    for path in sorted(glob.glob(os.path.join(CACHE, 'faq', '*.html'))):
        faq += faq_items(path, os.path.basename(path).rsplit('-', 1)[0])
    os.makedirs(DATA, exist_ok=True)
    json.dump({'crawledAt': meta.get('_crawledAt'), 'pages': pages}, open(os.path.join(DATA, 'pages.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'crawledAt': meta.get('_crawledAt'), 'faq': faq}, open(os.path.join(DATA, 'faq.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('pages', len(pages), 'faq', len(faq))
