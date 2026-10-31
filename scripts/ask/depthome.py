"""학과 홈페이지 메뉴 페이지 → RAG 색인용 원문(data/rag-depthome.json). 사용: python3 -I scripts/ask/depthome.py

10-28 운영진 요청: 학과 홈페이지 내용도 챗봇이 찾게. 낱말 목록(topics)을 짜지 않고 원문을 그대로 RAG 색인에 넣는다
(백엔드 tools/embed-server/build_index.py 가 이 파일을 읽는다 — docs/ask-embedding-plan.md).

- 대상: 백엔드 크롤러 학과 게시판(CrawlerBoards.DEPARTMENT_BOARDS)의 홈페이지. 첫 화면 메뉴의 '/<사이트>/NNNN.do'·'/<사이트>/sub/NNNN.do'.
- 교수·구성원 소개: 내용(연락처·연구실·이메일)은 옮기지 않고 '그 페이지가 어디 있는지'만 남긴다(10-28 운영진 결정 —
  교수 정보는 우리가 답하지 않고 학과 홈페이지 교수 소개로 안내). linkOnly 쪽.
  10-31 운영진 결정: 교수진 페이지는 이름·직위·연구분야(소속은 학과)만 옮긴다 — `--faculty` 가 화면을 그려(헤드리스 Chrome,
  교수진 목록은 자바스크립트로 채워진다) 그 세 칸만 읽는다. 학위·출신 학교·연구실·전화·이메일·사진은 읽지도 저장하지도 않는다.
  교직원·연구랩·조교 소개는 지금처럼 위치만.
- 빼는 것: 게시판(글 목록이 있는 메뉴 — 공지는 서버가 매시간 따로 모은다), 이메일 주소,
  화면에서 채우는 틀('{{ … }}'), 여러 학과에 똑같이 들어간 공통 문구, 남은 본문이 짧은 페이지.
- 예절: robots.txt 가 막은 폴더(/_attach 등)는 가지 않는다. 요청 사이 1초, 홍익온 수집기 이름(UA).
"""
import collections, json, os, re, sys, time, urllib.request
from urllib.parse import urljoin, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extract  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
BOARDS = os.path.join(ROOT, '..', '..', '..', 'hongikon-be', 'src', 'main', 'java', 'com', 'hongmap', 'hongmapbackend',
                      'crawler', 'config', 'CrawlerBoards.java')
CACHE = os.path.join(ROOT, 'cache', 'depthome')
OUT = os.path.join(ROOT, 'data', 'rag-depthome.json')
UA = 'Mozilla/5.0 (compatible; hongikon-ask-crawler; +https://hongikon.com)'
DELAY = 1.0
MAX_PAGES = 40
MIN_CHARS = 120
# 사람 소개(교수·교직원·연구실) — 내용 없이 위치만. 10-28 점검: '연구랩실소개'(교수 실명·연구실), '교직원소개'(직원 실명·내선·호실)가 걸러지지 않았다.
FACULTY_TITLE = re.compile(r'교수|교원|교수진|구성원|교직원|직원|연구랩|랩실|Lab|LAB|Faculty|People|Staff')
SKIP_TITLE = re.compile(r'조교|연구실|동문|갤러리|사진|오시는\s*길')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+(\.[\w-]+)+')
# 학번(영문 1자 + 숫자 6~7자리)이 있는 줄은 개인 기록(수상·임원 명단)이라 뺀다(10-28 공개 저장소 점검에서 '학과연혁' 명예의 전당 실명·학번 발견).
STUDENT_ID = re.compile(r'\b[A-Z]\d{6,7}\b')
# 게시판 목록(글 제목에 학생 실명·수상자가 섞인다). 메뉴가 게시판인데 글 링크를 자바스크립트로 그려 위 검사에 안 걸리는 경우.
BOARD_TITLE = re.compile(r'게시판\s*목록|게시판목록')


def fetch(url):
    time.sleep(DELAY)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return urllib.request.urlopen(req, timeout=20).read().decode('utf-8', errors='ignore')


def departments():
    """(학과 이름, 홈페이지 첫 화면) — 같은 사이트는 한 번만."""
    src = open(BOARDS, encoding='utf-8').read()
    out = {}
    for source_id, url in re.findall(r'hongik\("[^"]+",\s*"([^"]+)",\s*"[^"]+",\s*"(https://[a-z0-9-]+\.hongik\.ac\.kr/[^"/]+)/', src):
        host = urlparse(url).netloc
        if host in ('www.hongik.ac.kr', 'inno.hongik.ac.kr') or host in out:
            continue
        out[host] = (source_id, url + '/index.do')
    return list(out.values())


def lines_of(page):
    out = []
    for s in page['sections']:
        for text in [s['title']] + s['items'] + [' | '.join(c for c in row if c) for row in s.get('table') or []]:
            text = EMAIL.sub('', re.sub(r'\s+', ' ', text or '')).strip()
            if text and '{{' not in text and text not in ('공유', 'URL 복사', '홈페이지') and not STUDENT_ID.search(text):
                out.append(text)
    return out


