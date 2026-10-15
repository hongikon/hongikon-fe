"""학교 홈페이지 '대학과정'(education/intro-university.do) — 서울캠퍼스 단과대학·학과(부)·전공별 사무실 전화번호 표.

공용 추출(data/pages.json education_intro-university)은 '홈페이지 / 02-… / 위치' 줄이 학과 이름과 떨어져 읽기 어렵다.
여기서는 학과 바로가기 링크(deptCd)와 그 뒤 첫 전화 버튼(data-tooltip-title)만 짝지어 표로 만든다.
deptCd 가 A 로 시작하면 서울캠퍼스, B 는 세종캠퍼스라 A 만 남긴다. 위치 버튼은 캠퍼스맵 링크뿐이라 글자가 없어 옮기지 않는다.
전화가 없는 줄(무역학전공·지능로봇공학전공 등)은 뺀다. 번호는 원문 그대로 둔다.
"""
import html, re

LABEL = '학교 홈페이지 대학과정 안내'
PAGES = {
    'dept_univ_phones': 'https://www.hongik.ac.kr/kr/education/intro-university.do',
}
CONTENT = {'tag': 'body'}

_A = re.compile(r'<a href="\?mode=view&(?:amp;)?deptCd=(\w+)&(?:amp;)?depth=(\d)"[^>]*>(.*?)</a>', re.S)


def postprocess(key, page, raw):
    anchors = list(_A.finditer(raw))
    seen, rows = set(), [['단과대학', '학과(부) · 전공', '전화']]
    college = ''
    for n, m in enumerate(anchors):
        code, depth = m.group(1), m.group(2)
        name = html.unescape(re.sub(r'<[^>]+>', '', m.group(3))).strip()
        if not code.startswith('A') or code in seen:
            continue
        seen.add(code)
        end = anchors[n + 1].start() if n + 1 < len(anchors) else len(raw)
        ph = re.search(r'data-tooltip-title="([^"]+)"', raw[m.end():end])
        if depth == '1':
            college = name
        if not ph:
            continue
        rows.append([college, name if depth != '1' else '(단과대학 행정실)', html.unescape(ph.group(1)).strip()])
    page['title'] = '서울캠퍼스 학과(부) 사무실 전화번호'
    page['sections'] = [{'title': '서울캠퍼스 단과대학 · 학과(부) · 전공 전화', 'items': [], 'ordered': False, 'table': rows}]
    return page
