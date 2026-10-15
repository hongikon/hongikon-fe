"""국제언어교육원 한국어교육부 홈페이지 koreanle.hongik.ac.kr:4433/new — 한국어 과정·한국어 도우미(재학생 봉사장학) 안내.

메뉴는 첫 화면 위 메뉴(한국어교육부·한국어교육과정·한국어 도우미 프로그램·학교생활정보·커뮤니티)에서 찾았다.
- 공지사항·Q&A·갤러리 게시판, 입학신청·도우미신청 양식(입력 화면), 수강지원(학번 조회 화면)은 넣지 않는다.
  Q&A 는 지원 예정 외국인의 입학·서류 질문뿐이라(학부생 물음이 아니다) 넣지 않는다. 브로슈어·교재 미리보기·레벨테스트는 내려받기·조회 화면뿐이다.
- 양식다운로드(edudata)는 파일 이름 목록만 있어 이름만 줄로 모은다(kle_forms).
- 오시는 길(language_06)은 본문 상자가 .contact 라 CONTENT_OF 로 따로 고른다. 연혁(language_03)에 '2024년 2월 예문관 이전'이 있어
  사회교육관(N동)이라 적힌 옛 페이지(life_03·school_01)보다 예문관 주소가 맞다.
- 소개(language_01)는 과정 이름 한 줄뿐이라 넣지 않는다. 공지사항 글은 날짜가 지나면 틀려져 넣지 않는다.
- 원문 HTML 안 주석(<!-- -->)에 옛 일정이 숨어 있어 주석은 지우고 읽는다(_intlkit.reparse).
외국어교육부(본교생 외국어 강좌, huniv.hongik.ac.kr/~hili/)는 403 이라 받지 못했다.
"""
import re

LABEL = '국제언어교육원 한국어교육부 홈페이지'
B = 'https://koreanle.hongik.ac.kr:4433/new'
PAGES = {
    'kle_course': f'{B}/education/education_01.php?sMenu=kor21',     # 한국어 정규과정 개요·학기 일정·교육내용
    'kle_admission': f'{B}/education/education_02.php?sMenu=kor22',  # 지원자격·제출서류·지원절차·학비·환불
    'kle_buddy': f'{B}/life/life_01.php?sMenu=kor31',                # 한국어 도우미(재학생 봉사장학) 소개·신청
    'kle_buddy-cert': f'{B}/life/life_03.php?sMenu=kor33',           # 도우미 활동 증명서
    'kle_facility': f'{B}/school/school_01.php?sMenu=kor41',         # 어학연수생 교내 편의시설
    'kle_visa': f'{B}/school/school_02.php?sMenu=kor42',             # 어학연수(D-4) 비자·외국인등록
    'kle_culture': f'{B}/school/school_03.php?sMenu=kor43',          # 문화체험·동아리
    'kle_insurance': f'{B}/school/school_05.php?sMenu=kor45',        # 어학연수생 보험
    'kle_faq': f'{B}/cmnct/faq.php?sMenu=kor52',                     # FAQ
    'kle_rules': f'{B}/school/school_04.php?sMenu=kor44',            # 학칙(출석·일시귀국·진급·휴학·자퇴·제적)
    'kle_location': f'{B}/language/language_06.php?sMenu=kor16',     # 오시는 길(예문관 A동 411호, 상수역)
    'kle_buddy-report': f'{B}/life/life_04.php?sMenu=kor34',         # 한국어 도우미 활동보고서 작성·제출
    'kle_forms': f'{B}/education/list.php?sMenu=kor24&db_code=edudata',  # 양식다운로드(수강취소·환불·일시출국 신고서 등 파일 목록)
}
# 본문 상자가 .typography 가 아닌 페이지.
CONTENT_OF = {'kle_location': {'class': 'contact'}}
CONTENT = {'class': 'typography'}
TITLES = {
    'kle_course': '한국어교육과정 과정소개', 'kle_admission': '입학절차 및 주의사항', 'kle_buddy': '한국어 도우미 프로그램',
    'kle_buddy-cert': '한국어 도우미 증명서신청', 'kle_facility': '교내편의시설', 'kle_visa': '비자 및 외국인등록',
    'kle_culture': '유학생활', 'kle_insurance': '유학생 보험', 'kle_faq': 'FAQ',
    'kle_rules': '학칙', 'kle_location': '오시는 길', 'kle_buddy-report': '활동계획서 및 보고서작성',
    'kle_forms': '양식다운로드',
}


def _faq_html(raw):
    # FAQ 는 표 한 줄(colspan=2)에 질문, 다음 줄 오른쪽 칸에 답이 있다 → <h4>질문</h4><div>답</div>.
    def table(m):
        tab = m.group(0)
        qs = re.findall(r"<tr><td colspan='2'[^>]*>(.*?)</td></tr>\s*<tr><td[^>]*></td><td[^>]*>(.*?)</td></tr>", tab, re.S)
        if not qs:
            return tab
        from sites import _intlkit as K
        return ''.join(f'<h4>{K.text(q)}</h4><p>{K.text(a)}</p>' for q, a in qs)
    return re.sub(r'<table\b.*?</table>', table, raw, flags=re.S)


def _forms(raw):
    # 양식다운로드는 파일 링크 표뿐이다. 링크 이름(한국어 부분)을 번호별 한 줄로 모은다.
    from sites import _intlkit as K
    rows = re.findall(r"<tr><td class='table2'>(\d+)</td>(.*?)</tr>", raw, re.S)
    items = []
    for _, body in rows:
        names = []
        for n in re.findall(r"<a href='[^']*up_file[^']*'[^>]*>(.*?)</a>", body, re.S):
            n = re.sub(r'\.(pdf|docx?|hwpx?|jpe?g|png)$', '', K.text(n))
            n = re.sub(r'\([^)가-힣]*\)', '', n)                  # 한글 없는 괄호(베트남어 번역)
            n = re.sub(r'_[^_가-힣]*[A-Za-zĐđ][^가-힣]*$', '', n)  # 뒤에 붙은 베트남어 이름
            n = re.sub(r'^\[최종\]', '', n)                        # 파일 이름 앞 '[최종]'
            n = re.sub(r'_한(_수정)?$', '', n).replace('_', ' ').strip()   # '_한'(한국어판)·'_한_수정' 꼬리
            if n and re.match(r'[가-힣\[]', n) and n not in names:   # 베트남어로 시작하는 작성방법 그림은 뺀다
                names.append(n)
        if names:
            items.append(' · '.join(names))
    return [{'title': '양식다운로드', 'items': items, 'ordered': False}]


def postprocess(key, page, raw):
    from sites import _intlkit as K
    if key == 'kle_forms':
        page = dict(page, sections=_forms(raw), title=TITLES[key])
        return page
    page = dict(page, **K.reparse(raw, CONTENT_OF.get(key, CONTENT), extra=_faq_html))
    secs = K.drop(page['sections'], bad_title=('신청바로가기', '지도보기', '양식 다운로드', '보고서 제출하기', '보고서제출현황'),
                  bad_item=('신청바로가기', '보고서종류 활동계획서'))
    secs = K.dedupe_titles(K.fold_parents(secs))
    if key == 'kle_buddy':
        # 본교 재학생이 보는 답이라 '본교 재학생 참조' 부분을 소개 바로 뒤로 올린다(글은 그대로).
        cut = next((i for i, s in enumerate(secs) if '본교 재학생' in s['title']), None)
        if cut:
            secs = secs[:1] + secs[cut:] + secs[1:cut]
    page['sections'] = secs
    page['title'] = TITLES.get(key, '국제언어교육원 한국어교육부')
    return page
