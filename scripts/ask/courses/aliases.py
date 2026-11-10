"""줄임말 사전(data/aliases.json) — 운영진이 알려 준 줄임말(curated) + 과목명에서 규칙으로 만든 후보(auto).

계획: docs/ask-course-db-plan.md 2-3. 입력: data/courses.json(extract.py). 사용: python3 -I scripts/ask/courses/aliases.py

학생들이 줄이는 법(11-10 운영진):
- 뜻 단위 첫 글자: 중앙+동아리 → 중동, 컴퓨터+프로그래밍 → 컴프, 인터넷+프로그래밍 → 인프, 재료+전기+화학 → 재전화.
- 조사는 뺀다: 협상+의+기술 → 협기.
- 꼬리 '학생'을 뺀다: 교환학생 → 교환, 방문학생 → 방문.
- 앞 단위를 한 글자로 줄이고 뒤 단위를 그대로 두기도 한다: 화학+공정(+계산) → 화공정 — 이런 것은 규칙으로 다 못 만들어 curated 에 적는다.
auto 는 뜻 단위 첫 글자 규칙만 쓴다. 같은 줄임말이 여러 과목이면 모두 남겨 물어보기가 되묻게 한다.
"""
import collections
import json
import math
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), 'data')

# 운영진이 직접 알려 준 줄임말 + 이미 주제표에서 쓰던 줄임말(근거 있는 것만). kind: course·facility·program·org.
CURATED = [
    ('중동', '중앙동아리', 'org'), ('가동', '가동아리', 'org'), ('총동연', '총동아리연합회', 'org'), ('총학', '총학생회', 'org'),
    ('교환', '교환학생', 'program'), ('방문', '방문학생', 'program'),
    ('컴프', '컴퓨터프로그래밍', 'course'), ('인프', '인터넷프로그래밍', 'course'), ('재전화', '재료전기화학', 'course'),
    ('협기', '협상의기술', 'course'), ('화공정', '화학공정계산', 'course'),
    ('논사글', '논리적사고와글쓰기', 'course'), ('전기영', '전공기초영어', 'course'),
    ('디씽', '디자인씽킹', 'course'), ('창실법', '창업과실용법률', 'course'), ('컴사', '컴퓨팅사고', 'course'), ('선대', '선형대수학', 'course'), ('선대수', '선형대수학', 'course'),
    ('대물', '대학물리|대학물리실험', 'course'), ('대수', '대학수학', 'course'), ('대화', '대학화학|대학화학실험', 'course'), ('C프', 'C-프로그래밍', 'course'),
    ('중도', '중앙도서관', 'facility'), ('홍문관', '홍문관 R동', 'facility'),
    ('1공', '제1공학관', 'facility'), ('2공', '제2공학관', 'facility'), ('3공', '제3공학관', 'facility'), ('4공', '제4공학관', 'facility'),
    ('긱사', '기숙사', 'facility'),
]

PARTICLES = ('의', '와', '과', '및')
NOISE = re.compile(r'[※*·]|\([^)]*\)|\[[^\]]*\]|[ⅠⅡⅢⅣ0-9]+$|^\*|\s+')


def clean(name):
    """'(sw심화)데이터베이스시스템(공-컴)' → '데이터베이스시스템', '대학수학(1)' → '대학수학'."""
    return NOISE.sub('', name).strip()


# 쪼개면 안 되는 낱말(외래어·학술어) — 빈도만으로는 '프로'+'그래밍'처럼 잘린다.
KEEP = {'프로그래밍', '알고리즘', '시스템', '데이터', '데이터베이스', '네트워크', '소프트웨어', '하드웨어', '디자인', '인터넷', '컴퓨터',
        '마케팅', '커뮤니케이션', '애니메이션', '엔지니어링', '프로젝트', '세미나', '스튜디오', '대수학', '열역학', '유체역학', '고체역학',
        '인공지능', '머신러닝', '딥러닝', '빅데이터', '클라우드', '모바일', '그래픽스', '멀티미디어', '인터랙션', '포트폴리오'}


def boundary_counts(names):
    """덩어리가 과목명의 앞·끝, 또는 조사(의·와·과·및) 옆에 나오는 과목 수 — 뜻 단위일수록 많다."""
    counts = collections.Counter()
    for name in names:
        parts = re.split('[의와과및]', name) if len(name) > 3 else [name]
        seen = set()
        for part in [name] + parts:
            for k in range(2, min(6, len(part)) + 1):
                seen.add(part[:k])
                seen.add(part[-k:])
        counts.update(seen)
    return counts


