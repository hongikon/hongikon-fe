"""학교 홈페이지(www.hongik.ac.kr) 가운데 메뉴 크롤링(sources.py)이 안 받는 학사·행정 안내: 부서 안내 상세, 졸업 관련 공지,
강의평가·졸업사정·입학식·수강신청 문의처 공지, 개인형 이동장치 출입 금지, 통합로그인 보안코드 공지(+첨부 PDF), 대표 전화,
증명서 종류 안내(내려받기 파일). 학사·행정(admin) 갈래 주제(topics/ext_admin.py)가 쓴다.

공지(newscenter/notice.do?mode=view)는 날짜가 지나면 틀려지므로, 학생이 매 학기 안내받는 '상시 안내 글'만 둔다.
  - 졸업가운 대여·졸업물품 배부, 학위수여식 참석 안내, 졸업앨범 촬영 안내: 매 학기 같은 꼴로 다시 올라오는 공지의 최신 글.
    학기가 바뀌면 새 글 번호로 바꾼다(공지 검색: 학위복·학위수여식·졸업앨범).
robots.txt 는 /_attach/ 만 막는다. 증명서 종류 안내는 /cms/etcResourceDown.do 내려받기(스캔 PDF)라 글자가 없어,
학교 파일을 눈으로 옮긴 표(CERT_TYPES)를 쓰고 파일이 바뀌면(PDF /ID 가 달라지면) 답에서 뺀다.
"""
import re
from sites import _adminkit as kit

LABEL = '학교 홈페이지'
NOTICE = 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo={}'
ADMIN = 'https://www.hongik.ac.kr/kr/introduction/administrative.do?mode=view&articleNo={}&dept={}'
SUB = 'https://www.hongik.ac.kr/kr/introduction/subsidiary.do?mode=view&articleNo={}&article.offset=0&articleLimit=1000&dept={}'
REG = 'https://www.hongik.ac.kr/kr/introduction/regulations-book.do?mode=list&srCategoryId=109'

