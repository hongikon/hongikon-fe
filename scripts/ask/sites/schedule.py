"""학사일정. 학교 홈페이지 학사일정(www.hongik.ac.kr/kr/education/academic-schedule.do)은 달력을 JavaScript 로 그리고,
실제 일정은 /sso/APICipher.jsp 에 {url:'/schedule/get_schedule.php', GUBUN=0, YEAR=연도} 를 넘겨 JSON 으로 받는다
(페이지 안 '리스트 보기'의 HTML 은 2023년 견본이라 쓰지 않는다). 같은 주소를 GET 으로 불러도 같은 JSON 이 온다.
페이지의 '다운로드'(학사일정 PDF)는 올린 뒤 바뀐 날짜가 반영되지 않아(예: 2학기 복학신청) JSON 을 쓴다.

한 해 JSON(연도 = 수집하는 해)에 그해 1월~이듬해 2월 일정이 들어 있다. 공휴일(HOLY=1)은 '공휴일' 덩어리로 따로 모은다.
중간·기말고사 날짜는 학사일정에 없다('강의중간평가'는 학생이 하는 강의평가다).
"""
import json, os, re, urllib.parse
from datetime import date

LABEL = '학교 홈페이지'
YEAR = date.today().year
_API = 'https://www.hongik.ac.kr/sso/APICipher.jsp?data='
_Q = {'url': '/schedule/get_schedule.php', 'url2': '&GUBUN=', 'url3': '0', 'url4': '&YEAR=', 'url5': str(YEAR)}
PAGE_URL = 'https://www.hongik.ac.kr/kr/education/academic-schedule.do'
# schedule_json(실제 일정 JSON)을 받아 두고, 답 출처 링크는 학생이 보는 학사일정 페이지(schedule_year)로 건다.
# schedule_json 자체는 덩어리를 비워 답 페이지로 남기지 않는다.
PAGES = {
    'schedule_json': _API + urllib.parse.quote(json.dumps(_Q, separators=(',', ':'))),
    'schedule_year': PAGE_URL,
}
CONTENT = {'id': 'none'}  # 본문 상자를 쓰지 않는다. postprocess 가 JSON 으로 덩어리를 만든다.
_CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cache', 'schedule', 'schedule_json.html')
YOIL = '월화수목금토일'


def _day(s):
    """'2026-03-03' → '3.3(화)', '2026-05' → '5월'. 다른 해면 앞에 연도를 붙인다."""
    if len(s) >= 10:
        d = date.fromisoformat(s[:10])
        y = f'{d.year}.' if d.year != YEAR else ''
        return f'{y}{d.month}.{d.day}({YOIL[d.weekday()]})'
    y, m = s.split('-')
    return f"{'' if int(y) == YEAR else y + '년 '}{int(m)}월"


def _when(a, b):
    return _day(a) if a == b else f'{_day(a)} ~ {_day(b)}'


def postprocess(key, page, raw):
    if key != 'schedule_year' or not os.path.exists(_CACHE):
        page['sections'] = []
        return page
    raw = open(_CACHE, encoding='utf-8').read()
    m = re.search(r'\{.*\}', raw, re.S)
    data = json.loads(m.group(0)) if m else {}
    if data.get('result') != 'Y':
        page['sections'] = []
        return page
    rows = []
    for x in data['data']:
        title = urllib.parse.unquote_plus(x['TITLE']).strip()
        rows.append((x['START'], x['END'], title, x.get('HOLY') == '1'))
    rows.sort(key=lambda r: (r[0], r[1]))
    groups = {}
    for start, end, title, holy in rows:
        if holy:
            g = '공휴일·개교기념일'
        elif '입학전형' in title or '특별전형' in title:
            g = '입학전형'
        else:
            mm = re.search(r'(\d{4})학년도 (\d)학기', title) or re.search(r'(\d{4})-(\d)', title)
            if '계절' in title:
                yr = re.search(r'(\d{4})학년도', title).group(1)
                g = f"{yr}학년도 {'하계' if '하계' in title else '동계'} 계절학기"
            elif '학위수여식' in title or '졸업' in title:
                g = '학위수여식·졸업'
            elif mm:
                g = f'{mm.group(1)}학년도 {mm.group(2)}학기'
            else:
                g = '그 밖의 일정'
        groups.setdefault(g, []).append(f'{_when(start, end)} {title}')
    # 개교기념일은 원문에서 공휴일 표시(HOLY)로 온다.
    order = sorted(k for k in groups if re.match(r'\d{4}학년도 \d학기', k))
    order += sorted((k for k in groups if '계절학기' in k), key=lambda k: (k[:4], '동계' in k))
    order += [k for k in ('학위수여식·졸업', '그 밖의 일정', '공휴일·개교기념일', '입학전형') if k in groups]
    page['title'] = f'홍익대학교 | {YEAR}학년도 학사일정'
    page['sections'] = [{'title': k, 'items': groups[k], 'ordered': False} for k in order]
    return page
