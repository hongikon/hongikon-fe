"""통합로그인(마이홍익·클래스넷 공통). 로그인 화면(www.hongik.ac.kr/login.do — 클래스넷 cn.hongik.ac.kr 도 이 화면으로 보낸다)의
아이디 안내와, 아이디·비밀번호·보안코드 찾기 화면(fbt.hongik.ac.kr/find/…)의 안내 글. 모두 로그인 없이 보이는 공개 화면이다.
찾기 화면의 입력 칸·인증 절차 자체는 옮기지 않고 화면에 적힌 안내 문장과 인증 방법 이름만 옮긴다.
"""
import html, re
from sites import _adminkit as kit

LABEL = '홍익대학교 통합로그인'
PAGES = {
    'sso_login': 'https://www.hongik.ac.kr/login.do',
    'sso_find-id': 'https://fbt.hongik.ac.kr/find/index.jsp',
    'sso_find-pw': 'https://fbt.hongik.ac.kr/find/index_pw.jsp',
    'sso_find-sec': 'https://fbt.hongik.ac.kr/find/index_sec.jsp',
}
CONTENT = {'class': 'login-bottom-box'}

TITLES = {
    'sso_login': ('통합로그인 아이디 안내', '로그인 아이디·비밀번호'),
    'sso_find-id': ('아이디 찾기', '아이디 찾기 안내'),
    'sso_find-pw': ('비밀번호 찾기', '비밀번호 찾기 안내'),
    'sso_find-sec': ('보안코드 찾기', '보안코드 찾기 안내'),
}


def _body_lines(raw):
    i = raw.find('<body')
    s = re.sub(r'<(script|style).*?</\1>|<!--.*?-->', '', raw[i:], flags=re.S)
    s = re.sub(r'<br\s*/?>|</(p|li|div|label|a|option|h\d|td|th|span)>', '\n', s)
    s = html.unescape(re.sub(r'<[^>]+>', '', s)).replace('\xa0', ' ')
    return [re.sub(r'\s+', ' ', x).strip() for x in s.split('\n') if x.strip()]


def postprocess(key, page, raw):
    title, sec = TITLES[key]
    page['title'] = f'홍익대학교 | {title}'
    if key == 'sso_login':
        items = [i for s in page['sections'] for i in s['items']]
        page['sections'] = [{'title': sec, 'items': items, 'ordered': False}] if items else []
        return page
    lines = _body_lines(raw)
    notes = [l.lstrip('* ').strip() for l in lines if l.startswith('*') and '보안문자' not in l]
    ways = [l for l in lines if l.endswith('인증하기')]
    kinds = []
    if '사용자 구분' in lines:
        j = lines.index('사용자 구분')
        kinds = [l for l in lines[j + 1:j + 6] if l in ('학부생', '대학원생', '교직원(교원·직원)', '기타(TA·부서 등)')]
    secs = []
    if notes:
        secs.append({'title': sec, 'items': notes, 'ordered': False})
    if kinds:
        secs.append({'title': '사용자 구분', 'items': kinds, 'ordered': False})
    if ways:
        secs.append({'title': '본인 확인 방법', 'items': ways, 'ordered': False})
    page['sections'] = secs
    return page
