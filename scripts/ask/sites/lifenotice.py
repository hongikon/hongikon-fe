"""생활·복지 쪽 학교 홈페이지 공지 가운데 학생이 해마다 안내받는 글(부속 사이트에는 첨부 PDF 만 있는 것).

- 폭력예방교육: 인권센터 공지사항(help.hongik.ac.kr/help/0401.do)에는 PDF 만 있고, 같은 해 학교 홈페이지 공지에 본문이 있다.
  해마다 새 글이 올라오므로(2026학년도: 글 150948) 새 학년도 글이 나오면 글 번호와 topics/ext_life.py 의 lead 를 함께 바꾼다.
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lifekit import article  # noqa: E402

LABEL = '학교 홈페이지'
N = 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo='
PAGES = {
    'lifenotice_prevention': f'{N}150948',   # ⭐[서울캠퍼스] 2026 온라인 폭력 예방교육⭐ (인권센터)
}
CONTENT = {'id': 'cms-content'}


def postprocess(key, page, raw):
    title, secs = article(raw)
    page['title'] = re.sub(r'[⭐★]', '', title).strip()
    # 줄 중간에 끊긴 강조(<strong>) 조각을 한 줄로 붙인다.
    lines = [i for s in secs for i in ([s['title']] if s['title'] else []) + s['items'] if i.strip()]
    text = ' '.join(lines)
    text = re.sub(r'\s*(\d\.\s)', r'\n\1', text)
    text = re.sub(r'\s*(※|★|- 미)', r'\n\1', text)
    text = re.sub(r'\s*(모든 재학생 여러분께서는|문의 :)', r'\n\1', text)
    out = [l.strip() for l in text.split('\n') if l.strip()]
    page['sections'] = [{'title': '', 'items': out, 'ordered': False}]
    return page
