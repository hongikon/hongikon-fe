"""2026 교과과정책자(PDF) 학과 교과과정 표 → 과목 DB(data/courses.json) + 검사 보고(data/courses-report.json).

계획: docs/ask-course-db-plan.md 2-1. 책자: cache/curriculum/curr.pdf(sites/curriculum.py 가 받는다).
준비: pip install pdfplumber. 사용: python3 -I scripts/ask/courses/extract.py

표 모양(11-10 확인): 머리 '이수구분 | 교 과 목 | 학수번호 | 1 학 기(학점·시수) | 학수번호 | 2 학 기(학점·시수) | 비고'.
- 한 칸에 여러 과목이 줄바꿈으로 들어 있다. 학기 학점 칸이 과목 줄 수의 기준이다('-'는 그 학기에 없음).
- 학수번호 칸에는 그 학기에 있는 과목의 번호만 차례로 있다. '부학기'는 번호 대신(다른 학기 번호를 함께 씀).
- 한 줄에 두 과목('대학물리(1), 대학물리실험(1)' ↔ '012101,012103' ↔ '3,1').
- 과목명이 길면 다음 줄로 넘어간다('논리적사고와글쓰기(공학),' + '공학글쓰기 중 택1') — 학점 줄 수에 맞춰 붙인다.
- 표 아래 학기 합계 행(이름 칸이 비고 학점만 있음)으로 검산한다. 안 맞으면 보고서에 남기고 사람이 PDF 쪽을 본다.
학과·학년은 표 바로 위 '○○학과 N학년' 줄에서 읽는다.
이수구분은 위아래로 합쳐진 칸 — 그 칸을 가로지르는 가로줄 사이(category_blocks)에 이름 줄이 있는 과목에 붙인다.
category 는 정규 이름(전공필수·전공선택·전공기초·MSC·교양·교양필수·교양선택·일반선택·교직·특성화교양), categoryDetail 은 영역(과학·핵심교양 …), categoryRaw 는 책자 글자.
"""
import json
import os
import re
import sys

import pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
ASK = os.path.dirname(HERE)
PDF = os.path.join(ASK, 'cache', 'curriculum', 'curr.pdf')
if not os.path.exists(PDF):
    PDF = os.path.join(ASK, '..', '..', '..', '..', 'hongikon-fe', 'scripts', 'ask', 'cache', 'curriculum', 'curr.pdf')
OUT = os.path.join(ASK, 'data', 'courses.json')
REPORT = os.path.join(ASK, 'data', 'courses-report.json')

GRADE_LINE = re.compile(r'^(?P<dept>\S.*?(?:학과|학부|전공|과정|대학))\s*(?P<grade>[1-5])\s*학년')
CODE = re.compile(r'^\d{6}$')
NUM = re.compile(r'^\d+(?:\.\d+)?$')
# 187쪽 'AID융합과학기술대학(구. 과학기술대학)'부터 끝까지가 세종캠퍼스 학과(상경·광고홍보·디자인컨버전스·게임 포함, 11-10 확인).
SEJONG_FROM_PAGE = 187


def squash(s):
    return re.sub(r'\s+', '', s or '')


def lines(cell):
    return [x.strip() for x in (cell or '').split('\n') if x.strip()]


def header_columns(rows):
    """머리 줄에서 칸 번호: 이름·학수1·학점1·시수1·학수2·학점2·시수2·개설학과·구분."""
    head = [squash(c) for c in rows[0]]
    try:
        t1 = next(i for i, c in enumerate(head) if c.startswith('1학기'))
        t2 = next(i for i, c in enumerate(head) if c.startswith('2학기'))
    except StopIteration:
        return None
    codes = [i for i, c in enumerate(head) if c.startswith('학수')]
    c1 = max([i for i in codes if i < t1], default=None)
    c2 = max([i for i in codes if t1 < i < t2], default=None)
    name = next((i for i, c in enumerate(head) if '교과목' in c or c == '과목명'), None)
    if None in (c1, c2, name):
        return None
    # 이름 칸과 학수 칸 사이에 칸이 하나 더 있으면 '개설 학과' 칸(융합전공), 구분 칸은 이름 앞.
    extra = name + 1 if name + 1 < c1 else None
    category = 0 if name > 0 else None
    sub = 1 if name > 1 else None
    return dict(name=name, c1=c1, cr1=t1, h1=t1 + 1, c2=c2, cr2=t2, h2=t2 + 1, extra=extra, category=category, sub=sub)