PAGES = {
    # 졸업(매 학기 공지의 최신 글)
    'hiweb_grad-gown': NOTICE.format(155217),        # 졸업가운 대여 및 졸업물품 배부 안내(서울캠퍼스 학부생) 2026.08.14 학생지원팀
    'hiweb_degree-ceremony': NOTICE.format(154149),  # (제76회) 2025학년도 후기 학위수여식 참석 안내(학부) 2026.07.14 학사지원팀
    'hiweb_grad-album': NOTICE.format(157231),       # 2026-2 졸업앨범 사진 촬영 안내(서울캠퍼스) 2026.09.17 학생지원팀
    # 통합로그인 보안코드(정보전산원 상시 안내)
    'hiweb_security-code': NOTICE.format(93872),
    # 부서 안내(행정기관·부속기관 상세): 주요업무·담당정보
    'hiweb_dept-academic': ADMIN.format(28058, 'A23100'),   # 학사지원팀
    'hiweb_dept-property': ADMIN.format(28107, 'A42100'),   # 관재팀
    'hiweb_dept-student': ADMIN.format(28061, 'A31100'),    # 학생지원팀
    'hiweb_dept-finance': ADMIN.format(28112, 'A45100'),    # 재무팀
    'hiweb_dept-general': ADMIN.format(28067, 'A41100'),    # 총무팀(우편물 배부)
    'hiweb_dept-it': SUB.format(78381, 'AC1250'),           # 정보전산원
    'hiweb_dept-rotc': SUB.format(78395, 'AC1110'),         # 133학생군사교육단(학군단)
    'hiweb_dept-broadcast': SUB.format(78378, 'AC1140'),    # 교육방송국
    'hiweb_dept-englishpaper': SUB.format(78375, 'AC1230'), # 영자신문사
    'hiweb_dept-newspaper': SUB.format(78374, 'AC2310'),    # 홍대신문사 / 교지편집위원회
    'hiweb_dept-reserve': SUB.format(78394, 'AC1240'),      # 예비군연대본부(서울)
    # 학사(매 학기 같은 꼴로 다시 올라오는 공지의 최신 글)
    'hiweb_lecture-eval': NOTICE.format(151810),     # 2026학년도 1학기 강의평가 시행 안내(학사) 2026.05.18
    'hiweb_lecture-midterm': NOTICE.format(158541),  # 2026학년도 2학기 강의중간평가 시행 안내(학생용) 2026.10
    'hiweb_grad-check': NOTICE.format(154928),       # 2026년 8월 졸업대상자 졸업사정결과 조회 안내(학부)
    'hiweb_credit-withdraw': NOTICE.format(156088),  # 2026학년도 2학기 학점포기 신청 안내
    'hiweb_major-name': NOTICE.format(153800),       # [서울캠퍼스] 2026년 8월 졸업예정자 전공명 선택 안내(2차)
    'hiweb_entrance': NOTICE.format(147615),         # 2026학년도 신입생 입학식 안내
    'hiweb_course-contacts': NOTICE.format(154444),  # [전학년 필독] 2026-2학기 수강신청 안내 ①의 '문의처' 부분만
    'hiweb_freshman-guide': NOTICE.format(145568),   # 2026학년도 신입생 수강신청 안내의 학번 검색·클래스넷 로그인 부분만
    'hiweb_class-periods': NOTICE.format(145568),    # 같은 공지의 '기타 참고사항'(교시 시간·교과과정·학수번호) 부분만
    # 개인형 이동장치(전동킥보드)·자전거 교내 출입 금지(상시 규칙)
    'hiweb_pm-ban': NOTICE.format(148202),           # 교내 안전을 위한 개인형 이동장치 출입 연관 안내 및 협조(포스터 그림 2장)
    'hiweb_pm-parking': NOTICE.format(131093),       # 개인형 이동장치 교내 출입 금지 및 주차구역 변경 안내
    # 부서 안내(부속기관): 고시반·공학인증·교양과목
    'hiweb_dept-future': SUB.format(140827, 'AC1270'),   # 미래인재센터(고시반)
    'hiweb_dept-abeek': SUB.format(78393, 'AC1130'),     # 공학교육혁신센터(공학교육인증)
    'hiweb_dept-liberal': SUB.format(79655, 'AC4100'),   # 교양교육원
    'hiweb_dept-autonomous': ADMIN.format(79210, 'A2B110'),  # 자율전공지원실(캠퍼스자율전공 행정)
    # 학적변동 안내(학사지원팀 상시 안내: 휴학·제적·전과·재입학 길 + 학사지원팀 이메일 문의처)
    # 수강신청 부정행위(매크로) 관리: 매 정규학기 수강신청마다 같은 꼴로 다시 올라오는 공지의 최신 글
    'hiweb_reg-macro': NOTICE.format(154613),        # 2026학년도 2학기 수강신청 부정행위 관리 시행 안내(학사)
    # 학생 포상(교외 공모전·대회 수상자 총장표창): 매 학기 다시 올라오는 서울 학부생 공지의 최신 글(학생지원팀)
    'hiweb_student-award': NOTICE.format(153561),    # [서울 학부생] 2026-1학기 학생 포상 추천 접수(~7.2 기한연장)
    # 대외홍보실(공식 SNS 운영) 부서 안내: 홍익SNS 주제의 전화·위치 출처
    'hiweb_dept-pr': ADMIN.format(112161, 'A13120'),
    'hiweb_status-guide': NOTICE.format(146799),     # [신입생 필독] 학적변동(군휴학, 휴학, 제적, 전과, 재입학 등) 안내 2025.12.29 학사지원팀
    # 학칙(규정집 › 제2편 학칙 › 1) 학칙. 전문이 페이지에 글로 실려 있다). 같은 주소를 세 키로 받아 필요한 조문만 옮긴다.
    'hiweb_rules': REG,          # 학칙 정보(제정·개정)와 장 목록
    'hiweb_rules-term': REG,     # 제5조(수업 및 재학연한)·제7조(학년)·제8조(학기)·제9조(수업일수)·제10조(휴업일)
    'hiweb_rules-exam': REG,     # 제42조(시험)·제43조(추가시험)·제44조(출석의무)
    'hiweb_rules-student': REG,  # 제62조(금지사항)·제64조(집회 및 광고승인)·제65조(포상)·제66조(징계)·제67조(상벌위원회)
    # 대표 전화·주소(전화번호 검색 페이지 머리 설명)
    'hiweb_contact': 'https://www.hongik.ac.kr/kr/introduction/search-phone.do',
    # 증명서 종류 및 안내(인터넷증명발급 페이지의 [보기] 내려받기)
    'hiweb_cert-types': 'https://www.hongik.ac.kr/cms/etcResourceDown.do?site=%24cms%24NYJyA&key=%24cms%24pm9hDxhMC0i5k4oV2DiDhQicBqdgJUcC0NAKQmquBqBwA5OALY4ADLAlAHQAOAJgGZA',
}

