"""국제협력본부(국제교류실·국제학생지원실) 홈페이지 oia.hongik.ac.kr — 상시 안내 메뉴만.

메뉴는 첫 화면의 전체 메뉴(/oia/content/N)에서 찾았다. 공지사항·경험보고서 게시판은 날짜가 지나면 틀려져 넣지 않는다.
구성원 소개(content/2)는 직원 이름·개인 메일이라 넣지 않는다. 외국인 채용 정보(content/15)는 바깥 사이트 링크뿐이다.
서식자료실 글 중 해외자매대학 개별 계절학기 신청(boardview/3/7)은 상시 절차 안내라 넣는다.
국제학생지원실 서식(board/5) 글도 양식과 함께 휴학·복학·자퇴·출국신고 절차가 적혀 있어 넣는다(2021년 글이지만 날짜 없는 상시 절차).
국제학생지원실 공지(board/4)의 TOPIK 제출·어학인증장학금 신청 글은 학기마다 날짜가 바뀌는 공지라 넣지 않는다.
공지(board/1) 중 1/157 은 '2023학년도 파견부터' 바뀐 지원자격(마지막 정규학기 파견 불가)을 알리는 상시 규정 글이라 넣는다.
Q&A(board/14)는 국제교류실 직원이 단 답글(┗ Re) 가운데 상시 규칙만 넣는다(14/113 SAF, 14/73 ECTS, 14/52 쿼터제, 14/75·77 어학성적,
  14/30 방문학생 학점인정, 14/48 영어성적, 14/79 여권사본, 14/71 지원 전공, 14/118 2차지원, 14/96 이수 학기). 2026-10 기준 답글은 14/118 이 마지막이다.
  답글 아래 '[원본내용]'(학생이 쓴 질문 원문)부터는 잘라 낸다. 학기별 일정·특정 학교 답은 넣지 않는다.
"""
import re