def cell_lines(page, bbox):
    """칸 안의 글자 줄과 세로 위치(top). 줄바꿈 순서 대신 위치로 맞춘다(pdfplumber 가 칸 글자에서 '-' 줄을 빠뜨리는 일이 있다)."""
    if not bbox:
        return []
    x0, top, x1, bottom = bbox
    try:
        crop = page.crop((x0 + 0.5, top + 0.5, x1 - 0.5, bottom - 0.5))
    except ValueError:
        return []
    return [(l['top'], l['text'].strip()) for l in crop.extract_text_lines() if l['text'].strip()]


def align(name_lines, other, tol=4.0):
    """다른 칸 줄(top, text)을 가장 가까운 과목명 줄에 붙인다. 가까운 줄이 없으면(두 줄 이름 가운데 찍힌 학점)
    아직 비어 있는 가장 가까운 줄에 붙인다."""
    out = [None] * len(name_lines)
    left = []
    for top, text in other:
        best = min(range(len(name_lines)), key=lambda i: abs(name_lines[i][0] - top), default=None)
        if best is not None and abs(name_lines[best][0] - top) <= tol and out[best] is None:
            out[best] = text
        else:
            left.append((top, text))
    for top, text in left:
        free = [i for i in range(len(name_lines)) if out[i] is None]
        if free:
            out[min(free, key=lambda i: abs(name_lines[i][0] - top))] = text
    return out


def split_pairs(name, credits, hours, codes):
    """'대학물리(1), 대학물리실험(1)' + 학점 '3,1' + 번호 '012101,012103' → 과목 두 개."""
    names = [x.strip() for x in name.split(',') if x.strip()]
    code_list = [c for c in re.split(r'[,\s]+', codes or '') if CODE.match(c)]
    if len(names) > 1 and len(code_list) == len(names):
        crs = credits.split(',')
        hrs = (hours or '').split(',')
        return [(n, crs[i] if i < len(crs) else crs[-1], hrs[i] if i < len(hrs) else '', code_list[i]) for i, n in enumerate(names)]
    return [(name, credits, hours, code_list[0] if code_list else None)]


def category_blocks(page, table, words, x0, x1):
    """이수구분 칸(x0~x1)을 가로줄로 나눈 덩어리 [(위, 아래, 글자)].

    이수구분 칸은 위아래로 합쳐진 칸이고 표 왼쪽 테두리가 없어 pdfplumber 가 칸을 못 잡는다(None, 11-12 확인: 99쪽).
    대신 그 칸을 가로지르는 가로줄이 합쳐진 칸의 실제 경계다 — 줄과 줄 사이 글자가 그 덩어리의 이수구분이고,
    그 사이에 이름 줄이 있는 과목만 그 이수구분을 받는다(다음 경계에서 끊기니 '과학'이 전공 과목으로 번지지 않는다)."""
    top, bottom = table.bbox[1], table.bbox[3]
    xm = (x0 + x1) / 2
    cuts = sorted({round(e['top'], 1) for e in page.edges
                   if e['orientation'] == 'h' and e['x0'] <= xm <= e['x1'] and top - 1 <= e['top'] <= bottom + 1}
                  | {round(top, 1), round(bottom, 1)})
    out = []
    for lo, hi in zip(cuts, cuts[1:]):
        if hi - lo < 2:
            continue
        inside = sorted((w for w in words if x0 - 1 <= w['x0'] < x1 - 1 and lo - 1 <= w['top'] < hi - 1),
                        key=lambda w: (round(w['top']), w['x0']))
        out.append((lo, hi, ''.join(w['text'] for w in inside)))
    return out


def pick_label(block, written):
    """덩어리 글자와 그 행 칸에 적힌 글자 중 더 온전한 쪽(글자 하나가 경계에 걸려 '일반'만 잡힌 때, 11-12)."""
    if written and (not block or (written != block and written.startswith(block))):
        return written
    return block


def block_label(blocks, y):
    return next((label for lo, hi, label in blocks if lo - 1 <= y < hi - 1), '')


# 이수구분 원문(raw) → 정규 이름. 원문 표기가 학과마다 다르다(전공필수·전필·필수, 기본소양·핵심교양 …).
CATEGORY_RULES = [
    (re.compile(r'^(전공)?필수$|^전필$|^전공필수'), '전공필수'),
    (re.compile(r'^(전공)?선택$|^전선$|^전공선택'), '전공선택'),
    (re.compile(r'^전공기초'), '전공기초'),
    (re.compile(r'^(교양필수|교필)|소양교양필수$'), '교양필수'),
    (re.compile(r'^(교양선택|교선)'), '교양선택'),
    (re.compile(r'^일반선택|^일선|^일반이수'), '일반선택'),
    (re.compile(r'MSC|^(수학|과학|전산|통계)(영역)?$'), 'MSC'),
    (re.compile(r'특성화교양'), '특성화교양'),
    (re.compile(r'^교직'), '교직'),
    (re.compile(r'교양|기본소양'), '교양'),
]


