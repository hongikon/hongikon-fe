"""창업교육센터가 학교 홈페이지 공지로 내는 글 — 창업장학금(자격·서류·접수)과 창업동아리 모집(혜택: 창업장학생 선발 가산점).

- 창업교육센터 페이지(topics/life.py 'startup')에는 '연 1회 평가로 창업장학생 선발'만 있고 자격·서류는 해마다 공지에 있다.
  새 학년도 공지가 나오면 글 번호와 topics/life.py 'startup' lead 의 학년도·기간을 함께 바꾼다
  (11-14 기준 최신: 창업장학금 2025학년도 글 146777, 창업동아리 2026 글 149675).
- 개인정보: 공지 본문의 담당 직원 이름·개인 이메일은 옮기지 않는다(답에 개인 연락처를 쓰지 않는 규칙).
  접수 이메일 주소는 '공지 본문 참고'로 바꾸고, 문의는 부서 전화만 남긴다.
- 창업 교과목 수강 가산점은 공식 페이지에서 확인하지 못해(11-14, changup-edu1 0202·0301) 넣지 않았다.
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lifekit import article  # noqa: E402

LABEL = '학교 홈페이지'
N = 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo='
PAGES = {
    'startupnotice_scholarship': f'{N}146777',  # 2025 창업장학금 신청(서울/세종) — 창업교육센터, 2025.12.29
    'startupnotice_club': f'{N}149675',         # [참가신청] 2026 홍익대학교 창업 동아리 모집(서울) — 2026.03.13
}
CONTENT = {'id': 'cms-content'}

_EMAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
# '창업교육센터 홍길동 Tel.02-…' 처럼 부서 뒤에 붙은 담당자 이름.
_STAFF = re.compile(r'(창업교육센터)\s+[가-힣]{2,4}\s+(Tel\.?)')


def _clean(line):
    line = _STAFF.sub(r'\1 \2', line)
    if _EMAIL.search(line):
        line = _EMAIL.sub('', line)
        line = re.sub(r'\s*/\s*$', '', line).rstrip(' :/')
        if re.search(r'(접수|신청방법)', line) and not re.search(r'\d{2,3}-\d{3,4}-\d{4}', line):
            line = line + ' (주소는 공지 본문 참고)'
    return re.sub(r'\s{2,}', ' ', line).strip()


def postprocess(key, page, raw):
    title, secs = article(raw)
    page['title'] = title
    out = []
    for s in secs:
        for item in ([s['title']] if s['title'] else []) + s['items']:
            item = _clean(item)
            if item and not _EMAIL.search(item):
                out.append(item)
    page['sections'] = [{'title': '', 'items': out, 'ordered': False}]
    return page
