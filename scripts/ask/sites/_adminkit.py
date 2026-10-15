"""학사·행정(admin) 갈래 사이트 파일(hiweb·sso·itboard·schedule)이 함께 쓰는 정리 도구. 사이트가 아니다(PAGES 없음).

- reparse(raw, content): 페이지마다 본문 상자가 다를 때 extract.P 로 다시 읽는다.
- box_lines(raw) + notice_sections(lines): 게시글 본문(<p> 줄글)을 쓰인 차례대로 줄로 뽑아 '1. …' 번호 줄에서 덩어리로 나눈다.
- dept_sections(secs): 학교 홈페이지 부서 안내(행정기관·부속기관 상세)에서 공유 버튼 같은 군더더기를 뺀다.
"""
import html, re

JUNK = {'서울캠퍼스', '세종캠퍼스', '홈페이지', '대표홈페이지', '공유', '카카오 공유하기', '페이스북 공유하기', 'URL 복사', 'URL 공유하기',
        '목록', '프린터', '팝업 닫기', '뷰어'}


def reparse(raw, content):
    from extract import P  # extract.py 가 부르는 훅이라 이미 읽혀 있다
    p = P(content)
    p.feed(raw)
    p.end_text()
    out = []
    for s in p.sections:
        items = [i for i in s['items'] if i.strip() and i.strip() not in ('-', '·')]
        tab = s.get('table')
        if tab:
            w = max(len(r) for r in tab)
            tab = [r + [''] * (w - len(r)) for r in tab]
        if not items and not tab and not s['title']:
            continue
        out.append({'title': s['title'], 'items': items, 'ordered': s['ordered'], **({'table': tab} if tab else {})})
    return out


def box_lines(raw, start=r'<div class="fr-view[^"]*"[^>]*>'):
    """본문 상자 안의 글을 쓰인 차례대로 줄로 뽑는다(표 칸·줄바꿈도 줄 하나). 게시글 본문은 <p> 줄글이라 이 편이 정확하다."""
    m0 = re.search(start, raw)
    if not m0:
        return []
    i, start_len = m0.start(), len(m0.group(0))
    depth, j = 0, i
    for m in re.finditer(r'<(/?)div\b', raw[i:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            j = i + m.start()
            break
    body = raw[i + start_len:j]
    body = re.sub(r'<(script|style).*?</\1>', '', body, flags=re.S)
    body = re.sub(r'<br\s*/?>|</(p|li|td|th|tr|h\d)>', '\n', body)
    body = html.unescape(re.sub(r'<[^>]+>', '', body)).replace('\xa0', ' ')
    return [re.sub(r'\s+', ' ', x).strip() for x in body.split('\n') if x.strip()]


NUM_HEAD = re.compile(r'^(\d{1,2})\.\s*(?!\d)\S')


def notice_sections(lines, first_title='안내', drop=()):
    """번호 줄('1. 졸업가운 대여')을 덩어리 제목으로 삼아 나눈다. '1. 일 시 : …'처럼 내용이 붙은 번호 줄은 그대로 줄로 둔다.
    drop 에 든 낱말로 시작하는 줄은 뺀다."""
    out = [{'title': first_title, 'items': [], 'ordered': False}]
    for val in lines:
        if not val or val in JUNK or any(val.startswith(d) for d in drop):
            continue
        if NUM_HEAD.match(val) and ':' not in val and len(val) <= 40:
            out.append({'title': val, 'items': [], 'ordered': False})
        else:
            out[-1]['items'].append(val)
    return [s for s in out if s['items']]


def dept_sections(secs):
    """부서 안내: 위치·전화·업무시간 줄, 주요업무, 담당정보 표(전화 없는 칸은 뺀다)만 남긴다."""
    out = []
    for s in secs:
        if s['title'] in ('연혁',):
            continue  # 부서 연혁 표는 학생 질문과 상관없다
        if s['title'] == '담당정보':
            s = {**s, 'items': []}  # 표와 같은 내용을 모바일용으로 한 번 더 적은 줄
        items = [i.strip() for i in s['items'] if i.strip() and i.strip() not in JUNK and not i.strip().startswith('02-')]
        if s['title'] == '':
            items = [i for i in items if re.match(r'^(위치|전화|팩스|이메일|\d{2}:\d{2})', i)]
            title = '부서 정보'
        else:
            title = s['title']
        tab = s.get('table')
        if tab:
            tab = [tab[0]] + [r for r in tab[1:] if r[0].strip() and r[-1].strip().strip('.')]
            items = [i for i in items if not any(i == c for r in tab for c in r)]
        if items or (tab and len(tab) > 1):
            out.append({'title': title, 'items': items, 'ordered': False, **({'table': tab} if tab and len(tab) > 1 else {})})
    return out
