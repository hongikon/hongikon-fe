"""홍익대학교 박물관 홈페이지(museum.hongik.ac.kr). 학교 홈페이지 박물관 소개(introduction/museum.do)에는 관람 시간이 없어
박물관 홈페이지의 '전시실 안내'(운영시간)와 '오시는 길'(위치·연락처)만 받아 museum_visit 하나로 합친다(답 출처 링크는 오시는 길). 학사·행정(admin) 갈래 주제 'museum' 이 쓴다.
robots.txt 는 /_attach/ 같은 자원 경로만 막는다.
"""
import os
from sites import _adminkit as kit

_CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cache', 'museum')

LABEL = '홍익대학교 박물관 홈페이지'
PAGES = {
    'museum_rooms': 'https://museum.hongik.ac.kr/museum/0105.do',  # 전시실 안내(운영시간)
    'museum_visit': 'https://museum.hongik.ac.kr/museum/0106.do',  # 오시는 길(교통편·주소·전화)
}
CONTENT = {'id': 'cms-content'}


def postprocess(key, page, raw):
    """museum_visit 하나로 합친다: 전시실 안내의 '운영시간' 줄 + 오시는 길(교통편·주소·전화). museum_rooms 는 답 페이지로 남기지 않는다."""
    if key == 'museum_rooms':
        page['sections'] = []
        return page
    page['title'] = '홍익대학교 박물관 | 관람 안내'
    secs = [s for s in kit.reparse(raw, CONTENT) if s['title']]
    rooms = os.path.join(_CACHE, 'museum_rooms.html')
    if os.path.exists(rooms):
        hours = [i for s in kit.reparse(open(rooms, encoding='utf-8').read(), CONTENT) for i in s['items'] if i.startswith('운영시간')]
        if hours:
            secs.insert(0, {'title': '운영시간(전시실 안내)', 'items': hours, 'ordered': False})
    page['sections'] = secs
    return page