def main():
    os.makedirs(CACHE, exist_ok=True)
    pages = []
    faculty = []
    for dept, home in departments():
        site = urlparse(home).path.split('/')[1]
        try:
            raw = fetch(home)
        except Exception as e:  # noqa: BLE001
            print(f'{dept}: 첫 화면 실패 {e}', file=sys.stderr)
            continue
        links = []
        for href in re.findall(r'href="([^"]+)"', raw):
            path = urlparse(urljoin(home, href.replace('&amp;', '&'))).path
            if re.fullmatch(rf'/{site}/(sub/)?\d{{3,6}}\.do', path) and path not in links:
                links.append(path)
        kept = 0
        for path in links[:MAX_PAGES]:
            url = f'https://{urlparse(home).netloc}{path}'
            try:
                body = fetch(url)
            except Exception as e:  # noqa: BLE001
                print(f'{dept}: {path} 실패 {e}', file=sys.stderr)
                continue
            if re.search(rf'{re.escape(path)}\?mode=view', body.replace('&amp;', '&')):
                continue  # 게시판 목록(이 메뉴 글로 가는 링크가 있다)
            name = re.sub(r'[^a-z0-9]+', '_', f'{site}{path}'.lower()).strip('_')
            file = os.path.join(CACHE, name + '.html')
            open(file, 'w', encoding='utf-8').write(body)
            page = extract.extract(file, {'id': 'cms-content'})
            title = re.sub(r'\s+', ' ', page['title'])
            if FACULTY_TITLE.search(title):
                faculty.append({'key': 'depthome_' + name, 'dept': dept, 'url': url, 'title': title})
                kept += 1
                continue
            if SKIP_TITLE.search(title) or BOARD_TITLE.search(title):
                continue
            pages.append({'key': 'depthome_' + name, 'dept': dept, 'url': url, 'title': title, 'lines': lines_of(page)})
            kept += 1
        print(f'{dept}: 메뉴 {len(links)} → {kept}쪽', flush=True)
    # 여러 학과에 똑같이 들어간 줄(공통 안내·꼬리말)은 뺀다.
    seen = collections.Counter(line for p in pages for line in set(p['lines']))
    depts_of = collections.defaultdict(set)
    for p in pages:
        for line in set(p['lines']):
            depts_of[line].add(p['dept'])
    out = []
    for p in pages:
        lines = [l for l in p['lines'] if len(depts_of[l]) < 4]
        text = '\n'.join(dict.fromkeys(lines))
        if len(text) >= MIN_CHARS:
            out.append({'key': p['key'], 'dept': p['dept'], 'url': p['url'], 'title': p['title'], 'text': text})
    # 교수 소개는 위치만. 질문('○○ 교수님 연구실', '교수 이메일', '면담')에 걸리게 쓰는 말만 적고 개인 정보는 넣지 않는다.
    for f in faculty:
        out.append({'key': f['key'], 'dept': f['dept'], 'url': f['url'], 'title': f['title'], 'linkOnly': True,
                    'text': f"{f['dept']} 교수진·교직원·연구실 소개는 {f['dept']} 홈페이지의 '{f['title'].split('|')[-1].strip()}' 메뉴에서 볼 수 있어요. "
                            "교수님·교직원 연구실·연락처·이메일·면담·전공 분야는 홍익온이 따로 안내하지 않고 이 학과 홈페이지 페이지로 안내해요."})
    json.dump({'crawledAt': time.strftime('%Y-%m-%d'), 'pages': out}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'완료: {len(out)}쪽, {sum(len(p["text"]) for p in out)}자 → {OUT}', flush=True)


def refilter():
    """이미 만든 data/rag-depthome.json 을 다시 수집하지 않고 지금 규칙(학번 줄·게시판 목록)으로 거른다."""
    data = json.load(open(OUT, encoding='utf-8'))
    kept = []
    for p in data['pages']:
        if not p.get('linkOnly') and BOARD_TITLE.search(p['title']):
            continue
        if not p.get('linkOnly') and FACULTY_TITLE.search(p['title']):
            p.update(linkOnly=True, text=f"{p['dept']} 교수진·교직원·연구실 소개는 {p['dept']} 홈페이지의 '{p['title'].split('|')[1].strip() if '|' in p['title'] else p['title']}' 메뉴에서 볼 수 있어요. "
                                         "개인 연구실·연락처·이메일은 홍익온이 따로 안내하지 않고 이 학과 홈페이지 페이지로 안내해요.")
        if not p.get('linkOnly'):
            p['text'] = '\n'.join(l for l in p['text'].split('\n') if not STUDENT_ID.search(l))
            if len(p['text']) < MIN_CHARS:
                continue
        kept.append(p)
    data['pages'] = kept
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'다시 거름: {len(kept)}쪽')


CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
# 교수 목록이 있는 교수진 메뉴(교직원·연구랩·게시판 목록은 아니다).
PROF_TITLE = re.compile(r'교수진|교수\s*소개|교수소개|교원')
NOT_PROF_TITLE = re.compile(r'게시판|직원|연구랩|랩실|조교')
# 연구분야 칸이 비어 첫 줄이 학위·학교·연구실이면 버린다.
NOT_FIELD = re.compile(r'박사|석사|학사|Ph\.?\s*D|Univ|University|College|대학교|대학원|\d+호|\d층|@')


