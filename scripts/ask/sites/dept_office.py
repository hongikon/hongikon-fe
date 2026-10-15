"""학과 홈페이지의 '학과사무실 안내' · '오시는 길'(정적 페이지만). 학과 안내(01xx) 위젯은 /_custom 스크립트(robots 금지)로
학과 정보를 불러와 받지 않는다. 그래서 사무실 위치·업무시간을 페이지 글자로 적어 둔 학과만 담는다.

- 컴퓨터공학과 0102 학과사무실안내: 사무실(기자재실) T704 · 사무실 T703 · 멀티미디어실 T604, 전화·업무시간·담당업무
- 신소재공학전공 0102 학과사무실안내: K412, 전화 2개, 업무시간
- 화학공학전공 0103 오시는길: 과학관(I동) 505호, 대표번호
- 경제학부 0103 오시는길: 인문사회관 C동 321호
"""
import re
from sites import _adminkit as kit

LABEL = '학과 홈페이지'
PAGES = {
    'dept_office_ce': 'https://wwwce.hongik.ac.kr/wwwce/0102.do',
    'dept_office_mse': 'https://mse.hongik.ac.kr/mse/0102.do',
    'dept_office_chemeng': 'https://chemeng.hongik.ac.kr/chemeng/sub/0103.do',
    'dept_office_econ': 'https://economics.hongik.ac.kr/economics/0103.do',
}
CONTENT = {'id': 'cms-content'}
TITLES = {
    'dept_office_ce': '컴퓨터공학과 | 학과사무실안내',
    'dept_office_mse': '신소재공학전공 | 학과사무실안내',
    'dept_office_chemeng': '화학공학전공 | 오시는길',
    'dept_office_econ': '경제학부 | 오시는길',
}
_FOOT = ('개인정보처리방침', '예결산공고', '대학정보공시', '대학자체평가', '전화번호 안내', 'COPYRIGHT')


def postprocess(key, page, raw):
    page['title'] = TITLES[key]
    if key == 'dept_office_ce':
        # 위쪽은 다른 기관 소개 글이 잘못 들어가 있어 '학과 사무실(기자재실) 정보' 부터 옮긴다.
        i = raw.find('학과 사무실(기자재실) 정보')
        if i > 0:
            raw = raw[:raw.find('id="cms-content"')] + 'id="cms-content">' + raw[raw.rfind('<', 0, i):]
    secs = []
    for s in kit.reparse(raw, CONTENT):
        s['items'] = [x for x in s['items'] if not x.startswith(_FOOT) and '지도' != x.strip()]
        if s['title'].startswith(_FOOT):
            continue
        if s['items'] or s.get('table') or s['title']:
            secs.append(s)
    if key == 'dept_office_ce':
        names = ['학과 사무실(기자재실) 정보', '학과 사무실 정보', '멀티미디어실 정보']  # 원문 상자 제목, 표 차례대로
        tabs = [s for s in secs if s.get('table')]
        for s, n in zip(tabs, names):
            s['title'], s['items'] = n, []
        secs = tabs
    page['sections'] = secs
    return page
