"""중앙도서관 홈페이지(honors.hongik.ac.kr) — 첫 화면만.

이 사이트 robots.txt 는 'Disallow: /' + 'Allow: /$' 라 첫 화면(/) 말고는 받지 않는다(대출/반납·상호대차·
공동학습실·노트북 대여·인쇄 안내 페이지, wp-json 모두 막혀 있음). 첫 화면에 펼쳐 있는 상시 안내 덩어리
(이용자별 대출 권수·기간, 시설 층별 안내, 연체료 납부, 교외접속, 자료구입신청)를 키마다 하나씩 잘라 옮긴다.
키마다 같은 첫 화면을 받으므로 URL 은 '#조각'만 다르다(조각은 서버로 가지 않는다).
첫 화면의 '이용시간' 상자는 학기·방학에 따라 바뀌고 머리가 실제 기간과 안 맞을 때가 있어 옮기지 않는다
(운영 시간은 학교 홈페이지 introduction_central-library-view 와 도서관 규정 제20조를 쓴다).
"""
import html, re

LABEL = '중앙도서관 홈페이지'
HOME = 'https://honors.hongik.ac.kr/'
PAGES = {
    'honors_loan': HOME + '#loan',          # 이용자별 안내(대출 권수·기간·예약·구입신청 권수) + My Library 메뉴
    'honors_floor': HOME + '#floor',        # 도서관 시설 안내(층별 실·소장자원)
    'honors_fine': HOME + '#fine',          # 연체료 온라인 납부 안내
    'honors_offcampus': HOME + '#offcampus',  # 교외접속 이용 방법
    'honors_purchase': HOME + '#purchase',  # 자료구입신청 서비스·신청 절차
    'honors_eresources': HOME + '#eresources',  # 주요 전자자료·전자책·이러닝·전자잡지(표절검사 포함)
    'honors_alumni': HOME + '#alumni',  # 졸업생/수료생: 이용신청 링크·메뉴 이름·교외접속 제한
    'honors_devices': HOME + '#devices',  # 전체메뉴 '시설 · 기기 이용'(공동학습실·열람실·노트북/기기대여·인쇄·복사·스캔 …) 메뉴 이름
}
CONTENT = {'tag': 'body'}

TITLES = {
    'honors_loan': '이용자별 안내',
    'honors_floor': '도서관 시설 안내',
    'honors_fine': '연체료 온라인 납부 안내',
    'honors_offcampus': '교외접속',
    'honors_purchase': '자료구입신청 서비스',
    'honors_eresources': '주요 전자자료 · 전자책·이러닝·전자잡지',
    'honors_alumni': '졸업생/수료생 이용 안내',
    'honors_devices': '시설 · 기기 이용',
}


def _text(fragment):
    s = re.sub(r'(?is)<(script|style|svg)\b.*?</\1>', '', fragment)
    s = re.sub(r'(?i)<br\s*/?>', ' ', s)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s)).replace('\xa0', ' ')).strip()


def _lines(fragment):
    s = re.sub(r'(?is)<(script|style|svg)\b.*?</\1>', '', fragment)
    s = re.sub(r'(?i)<br\s*/?>', ' ', s)
    s = re.sub(r'<[^>]+>', '\n', s)
    s = html.unescape(s).replace('\xa0', ' ')
    return [re.sub(r'\s+', ' ', x).strip() for x in s.split('\n') if x.strip()]


def _table(raw, marker):
    """marker 가 든 첫 <table> 을 rowspan 을 펼친 행 목록으로."""
    for m in re.finditer(r'(?is)<table\b.*?</table>', raw):
        if marker not in m.group(0):
            continue
        rows, carry = [], {}
        for tr in re.findall(r'(?is)<tr\b.*?</tr>', m.group(0)):
            row, col = [], 0
            cells = re.findall(r'(?is)<t([hd])\b([^>]*)>(.*?)</t[hd]>', tr)
            it = iter(cells)
            while True:
                if col in carry:
                    text, left = carry[col]
                    row.append(text)
                    carry[col] = (text, left - 1)
                    if left - 1 == 0:
                        del carry[col]
                    col += 1
                    continue
                try:
                    _, attrs, body = next(it)
                except StopIteration:
                    break
                text = _text(body)
                span = re.search(r'rowspan="(\d+)"', attrs)
                if span and int(span.group(1)) > 1:
                    carry[col] = (text, int(span.group(1)) - 1)
                row.append(text)
                col += 1
            rows.append(row)
        return rows
    return []


def _between(lines, start, end):
    """처음 나오는 start 줄 다음부터 end 줄 앞까지."""
    i = lines.index(start)
    j = lines.index(end, i + 1)
    return lines[i + 1:j]


def _loan_table(raw):
    t = _table(raw, '대출 권수')
    return [[c.replace('구 분', '구분').replace('교 원', '교원').replace('직 원', '직원').replace('비 고', '비고') for c in r] for r in t]


