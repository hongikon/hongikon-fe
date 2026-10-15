"""미술대학 디자인·공예 학과 홈페이지(공지) — 학과 고유 졸업 규정.

학기마다 날짜만 바뀌어 다시 올라오는 공지에서 날짜와 상관없는 규정 줄만 옮긴다(신청 기간·면접 일시·제출 서류·교수 이름은 옮기지 않는다).
- 산업디자인전공(id.hongik.ac.kr) '코스트랙 및 졸업요건 추가 상세설명': 졸업요건 전공선택 개수·폐지 과목 인정 규칙.
- 금속조형디자인과: 학과 공지는 학과가 따로 운영하는 홈페이지(hongik-mad.com, metalart.hongik.ac.kr 공지 155066 이 안내)에 있다.
  '복수/부전공 졸업자격': 졸업논문 = 졸업전시 참여, 졸업전시 이수 과목(세공·대공 분야).
- 도예유리과(cer.hongik.ac.kr) 복·부전공 신청 안내의 '복,부전공 졸업 요건'.
- 목조형가구학과(waf.hongik.ac.kr) 복·부전 공지: 기초공구기법과조형 → 특수공구기법과조형 차례 이수.
시각디자인전공(sidi.hongik.ac.kr)은 자바스크립트로 그리는 사이트라, 섬유미술패션디자인과(textile)는 졸업 규정 글이 없어 넣지 않았다.
다음 학기 글이 올라오면 PAGES 의 글 번호를 바꾼다. 사용: python3 -I scripts/ask/crawl.py --site deptrule_design → extract.py --site deptrule_design.
"""
import html, re

LABEL = '학과 홈페이지'
PAGES = {
    'deptrule_design_id': 'https://id.hongik.ac.kr/id/0401.do?mode=view&articleNo=131703',
    'deptrule_design_metal': 'http://hongik-mad.com/hongikmad/bbs/board.php?bo_table=a401&wr_id=117',
    'deptrule_design_ceramic': 'https://cer.hongik.ac.kr/cer/0401.do?mode=view&articleNo=146877',
    'deptrule_design_wood': 'https://waf.hongik.ac.kr/waf/0401.do?mode=view&articleNo=153794',
}
CONTENT = {'class': 'fr-view'}

TITLES = {
    'deptrule_design_id': '산업디자인전공 졸업요건 상세설명',
    'deptrule_design_metal': '금속조형디자인과 졸업전시·복수/부전공 졸업자격',
    'deptrule_design_ceramic': '도예유리과 복수·부전공 졸업요건',
    'deptrule_design_wood': '목조형가구학과 공구기법 과목 이수 순서',
}

# 원문에 이 문장이 그대로 있을 때만 옮긴다(공백·별표는 비교에서 뺀다). (단면 제목, [문장 …])
_RULES = {
    'deptrule_design_id': [
        ('산업디자인전공 졸업요건 규정', [
            "폐지된 전공 선택 과목도 이미 이수하였다면 '졸업요건 전공선택 개수'에 포함됨.",
            '2020년도 2학기까지 UX분석과응용 수업을 이수한 학생은 전공선택으로 인정함.',
            '(해당 학생들에게는 UX분석과응용 수업이 전공 필수가 아님, 2021년도 이후로 전공 필수)',
            "전공 필수 과목을 대체한 전공 선택 과목은 '졸업요건 전공선택 개수'로 인정되지 않음.",
            '미이수한 폐지된 전공필수과목은 대체 과목 수강 후 졸업사정시 사유서 작성해야 함',
        ]),
    ],
    'deptrule_design_metal': [
        ('복수전공 졸업자격(졸업전시)', [
            '복수전공학과의 졸업논문에 합격하여야 함 (금속조형디자인과의 경우, 졸업전시 참여)',
            '졸업전시를 참여하는 학생은 [세공분야1개 + 대공분야1개]를 필수로 이수하고, 각 분야별 작품을 제출해야함',
            '졸업전시는 1년 프로젝트로 진행되며, 특별한 사유를 제외하고서는 해당학년도 1+2학기 연속 수강을 원칙으로 함',
            '산업장신구(1)(2) 또는 아트장신구(1)(2) 중 택 1',
            '금속조명가구디자인(1)(2) 또는 금속오브젝트(1)(2) 중 택1',
            '이수계통도에 따른 학과 내규 필수 과목 이수조건 충족 (이수계통도는 클래스넷에서 확인 가능)',
        ]),
        ('부전공 졸업자격', [
            '이수지정과목을 21학점 이상 이수',
            '이수지정과목 평점 평균이 C0(2.0) 이상이어야 함',
            '부전공은 주전공의 재학 연한 (4년제:16학기, 5년제:20학기) 이내에 이수하지 못하면 이수 자격을 상실함',
        ]),
    ],
    'deptrule_design_ceramic': [
        ('복수전공 졸업요건', [
            '기초평면(1),기초입체(1) 이수',
            '전공 필수 포함 36학점 이상 이수',
            '(전공 필수 과목 : 유리기법(1), 물레심화(1), CLAYWORK전공심화(2), 석고기법(2), 공예론, 도예론)',
            '2학기 졸업전시 참여 (졸업 전시 참여자는 해당 연도 1,2학기 4학년 전공 과목을 1과목 이상 이수해야함)',
        ]),
        ('부전공 졸업요건', [
            '전공 21학점 이상 취득(이수한 교과목 성적 평균평점이 “C°”이상)',
            '도예유리과 부전공 이수 지정 과목은 도예유리과에서 개설하는 전체 과목입니다.',
        ]),
    ],
    'deptrule_design_wood': [
        ('목조형가구학과 필수 이수 순서', [
            '목조형가구학과는 안전상의 이유로 복, 부전 / 주전공생들에게 반드시 기초공구기법과조형(1학기) 특수공구기법과조형(2학기)를 차례대로 이수하도록 하고 있습니다.',
            '본 과목을 차례대로 수강하지 않을 경우 수공구와 기계의 오사용으로 인해, 영구적이고 회복불가능한 신체결손을 유발하는 사고가 발생할 가능성이 매우 높습니다.',
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