def rendered(url):
    """화면을 그린 뒤의 HTML(교수진 목록은 자바스크립트가 채운다). 임시 프로필, 홍익온 수집기 이름."""
    time.sleep(DELAY)
    import subprocess, tempfile  # noqa: E401
    with tempfile.TemporaryDirectory() as profile:
        out = subprocess.run([CHROME, '--headless=new', '--disable-gpu', f'--user-data-dir={profile}', f'--user-agent={UA}',
                              '--virtual-time-budget=10000', '--dump-dom', url], capture_output=True, timeout=120)
    return out.stdout.decode('utf-8', errors='ignore')


def professors(html, position=''):
    """교수진 목록 → [(이름, 직위, 연구분야)]. 그 밖의 칸(학위·학교·연구실·전화·이메일·사진)은 읽지 않는다.
    position: 직위 칸이 없는 쪽(기계시스템디자인공학과 'professor-box' — 쪽마다 전임·초빙·겸임)에 쓸 쪽 제목."""
    if 'prof-ul' not in html:
        return _professor_boxes(html, position)
    out = []
    for block in html.split('class="faculty-intro"')[1:]:
        name = re.search(r'class="faculty-name"[^>]*>\s*([^<]+?)\s*</a>', block)
        position = re.search(r'<p class="position">\s*([^<]*?)\s*</p>', block)
        info = re.search(r'<ul class="info">\s*<li>\s*([^<]*?)\s*</li>', block)
        if not name:
            continue
        field = _clean(info.group(1)) if info else ''
        if NOT_FIELD.search(field):
            field = ''
        row = (_clean(name.group(1)), _clean(position.group(1)) if position else '', field)
        if row not in out:
            out.append(row)
    return out


def _clean(text):
    """'함채원&nbsp;' → '함채원'."""
    return re.sub(r'\s+', ' ', text.replace('&nbsp;', ' ').replace('\xa0', ' ').replace('&amp;', '&')).strip()


def _professor_boxes(html, position):
    """기계시스템디자인공학과 꼴 — 교수마다 'professor-box': 이름(h2), 연구실(랩) 이름(p.lab), 상세 첫 줄(전공 분야이거나 학위)."""
    out = []
    for block in html.split('class="professor-box"')[1:]:
        name = re.search(r'<h2>\s*([^<]+?)\s*(?:<|$)', block)
        if not name:
            continue
        lab = re.search(r'<p class="lab">\s*([^<]+?)\s*</p>', block)
        first = re.search(r'class="professor-details">\s*<p><strong>•</strong>\s*([^<]+?)\s*</p>', block)
        field = _clean(lab.group(1) if lab else (first.group(1) if first else ''))
        if NOT_FIELD.search(field):
            field = ''
        row = (_clean(name.group(1)), position, field)
        if row not in out:
            out.append(row)
    return out


# 지금 가르치지 않는 분(퇴임·명예) 쪽은 넣지 않는다 — 다른 학과의 퇴임·명예교수 게시판 목록도 위치만이다.
RETIRED_TITLE = re.compile(r'퇴임|명예')
POSITION_TITLE = re.compile(r'(전임|초빙|겸임|객원|외래)\s*교수|강사')


def faculty():
    """이미 만든 data/rag-depthome.json 의 교수진 쪽만 화면을 그려 이름·직위·연구분야로 채운다(다른 쪽은 그대로)."""
    data = json.load(open(OUT, encoding='utf-8'))
    changed = 0
    for p in data['pages']:
        if not p.get('linkOnly') or not PROF_TITLE.search(p['title']) or NOT_PROF_TITLE.search(p['title']) \
                or RETIRED_TITLE.search(p['title']):
            continue
        position = POSITION_TITLE.search(p['title'])
        try:
            rows = professors(rendered(p['url']), position.group(0).replace(' ', '') if position else '')
        except Exception as e:  # noqa: BLE001
            print(f"{p['dept']}: {p['url']} 실패 {e}", file=sys.stderr)
            continue
        if not rows:
            print(f"{p['dept']}: 교수 목록 없음 — 위치만 둔다 ({p['url']})", flush=True)
            continue
        menu = p['title'].split('|')[-1].strip()
        lines = [f"{p['dept']} 교수진(학과 홈페이지 '{menu}' 메뉴 기준, 이름 · 직위 · 연구분야)"]
        lines += [' · '.join(c for c in row if c) for row in rows]
        lines.append(f"연구실·전화·이메일·면담은 홍익온이 안내하지 않고 {p['dept']} 홈페이지 교수진 페이지로 안내해요.")
        p.pop('linkOnly', None)
        p.update(faculty=True, text=EMAIL.sub('', '\n'.join(lines)))
        changed += 1
        print(f"{p['dept']}: 교수 {len(rows)}명", flush=True)
    data['facultyAt'] = time.strftime('%Y-%m-%d')
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'교수진 채움: {changed}쪽')


if __name__ == '__main__':
    refilter() if '--refilter' in sys.argv else faculty() if '--faculty' in sys.argv else main()