CONTENT = {'class': 'fr-view'}

# 학교 파일 '붙임2-증명서종류안내(학사지원팀).pdf'(스캔 1쪽)를 옮긴 표. 학부 칸만 옮기고 대학원 칸은 뺐다(서울캠퍼스 학부생 챗봇).
# O=발급, X=발급 안 됨. 참고 사항은 원문 그대로.
CERT_HEAD = ['증명서', '학부 국문', '학부 영문', '발급기', '인터넷', '팩스민원', '우편민원', '참고 사항']
CERT_TYPES = [
    ['재학증명서', 'O', 'O', 'O', 'O', 'O', 'O', ''],
    ['휴학증명서', 'O', 'O', 'O', 'O', 'O', 'O', ''],
    ['제적증명서', 'O', 'O', 'O', 'O', 'O', 'O', ''],
    ['수료증명서', 'O', 'O', 'O', 'O', 'O', 'O', ''],
    ['수료예정증명서', 'O', 'O', 'O', 'O', 'O', 'O', '해당학기 성적입력 완료 후 학기 종료일까지 발급 가능'],
    ['졸업(학위수여)증명서', 'O', 'O', 'O', 'O', 'O', 'O', ''],
    ['졸업(학위수여)예정증명서', 'O', 'O', 'O', 'O', 'O', 'O', '당해 학기 졸업예정자만 발급 가능'],
    ['성적증명서', 'O', 'O', 'O', 'O', 'O', 'O', ''],
    ['복학예정증명서', 'O', 'X', 'O', 'O', 'O', 'O', '복학신청 승인 이후부터 학기 개강일 전까지 발급'],
    ['복수전공이수증명서', 'O', 'X', 'O', 'O', 'O', 'O', '발급대상 : 복수전공 이수중인 재학생, 졸업 후에는 졸업증명서에 기재됨'],
    ['부전공이수증명서', 'O', 'X', 'O', 'O', 'O', 'O', '발급대상 : 부전공 이수중인 재학생, 졸업 후에는 졸업증명서에 기재됨'],
    ['융합전공이수증명서', 'O', 'X', 'O', 'O', 'O', 'O', '발급대상 : 융합전공 이수중인 재학생, 졸업 후에는 졸업증명서에 기재됨'],
    ['장학수혜증명서', 'O', 'O', 'O', 'O', 'O', 'O', ''],
    ['교육비납입증명서', 'O', 'X', 'O', 'X', 'O', 'X', '연말정산기간에만 발급가능. 수수료 무료'],
    ['학적원부', 'O', 'X', 'X', 'X', 'O', 'O', ''],
    ['성적원부', 'O', 'X', 'X', 'X', 'O', 'O', '성적경고, 학기재수강이 모두 기재됨'],
    ['성적원부(복수전공)', 'O', 'X', 'X', 'X', 'O', 'O', '복수전공 과목에만 이수구분 기재됨'],
    ['성적원부(융합전공)', 'O', 'X', 'X', 'X', 'O', 'O', '융합전공 과목에만 이수구분 기재됨'],
    ['성적원부(부전공)', 'O', 'X', 'X', 'X', 'O', 'O', '부전공 과목에만 이수구분 기재됨'],
]
CERT_FILE_ID = '25DCBE0F11A059B5FED9E439936B80AF'  # 옮겨 적은 파일(2019-03-26 스캔)의 PDF /ID. 다르면 학교가 파일을 바꾼 것이라 답에서 뺀다.