def segment(name, counts):
    """가장 그럴듯하게 나누기(동적 계획) — 점수 = 단위마다 log(경계 빈도) + 길이 보너스, KEEP 낱말은 크게 우대, 조사는 건너뛴다."""
    n = len(name)
    best = [(-1e9, None)] * (n + 1)
    best[0] = (0.0, None)
    for i in range(n):
        if best[i][0] <= -1e8:
            continue
        if name[i] in PARTICLES and i > 0 and best[i][0] > best[i + 1][0]:
            best[i + 1] = (best[i][0], (i, None))
        for k in range(1, min(7, n - i) + 1):  # 한 글자 덩어리도 되지만 크게 깎는다(남는 한 글자 때문에 나누기가 끊기지 않게)
            unit = name[i:i + k]
            freq = counts.get(unit, 0)
            score = best[i][0] + (math.log(freq) if freq >= 2 and k >= 2 else -3.0) + 0.3 * k - 1.5 + (8.0 if unit in KEEP else 0.0) - (4.0 if k == 1 else 0.0)
            if score > best[i + k][0]:
                best[i + k] = (score, (i, unit))
    out, j = [], n
    while j > 0:
        i, unit = best[j][1]
        if unit:
            out.append(unit)
        j = i
    return out[::-1]


def main():
    courses = json.load(open(os.path.join(DATA, 'courses.json'), encoding='utf-8'))['courses']
    names = [clean(c['name']) for c in courses if c['name'] and '택' not in c['name'] and clean(c['name'])]
    vocab = boundary_counts(set(names))
    by_short = collections.defaultdict(set)
    codes = collections.defaultdict(set)
    for c in courses:
        name = clean(c['name'])
        if not name or '택' in c['name'] or len(name) < 4:
            continue
        latin = re.match(r'^([A-Za-z]+)-?(.+)$', name)
        units = ([latin.group(1)] + segment(latin.group(2), vocab)) if latin else segment(name, vocab)
        if len(units) == 1 and len(name) == 4 and name not in KEEP:
            units = [name[:2], name[2:]]  # 운영체제 → 운영+체제 → 운체
        if len(units) < 2 or len(units) > 4:
            continue
        short = ''.join(u[0] for u in units)
        if len(short) < 2 or short == name:
            continue
        by_short[short].add(name)
        if c['code']:
            codes[name].add(c['code'])
    curated_shorts = {s for s, _, _ in CURATED}
    auto = [dict(short=s, full=sorted(full), codes=sorted({x for f in full for x in codes[f]}), ambiguous=len(full) > 1)
            for s, full in sorted(by_short.items()) if s not in curated_shorts]
    out = dict(
        note='curated: 운영진 확인 줄임말. auto: 과목명 뜻 단위 첫 글자 규칙 후보(검색에만 쓰고, 여러 과목이면 되묻는다).',
        curated=[dict(short=s, full=f.split('|'), kind=k) for s, f, k in CURATED],  # 한 줄임말이 여러 과목이면 '|'
        auto=auto)
    json.dump(out, open(os.path.join(DATA, 'aliases.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    # 앱(앱 안 안내 찾기)은 운영진 확인 줄임말만 쓴다 — 자동 후보는 서버 검색에만.
    ts = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), 'src', 'constants', 'askAliases.ts')
    with open(ts, 'w', encoding='utf-8') as f:
        f.write('// 자동 생성(scripts/ask/courses/aliases.py) — 손으로 고치지 않는다. 운영진이 확인한 줄임말 → 정식 이름.\n')
        f.write('export const ASK_ALIASES: Readonly<Record<string, readonly string[]>> = {\n')
        for short, full, _ in CURATED:
            f.write(f"  {json.dumps(short, ensure_ascii=False)}: {json.dumps(full.split('|'), ensure_ascii=False)},\n")
        f.write('}\n')
    amb = sum(1 for a in auto if a['ambiguous'])
    print(f'curated {len(CURATED)} · auto {len(auto)}(여러 과목 {amb}) · 단위 사전 {len(vocab)}')
    for probe in ('컴퓨터프로그래밍', '인터넷프로그래밍', '재료전기화학', '협상의기술', '자료구조및프로그래밍', '데이터베이스시스템'):
        print(' ', probe, '→', segment(probe, vocab))


if __name__ == '__main__':
    main()