LABEL = '국제협력본부 홈페이지'
B = 'https://oia.hongik.ac.kr/oia'
PAGES = {
    'oia_intro': f'{B}/content/1',             # 본부 소개 · 업무시간 · 위치 · 전화
    'oia_partners': f'{B}/content/3',          # 자매대학현황
    'oia_isl': f'{B}/content/4',               # 외국인유학생라운지(ISL)
    'oia_outbound': f'{B}/content/6',          # OUTBOUND(교환·방문·복수학위) 지원자격·시기·서류·선발
    'oia_inbound': f'{B}/content/7',           # INBOUND(외국 대학 학생이 홍익대로)
    'oia_language-intern': f'{B}/content/9',   # 해외어학연수 / 해외인턴십 학점인정
    'oia_buddy': f'{B}/content/10',            # 도우미(버디) 프로그램
    'oia_faq': f'{B}/content/12',              # 교류학생 FAQ
    'oia_seasonal': f'{B}/boardview/3/7',      # 해외자매대학 개별 계절학기 신청
    'oia_credit-forms': f'{B}/boardview/3/8',  # 교류학생 학점인정신청서 · 교류교환 취소 신청서 양식
    'oia_academic': f'{B}/content/18',         # 유학생 학사안내(휴·복학 비자, 성적경고, 제적, 전과, 계절학기)
    'oia_course': f'{B}/content/19',           # 유학생 수강신청
    'oia_scholarship': f'{B}/content/20',      # 유학생 장학금(홍익 글로벌 장학금)
    'oia_dorm': f'{B}/content/21',             # 유학생 기숙사
    'oia_support': f'{B}/content/22',          # 유학생 지원 프로그램(도우미·튜터링·상담)
    'oia_visa': f'{B}/content/23',             # 비자(D-2 발급·연장·휴복학·학기 중 출국)
    'oia_arc': f'{B}/content/24',              # 외국인 등록증
    'oia_parttime': f'{B}/content/25',         # 시간제 취업(아르바이트)
    'oia_insurance': f'{B}/content/26',        # 의료보험
    'oia_agencies': f'{B}/content/27',         # 관련 기관(출입국관리사무소·1345·하이코리아)
    'oia_global-out': f'{B}/content/29',       # 대학교육혁신 OUTBOUND(전공연계 해외파견·해외취업 인턴십·글로벌 서포팅 장학금)
    'oia_global-in': f'{B}/content/30',        # 대학교육혁신 INBOUND(글로벌 학습지원·유학생 지원 프로그램)
    # 국제학생지원실 서식(board/5) — 양식과 함께 상시 절차가 적힌 글
    'oia_form-leave': f'{B}/boardview/5/1',     # 휴학원서 · 휴학 신청 절차(클래스넷 불가)
    'oia_form-return': f'{B}/boardview/5/2',    # 복학원서 · 복학 절차
    'oia_form-withdraw': f'{B}/boardview/5/3',  # 자퇴원서 · 자퇴 절차 · 등록금 환불 기준
    'oia_form-departure': f'{B}/boardview/5/6', # 학기 중 출국신고서
    'oia_form-advisor': f'{B}/boardview/5/9',   # 초과학기자 비자연장용 지도교수 확인서
    'oia_form-parttime': f'{B}/boardview/5/10', # 시간제 취업 확인서
    'oia_last-semester': f'{B}/boardview/1/157',  # OUTBOUND 지원자격 — 마지막 정규학기·초과학기 파견 불가(2023학년도 파견부터)
    'oia_qa-saf': f'{B}/boardview/14/113',        # Q&A 국제교류실 답 — SAF 방문학생, 방문 최대 1년
    'oia_qa-ects': f'{B}/boardview/14/73',        # Q&A 국제교류실 답 — 유럽 ECTS 학점 환산(1.6ECTS = 1학점)
    'oia_qa-quarter': f'{B}/boardview/14/52',     # Q&A 국제교류실 답 — 상대교가 쿼터제일 때(쿼터 2개 = 본교 1학기, 최대 18학점), 내부선발 필수
    'oia_qa-score-valid': f'{B}/boardview/14/75', # Q&A 국제교류실 답 — 내부선발 어학성적은 유효기간 이내만
    'oia_qa-score-pdf': f'{B}/boardview/14/77',   # Q&A 국제교류실 답 — 어학성적표는 기관 PDF 출력본 제출 가능
    'oia_qa-visit-credit': f'{B}/boardview/14/30',  # Q&A 국제교류실 답 — 방문학생 학점인정 두 조건(내부선발 사전승인, 양교 등록)
    'oia_qa-no-score': f'{B}/boardview/14/48',      # Q&A 국제교류실 답 — 상대교 어학요건이 없어도 내부선발용 영어성적 제출
    'oia_qa-passport': f'{B}/boardview/14/79',      # Q&A 국제교류실 답 — 내부선발 여권사본은 여권정보증명서로 대체 가능
    'oia_qa-major': f'{B}/boardview/14/71',         # Q&A 국제교류실 답 — 상대교 전공은 홍대 전공(부·복수전공 포함)과 일치하게 지원
    'oia_qa-second-round': f'{B}/boardview/14/118', # Q&A 국제교류실 답 — 상대교 2차지원 불합격은 드물지만 있음
    'oia_qa-semester-count': f'{B}/boardview/14/96',  # Q&A 국제교류실 답 — 파견 가능 학기는 이수 학기 기준(4년제 최대 7학기째)
    # 서식자료실(board/3) 해외어학연수·해외인턴십 학점인정 신청서 글(첨부 양식 + content/9 안내 링크)
    'oia_form-language': f'{B}/boardview/3/4',      # [Outbound] 해외어학연수 학점인정 신청서
    'oia_form-intern': f'{B}/boardview/3/5',        # [Outbound] 해외인턴십 학점인정 신청서(기관소개자료 양식 포함)
    # 공지(board/1) 맨 위에 고정된 '[참고]' 상시 안내 글(학기 날짜 없는 규칙·제도 설명)
    'oia_ref-seasonal': f'{B}/boardview/1/411',   # [참고] 해외자매대학 계절학기 참가학생 학점인정(자격·최대 6학점·절차)
    'oia_ref-credit': f'{B}/boardview/1/399',     # [참고] Outbound 교류교환 학점인정(비자매대학·개인 방문 인정 불가, 인정학점(전공)=주전공)
    'oia_ref-mirae': f'{B}/boardview/1/392',      # [참고] 미래에셋 해외교환 장학금
    'oia_ref-asemduo': f'{B}/boardview/1/391',    # [참고] 아셈듀오(ASEM-DUO) 장학금
    'oia_ref-west': f'{B}/boardview/1/393',       # [참고] 한미 WEST 대학생 연수 프로그램
    'oia_arch-credit': f'{B}/boardview/1/527',    # (★중요★) 건축학부 교류학생 대체학점 사전승인
    # 국제학생지원실 공지(board/4) 중 학기 날짜가 아닌 상시 규칙을 알린 글(교육부 지침, 2025-2학기부터 계속 적용)
    'oia_iss-cyber': f'{B}/boardview/4/457',      # [중요] 외국인 유학생 사이버강좌 수강 제한(정규학기 1강좌)
    # 국제학생지원실 '오리엔테이션 및 기타 안내문'(board/6) 의 최신 학기초과자 매뉴얼. 첨부 PDF 가 글자 없는 그림이라
    # 학부생에 해당하는 문답만 PDF 원문 그대로 옮겨 적는다(postprocess MANUAL_OVERTERM). PDF 가 바뀌면 다시 옮겨 적는다.
    'oia_manual-overterm': f'{B}/boardview/6/9',  # 2023학년도 대학원 수료생 & 학부생 초과학기자 매뉴얼(국문 PDF)
}
CONTENT = {'id': 'divContent'}
# 답 아래 출처 링크에 붙는 이름(홈페이지 메뉴 이름).
TITLES = {
    'oia_intro': '본부소개', 'oia_partners': '자매대학현황', 'oia_isl': '외국인유학생라운지(ISL)',
    'oia_outbound': 'OUTBOUND 프로그램', 'oia_inbound': 'INBOUND 프로그램', 'oia_language-intern': '해외어학연수 / 해외인턴십',
    'oia_buddy': '도우미(버디) 프로그램', 'oia_faq': '국제교류실 FAQ', 'oia_seasonal': '해외자매대학 개별 계절학기 신청',
    'oia_credit-forms': '교류교환 학생 학점인정신청서·취소 신청서 양식', 'oia_academic': '유학생 학사안내',
    'oia_course': '유학생 수강신청', 'oia_scholarship': '유학생 장학금', 'oia_dorm': '유학생 기숙사',
    'oia_support': '유학생 지원 프로그램', 'oia_visa': '비자', 'oia_arc': '외국인 등록증', 'oia_parttime': '시간제 취업',
    'oia_insurance': '의료보험', 'oia_agencies': '관련 기관 안내', 'oia_global-out': '대학교육혁신 OUTBOUND 프로그램',
    'oia_global-in': '대학교육혁신 유학생 지원 프로그램',
    'oia_form-leave': '[양식] 휴학원서', 'oia_form-return': '[양식] 복학원서', 'oia_form-withdraw': '[양식] 자퇴원서',
    'oia_form-departure': '[양식] 학기 중 출국신고서', 'oia_form-advisor': '[양식] 논문지도·졸업시험·학점취득 일정에 대한 지도교수 확인서',
    'oia_form-parttime': '[양식] 시간제 취업 확인서',
    'oia_last-semester': 'OUTBOUND 교류학생 지원자격(마지막 학기·초과학기 파견)',
    'oia_qa-saf': 'Q&A 국제교류실 답변 — 방문학생과 SAF', 'oia_qa-ects': 'Q&A 국제교류실 답변 — 학점 관련(ECTS)',
    'oia_qa-quarter': 'Q&A 국제교류실 답변 — 방문학생 희망 학교가 Quarter제인 경우',
    'oia_qa-score-valid': 'Q&A 국제교류실 답변 — iBT 토플 인정 관련', 'oia_qa-score-pdf': 'Q&A 국제교류실 답변 — 어학성적표 제출',
    'oia_qa-visit-credit': 'Q&A 국제교류실 답변 — 방문학생의 학점 인정', 'oia_qa-no-score': 'Q&A 국제교류실 답변 — 영어가능자 점수',
    'oia_qa-passport': 'Q&A 국제교류실 답변 — 교환학생 여권 사본', 'oia_qa-major': 'Q&A 국제교류실 답변 — 교환학생 지원 전공',
    'oia_qa-second-round': 'Q&A 국제교류실 답변 — 상대교 2차지원 불합격', 'oia_qa-semester-count': 'Q&A 국제교류실 답변 — 파견 가능 학기(이수 학기 기준)',
    'oia_form-language': '[Outbound] 해외어학연수 학점인정 신청서', 'oia_form-intern': '[Outbound] 해외인턴십 학점인정 신청서',
    'oia_ref-seasonal': '[참고] 해외자매대학 계절학기 참가학생 학점인정', 'oia_ref-credit': '[참고] Outbound 교류교환 학점인정 관련',
    'oia_ref-mirae': '[참고] 미래에셋 장학금이란?', 'oia_ref-asemduo': '[참고] 아셈듀오(ASEM-DUO) 장학금이란?',
    'oia_ref-west': '[참고] 한미 WEST 대학생 연수 프로그램이란?', 'oia_arch-credit': '[건축도시대학 건축학부] 교류학생 대체학점 관련 안내사항',
    'oia_manual-overterm': '2023학년도 대학원 수료생 & 학부생 초과학기자 매뉴얼',
    'oia_iss-cyber': '[중요] 외국인 유학생 사이버강좌 강의 수강 제한 관련',
}