def _cert_types(page, raw):
    # crawl.py 는 받은 내용을 글자로 읽어 두므로(깨진 바이트는 버림) 크기 대신 PDF /ID 로 같은 파일인지 본다.
    if CERT_FILE_ID not in raw:
        page['sections'] = []
        return page
    page['title'] = '홍익대학교 | 증명서 종류 및 안내'
    lines = []
    for name, ko, en, *ways in CERT_TYPES:
        note = ways.pop()
        lang = '국문·영문' if en == 'O' else '국문만(영문 X)'
        how = [h for h, v in zip(CERT_HEAD[3:7], ways) if v == 'O']
        lines.append(f"{name}: {lang} · {'·'.join(how) if how else '발급 방법 X'}" + (f' — {note}' if note else ''))
    page['sections'] = [{
        'title': '증명서 종류별 발급 방법(학부)',
        'items': ['학교 홈페이지 인터넷증명발급 페이지의 \'증명서 종류 및 안내\' 파일(학사지원팀)을 옮겼어요. 증명서마다 되는 언어와 발급 방법(발급기·인터넷·팩스민원·우편민원)이에요.'] + lines,
        'ordered': False,
    }]
    return page


# 공지 148202 는 글 없이 포스터 그림 2장뿐이라 그림의 글을 옮겼다. 같은 그림(파일 이름)이 걸려 있을 때만 붙인다.
PM_POSTER = ('JWpreDXBuhODXLolCtnGqvdRtR.png', [
    '시행 2025.02.13부터',
    '개인형이동장치 전동 킥보드 · 자전거 교내 출입금지',
    '주차 허용 구역 (정문 앞 광장)',
])

# 공지 93872 첨부 '통합로그인 보안코드 설정 및 사용안내.pdf'(attachNo 48958)의 글. 글이 같은 첨부를 걸고 있을 때만 붙인다.
SECURITY_PDF = (48958, '보안코드 설정 및 사용방법 안내', [
    '1. 보안코드 설정방법',
    '가. [개인정보 변경]클릭: 마이홍익 > 개인정보변경',
    "나. 보안코드 항목에서 '보안코드 사용여부'를 체크하면 보안코드 입력 활성화(기본값은 보안코드 미사용)",
    "- 보안코드 사용을 원하는 경우에는 '보안코드'란에 숫자 6자리 입력('보안코드 확인'란도 동일하게 입력) 후 개인정보변경(저장)",
    "- 보안코드 미사용으로 변경을 원하는 경우에는 '보안코드 사용여부' 체크를 해제 후 개인정보변경(저장)",
    '2. 보안코드 로그인 방법',
    '가. 통합 로그인 페이지에서 ID / PW로 로그인 > 보안코드 입력창(보안코드 미사용자는 바로 로그인) 활성화 > 설정한 보안코드 입력 후 로그인',
    '3. 보안코드 변경 방법',
    '가. 개인정보변경에서 설정 : 1. 보안코드 설정방법 참고',
    '나. 보안코드 찾기 - 보안코드 사용자의 경우 보안코드 분실 시 ID / PW를 통한 로그인 후 보안코드 입력창 하단의 [보안코드 찾기] 클릭 (비밀번호 찾기와 기능 동일)',
])


REPORT_URL = 'https://my.hongik.ac.kr/my/hongik-report.do'  # 공통 메뉴 '홍익신문고' 링크(2026-10-15 확인: 열면 마이홍익 로그인으로 넘어감)


