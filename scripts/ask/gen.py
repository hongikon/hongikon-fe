"""
data/pages.json·data/faq.json(학교 홈페이지 수집본) + topics/*.py(주제표) → src/constants/askPages.ts.
사용: python3 -I scripts/ask/gen.py   (그다음 node scripts/ask/test-routing.mjs 로 질문 경로를 검사한다)
페이지 본문(제목·목록·표)을 그대로 옮기고, 찾는 낱말·담당 전화·위치는 주제표에 손으로 단다.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from contacts import P, F
from sources import url_of
from topics import TOPICS

OUT = os.path.join(ROOT, '..', '..', 'src', 'constants', 'askPages.ts')
_pages = json.load(open(os.path.join(ROOT, 'data', 'pages.json'), encoding='utf-8'))
_faq = json.load(open(os.path.join(ROOT, 'data', 'faq.json'), encoding='utf-8'))
PAGES = _pages['pages']
FAQ = {f['q']: f for f in _faq['faq']}
CHECKED = _pages['crawledAt']
FAQ_URLS = {
    'academic-faq': ('학사FAQ', 'https://www.hongik.ac.kr/kr/education/academic-faq.do'),
    'scholarship-faq': ('장학FAQ', 'https://www.hongik.ac.kr/kr/education/scholarship-faq.do'),
}


def faq_link(q):
    name, url = FAQ_URLS[FAQ[q]['board']]
    return [{'label': f'학교 홈페이지 · {name}', 'url': url}]


def check(t):
    """주제표 오타를 생성 전에 잡는다."""
    errs = []
    for key in [t.get('page'), t.get('faqpage')] + list(t.get('pages', [])):
        if key and key not in PAGES:
            errs.append(f'페이지 없음 {key}')
    for q in list(t.get('faqs', [])) + list(t.get('faq', [])):
        if q not in FAQ:
            errs.append(f'FAQ 없음 {q!r}')
    errs += [f'전화 키 없음 {p}' for p in t.get('phones', []) if isinstance(p, str) and p not in P]
    if t.get('facility') and t['facility'] not in F and not t['facility'].startswith('hi-'):
        errs.append(f"위치 키 없음 {t['facility']}")
    for entry in t['match']:
        for group in entry:
            errs += [f'낱말에 공백·대문자 {w!r}' for w in group if w != w.lower() or re.search(r'\s', w)]
    return [f"{t['id']}: {e}" for e in errs]


SKIP_LINES = {'목록보기', '전체', '홈페이지', '뷰어', '-', '·'}


def squash(s):
    return re.sub(r'\s+', '', s)


def clean_items(items, table):
    tabsq = squash(' '.join(' '.join(r) for r in (table or [])))
    out = []
    for it in items:
        core = it.strip()
        if not core or core in SKIP_LINES:
            continue
        if re.search(r'(바로가기|다운로드|\[보기\])\s*$', core) and len(core) < 40:
            continue
        core = re.sub(r'^(.{2,30}?) \1(?=\s|$)', r'\1', core)  # '카페(카페드림) 카페(카페드림) …' 같은 겹침
        if table and len(squash(core)) >= 2 and squash(core) in tabsq:
            continue  # 표와 같은 내용을 모바일용으로 한 번 더 적은 줄
        indent = (len(it) - len(it.lstrip(' '))) // 2
        out.append(('  ' * indent) + core)
    return out


def table_of(t):
    t = [[re.sub(r'\s+', ' ', c).strip() for c in r] for r in t]
    width = max(len(r) for r in t)
    t = [r + [''] * (width - len(r)) for r in t]
    cols = [i for i in range(len(t[0])) if any(r[i] for r in t)]
    t = [[r[i] for i in cols] for r in t]
    if len(t) < 2 or len(t[0]) < 2:
        return None
    return {'head': t[0], 'rows': t[1:]}


def sections_of(secs):
    out = []
    for s in secs:
        table = table_of(s['table']) if s.get('table') else None
        items = clean_items(s['items'], s.get('table'))
        if not items and not table:
            continue
        sec = {'title': s['title'] or '안내'}
        if table:
            if len(table['head']) > 4:
                # 열이 다섯 개 넘는 표는 말풍선에 안 들어가 '머리: 값' 줄글로 푼다.
                lines = [' · '.join(f'{h}: {v}' for h, v in zip(table['head'], r) if v and h) or r[0] for r in table['rows']]
                items = lines + items
            else:
                sec['table'] = table
        if items:
            sec['items'] = items
            if s['ordered'] and not any(i.startswith('  ') for i in items):
                sec['ordered'] = True
        out.append(sec)
    return out


def page_title(key):
    parts = PAGES[key]['title'].replace('홍익대학교 | ', '').split(' | ')
    if parts[0] == '정보전산원' and len(parts) > 1:
        return parts[1]
    return parts[0].replace(' 게시판목록', '')


def first_sentence(secs):
    for it in (secs[0].get('items', []) if secs else []):
        it = it.strip()
        if 20 <= len(it) <= 170 and not re.match(r'^(\d+\.|[가-하]\.|-|※|●)', it) and re.search(r'(다|요|임|함|음)\.?$', it):
            return it
    return None


def contacts_links(key):
    links = []
    for c in PAGES[key].get('contacts', []):
        if len(c) >= 2 and '@' in c[1] and '세종' not in c[0] and c[0] not in ('교무입시팀', '총무관리팀', '학생복지팀', '전산관리팀'):
            links.append({'label': f'{c[0]} 메일 · {c[1]}', 'url': f'mailto:{c[1]}'})
    return links


def faq_sections(q):
    return sections_of(FAQ[q]['sections'])


def answer(text, sections, links, t):
    n = {'kind': 'answer', 'text': text, 'sections': sections}
    if t.get('phones'):
        # 키(contacts.P) 또는 ('라벨', '번호') 그대로.
        n['phones'] = [{'label': (P[p] if isinstance(p, str) else p)[0], 'phone': (P[p] if isinstance(p, str) else p)[1]} for p in t['phones']]
    n['links'] = links
    if t.get('facility'):
        n['facilityId'] = F.get(t['facility'], t['facility'])
    return n




def build(t):
    nodes = {}
    if 'page' in t:
        key = t['page']
        secs = sections_of(PAGES[key]['sections'])[: t.get('max_sections')]
        title = page_title(key)
        lead = t.get('lead')
        if not lead:
            lead = first_sentence(secs)
            if lead:  # 첫 줄을 요약으로 올렸으면 본문에서 뺀다.
                secs[0]['items'] = [i for i in secs[0].get('items', []) if i.strip() != lead]
                if not secs[0]['items'] and not secs[0].get('table'):
                    secs = secs[1:]
                elif not secs[0]['items']:
                    del secs[0]['items']
            else:
                lead = f"학교 홈페이지 '{title}' 안내를 옮겼어요."
        follow = []
        for i, q in enumerate(t.get('faq', [])):
            nodes[f'faq{i}'] = answer(f"학사 FAQ '{q}' 답변이에요.", faq_sections(q), faq_link(q), t)
            follow.append({'label': f'자주 묻는 질문 · {q}', 'next': f'faq{i}'})
        if t.get('faqpage'):
            k2 = t['faqpage']
            nodes['more'] = answer(f"학교 홈페이지 '{page_title(k2)}' 안내예요.", sections_of(PAGES[k2]['sections']),
                                   [{'label': f'학교 홈페이지 · {page_title(k2)}', 'url': url_of(k2)}], t)
            follow.append({'label': page_title(k2), 'next': 'more'})
        a = answer(lead, secs, [{'label': f'학교 홈페이지 · {title}', 'url': url_of(key)}] + contacts_links(key), t)
        if follow:
            a = {**a, 'followUps': follow}
        nodes['start'] = a
    elif 'faqs' in t:
        if len(t['faqs']) == 1:
            q = t['faqs'][0]
            nodes['start'] = answer(f"학사 FAQ '{q}' 답변이에요.", faq_sections(q), faq_link(q), t)
        else:
            opts = []
            for i, q in enumerate(t['faqs']):
                nodes[f'a{i}'] = answer(f"학사 FAQ '{q}' 답변이에요.", faq_sections(q), faq_link(q), t)
                opts.append({'label': q, 'next': f'a{i}'})
            nodes['start'] = {'kind': 'question', 'text': t['question'], 'options': opts}
    else:
        opts = []
        for i, key in enumerate(t['pages']):
            title = page_title(key)
            nodes[f'p{i}'] = answer(f"총동아리연합회 '{title}' 분과 동아리예요.", sections_of(PAGES[key]['sections']),
                                    [{'label': f'학교 홈페이지 · 동아리({title})', 'url': url_of(key)}], t)
            opts.append({'label': title, 'next': f'p{i}'})
        nodes['start'] = {'kind': 'question', 'text': t['question'], 'options': opts}
    for n in nodes.values():
        if n['kind'] == 'answer' and not n['sections']:
            raise SystemExit(f"{t['id']}: 빈 답")
    entries = [{'match': g, 'node': 'start', **({'not': t['exclude']} if t.get('exclude') else {})} for g in t['match']]
    return {'id': t['id'], 'entries': entries, 'nodes': nodes, 'checkedAt': CHECKED}


if __name__ == '__main__':
    errors = [e for t in TOPICS for e in check(t)]
    ids = [t['id'] for t in TOPICS]
    errors += [f'id 겹침 {i}' for i in set(ids) if ids.count(i) > 1]
    if errors:
        raise SystemExit('\n'.join(errors))
    flows = [build(t) for t in TOPICS]
    header = """import type { AskFlow } from './askAnswers'

/**
 * 학교 홈페이지 안내 페이지·학사/장학 FAQ 를 옮긴 '물어보기' 답(수집일은 checkedAt).
 * 손으로 고치지 말고 scripts/ask(주제표 topics/*.py → gen.py)로 다시 만든다.
 * 본문(제목·목록·표)은 학교 원문 그대로, 찾는 낱말·담당 전화(adminOffices 담당정보 표)·위치만 붙였다.
 * 학교가 공개하지 않는 담당자 성명은 넣지 않고, 메일은 부서 대표 메일만 쓴다.
 */
export const ASK_PAGE_FLOWS: readonly AskFlow[] = """
    body = json.dumps(flows, ensure_ascii=False, indent=1)
    open(OUT, 'w', encoding='utf-8').write(header + body + '\n')
    print('flows', len(flows), 'KB', len((header + body).encode()) // 1024)
