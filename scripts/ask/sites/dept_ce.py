"""컴퓨터공학과 홈페이지(wwwce.hongik.ac.kr) — 학과 고유 졸업 규정.

졸업프로젝트 수강신청 안내 글(매 학기 같은 내용으로 다시 올라온다)에서 날짜와 상관없는 규정 줄만 옮긴다:
AIML응용프로젝트·종합설계프로젝트1·2 는 졸업논문 대체 과목이자 졸업 필수 요건, 프로젝트 과목은 학과가 직접 수강 입력.
신청 기간·구글폼·담당 교수 같은 학기별 내용은 옮기지 않는다. 다음 학기 글이 올라오면 PAGES 의 articleNo 를 바꾼다.
"""
import html, re

LABEL = '컴퓨터공학과 홈페이지'
PAGES = {
    'dept_ce_project': 'https://wwwce.hongik.ac.kr/wwwce/0401.do?mode=view&articleNo=154811',
}
CONTENT = {'class': 'fr-view'}

# 원문에 이 문장이 그대로 있을 때만 옮긴다(별표·공백은 비교에서 뺀다).
_RULES = [
    'AIML응용프로젝트, 종합설계프로젝트1, 2 과목은 졸업논문 대체 과목으로, 졸업 필수 요건입니다.',
    '프로젝트 과목은 학교 수강신청 사이트에서 수강신청 하지 않으며, 학과에서 직접 입력해드립니다.',
    '수강신청 사이트에서 신청하신 것은 아무 효력이 없습니다.',
    '직전학기에 프로젝트 수업을 수강했다고 자동으로 2학기 수강신청이 되지 않습니다!',
]


def _flat(text):
    return re.sub(r'[\s*]+', '', text)


def postprocess(key, page, raw):
    body = _flat(html.unescape(re.sub(r'<[^>]+>', ' ', raw)))
    kept = [rule for rule in _RULES if _flat(rule) in body]
    return {'title': '졸업프로젝트(졸업논문 대체)', 'sections': [{'title': '컴퓨터공학과 졸업프로젝트 규정', 'items': kept, 'ordered': False}] if kept else []}
