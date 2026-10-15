"""문과대학·디자인·예술경영학부 학과 홈페이지 — 학과 고유 졸업 규정(공지사항 상단 고정 글).

- 영어영문학과 [졸업01] 졸업 요건 안내: 졸업레포트 4편(=졸업논문), 복수전공·편입생 2편, 토익 등으로 대체 불가.
- 독어독문학과 논문대체관련 Q&A: 논문 작성(202611, 3학년 2학기 개설) 수강 완료 후 학과 사무실 이메일 제출.
- 디자인예술경영학부 졸업논문 및 논문대체원 안내: 졸업논문 또는 논문대체원(전공성적확인서·공인어학성적표) 합격 요건.
신청 기간·담당 조교 이메일·양식 같은 학기별 내용은 옮기지 않는다. 원문에 그 문장이 그대로 있을 때만 옮긴다(공백·별표는 비교에서 뺀다).
불어불문학과·국어국문학과는 학기별 졸업논문 일정 글만 있어 넣지 않았다.
"""
import html, re

LABEL = '학과 홈페이지'
PAGES = {
    'deptrule_hum_english': 'https://english.hongik.ac.kr/english/0401.do?mode=view&articleNo=133162',
    'deptrule_hum_german': 'https://german.hongik.ac.kr/german/0401.do?mode=view&articleNo=157135',
    'deptrule_hum_iim': 'https://iim.hongik.ac.kr/iim/0401.do?mode=view&articleNo=153752',
}
CONTENT = {'class': 'fr-view'}

TITLES = {
    'deptrule_hum_english': '영어영문학과 졸업 요건(졸업레포트)',
    'deptrule_hum_german': '독어독문학과 논문대체(논문 작성 과목)',
    'deptrule_hum_iim': '디자인·예술경영학부 졸업논문·논문대체원',
}

# 키 → [(단면 제목, [원문 문장 …])]
_RULES = {
    'deptrule_hum_english': [
        ('영어영문학과 졸업 요건', [
            '졸업 요건 1. 입학연도별 졸업 요건 충족',
            '졸업 요건 2. 영어영문학과 졸업레포트 4편(=졸업논문) 제출',
            'a. 복수전공, 편입생들은 2편만 제출하시면 됩니다.',
            'b. 토익 등으로 대체 불가합니다.',
        ]),
    ],
    'deptrule_hum_german': [
        ('독어독문학과 논문대체 관련', [
            '[202611] 논문 작성 / 3학년 2학기 개설',
            '<수강 완료 후 독문과 사무실 이메일 제출요망>',
            '이름 / 학번 / "입학년도 - 학기"',
        ]),
    ],
    'deptrule_hum_iim': [
        ('졸업논문', [
            "'졸업논문'은 졸업 논문을 작성하여 심사를 통과하거나, 논문대체원을 제출하여 합격 요건을 충족할 시 합격으로 처리합니다.",
        ]),
        ('논문대체원 ① 전공성적확인서 합격요건', [
            '1) 신입학생 : 본인이 이수했던 전공필수를 모두 포함하여 50학점 이상이 되도록 선별한 전공과목들의 평점 평균 3.0 이상',
            '2) 편입학생 : 50학점 이상이 되도록 선별한 전공과목들의 평점 평균 3.0 이상',
            '4) 전공기초는 제외함',
        ]),
        ('논문대체원 ② 공인어학성적표', [
            '라. 합격요건 : TOEIC 700점, TOEFL(CBT) 207점, TOEFL(IBT) 76점, TEPS 327점, NEAT 220점, HSK 4급, JLPT N3 이상',
            '마. 유효기간 : 시험일로 부터 2년',
        ]),
        ('졸업논문 작성', [
            '연구(논문) 계획서를 작성하여 사전에 논문 지도교수를(학부 전임교원) 신청해야함',
            '최종 제출안 기준으로 표절 검사 결과 표절 확인 비율 15% 이상일 경우 불합격 처리함',
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
        if kept:
            sections.append({'title': title, 'items': kept, 'ordered': False})
    return {'title': TITLES[key], 'sections': sections}
