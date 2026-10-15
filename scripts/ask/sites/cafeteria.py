"""서울캠퍼스 식당(학교 홈페이지 대학생활 › 식당). 식당 목록·식단은 페이지가 스크립트로 불러온다:
  GET /sso/APICipher2.jsp?data={"url":"/homepage/get_food_list.php","url2":"CAMPUS=","url3":"0"}  → RESTINFO(식당 정보)·RESTDATA(이번 주 식단)
PAGES 는 사람이 보는 식당별 주간 식단 페이지(seoul-cafeteria-view.do)이고, 본문(위치·운영시간·가격)은 위 JSON 의 RESTINFO 로 만든다.
식단(메뉴)은 날마다 바뀌어 답에 옮기지 않고 링크로만 보낸다. JSON 은 cache/cafeteria/restinfo.json 에 두고 HTML 보다 오래되면 다시 받는다.
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lifekit import article  # noqa: E402

LABEL = '학교 홈페이지'
V = 'https://www.hongik.ac.kr/kr/life/seoul-cafeteria-view.do'
PAGES = {
    'cafeteria_student': f'{V}?articleNo=5414&restNo=3',   # 학생식당(기숙사식당)
    'cafeteria_faculty': f'{V}?articleNo=5413&restNo=2',   # 교직원식당
    # 학생지원팀 공지(2026.09.29): 교직원식당 위탁운영 계약 만료 — 식권은 2026.10.30. 까지. 운영이 다시 정해지면 빼거나 바꾼다.
    'cafeteria_faculty_notice': 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=158468',
}
CONTENT = {'id': 'cms-content'}
API = 'https://www.hongik.ac.kr/sso/APICipher2.jsp?' + urllib.parse.urlencode(
    {'data': json.dumps({'url': '/homepage/get_food_list.php', 'url2': 'CAMPUS=', 'url3': '0'}, separators=(',', ':'))})
UA = 'Mozilla/5.0 (compatible; hongikon-ask-crawler; +https://hongikon.com)'
CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cache', 'cafeteria')


def restinfo():
    path = os.path.join(CACHE, 'restinfo.json')
    pages = [os.path.join(CACHE, k + '.html') for k in PAGES if 'restNo=' in PAGES[k]]
    newest = max([os.path.getmtime(p) for p in pages if os.path.exists(p)] or [0])
    if not os.path.exists(path) or os.path.getmtime(path) < newest:
        raw = urllib.request.urlopen(urllib.request.Request(API, headers={'User-Agent': UA}), timeout=25).read().decode('utf-8', 'ignore')
        time.sleep(0.6)
        data = json.loads(raw[raw.find('{'):])
        os.makedirs(CACHE, exist_ok=True)
        json.dump(data.get('RESTINFO', []), open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return json.load(open(path, encoding='utf-8'))


def _txt(v):
    return html.unescape(urllib.parse.unquote_plus(str(v or '')))


def postprocess(key, page, raw):
    if 'notice.do' in PAGES[key]:
        page['title'], page['sections'] = article(raw)
        page['sections'] = [{**sec, 'items': [i for i in sec['items'] if not i.startswith('붙임')]} for sec in page['sections']]
        return page
    rest_no = re.search(r'restNo=(\d+)', PAGES[key]).group(1)
    info = next((r for r in restinfo() if str(r.get('REST_NO')) == rest_no), None)
    if not info:
        page['sections'] = []
        return page
    name = _txt(info['NAME'])
    work = [w.strip() for w in re.split(r'<br\s*/?>', _txt(info.get('WORK'))) if w.strip()]
    desc = [l.strip() for l in _txt(info.get('DEPT_GOAL')).replace('\r', '').split('\n') if l.strip()]
    base = [f"위치 : {_txt(info.get('OFFICE'))}"] + ([f"전화 : {info['PHONE']}"] if info.get('PHONE') else [])
    page['title'] = name
    page['sections'] = [
        {'title': name, 'items': base + desc[:1], 'ordered': False},
        {'title': '운영시간', 'items': work, 'ordered': False},
        {'title': '가격·이용', 'items': desc[1:], 'ordered': False},
    ]
    page['sections'] = [s for s in page['sections'] if s['items']]
    return page