def _between(lines, start, stop=None):
    """start 로 시작하는 줄부터 stop 으로 시작하는 줄 앞까지."""
    out, on = [], False
    for v in lines:
        if v.startswith(start):
            on = True
        elif stop and on and v.startswith(stop):
            break
        if on:
            out.append(v)
    return out


def _course_contacts(raw):
    """수강신청 안내 ①에서 '문의처' 두 덩어리만(서울캠퍼스). 학과 표 그림 자리('※ 서울캠퍼스' 등)와 융합전공 표는 뺀다."""
    lines = kit.box_lines(raw)
    a = _between(lines, '1. 교양교육원', '※ 세종캠퍼스')
    b = _between(lines, '2. 학사 문의 가능 사항', '★ 수강신청 전 반드시')
    secs = []
    if a:
        secs.append({'title': a[0], 'items': a[1:], 'ordered': False})
    if b:
        secs.append({'title': b[0], 'items': b[1:], 'ordered': False})
    return secs


def _freshman(raw, part):
    """신입생 수강신청 안내에서 해마다 같은 부분만: part='id' 학번 검색 길·클래스넷 로그인 / 'periods' 교시 시간·교과과정·학수번호."""
    lines = kit.box_lines(raw)
    if part == 'id':
        a = _between(lines, '★ 학번 검색', '3. 수강신청 시간표')
        return [{'title': '학번 검색·클래스넷 로그인', 'items': a[1:], 'ordered': False}] if a else []
    b = _between(lines, '4. 기타 참고사항')
    return [{'title': '수업 시간(교시)·교과과정·학수번호', 'items': b[1:], 'ordered': False}] if b else []


RULE_ARTICLES = {
    'hiweb_rules-term': ('제5조', '제7조', '제8조', '제9조', '제10조'),
    'hiweb_rules-exam': ('제42조', '제43조', '제44조'),
    'hiweb_rules-student': ('제62조', '제64조', '제65조', '제66조', '제67조'),
}


def _rules(key, raw):
    """규정집 학칙 화면: 'b-regulation-con-box' 안의 제정·개정 날짜와 본문(fr-view)을 읽는다."""
    i = raw.find('b-regulation-con-box')
    if i < 0:
        return []
    box = raw[i:]
    dates = re.findall(r'<li class="b-date-box">\s*<span>(제정|개정)</span>\s*<span>\s*([\d.]+)', box)
    lines = kit.box_lines(box)
    if not lines or not lines[0].startswith('홍익대학교 학칙'):
        return []
    if key == 'hiweb_rules':
        info = [f'{a} {b}' for a, b in dates] + ['제2편 학칙 › 1) 학칙 (파일다운로드: PDF)', '* 별표 및 서식은 각 규정의 PDF 첨부파일을 참고하시길 바랍니다.']
        chapters = [v for v in lines if re.match(r'^제\d+장 ', v)]
        return [{'title': '홍익대학교 학칙', 'items': info, 'ordered': False},
                {'title': '학칙 목차(장)', 'items': chapters, 'ordered': False}]
    want = RULE_ARTICLES[key]
    secs, cur = [], None
    for v in lines:
        m = re.match(r'^(제\d+조(?:의\d+)?)\(([^)]*)\)\s*(.*)$', v)
        if m or re.match(r'^제\d+장 ', v):
            cur = None
            if m and m.group(1) in want:
                cur = {'title': f'{m.group(1)}({m.group(2)})', 'items': [m.group(3)] if m.group(3) else [], 'ordered': False}
                secs.append(cur)
            continue
        if cur is not None:
            cur['items'].append(v)
    return secs


def _notice_title(page, raw):
    m = re.search(r'<span class="b-title">(.*?)</span>', raw, re.S)
    if m:
        page['title'] = '홍익대학교 | ' + re.sub(r'\s+', ' ', m.group(1)).strip()


