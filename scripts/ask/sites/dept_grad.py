"""학과 홈페이지의 상시 졸업요건 페이지(학사안내 · 졸업요건).

- 공연예술학부 뮤지컬전공(musical 0403) · 실용음악전공(music 0403): 같은 표. 졸업논문은 '졸업공연 혹은 졸업공연에 준하는 졸업시험'.
- 신소재공학전공(mse 0403): 공통 졸업 기준(실험 2과목·창의적종합설계), 졸업인증 실험과목, 공학인증 과정별 요건(영어성적 기준 포함).
"""
from sites import _adminkit as kit

LABEL = '학과 홈페이지'
PAGES = {
    'dept_grad_musical': 'https://musical.hongik.ac.kr/musical/0403.do',
    'dept_grad_music': 'https://music.hongik.ac.kr/music/0403.do',
    'dept_grad_mse': 'https://mse.hongik.ac.kr/mse/0403.do',
}
CONTENT = {'id': 'cms-content'}
TITLES = {
    'dept_grad_musical': '공연예술학부 뮤지컬전공 | 졸업요건',
    'dept_grad_music': '공연예술학부 실용음악전공 | 졸업요건',
    'dept_grad_mse': '신소재공학전공 | 졸업요건',
}
_FOOT = ('개인정보처리방침', '예결산공고', '대학정보공시', '대학자체평가', '전화번호 안내', 'COPYRIGHT')


def postprocess(key, page, raw):
    page['title'] = TITLES[key]
    secs = []
    for s in kit.reparse(raw, CONTENT):
        s['items'] = [x for x in s['items'] if not x.startswith(_FOOT) and '교수님' not in x]  # 교직원 이름 줄은 옮기지 않는다
        if s['items'] or s.get('table') or s['title']:
            secs.append(s)
    page['sections'] = secs
    return page
