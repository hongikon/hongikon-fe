"""학생상담센터(서울) 홈페이지(counsel1.hongik.ac.kr). 센터 이용·심리상담·심리검사 안내와 FAQ.
counsel2 는 세종캠퍼스라 받지 않는다. 공지사항은 상시 안내인 '정신건강 심리상담 바우처 사업 신청 안내'만 옮긴다.
"""
import html, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lifekit import site_postprocess, table_lists, text_lines  # noqa: E402

LABEL = '학생상담센터 홈페이지'
B = 'https://counsel1.hongik.ac.kr/counsel1'
PAGES = {
    'counsel_intro': f'{B}/0101.do',       # 센터소개
    'counsel_use': f'{B}/0103.do',         # 센터 이용(신청 절차·위치·운영시간)
    'counsel_personal': f'{B}/0201.do',    # 개인상담
    'counsel_group': f'{B}/0202.do',       # 집단상담
    'counsel_intl': f'{B}/0203.do',        # 유학생상담
    'counsel_crisis': f'{B}/0204.do',      # 위기상담·긴급전화
    'counsel_tests': f'{B}/0301.do',       # 심리검사 안내
    'counsel_test_apply': f'{B}/index001.do',  # 심리검사 신청방법
    'counsel_faq': f'{B}/0401.do',         # 자주 묻는 질문
    'counsel_voucher': f'{B}/0402.do?mode=view&articleNo=148797',  # 정신건강 심리상담 바우처 신청 안내
    'counsel_apply': f'{B}/main.do',       # 상담/검사신청(첫 화면 안내창: 전화·방문·메일·온라인 신청 버튼)
}
CONTENT = {'id': 'cms-content'}


# 심리검사 온라인 신청(index001.do 의 '서울캠퍼스 검사신청' 링크).
TEST_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdbSxPH3uAq6B2TWuw3_2Uboo3y91VC0kSX1tyDHrCBQzeQ1g/viewform'


def _apply(page, raw):
    """첫 화면 안내창 '상담 및 검사 신청방법' → 신청 방법 줄 + 온라인 신청 버튼(링크). 대학로캠퍼스 버튼은 뺀다."""
    i = raw.find('상담 및 검사 신청방법')
    box = raw[i:raw.find('popup-close', i)] if i >= 0 else ''
    lines = [l for l in text_lines(re.sub(r'(?is)<a\b[^>]*forms\.gle.*?</a>', '\n', box)) if l != '상담 및 검사 신청방법']
    ways = [l.lstrip('- ').strip() for l in lines if l.startswith('-')]
    links = [(re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t))).strip(), u)
             for u, t in re.findall(r'<a[^>]*href="(https://forms\.gle/[^"]+)"[^>]*>(.*?)</a>', box, re.S)]
    links = [(t, u) for t, u in links if '대학로' not in t]
    k = next((n for n, l in enumerate(lines) if l.startswith('온라인으로')), None)
    intro = [] if k is None else [' '.join(lines[k:k + 2])]  # '온라인으로 … 경우,' + '아래의 버튼을 …' 두 줄로 나뉘어 있다
    page['title'] = '상담 및 검사 신청방법'
    page['sections'] = [
        {'title': '상담 및 검사 신청방법', 'items': ways, 'ordered': False},
        {'title': '온라인 신청', 'items': intro + [f'{t}: {u}' for t, u in links], 'ordered': False},
    ]
    return page


def _fix(key, page, raw):
    if key == 'counsel_apply':
        return _apply(page, raw)
    secs = page['sections']
    if key == 'counsel_test_apply':
        page['title'] = '심리검사 신청방법'
        for s in secs:
            s['items'] = [f'서울캠퍼스 검사신청: {TEST_FORM}' if i.startswith('서울캠퍼스 검사신청') else i for i in s['items']]
    elif key == 'counsel_personal':
        # 분류표(칸 안 목록)를 분류마다 덩어리 하나로.
        groups = table_lists(raw)
        head = [s for s in secs if not s.get('table')][:1]
        page['sections'] = head + [{'title': f'이런 문제는 상담센터와 함께 하세요! · {h}', 'items': lis, 'ordered': False} for h, lis in groups]
    elif key == 'counsel_crisis':
        for s in secs:
            s['items'] = [x.strip() for i in s['items'] for x in (i.split('·') if i.startswith('·') else [i]) if x.strip()]
    return page


_post = site_postprocess(PAGES, faq_keys=('counsel_faq',))


def postprocess(key, page, raw):
    return _fix(key, _post(key, page, raw), raw)