def postprocess(key, page, raw):
    lines = _lines(raw)
    page['title'] = TITLES[key]
    secs = []
    if key == 'honors_loan':
        secs.append({'title': '이용자별 안내', 'items': [], 'ordered': False, 'table': _loan_table(raw)})
        # 로그인 뒤 쓰는 My Library 메뉴 이름(첫 화면 전체메뉴에 있음).
        menu = _between(lines, 'My Library', '닫기')
        secs.append({'title': 'My Library 메뉴', 'items': [m for m in menu if m != '내 서재'], 'ordered': False})
    elif key == 'honors_floor':
        rows = _table(raw, '실 구분')
        q_note = [r[3] for r in rows[1:] if len(r) > 3 and r[3]]
        body = [['중앙도서관(H동)', '실 구분', '소장자원']] + [r[:3] for r in rows[1:]]
        secs.append({'title': '도서관 시설 안내', 'items': q_note, 'ordered': False, 'table': body})
    elif key == 'honors_fine':
        body = _between(lines, '연체료 온라인 납부 안내', '연체료 온라인 납부 희망')
        secs.append({'title': '연체료 온라인 납부 안내', 'items': body, 'ordered': False})
    elif key == 'honors_offcampus':
        body = _between(lines, '이용 방법', '주소 클립보드 복사')
        # '*' / '졸업생/퇴직자는' 처럼 끊긴 줄을 한 문장으로 잇는다.
        out = []
        for x in body:
            if out and (out[-1] in ('*',) or out[-1].endswith(('는', '앞에')) or x.startswith(('를 ', '교외접속 이용이'))):
                out[-1] = (out[-1] + ' ' + x).replace('* ', '※ ').strip()
            else:
                out.append(x)
        out = [re.sub(r'^1?\.?\s*(?=중앙도서관 홈페이지 로그인)', '1. ', o) for o in out]
        secs.append({'title': '교외접속 이용 방법', 'items': out, 'ordered': False})
    elif key == 'honors_purchase':
        body = _between(lines, '자료구입신청 서비스', '자료구입 신청 바로가기')
        i = body.index('신청 절차')
        intro, steps = body[:i], body[i + 1:]
        joined, cur = [], None
        for x in steps:
            if re.fullmatch(r'0\d', x):
                cur = [x]
                joined.append(cur)
            elif cur is not None:
                cur.append(x)
        secs.append({'title': '자료구입신청 서비스', 'items': intro, 'ordered': False})
        secs.append({'title': '신청 절차', 'items': [f"{c[0]} {c[1]}" + (f" — {' · '.join(c[2:])}" if len(c) > 2 else '') for c in joined], 'ordered': False})
        secs.append({'title': '이용자별 안내', 'items': [], 'ordered': False, 'table': _loan_table(raw)})
    elif key == 'honors_eresources':
        # 교외접속 상자 뒤 '주요 전자자료' / '전자책·이러닝·전자잡지' 카드: <h4> 이름 + 설명 줄.
        a = raw.find('주소 클립보드 복사')
        b = raw.find('전자책 오디오북 이러닝 전체보기', a)
        part = raw[a:b]
        group, rows = '주요 전자자료', {'주요 전자자료': [], '전자책·이러닝·전자잡지': []}
        heads = list(re.finditer(r'(?is)<h4[^>]*>(.*?)</h4>', part))
        for n, m in enumerate(heads):
            name = _text(m.group(1))
            if name in rows:  # 묶음 제목 카드
                group = name
                continue
            end = heads[n + 1].start() if n + 1 < len(heads) else len(part)
            desc = [x for x in _lines(part[m.end():end]) if x not in ('학술DB 전체보기',)]
            rows[group].append([name, ' '.join(desc)])
        for g, r in rows.items():
            if r:
                secs.append({'title': g, 'items': [], 'ordered': False, 'table': [['이름', '설명']] + r})
    elif key == 'honors_alumni':
        # 첫 화면 바닥글 링크('★ 졸업생/수료생 도서관 이용신청-클릭★'), 커뮤니티 메뉴 이름, 교외접속 상자의 졸업생 줄.
        foot = next((x for x in lines if '졸업생/수료생 도서관 이용신청' in x), '')
        items = []
        if foot:
            items.append(re.sub(r'^.*?(졸업생/수료생 도서관 이용신청).*$', r'\1', foot))
        menu = _between(lines, '도서관 안내 및 소식', '독서문화 프로그램')
        items += [f'커뮤니티 › {m}' for m in menu if m in ('이용자별 안내(졸업/수료생)', '열람증 신청/연장/환불')]
        secs.append({'title': '졸업생/수료생', 'items': items, 'ordered': False})
        off = next((x for x in postprocess('honors_offcampus', {'sections': []}, raw)['sections'][0]['items'] if '졸업생' in x), '')
        if off:
            secs.append({'title': '교외접속', 'items': [off], 'ordered': False})
    elif key == 'honors_devices':
        # 전체메뉴의 '시설 · 기기 이용' 묶음(첫 번째 것): 안내 문장 + '시설 이용 안내' / '기기 이용 안내' 메뉴 이름.
        i = lines.index('Facility·Device')
        j = lines.index('커뮤니티', i)
        body = lines[i + 1:j]
        a, b = body.index('시설 이용 안내'), body.index('기기 이용 안내')
        secs.append({'title': '시설 · 기기 이용', 'items': [x for x in body[:a] if not x.isascii()], 'ordered': False})
        secs.append({'title': '시설 이용 안내', 'items': body[a + 1:b], 'ordered': False})
        secs.append({'title': '기기 이용 안내', 'items': body[b + 1:], 'ordered': False})
        # 첫 화면 '도서관 시설 안내/예약' 상자의 바로가기와 My Library 신청 현황 메뉴.
        links = [x for x in lines if x in ('공동학습실 예약 바로가기', '일반열람실 이용 바로가기')]
        mine = [f'My Library › {m}' for m in _between(lines, 'My Library', '닫기') if m in ('시설/서비스 신청 현황', '공동학습실신청 현황')]
        secs.append({'title': '예약·신청 현황', 'items': list(dict.fromkeys(links)) + mine, 'ordered': False})
    page['sections'] = secs
    return page
