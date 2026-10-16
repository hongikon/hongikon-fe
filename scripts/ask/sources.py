"""물어보기 크롤링 대상. crawl.py 가 읽는다.

- 메뉴 페이지: SEEDS 에서 링크를 따라가며 ALLOW 에 맞고 DENY 에 안 걸리는 상시 안내 페이지(.do)를 모은다.
  게시글(mode=view)·공지 목록은 날짜가 지나면 틀려지므로 따라가지 않는다.
- 게시판 FAQ: 상시 답이라 목록 페이지를 끝까지 넘겨 본문까지 받는다.
- 낱개 글: 메뉴에 없지만 답의 출처로 쓰는 글(정보전산원 메일 안내, 부서 소개 등). 키는 직접 붙인다.
"""
import re

SEEDS = [
    'https://www.hongik.ac.kr/kr/index.do',
    'https://it.hongik.ac.kr/it/index.do',
]

ALLOW = [
    re.compile(r'^https://www\.hongik\.ac\.kr/kr/(education|life|introduction|campus)/[a-z0-9_-]+\.do$'),
    re.compile(r'^https://it\.hongik\.ac\.kr/it/[0-9]+\.do$'),
]
# 세종캠퍼스·대학원·영문 안내는 서울캠퍼스 학부생 챗봇에서 쓰지 않는다. 공지·게시판은 날짜가 지나면 틀려진다.
# school-bus 는 세종캠퍼스 통학버스만 있다.
DENY = re.compile(r'sejong|notice|newscenter|/board/|-grad\b|-grad\.do|daehakro|hwaseong|munjeong|law-library|school-bus')

MAX_PAGES = 600
DELAY_SECONDS = 0.3

# 게시판형 FAQ — 목록(offset 10씩)에 본문이 펼쳐져 있다.
FAQ_BOARDS = {
    'academic-faq': 'https://www.hongik.ac.kr/kr/education/academic-faq.do?mode=list&articleLimit=10&article.offset={offset}',
    'scholarship-faq': 'https://www.hongik.ac.kr/kr/education/scholarship-faq.do?mode=list&articleLimit=10&article.offset={offset}',
}

# 키 → URL. 키는 생성 스크립트(topics/*.py)의 page= 에 쓴다.
ARTICLES = {
    'it_mail_board': 'https://it.hongik.ac.kr/it/board/0102.do',
    'it_mail_abroad': 'https://it.hongik.ac.kr/it/board/0102.do?mode=view&articleNo=134136',
    'notice_mail_faq': 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=142289',
    'office_health_center': 'https://www.hongik.ac.kr/kr/introduction/subsidiary.do?mode=view&articleNo=78386&dept=AC1210',
    'office_general_affairs': 'https://www.hongik.ac.kr/kr/introduction/administrative.do?mode=view&articleNo=28067&dept=A41100',
    'office_construction': 'https://www.hongik.ac.kr/kr/introduction/administrative.do?mode=view&articleNo=28109&dept=A43100',
    'wifi_site': 'http://wifi.hongik.ac.kr/hongik_wifi/',
}


def key_of(url):
    """페이지 URL → 저장 키. www …/kr/life/dormitory.do → life_dormitory, it …/it/0201.do → 0201."""
    m = re.match(r'^https://www\.hongik\.ac\.kr/kr/([a-z]+)/([a-z0-9_-]+)\.do$', url)
    if m:
        return f'{m.group(1)}_{m.group(2)}'
    m = re.match(r'^https://it\.hongik\.ac\.kr/it/([0-9]+)\.do$', url)
    if m:
        return m.group(1)
    return None


def url_of(key):
    if key in ARTICLES:
        return ARTICLES[key]
    if re.match(r'^\d+$', key):
        return f'https://it.hongik.ac.kr/it/{key}.do'
    a, b = key.split('_', 1)
    return f'https://www.hongik.ac.kr/kr/{a}/{b}.do'
