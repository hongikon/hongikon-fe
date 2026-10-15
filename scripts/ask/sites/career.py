"""취업진로지원센터 홈페이지(inno.hongik.ac.kr/career — 학교 홈페이지 서울캠퍼스 취업진로지원센터 안내가 잇는 사이트).
프로그램 개요·오프라인/온라인 프로그램·교과목·찾아오시는 길. 채용·아르바이트 게시판은 날마다 바뀌어 옮기지 않는다.
job.hongik.ac.kr 은 로그인 페이지라 받지 않는다. 세종캠퍼스 줄은 뺀다.
"""
import html, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lifekit import drop_empty_titles, drop_sejong, reextract, text_lines  # noqa: E402

LABEL = '취업진로지원센터 홈페이지'
B = 'https://inno.hongik.ac.kr/career/content'
PAGES = {
    'career_offline': f'{B}/4',      # 오프라인 프로그램(취업교육·취업지원 프로그램)
    'career_online': f'{B}/10',      # 온라인 프로그램(에듀스·AI 솔루션·CATCH·잡플래닛)
    'career_courses': f'{B}/5',      # 교과목(직업과 취업 등)
    'career_location': f'{B}/3',     # 찾아오시는길
    # 알림마당의 상시 이용 안내(해마다 이용기간만 바뀐다)
    'career_ai': 'https://inno.hongik.ac.kr/career/boardview/1/901',  # AI 합격 솔루션 이용 안내
    # 달마다 새로 올라오는 예약 안내(가장 최근 달 것 — 2026년 10월). 신청 방법·대상·횟수·장소·취소 규칙은 달마다 같은 틀이라
    # 학생이 안내받는 글로 옮긴다. 새 달 글이 올라오면 글 번호를 바꾸고 topics/ext_life.py 의 lead 를 맞춘다.
    'career_consult': 'https://inno.hongik.ac.kr/career/boardview/1/897',   # [서울] 취업(진로) 1:1 대면 집중컨설팅 일정 안내
    'career_read': 'https://inno.hongik.ac.kr/career/boardview/1/898',      # [서울] READ 진로상담 일정 안내
    'career_national': 'https://inno.hongik.ac.kr/career/boardview/1/900',  # [서울/국민취업지원제도] 현장접수 안내
    # 학기마다 올라오는 어학인증시험 응시장학금 지원 안내(서울, 2026학년도 2학기 1차 글 — 한 해 신청기간·대상·방법이 다 적혀 있다)
    'career_langfee': 'https://inno.hongik.ac.kr/career/boardview/1/890',
    # 대학혁신지원사업 NCS 집중교육(직업기초능력평가) 참여자 모집 — 서울·세종 공동 모집(2026학년도 2기, 모집 10. 12.~10. 23.). 다음 기수 글이 오면 바꾼다.
    'career_ncs': 'https://inno.hongik.ac.kr/career/boardview/1/902',
}
BOARD_TITLE = {
    'career_ai': 'AI 합격 솔루션 이용 안내',
}
CONTENT = {'id': 'content'}


def postprocess(key, page, raw):
    m = re.search(r'class="cont-title">([^<]+)', raw)
    page['title'] = html.unescape(m.group(1)).strip() if m else page['title']
    if '/boardview/' in PAGES[key]:
        # 게시글 본문(board-view-cont)만. 머리(작성자·날짜)는 옮기지 않는다. 제목은 board-view-title 의 글 제목.
        t = re.search(r'id="iLayoutSubContent_atitle"[^>]*>([^<]+)', raw)
        page['title'] = BOARD_TITLE.get(key) or (re.sub(r'\s+', ' ', html.unescape(t.group(1))).strip() if t else page['title'])
        secs = reextract(raw, {'class': 'board-view-cont'}, h1=True)
        for s in secs:
            s['items'] = [i for i in s['items'] if i.strip() != page['title']]
        secs = [s for s in secs if s['items'] or s.get('table')]
        # 글이 '■ 지원대상' 같은 줄로 덩어리를 나누면 그 줄을 제목으로 삼는다(표가 없는 글만).
        if not any(s.get('table') for s in secs) and any(i.startswith('■') for s in secs for i in s['items']):
            out = [{'title': '', 'items': [], 'ordered': False}]
            for i in (i for s in secs for i in s['items']):
                if i.startswith('■') and len(i) <= 30:
                    head, _, rest = i.lstrip('■ ').partition(': ')
                    out.append({'title': head.strip(), 'items': [rest.strip()] if rest.strip() else [], 'ordered': False})
                else:
                    out[-1]['items'].append(i)
            secs = [s for s in out if s['items']]
        page['sections'] = secs
        return page
    if key == 'career_location':
        # 표 머리(주소·대표전화·메일)와 값이 칸으로 나뉘어 있어 '머리: 값' 줄로 옮긴다(서울캠퍼스 표만).
        i = raw.find('<div id="content">')
        body = raw[i:raw.find('세종캠퍼스', i)]
        lines = [l for l in text_lines(body) if l not in ('zoom_out_map', '|')]
        items, label = [], None
        for l in lines:
            if l in ('주소', '대표전화', '메일'):
                label = l
            elif label:
                items.append(f'{label}: {l}')
                label = None
        page['sections'] = [{'title': '서울캠퍼스', 'items': items, 'ordered': False}]
        return page
    page['sections'] = drop_empty_titles(reextract(raw, CONTENT, h1=True, spans=True))
    for s in page['sections']:
        s['items'] = [i for i in s['items'] if i.strip() not in ('zoom_out_map',) and not i.startswith(('room', 'call', 'home'))]
    page['sections'] = [s for s in page['sections'] if s['items'] or s.get('table')]
    return drop_sejong(page)
