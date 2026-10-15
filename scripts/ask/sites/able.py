"""장애학생지원센터 홈페이지(ablecenter.hongik.ac.kr). 등록·학습·생활·보조공학기기·장학/취업·교육지원인력·장애인식개선교육.
센터 소개(0101)는 부서 정보를 스크립트(/_custom, robots 금지)로 불러와 받지 않는다. 세종캠퍼스 줄·표는 뺀다.
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lifekit import drop_sejong, site_postprocess, split_numbered  # noqa: E402

LABEL = '장애학생지원센터 홈페이지'
B = 'https://ablecenter.hongik.ac.kr/ablecenter'
PAGES = {
    'able_register': f'{B}/0201.do',     # 장애학생 등록·문의처
    'able_study': f'{B}/0202.do',        # 학습 지원(우선수강신청·교육활동 지원·시험 편의)
    'able_life': f'{B}/0203.do',         # 대학생활 지원(기숙사 장애인실·도서관)
    'able_devices': f'{B}/0204.do',      # 보조공학기기 대여
    'able_scholarship': f'{B}/0205.do',  # 장학/취업 지원(복지장학금)
    'able_helper': f'{B}/0301.do',       # 교육지원인력 안내
    'able_awareness': f'{B}/0401.do',    # 장애인식개선교육
    'able_scholarship_guide': f'{B}/0502.do?mode=view&articleNo=137146',  # 장학금 게시판: 복지장학금 안내(학부생, 상시)
    'able_messagestone': f'{B}/0505.do?mode=view&articleNo=153895',  # 자료실: 청각장애 보조기기(메시지스톤 에듀AI) 사용법 안내(본문 안내 + 첨부 사용설명서)
}
CONTENT = {'id': 'cms-content'}


def _fix(key, page, raw):
    if key == 'able_register':
        # 등록 절차는 그림 단계(alt 글)로만 적혀 있다: 센터 문의 → 개별 면담 → 장애 학생 등록신청 → 등록 완료
        steps = [a for a in re.findall(r'<img[^>]*ablecenter/img/dept/[^>]*alt="([^"]+)"', raw) if a != '다음']
        page['sections'] = [{'title': '1. 장애학생 등록 방법', 'items': [' → '.join(steps)], 'ordered': False}] + [
            {**s, 'items': [i for i in s['items'] if i not in ('1. 장애학생 등록 방법', '2. 문의처')],
             'title': s['title'] or '2. 문의처'}
            for s in page['sections'] if s['title'] != '1. 장애학생 등록 방법']
        page['sections'] = [s for s in page['sections'] if s['items'] or s.get('table')]
        for s in page['sections']:
            t = s.get('table')
            if t and t[0] and '세종' in ' '.join(t[0]):
                keep = [i for i, h in enumerate(t[0]) if '세종' not in h]
                s['table'] = [[r[i] for i in keep] for r in t]
    return drop_sejong(split_numbered(page) if key != 'able_register' else page)


_post = site_postprocess(PAGES)


def postprocess(key, page, raw):
    return _fix(key, _post(key, page, raw), raw)
