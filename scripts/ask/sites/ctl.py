"""교수학습지원센터(서울) 홈페이지(ctl1.hongik.ac.kr). 학생용 상시 안내 메뉴만 옮긴다.

옮기지 않는 것: 공지사항(0201~0203, 학기마다 바뀌는 모집 공지), 교수지원(05xx, 교원용), 자료실(0307·0406·0604·0703, 글 없음),
매체지원 동영상(0603). 세종 센터(inno.hongik.ac.kr/ctl2)는 세종캠퍼스라 받지 않는다.
"""
import html, re

LABEL = '교수학습지원센터 홈페이지'
B = 'https://ctl1.hongik.ac.kr/ctl1'
PAGES = {
    'ctl_about': f'{B}/0102.do',          # 센터 소개
    'ctl_staff': f'{B}/0103.do',          # 센터 구성(담당 업무·연락처)
    'ctl_location': f'{B}/0104.do',       # 찾아오시는 길(Q동 213호)
    'ctl_learning': f'{B}/0301.do',       # 학습지원 안내(프로그램 표)
    'ctl_tutoring': f'{B}/0302.do',       # 학습튜터링·홍익투게더·유학생 튜터링
    'ctl_club': f'{B}/0303.do',           # 자기주도학습동아리
    'ctl_workshop': f'{B}/0304.do',       # 학습법 워크숍
    'ctl_studygroup': f'{B}/0305.do',     # 스터디 그룹
    'ctl_master': f'{B}/0306.do',         # 홍익전공마스터
    'ctl_communication': f'{B}/0401.do',  # 소통역량지원 안내(글쓰기·English Contest·포트폴리오)
    'ctl_hitouch': f'{B}/0402.do',        # 유학생 학습멘토링(HI-TOUCH)
    'ctl_clinic': f'{B}/0403.do',         # 글쓰기 클리닉
    'ctl_contest': f'{B}/0404.do',        # 논리적 글쓰기 대회(서평·에세이)
    'ctl_writing': f'{B}/0405.do',        # 글쓰기 워크숍
    'ctl_media': f'{B}/0601.do',          # 교육매체지원 안내
    'ctl_equipment': f'{B}/0602.do',      # 기자재 대여 절차·품목
    'ctl_elearning': f'{B}/0701.do',      # 이러닝지원 안내
}
CONTENT = {'id': 'cms-content'}


def _text(fragment):
    s = re.sub(r'(?i)<br\s*/?>', ' ', fragment)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s)).replace('\xa0', ' ')).strip()


def _menu_title(raw):
    m = re.search(r'<title>(.*?)</title>', raw, re.S)
    parts = [p.strip() for p in html.unescape(m.group(1)).split('|')] if m else []
    return parts[1] if len(parts) > 1 else (parts[0] if parts else '')


def _tutoring(raw):
    """'· 프로그램명 : 설명' 줄 바로 뒤 표가 그 프로그램 표다. 기본 추출은 표와 이름이 한 칸씩 밀려 직접 짝짓는다."""
    body = raw[raw.find('id="cms-content"'):]
    secs = []
    first = re.search(r'(?is)<p[^>]*>(.*?)</p>', body)
    for m in re.finditer(r'(?is)<li class="con-p">(.*?)</li>\s*<table\b(.*?)</table>', body):
        name = _text(m.group(1)).lstrip('· ').strip()
        title, _, desc = name.partition(':')
        rows = [[_text(c) for c in re.findall(r'(?is)<t[hd][^>]*>(.*?)</t[hd]>', tr)] for tr in re.findall(r'(?is)<tr\b.*?</tr>', m.group(2))]
        secs.append({'title': title.strip(), 'items': [desc.strip()] if desc.strip() else [], 'ordered': False,
                     'table': [r for r in rows if any(r)]})
    return secs, (_text(first.group(1)) if first else '')


def _table_rows(fragment):
    """<table> 하나 → rowspan 을 펼친 행 목록."""
    rows, carry = [], {}
    for tr in re.findall(r'(?is)<tr\b.*?</tr>', fragment):
        row, col = [], 0
        it = iter(re.findall(r'(?is)<t[hd]\b([^>]*)>(.*?)</t[hd]>', tr))
        while True:
            if col in carry:
                text, left = carry[col]
                row.append(text)
                if left <= 1:
                    del carry[col]
                else:
                    carry[col] = (text, left - 1)
                col += 1
                continue
            try:
                attrs, body = next(it)
            except StopIteration:
                break
            text = _text(body)
            span = re.search(r'rowspan="?(\d+)', attrs)
            if span and int(span.group(1)) > 1:
                carry[col] = (text, int(span.group(1)) - 1)
            row.append(text)
            col += 1
        if any(row):
            rows.append(row)
    return rows


