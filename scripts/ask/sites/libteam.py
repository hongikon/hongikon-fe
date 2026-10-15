"""학교 홈페이지 '부속기관' 게시판의 중앙도서관 열람팀·수서팀 글(위치·전화·근무시간·주요업무·담당정보 표)과
서울캠퍼스 중앙도서관·법학도서관 글(위치·대표전화·개관시간, 법학도서관 '주말 휴무').

중앙도서관 홈페이지 안내 페이지는 robots.txt 로 막혀 있어, 상호대차·원문복사·열람증 발급·자료 구입 같은 서비스의
담당 전화는 이 글의 '담당정보'(연락처·담당) 표를 옮긴다. 담당자 성명은 옮기지 않는다(중앙도서관 글 표의 '사무보조 성명' 칸은 번호 앞 칸이라 건너뛴다).
본문 틀(span 묶음)이 표준 구조가 아니라 줄 단위로 읽어 다시 짠다. 숨겨진 견본 덩어리('회계/후생복지 02-000-0000 …')는 뺀다.
"""
import html, re

LABEL = '학교 홈페이지 부속기관 안내'
B = 'https://www.hongik.ac.kr/kr/introduction/subsidiary.do?mode=view'
PAGES = {
    'libteam_service': f'{B}&articleNo=79411&dept=AC1262',  # 중앙도서관 열람팀
    'libteam_acq': f'{B}&articleNo=79410&dept=AC1261',      # 중앙도서관 수서팀
    'libteam_central': f'{B}&articleNo=78377&dept=AC1260',  # 서울캠퍼스 중앙도서관(위치·대표전화·개관시간)
    'libteam_law': f'{B}&articleNo=89236&dept=AC1200',      # 법학도서관(위치·전화·열람시간·주말 휴무)
}
CONTENT = {'tag': 'body'}
TITLES = {'libteam_service': '중앙도서관 열람팀', 'libteam_acq': '중앙도서관 수서팀',
          'libteam_central': '서울캠퍼스 중앙도서관', 'libteam_law': '법학도서관'}
PHONE = re.compile(r'^0\d{1,2}-\d{3,4}-\d{4}$')


def _lines(fragment):
    s = re.sub(r'(?is)<(script|style|svg)\b.*?</\1>', '', fragment)
    s = re.sub(r'(?s)<!--.*?-->', '', s)
    s = re.sub(r'<[^>]+>', '\n', s)
    s = html.unescape(s).replace('\xa0', ' ')
    return [re.sub(r'\s+', ' ', x).strip() for x in s.split('\n') if x.strip()]


def postprocess(key, page, raw):
    lines = _lines(raw)
    page['title'] = TITLES[key]
    secs = []
    try:
        i = lines.index('URL 복사')
        j = lines.index('주요업무', i)
    except ValueError:
        page['sections'] = []
        return page
    head = lines[i + 1:j]
    # '전화 :' 다음 번호들이 ',02-…' 로 끊겨 있다 → 한 줄로 잇는다.
    info, phones = [], []
    for x in head:
        x = x.lstrip(',').strip()
        if PHONE.match(x):
            phones.append(x)
        elif x != '전화 :':
            info.append(x)
    if phones:
        info.insert(1 if info and info[0].startswith('위치') else 0, '전화 : ' + ', '.join(phones))
    secs.append({'title': '위치·연락처·근무시간', 'items': info, 'ordered': False})
    # 실제 '주요업무' 문단은 견본('회계/후생복지 …') 뒤 두 번째 '주요업무' 다음 줄이다.
    k = [n for n, x in enumerate(lines) if x == '주요업무']
    duty = lines[k[-1] + 1] if k else ''
    if duty:
        secs.append({'title': '주요업무', 'items': [duty], 'ordered': False})
    try:
        t0 = lines.index('담당', lines.index('담당정보'))
        t1 = lines.index('목록', t0)
    except ValueError:
        t0 = t1 = None
    if t0 is not None:
        cells, rows, seen = lines[t0 + 1:t1], [['연락처', '담당']], set()
        # 번호 다음 칸이 담당이다. 번호 앞의 직위·성명 칸(중앙도서관 글의 '사무보조 …')은 옮기지 않는다(개인정보).
        for n in range(len(cells) - 1):
            tel, what = cells[n], cells[n + 1]
            if PHONE.match(tel) and not PHONE.match(what) and (tel, what) not in seen:  # PC·모바일용으로 같은 표가 두 번 있다
                seen.add((tel, what))
                rows.append([tel, what])
        if len(rows) > 1:
            secs.append({'title': '담당정보', 'items': [], 'ordered': False, 'table': rows})
    page['sections'] = secs
    return page