# boardview/6/9 첨부 '2023 수료생_학기초과자 매뉴얼 (국문).pdf'(2023년 3월 작성) 중 학부생 문답. 그림 PDF 라 원문을 그대로 옮겨 적었다.
# (대학원 수료생 문답, 그리고 4쪽을 그대로 베낀 듯한 '학기초과자 비자연장 유의사항'(본문이 '수료생만'이라 적혀 있음)은 넣지 않는다.)
MANUAL_OVERTERM = [
    {'title': 'Q. 학기초과자란 무엇인가요?', 'items': [
        '정규학기 내 필수 학점을 모두 이수하지 못하였거나, 필수 이수학점은 충족하였지만 기타 졸업요건 미충족인 경우 학기초과자로 전환됨',
        "단 학적은 여전히 '재학'임"], 'ordered': False},
    {'title': 'Q. 학기초과자 수업료는 어떻게 납부해야 하나요?', 'items': [
        '만약 학점 부족으로 학기초과자가 된 경우, 우선 정해진 기간 내 수강신청을 한 후, 최종 수강신청한 학점에 따라 3월 중순-말 / 9월 중순-말 기간에 등록금이 고지됨.',
        '★학부', '  1학점-3학점까지: 원 학과 등록금의 1/6', '  3학점-6학점까지: 원 학과 등록금의 1/3',
        '  7학점-9학점까지: 원 학과 등록금의 1/2', '  10학점-한계학점: 원 학과 등록금 전액'], 'ordered': False},
    {'title': 'Q. 학사학위취득유예제란 무엇인가요?', 'items': [
        '정규학기를 모두 등록하였고, 학칙이 정한 졸업에 필요한 요건을 모두 충족한 학생은 학사학위취득유예를 신청할 수 있음',
        '단, 조기졸업신청자, 학석사연계과정자, 3회연속 성적경고자, 재학연한의 마지막 학기에 재학중인 자는 신청할 수 없음',
        '신청 시기: 1학기 5월 초~7월말 중 (해당학기 공지 확인) / 2학기 10월 초~11월 말 (해당학기 공지 확인)',
        '신청 방법: 학생 클래스넷에서 본인이 직접 신청',
        '유예기간은 1개 학기이며, 유예 연장 희망 시, 매 학기 유예 신청해야 함.',
        '유예 확정된 외국인 유학생은 더 이상 비자 연장이 불가능하며 반드시 귀국해야 함.'], 'ordered': False},
]



