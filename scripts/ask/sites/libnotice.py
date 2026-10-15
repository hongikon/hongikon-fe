"""학교 홈페이지 공지사항에 실린 중앙도서관(열람팀·수서팀)의 상시 안내 글.

학기마다 바뀌는 운영시간·시험기간 안내(그림 한 장으로만 올라옴)나 행사 공지는 옮기지 않는다. 날짜와 상관없이
그대로 쓰는 문제 해결 안내만 둔다. 글 본문(div.fr-view)의 문단을 줄 단위로 옮기고, 담당자 개인 메일 주소는 뺀다.
"""
import html, re

LABEL = '학교 홈페이지 공지사항'
B = 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view'
PAGES = {
    'libnotice_macproxy': f'{B}&articleNo=149816',  # [중앙도서관] MacOS 환경 교외접속 시 로그인 풀림 현상 조치 방법 안내
    'libnotice_completion': f'{B}&articleNo=149661',  # (연구생 필독) 수료생 도서관 이용 안내 — 학기와 무관한 상시 안내(본문 글)
}
CONTENT = {'tag': 'body'}
TITLES = {'libnotice_macproxy': 'MacOS 환경 교외접속 시 로그인 풀림 현상 조치 방법',
          'libnotice_completion': '수료생 도서관 이용 안내'}
EMAIL = re.compile(r'\s*/?\s*[\w.+-]+@[\w-]+(\.[\w-]+)+')


def _lines(raw):
    i = raw.find('>', raw.find('class="fr-view"')) + 1
    j = raw.find('b-pager-box', i)
    s = raw[i:j]
    s = re.sub(r'(?is)<(script|style)\b.*?</\1>', '', s)
    s = re.sub(r'(?i)<br\s*/?>|</p>|</div>|</li>', '\n', s)
    s = html.unescape(re.sub(r'<[^>]+>', '', s)).replace('\xa0', ' ')
    out = [re.sub(r'\s+', ' ', x).strip() for x in s.split('\n')]
    return [x.replace('**', '') for x in out if x and not x.startswith(('<div', 'class='))]


def _completion(lines):
    """수료생 안내: 머리글 · [유의사항] · ※ 무효수료생 이용 세 덩어리로. '바로가기' 링크 글자는 뺀다."""
    lines = [x.replace('(바로가기)', '').strip() for x in lines if not x.startswith('▶')]
    head, notes, expired = [], [], []
    cur = head
    for x in lines:
        if x.startswith('[유의사항]'):
            cur = notes
            continue
        if x.startswith('※ [논문제출기한'):
            m = re.match(r'※\s*\[([^\]]+)\]\s*-?\s*(.*)', x)
            expired.append(m.group(2).strip())
            cur = expired
            continue
        cur.append(x)
    return [
        {'title': '수료생 도서관 이용 신청', 'items': head, 'ordered': False},
        {'title': '유의사항', 'items': notes, 'ordered': False},
        {'title': '논문제출기한이 경과한 수료생(무효수료생) 도서관 이용', 'items': expired, 'ordered': False},
    ]


def postprocess(key, page, raw):
    lines = _lines(raw)
    page['title'] = TITLES[key]
    if key == 'libnotice_completion':
        page['sections'] = _completion(lines)
        return page
    secs, cur = [], {'title': '', 'items': [], 'ordered': False}
    for x in lines:
        if re.match(r'^\d\.\s*\S', x) or re.fullmatch(r'\d\.', x):
            cur = {'title': EMAIL.sub('', x).strip(), 'items': [], 'ordered': False}
            secs.append(cur)
            continue
        if cur['title'] and re.fullmatch(r'\d\.', cur['title']):
            cur['title'] += ' ' + x  # '4.' 다음 줄에 제목이 오는 경우
            continue
        x = EMAIL.sub('', x).strip()
        if x:
            if not secs:
                secs.append(cur)
            cur['items'].append(x)
    for s in secs:  # '조치 방법' 다음 줄의 ': …' 를 붙인다
        out = []
        for it in s['items']:
            if out and (it.startswith(':') or out[-1].endswith(':') or out[-1] in ('조치 방법', '조치방법')):
                out[-1] = (out[-1].rstrip(':').rstrip() + ': ' + it.lstrip(':').strip()).strip()
            else:
                out.append(it)
        s['items'] = out
    page['sections'] = secs
    return page
