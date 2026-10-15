"""학교 홈페이지(www.hongik.ac.kr) 기관 안내 중 국제·유학생 부서 — 위치·전화·업무시간 출처.

부속기관(introduction/subsidiary.do)·행정기관(introduction/administrative.do) 게시판 글이라 메뉴 크롤(sources.py)에 안 잡혀
여기서 낱개로 받는다. 국제언어교육원 홈페이지(huniv.hongik.ac.kr/~hili/)는 403 이라 이 안내가 위치·전화의 출처다.
열린교육 안내(open-education 28056·3150)는 위치를 '국제언어교육원(N동)'으로 적었지만, 기관 안내(행정실 '예문관')와
한국어교육부 연혁('2024년 2월 예문관 이전')과 어긋나 옛 위치로 보고 위치 줄은 뺀다(전화·업무시간·소개·강좌는 둔다).
"""
import re

LABEL = '홍익대학교 기관 안내'
W = 'https://www.hongik.ac.kr/kr/introduction'
PAGES = {
    'intlwww_kli': f'{W}/subsidiary.do?mode=view&articleNo=78392&dept=AC1150',        # 국제언어교육원
    'intlwww_kli-office': f'{W}/subsidiary.do?mode=view&articleNo=79414&dept=AC1151', # 국제언어교육원 행정실
    'intlwww_oia': f'{W}/administrative.do?mode=view&articleNo=28117&dept=A70100',    # 국제협력본부
    'intlwww_exchange': f'{W}/administrative.do?mode=view&articleNo=28125&dept=A71100',  # 국제교류실
    'intlwww_isss': f'{W}/administrative.do?mode=view&articleNo=28175&dept=A72100',   # 국제학생지원실
    # 교육 > 열린교육 의 국제언어교육원 안내. 외국어교육부(본교생 어학강좌) 프로그램 설명이 여기에만 있다.
    'intlwww_kli-foreign': 'https://www.hongik.ac.kr/kr/education/open-education.do?mode=view&articleNo=28056',  # 외국어교육부
    'intlwww_kli-courses': 'https://www.hongik.ac.kr/kr/education/open-education.do?mode=view&articleNo=3150',   # 강좌안내 목록
}
CONTENT = {'id': 'cms-content'}


OLD_PLACE = ('intlwww_kli-foreign', 'intlwww_kli-courses')


def postprocess(key, page, raw):
    from sites import _intlkit as K
    page_key = key
    # 태그 없는 <pre> 안 줄바꿈(강좌 목록)은 줄마다 항목으로, '목록보기' 버튼 줄은 뺀다.
    raw = re.sub(r'<pre[^>]*>([^<]*)</pre>', lambda m: '<ul>' + ''.join(f'<li>{l}</li>' for l in m.group(1).split('\n') if l.strip()) + '</ul>', raw, flags=re.S)
    raw = re.sub(r'<div class="b-btn-wrap">.*', '', raw, flags=re.S)
    page = dict(page, **K.reparse(raw, CONTENT))
    # 공유 버튼·'목록' 같은 화면 글자는 뺀다.
    junk = ('공유', '카카오 공유하기', '페이스북 공유하기', 'URL 복사', '목록', '홈페이지', '펼치기', '접기')
    for s in page['sections']:
        seen, items = set(), []
        cells = {c for r in s.get('table', []) for c in r}
        for i in s['items']:
            c = re.sub(r'(\d{2}) :(\d{2})', r'\1:\2', i)
            c = re.sub(r'(\d{2,3}) -(\d{3,4})', r'\1-\2', c)
            key = c.strip()
            if key in junk or key in ('서울캠퍼스', '목록보기', '담당부서', '위치', '위치 :', '전화', '홈페이지') or key in seen or re.fullmatch(r'[\d.\s]+', key):
                continue
            if page_key in OLD_PLACE and re.search(r'N동', key):
                continue
            if cells and (key in cells or key.replace(' ', '') in {x.replace(' ', '') for x in cells}):
                continue
            seen.add(key)
            items.append(c)
        s['items'] = items
    page['sections'] = [s for s in page['sections'] if s['items'] or s.get('table') or s['title']]
    return page