def postprocess(key, page, raw):
    page['title'] = _menu_title(raw)
    secs = page['sections']
    if key == 'ctl_tutoring':
        progs, _ = _tutoring(raw)
        intro = [s for s in secs if not s['title']][:1]
        contact = [s for s in secs if s['title'] == '[문의처]']
        secs = intro + progs + contact
    elif key == 'ctl_staff':
        # 같은 내용을 모바일용 목록으로 한 번 더 적은 덩어리(표 없는 둘째 '인력 및 담당 업무')는 뺀다.
        secs = [s for s in secs if s.get('table') or s['title'] != '교수학습센터 인력 및 담당 업무']
        secs = [s for s in secs if s.get('table') or s['items']]
    elif key == 'ctl_communication':
        # 표의 '주요 추진 내용' 칸이 비어 있고, 그 내용(신청시기·신청대상·운영내용…)은 표 위 목록에 프로그램 순서대로 따로 있다
        # → '신청시기'로 시작하는 묶음마다 끊어 표 셋째 칸에 순서대로 넣는다.
        for s in secs:
            if s['title'] == '소통역량지원 프로그램 안내' and s.get('table'):
                groups = []
                for it in s['items']:
                    if it.strip().startswith('신청시기'):
                        groups.append([])
                    if groups:
                        groups[-1].append(it.strip())
                rows = s['table'][1:]
                if len(groups) == len(rows):
                    for r, g in zip(rows, groups):
                        text = ' · '.join(g).replace(': · ', ': ')
                        r[2:] = [text]
                    s['items'] = []
    elif key == 'ctl_contest':
        # '[서평 쓰기 대회]' / '[에세이 쓰기 대회]' 제목 아래 '1. 대회 개요' … 가 붙는다 → 소제목 앞에 대회 이름을 붙인다.
        out, group = [], ''
        for s in secs:
            if s['title'] in ('[서평 쓰기 대회]', '[에세이 쓰기 대회]'):
                group = s['title'].strip('[]')
                continue
            if s['title'] == '[논리적 글쓰기 대회]':
                continue
            if group and re.match(r'\d\. ', s['title']):
                s = {**s, 'title': f"{group} · {s['title']}"}
            out.append(s)
        secs = out
    elif key == 'ctl_writing':
        # 끝에 붙은 빈 템플릿('종류 1 : 2 : 3 :')과 그 뒤 중복 문의처는 뺀다.
        cut = next((i for i, s in enumerate(secs) if s['title'] == '종류'), None)
        if cut is not None:
            secs = secs[:cut]
    elif key == 'ctl_clinic':
        # 표의 '신청방법' 칸은 목록이 밖으로 빠져 비어 있다 → 빈 칸 줄은 빼고 단계 목록을 그대로 둔다.
        for s in secs:
            if s.get('table'):
                # '지도교수' 줄은 교수 개인 이름 목록이라 옮기지 않는다.
                s['table'] = [r for r in s['table'] if all(c.strip() for c in r) and r[0] != '지도교수']
    elif key == 'ctl_equipment':
        # 품목을 표와 목록으로 두 번 적었다 → 표만 둔다. 표는 '구 분' 칸을 여러 줄로 합쳐 둬서 펼쳐 다시 읽는다.
        body = raw[raw.find('id="cms-content"'):]
        tab = next((m.group(0) for m in re.finditer(r'(?is)<table\b.*?</table>', body) if '모델명' in m.group(0)), '')
        for s in secs:
            if s.get('table'):
                if tab:
                    s['table'] = [[c.replace('구 분', '구분').replace('앰 프', '앰프').replace('웹 캠', '웹캠') for c in r] for r in _table_rows(tab)]
                s['items'] = [i for i in s['items'] if not i.startswith(' ') and i not in (
                    '기자재 품목', '프로젝터', '디지털 캠코더', '비디오 캡쳐보드', '웹캠', '앰프', '마이크', '프리젠터(포인터)')]
    elif key == 'ctl_media':
        # 업무 목록을 두 번(평면·묶음) 적었다 → 묶음만 둔다.
        for s in secs:
            if s['title'] == '교육매체지원 업무':
                i = next((n for n, it in enumerate(s['items']) if it.startswith('강의실 시청각기자재')), 0)
                s['items'] = s['items'][i:]
    if key == 'ctl_equipment':
        for s in secs:  # 'ㆍ대여를 원하는 … ㆍ물품의 …' 한 줄을 점마다 끊는다.
            s['items'] = [x.strip() for i in s['items'] for x in i.split('ㆍ') if x.strip()]
    for s in secs:
        # '신청대상 | 홍익대학교 재학생…' 같은 2칸 이름표 표는 머리줄이 없어 첫 줄이 표 머리로 보인다 → '이름: 값' 줄로 푼다.
        t = s.get('table')
        if t and all(len(r) == 2 for r in t) and len(t[0][1]) > 15:
            s['items'] = s['items'] + [f'{a}: {b}' for a, b in t if a and b]
            del s['table']
    secs = [s for s in secs if s['items'] or s.get('table')]
    page['sections'] = secs
    return page
