"""융합전공 주관학과 홈페이지 — 융합전공 고유 졸업 규정.

- 경영학부(문화예술경영전공 주관) 공지 '[졸업] 2025년 융합전공(문화예술경영전공) 졸업 요건': 경영학과·문과대·예술학과
  소속 과목별 최소 이수학점과 그 안의 필수 교과목. 책자 융-1 주석과 같은 내용을 경영대학이 정리한 글이다.
다른 융합전공 주관학과(기계·시스템디자인공학과, 전자·전기공학부, 산업·데이터공학과) 공지는 신청·자격취득 기간 안내와 특강뿐이라 넣지 않았다.
원문에 그 문장이 그대로 있을 때만 옮긴다(공백·별표는 비교에서 뺀다). 날짜·담당자·양식은 옮기지 않는다.
"""
import html, re

LABEL = '학과 홈페이지'
PAGES = {
    'deptrule_conv_culture': 'https://bizadmin.hongik.ac.kr/bizadmin/0401.do?mode=view&articleNo=138170',
}
CONTENT = {'class': 'fr-view'}

TITLES = {
    'deptrule_conv_culture': '문화예술경영 융합전공 졸업 요건(경영학부 공지)',
}

# 키 → [(단면 제목, [원문 문장 …])]
_RULES = {
    'deptrule_conv_culture': [
        ('경영대학 과목', [
            '문화예술경영 교과과정 과목의 경영학과 소속 과목 중 4과목(12학점) 이상을 이수해야 하며, '
            '12학점 안에는 필수 교과목: 문화예술경영, 문화컨텐츠산업론, 문화예술경제학, 문화예술정책 중 2과목 이상을 이수해야 함.',
        ]),
        ('문과대학 과목', [
            '문화예술경영 교과과정 과목의 문과대 소속 과목 중 총 4과목(12학점) 이상을 이수해야 하며, '
            '12학점 안에는 필수 교과목: 문화학 입문, 프랑스학 2 중 1과목 이상 / 영화와서사, 국문학 개론 중 1과목 이상을 이수해야 함.',
        ]),
        ('예술학과 과목', [
            '문화예술경영 교과과정 과목의 예술학과 소속 과목 중 최소 12학점 이상을 이수해야 하며, '
            '12학점 안에는 필수 교과목: 미학입문, 중국미술사, 예술학특론, 서양근세미술사 II, 포스트모더니즘미술론 중 2과목을 이상을 이수해야 함.',
        ]),
        ('유의', [
            '※ 졸업 및 자격취득서관련은 모두 학생이 직접 신청하고 수강신청을 하기에 모든 책임은 학생에게 있음.',
        ]),
    ],
}


def _flat(text):
    return re.sub(r'[\s*]+', '', text)


def postprocess(key, page, raw):
    body = _flat(html.unescape(re.sub(r'<[^>]+>', ' ', raw)))
    sections = []
    for title, rules in _RULES.get(key, []):
        kept = [rule for rule in rules if _flat(rule) in body]
        if len(kept) < len(rules):
            print(f'deptrule_conv: {key} 원문에 없는 문장 {len(rules) - len(kept)}개 버림({title})')
        if kept:
            sections.append({'title': title, 'items': kept, 'ordered': False})
    return {'title': TITLES[key], 'sections': sections}