def postprocess(key, page, raw):
    from sites import _intlkit as K
    if key == 'oia_global-out':
        extra = lambda r: K.prefix_headings(r, under_title_ment=True)
    else:
        extra = lambda r: K.prefix_headings(r, generic=('학점인정 안내',))
    if key.startswith('oia_qa-'):
        # Q&A 답글: 학생이 쓴 질문 원문('[원본내용]' 아래)은 버리고 국제교류실 답만 남긴다.
        raw = re.sub(r'-{20,}', '', raw.split('[원본내용]')[0]) + '</div></div>'
    page = dict(page, **K.reparse(raw, CONTENT, extra=extra))
    secs = K.drop(page['sections'],
                  bad_title=('ISL 사진', '제 2 기숙사 사진'),
                  bad_item=('페이지 준비중', 'ISL 입구', '이용에 불편을', '현재 페이지는 준비중', '필수항목'),
                  stop_title=('이전글', '다음글', '댓글'))
    secs = [dict(s, items=[i for i in s['items'] if not i.startswith('이전글')]) for s in secs]
    if key.startswith('oia_qa-'):
        # 답글 머리('[답글] 안녕하세요. 국제교류실 입니다.')는 뺀다.
        hello = r'^\[답글\]\s*(안녕하세요[.?]?\s*)?(국제교류실\s*입니다\.?\s*)?'
        secs = [dict(s, items=[re.sub(hello, '', i).strip() for i in s['items'] if re.sub(hello, '', i).strip()]) for s in secs]
        # 번호 붙은 답(1. … 2. … 또는 1) … 2) …)은 번호마다 줄을 나누고, 끝인사 '감사합니다.' 는 뺀다.
        secs = [dict(s, items=[x.strip() for i in s['items'] for x in re.split(r'\s(?=\d[.)]\s)', re.sub(r'\s*감사합니다\.?\s*$', '', i)) if x.strip()])
                for s in secs]
    for s in secs:
        # 게시글: '작성자·날짜·조회수' 줄과 첨부파일 이름 줄은 빼고, 첨부파일 제목은 지운다(본문이 그 아래 붙는다).
        s['items'] = [i for i in s['items'] if not re.search(r'\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}', i)
                      and not re.search(r'\.(hwpx?|docx?|pdf|xlsx?)\s*$', i)]
        if s['title'] == '첨부파일':
            s['title'] = ''
    secs = [s for s in secs if s['items'] or s.get('table') or not s['title'].startswith('페이지 준비중')]
    secs = K.fold_parents(secs)
    if key == 'oia_global-in':
        # 앞쪽은 대학원생 대상(글쓰기 컨설팅·전공학습지원)과 세종 프로그램이다. 학부 유학생·학부생 프로그램만 남긴다.
        cut = next((i for i, s in enumerate(secs) if s['title'] == '유학생 취업특강'), None)
        if cut is not None:
            secs = secs[cut:]
    if key == 'oia_iss-cyber':
        # 본문이 줄바꿈 없이 한 덩어리라 번호(1. 2. 1) 2))와 '즉,' 앞에서 줄을 나눈다. 인사말·'본교 공지사항 CLICK' 링크 글자는 뺀다.
        for s in secs:
            parts = []
            for i in s['items']:
                parts += [x.strip() for x in re.split(r'\s(?=\d\.\s|\d\)\s|즉,|대한민국 교육부|\*본교)', i) if x.strip()]
            s['items'] = [x for x in parts if not x.startswith('*본교') and not x.startswith('안녕하세요')]
    if key == 'oia_manual-overterm':
        # 게시글 본문은 '매뉴얼을 배부해 드리오니 확인하시기 바랍니다' 한 줄뿐이다. 그 줄 뒤에 PDF 문답을 붙인다.
        secs = [dict(s, items=[i for i in s['items'] if '번역본 포함' not in i]) for s in secs] + [dict(s) for s in MANUAL_OVERTERM]
    page['sections'] = secs
    page['title'] = TITLES.get(key, '국제협력본부')
    return page
