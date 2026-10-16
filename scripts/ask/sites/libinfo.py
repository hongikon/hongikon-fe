"""학교 홈페이지 '중앙도서관' 안내(introduction/central-library-view.do)를 운영 시간 표가 바르게 보이도록 다시 옮긴다.

공용 추출(data/pages.json introduction_central-library-view)은 두 줄짜리 머리(학기 중/방학 중 × 평일/토요일)와
colspan 을 펴지 못해 '방학 중: 09:00 ~ 15:00' 처럼 칸이 밀린다. 이 페이지에는 같은 표의 모바일용 마크업
(div.tr-box: 제목 · 실명 · 학기 중 · 방학 중 목록)이 함께 있어 그쪽을 읽는다. 모바일 마크업에만 24시간 열람실 층
(학기 중 4층, 방학 중 3층)이 적혀 있다. 글자는 바꾸지 않고 칸만 맞춘다.
"""
import html, re

LABEL = '학교 홈페이지 중앙도서관 안내'
PAGES = {
    'libinfo_hours': 'https://www.hongik.ac.kr/kr/introduction/central-library-view.do',  # 소개 · 주요 서비스 · 도서관 운영 시간
}
CONTENT = {'tag': 'body'}


def _text(fragment):
    s = re.sub(r'(?is)<(script|style)\b.*?</\1>', '', fragment)
    s = re.sub(r'(?i)<br\s*/?>|</p>\s*<p[^>]*>', ' ', s)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s)).replace('\xa0', ' ')).strip()


def _cell(li):
    """'06:00 ~ 23:00<p class="mark-p01">4층 열람실 24시간 개방</p>' → '06:00 ~ 23:00 (4층 열람실 24시간 개방)'."""
    m = re.match(r'(?is)(.*?)<p[^>]*class="mark-p01[^"]*"[^>]*>(.*?)</p>', li)
    if m:
        return f'{_text(m.group(1))} ({_text(m.group(2))})'
    return _text(li)


def _hours(raw):
    i = raw.find('mobile-table-wrap', raw.find('도서관 운영 시간</h5>'))  # 위쪽 '주요 서비스 안내'에도 같은 틀이 있다
    j = raw.find('b-btn-wrap', i)
    part = raw[i:j]
    rows = [['구분', '실명', '학기 중', '방학 중']]
    for box in re.split(r'(?i)<div class="tr-box">', part)[1:]:
        title = _text(re.search(r'(?is)<p class="table-title">(.*?)</p>', box).group(1))
        cols = {}
        for sub in re.finditer(r'(?is)<p class="table-sub-title">(.*?)</p>\s*<ul[^>]*>(.*?)</ul>\s*</li>', box):
            name = _text(sub.group(1))
            lis = re.findall(r'(?is)<li>(.*?)</li>', sub.group(2))
            cols[name] = (' · ' if name == '실명' else ' / ').join(_cell(x) for x in lis)
        rows.append([title, cols.get('실명', ''), cols.get('학기 중', ''), cols.get('방학 중', '')])
    return rows


def postprocess(key, page, raw):
    page['title'] = '중앙도서관'
    a = raw.find('홍익대학교 중앙도서관은')
    intro = _text(raw[a:raw.find('</p>', a)]) if a >= 0 else ''
    secs = []
    if intro:
        secs.append({'title': '중앙도서관', 'items': [intro], 'ordered': False})
    secs.append({'title': '도서관 운영 시간', 'items': [], 'ordered': False, 'table': _hours(raw)})
    page['sections'] = secs
    return page