def postprocess(key, page, raw):
    if key.startswith('hiweb_rules'):
        page['title'] = '홍익대학교 | 규정집 · 홍익대학교 학칙'
        page['sections'] = _rules(key, raw)
        return page
    if key == 'hiweb_course-contacts':
        _notice_title(page, raw)
        page['sections'] = _course_contacts(raw)
        return page
    if key in ('hiweb_freshman-guide', 'hiweb_class-periods'):
        _notice_title(page, raw)
        page['sections'] = _freshman(raw, 'id' if key == 'hiweb_freshman-guide' else 'periods')
        return page
    if key == 'hiweb_status-guide':
        # 번호 줄 가운데 '1. 휴학 …', '2. 제적 …', '3. 전과 …', '4. 문의처 …'만 덩어리 제목이다(군휴학 소급 절차의 '1.'·'2.'는 줄로 둔다).
        _notice_title(page, raw)
        secs = [{'title': '안내', 'items': [], 'ordered': False}]
        for v in kit.box_lines(raw):
            if v in kit.JUNK:
                continue
            if re.match(r'^[1-4]\. (휴학|제적|전과|문의처)', v):
                secs.append({'title': v, 'items': [], 'ordered': False})
            else:
                secs[-1]['items'].append(v)
        page['sections'] = [x for x in secs if x['items']]
        return page
    if key == 'hiweb_pm-ban':
        _notice_title(page, raw)
        name, lines = PM_POSTER
        page['sections'] = [{'title': '포스터(그림)의 글', 'items': lines, 'ordered': False}] if name in raw else []
        return page
    if key == 'hiweb_cert-types':
        return _cert_types(page, raw)
    if key == 'hiweb_contact':
        secs = kit.reparse(raw, {'class': 'title-desc-box'})
        items = [i for s in secs for i in s['items']]
        # '서울캠퍼스 :' 아래 주소·전화·팩스·메일만(세종캠퍼스는 뺀다)
        seoul = []
        on = False
        for i in items:
            if i.startswith('서울캠퍼스'):
                on = True
                continue
            if i.startswith('세종캠퍼스'):
                break
            if on:
                seoul.append(i.strip().rstrip(','))
        page['title'] = '홍익대학교 | 대표 전화·주소'
        page['sections'] = [{'title': '서울캠퍼스', 'items': seoul, 'ordered': False}] if seoul else []
        return page
    if key.startswith('hiweb_dept-'):
        page['sections'] = kit.dept_sections(kit.reparse(raw, {'id': 'cms-content'}))
        if key == 'hiweb_dept-student' and REPORT_URL in raw:
            # 학교 홈페이지 공통 메뉴(재학생)의 '홍익신문고' 링크. 링크 너머는 마이홍익 로그인 화면으로 넘어간다.
            page['sections'].append({'title': '재학생 메뉴 · 홍익신문고', 'items': [
                f'학교 홈페이지 재학생 메뉴의 \'홍익신문고\' → {REPORT_URL} (마이홍익 로그인 필요)'], 'ordered': False})
        return page
    # 공지 본문
    _notice_title(page, raw)
    page['sections'] = kit.notice_sections(kit.box_lines(raw), drop=('졸업생 여러분',))
    if key == 'hiweb_lecture-midterm':
        # '2. 평가 기간 : …'처럼 내용이 붙은 번호 줄이 '1. 평가 목적' 덩어리에 섞이므로 따로 뗀다.
        for s in page['sections']:
            if s['title'].startswith('1. 평가 목적'):
                keep = [i for i in s['items'] if not re.match(r'^[2-4]\. ', i) and not i.startswith('※ 담당 교수')]
                moved = [i for i in s['items'] if i not in keep]
                s['items'] = keep
                page['sections'].insert(page['sections'].index(s) + 1, {'title': '평가 기간·방법', 'items': moved, 'ordered': False})
                break
    if key == 'hiweb_security-code':
        no, name, lines = SECURITY_PDF
        if f'attachNo={no}' in raw:
            page['sections'].append({'title': f'첨부 · {name}', 'items': lines, 'ordered': False})
    return page