AREA = re.compile(r'영역|교양|수학|과학|전산|통계|MSC')


def normalize_category(main, sub):
    """(큰 칸, 작은 칸) 원문 → (정규 이수구분, 세부). 세부는 교양 영역(핵심교양·과학 …)."""
    raw = '·'.join(x for x in (main, sub) if x)
    if not raw:
        return None, None
    for cand in (main + sub, sub, main, raw):
        for rule, name in CATEGORY_RULES:
            if cand and rule.search(cand):
                # 세부는 영역 이름만(세로 글자가 두 칸에 걸친 '전선·공택' 같은 조각은 버린다).
                detail = sub if sub and sub != name and AREA.search(sub) else None
                return name, detail
    return None, None


def credit_sum(value):
    return sum(float(x) for x in str(value).split(',') if NUM.match(x.strip()))


def main():
    pdf = pdfplumber.open(PDF)
    courses, problems, tables_seen = [], [], 0
    for page_no, page in enumerate(pdf.pages, start=1):
        text_lines = page.extract_text_lines()
        grade_lines = [(w['top'], m) for w in text_lines if (m := GRADE_LINE.match(w['text'].strip()))]
        page_words = page.extract_words()
        for table in page.find_tables():
            rows = table.extract()
            if not rows or len(rows) < 3:
                continue
            cols = header_columns(rows)
            if not cols:
                continue
            above = [m for top, m in grade_lines if top < table.bbox[1]]
            if not above:
                continue
            dept, grade = above[-1].group('dept').strip(), int(above[-1].group('grade'))
            tables_seen += 1
            sums = {1: 0.0, 2: 0.0}
            table_start = len(courses)
            totals = None
            category = sub = ''
            col_x = [c.bbox[0] for c in table.columns]
            main_blocks = sub_blocks = []
            if cols['category'] is not None:
                main_end = col_x[cols['sub']] if cols['sub'] is not None else col_x[cols['name']]
                main_blocks = category_blocks(page, table, page_words, table.bbox[0], main_end)
                if cols['sub'] is not None:
                    sub_blocks = category_blocks(page, table, page_words, col_x[cols['sub']], col_x[cols['name']])
            for r_index, row in enumerate(rows[2:], start=2):
                cells = table.rows[r_index].cells

                def cell(i):
                    return (row[i] if i is not None and i < len(row) else '') or ''

                def bbox(i):
                    return cells[i] if i is not None and i < len(cells) else None
                # 그 행에 적힌 이수구분(덩어리 글자가 없을 때만 쓴다 — 실제 값은 category_blocks 의 합쳐진 칸 범위로, 11-12).
                category = squash(cell(cols['category']))
                sub = squash(cell(cols['sub'])) if cols['sub'] is not None else ''
                if not cell(cols['name']).strip():
                    cr1, cr2 = lines(cell(cols['cr1'])), lines(cell(cols['cr2']))
                    if any(NUM.match(x) for x in cr1 + cr2) and totals is None:
                        totals = (cr1[0] if cr1 else '0', cr2[0] if cr2 else '0')
                    continue
                names = cell_lines(page, bbox(cols['name']))
                cols_text = {k: align(names, cell_lines(page, bbox(cols[k]))) for k in ('cr1', 'h1', 'cr2', 'h2')}
                cols_text['c1'] = [None] * len(names)
                cols_text['c2'] = [None] * len(names)
                offered = align(names, cell_lines(page, bbox(cols['extra']))) if cols['extra'] is not None else [None] * len(names)
                # 학점 칸이 두 학기 모두 비어 있는 줄은 앞 과목명이 넘어온 줄 — 앞에 붙인다.
                merged = []
                for i, (top, text) in enumerate(names):
                    row_vals = {k: v[i] for k, v in cols_text.items()}
                    # 'A,' 다음 줄 'B 중 택1' 처럼 쉼표로 끝난 줄도 한 과목 묶음(택1)이다 — 학점은 한 번만 센다.
                    if merged and (merged[-1]['name'].endswith(',') or text.startswith('*반드시') or text.startswith('※')
                                   or (row_vals['cr1'] is None and row_vals['cr2'] is None)):
                        # '*반드시 하단 주석…' 같은 안내 줄은 과목이 아니다 — 학점이 그 줄에 찍혔으면 앞 과목 것으로 옮긴다.
                        for k in ('cr1', 'h1', 'cr2', 'h2'):
                            if row_vals[k] and not merged[-1][k]:
                                merged[-1][k] = row_vals[k]
                        prev = merged[-1]
                        prev['name'] += ('' if prev['name'].endswith(('(', '·')) else ' ') + text
                        for k in ('c1', 'c2'):
                            if row_vals[k] and prev[k] and row_vals[k] != prev[k]:
                                prev[k] = prev[k].rstrip(',') + ',' + row_vals[k]
                            elif row_vals[k] and not prev[k]:
                                prev[k] = row_vals[k]
                        continue
                    merged.append(dict(name=text, offered=offered[i], top=top, **row_vals))
                # 학수번호 칸은 그 학기에 있는 과목 번호만 차례로 적혀 있다 — 위치 대신 차례로 붙인다('부학기'도 한 자리).
                for term in (1, 2):
                    code_lines = [t for _, t in cell_lines(page, bbox(cols[f'c{term}']))]
                    joined = []
                    for t in code_lines:  # '001012,' 다음 줄 '001020' 처럼 쉼표로 끝나면 한 자리
                        if joined and joined[-1].endswith(','):
                            joined[-1] += t
                        else:
                            joined.append(t)
                    offered = [it for it in merged if it[f'cr{term}'] and it[f'cr{term}'] not in ('-', '–')]
                    if len(joined) == len(offered):
                        for it, code in zip(offered, joined):
                            it[f'c{term}'] = code
                    else:  # 학점 줄이 빠진 표 — 차례가 어긋나니 위치로 붙인다
                        by_pos = align([(it['top'], it['name']) for it in merged], cell_lines(page, bbox(cols[f'c{term}'])))
                        for it, code in zip(merged, by_pos):
                            it[f'c{term}'] = code
                for item in merged:
                    # 이 과목 이름 줄이 들어 있는 합쳐진 칸의 글자(없으면 그 행에 적힌 글자).
                    raw_main = pick_label(block_label(main_blocks, item['top']), category)
                    raw_sub = pick_label(block_label(sub_blocks, item['top']), sub)
                    cat_name, cat_detail = normalize_category(raw_main, raw_sub)
                    cat_raw = '·'.join(x for x in (raw_main, raw_sub) if x) or None
                    for term in (1, 2):
                        cr, hr, code = item[f'cr{term}'], item[f'h{term}'], item[f'c{term}']
                        if not cr or cr in ('-', '–'):
                            continue
                        sums[term] += credit_sum(cr)
                        for one_name, one_cr, one_hr, one_code in split_pairs(item['name'], cr, hr, code):
                            courses.append(dict(
                                code=one_code, name=re.sub(r'\s+', ' ', one_name).strip(), dept=dept, grade=grade, term=term,
                                credits=one_cr, hours=one_hr,
                                category=cat_name, categoryDetail=cat_detail, categoryRaw=cat_raw,
                                offeredBy=item['offered'], choice='택' in one_name, borrowed=(code or '') == '부학기',
                                campus='세종' if page_no >= SEJONG_FROM_PAGE else '서울',
                                src=f'2026 교과과정책자 PDF {page_no}쪽'))
            bad_terms = set()
            if totals:
                for term, want in ((1, totals[0]), (2, totals[1])):
                    if NUM.match(want) and abs(float(want) - sums[term]) > 0.01:
                        bad_terms.add(term)
                        problems.append(dict(page=page_no, dept=dept, grade=grade, kind=f'{term}학기 합계 다름',
                                             table=float(want), parsed=sums[term]))
            # 학기 합계가 표와 맞은 학기만 '검산됨' — 안 맞으면 답에 '책자 원문 확인'을 붙이게.
            for course in courses[table_start:]:
                course['checked'] = bool(totals) and course['term'] not in bad_terms
    # '부학기'(다른 학기 번호를 씀) — 같은 학과·같은 과목의 다른 학기 번호로 채운다.
    known = {(c['dept'], c['name']): c['code'] for c in courses if c['code']}
    for c in courses:
        if not c['code'] and (c['dept'], c['name']) in known:
            c['code'] = known[(c['dept'], c['name'])]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(dict(source='2026 교과과정책자(PDF) — 컴퓨터공학과 교과과정 게시판 첨부', courses=courses),
              open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    json.dump(dict(tables=tables_seen, courses=len(courses), problems=problems),
              open(REPORT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    depts = sorted({c['dept'] for c in courses})
    codes = {c['code'] for c in courses if c['code']}
    print(f'표 {tables_seen}개 · 과목 행 {len(courses)} · 학과 {len(depts)} · 학수번호 {len(codes)} · 문제 {len(problems)}')


if __name__ == '__main__':
    sys.exit(main())
