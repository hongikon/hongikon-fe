"""학교 홈페이지 규정집의 학칙·학사내규 전문 → data/rag-regs.json (RAG 색인용 원문, 11-06 운영진 요청).

- 대상: 규정집 › 제2편 학칙 › 제1장 홍익대학교 › 1) 학칙(srCategoryId=109)·2) 학사내규(110). 본문이 HTML(div.fr-view)로 실려 있다.
- 장(章)마다 한 쪽. 쪽 글 첫 줄은 '홍익대학교 학칙 제5장 전과(개정 …)' — 색인이 문단마다 첫 줄을 붙이므로 어느 규정 몇 장인지 남는다.
- 부칙(시행일·경과조치)은 개정마다 붙어 길어서 규정마다 '부칙' 쪽으로 모으고 PART_CHARS 로 나눈다.
- 규정 원문에는 개인 정보가 없다(조문·개정일만). 별표·서식은 PDF 첨부라 옮기지 않는다.
- 실행: python3 -I scripts/ask/regs.py [--offline]  (--offline: cache/regs/ 에 받아 둔 HTML 로만)
  결과가 바뀌면 BE tools/embed-server/build_index.py 로 색인을 다시 만든다(README 'RAG 색인용 원문').
"""
import html, json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache', 'regs')
OUT = os.path.join(HERE, 'data', 'rag-regs.json')
BOOK = 'https://www.hongik.ac.kr/kr/introduction/regulations-book.do?mode=list&srCategoryId={}'
REGS = [  # (키, 규정 이름, 규정집 분류 번호)
    ('hakchik', '학칙', 109),
    ('naegyu', '학사내규', 110),
]
DEPT = '규정집'
PART_CHARS = 5000

CHAPTER = re.compile(r'^제\s*(\d+)\s*장\s*(.*)$')
ADDENDA = re.compile(r'^부\s*칙')


def fetch(key, cat, offline):
    path = os.path.join(CACHE, f'{key}.html')
    if not offline:
        req = urllib.request.Request(BOOK.format(cat), headers={'User-Agent': 'hongikon-ask-crawler'})
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode('utf-8', 'replace')
        os.makedirs(CACHE, exist_ok=True)
        open(path, 'w', encoding='utf-8').write(raw)
        time.sleep(0.3)
    return open(path, encoding='utf-8').read()


def text_lines(raw):
    box = raw[raw.find('b-regulation-con-box'):]
    head = html.unescape(re.sub(r'<[^>]+>', ' ', box[:box.find('fr-view')]))
    dates = re.findall(r'(제정|개정)\s+([0-9]{4}\.[0-9]{2}\.[0-9]{2})', head)
    i = box.find('fr-view')
    if i < 0:
        raise SystemExit('규정 본문(fr-view)을 못 찾았다 — 학교 페이지 구조가 바뀌었는지 확인')
    t = box[i:]
    t = re.sub(r'<script.*?</script>', '', t, flags=re.S)
    t = re.sub(r'<(br|/p|/div|/li|/tr|/h\d)[^>]*>', '\n', t)
    t = re.sub(r'<(td|th)[^>]*>', ' ', t)
    t = html.unescape(re.sub(r'<[^>]+>', '', t)).replace('\xa0', ' ')
    lines = [re.sub(r'[ \t]+', ' ', x).strip() for x in t.split('\n')]
    return dict(dates), [x for x in lines if x]


def split(key, name, cat, raw):
    dates, lines = text_lines(raw)
    lines[0] = lines[0].replace('fr-view">', '').strip()
    if not lines or not lines[0].startswith(f'홍익대학교 {name}'):
        raise SystemExit(f'{name}: 첫 줄이 "홍익대학교 {name}" 가 아니다 — 페이지를 확인 ({lines[:1]})')
    stamp = ' · '.join(f'{k} {v}' for k, v in dates.items())
    url = BOOK.format(cat)
    chapters, cur = [], None
    for line in lines[1:]:
        m = CHAPTER.match(line)
        if m and (cur is None or cur['kind'] == 'ch'):
            cur = {'kind': 'ch', 'no': int(m.group(1)), 'name': m.group(2).strip(), 'body': []}
            chapters.append(cur)
            continue
        if ADDENDA.match(line) and len(line) < 40:
            if cur is None or cur['kind'] != 'add':
                cur = {'kind': 'add', 'body': []}
                chapters.append(cur)
            cur['body'].append(line)
            continue
        if cur is None or line.startswith('* 별표 및 서식은'):
            continue
        cur['body'].append(line)
    pages = []
    for c in chapters:
        if c['kind'] == 'ch':
            title = f"{name} 제{c['no']}장 {c['name']}"
            head = f'홍익대학교 {title}' + (f' ({stamp})' if stamp else '')
            pages.append({'key': f"reg-{key}-ch{c['no']:02d}", 'dept': DEPT, 'url': url, 'title': title,
                          'text': head + '\n' + '\n'.join(c['body'])})
        else:
            parts, buf = [], []
            for line in c['body']:
                if buf and sum(len(x) + 1 for x in buf) + len(line) > PART_CHARS:
                    parts.append(buf)
                    buf = []
                buf.append(line)
            if buf:
                parts.append(buf)
            for n, part in enumerate(parts, 1):
                title = f'{name} 부칙(시행일·경과조치) {n}/{len(parts)}'
                pages.append({'key': f'reg-{key}-add{n:02d}', 'dept': DEPT, 'url': url, 'title': title,
                              'text': f'홍익대학교 {title}\n' + '\n'.join(part)})
    nos = [c['no'] for c in chapters if c['kind'] == 'ch']
    if nos != list(range(1, len(nos) + 1)):
        raise SystemExit(f'{name}: 장 번호가 1부터 이어지지 않는다 {nos}')
    return pages


def main():
    offline = '--offline' in sys.argv
    pages = []
    for key, name, cat in REGS:
        got = split(key, name, cat, fetch(key, cat, offline))
        arts = sum(len(re.findall(r'(?m)^제\s*\d+\s*조(?:의\s*\d+)?\s*\(', p['text'])) for p in got)
        print(f'{name}: 쪽 {len(got)} · 조문 {arts} · 글자 {sum(len(p["text"]) for p in got):,}')
        pages += got
    json.dump({'crawledAt': time.strftime('%Y-%m-%d'), 'pages': pages}, open(OUT, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('→', os.path.relpath(OUT, HERE), len(pages), '쪽')


if __name__ == '__main__':
    main()
