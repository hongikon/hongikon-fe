"""서울캠퍼스 기숙사 홈페이지(dormitory.hongik.ac.kr). 메뉴 안내 페이지 + 자주묻는 질문(FAQ) 글 + 자료실 상시 안내 글.
공지사항(0501)은 학기마다 바뀌는 모집·일정 공지라 옮기지 않는다. 다만 기숙사비·학생식당 정기식 금액은 상시 안내 페이지가 없고
학기마다 나오는 '관리비 납부 안내문'·'학생식당 정기식 신청 및 납부 안내문'에만 있어서, 가장 최근 학기 글 하나씩만 옮긴다
(금액·환불·식비 조항만, 날짜 많은 입사 안내는 뺀다). 새 학기 글이 올라오면 아래 articleNo 를 바꾼다.
마이페이지(dorm.hongik.ac.kr)는 로그인이 필요해 받지 않는다.
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lifekit import article, drop_empty_titles, faq_list, menu_title, reextract, split_numbered, text_lines  # noqa: E402

LABEL = '기숙사(서울) 홈페이지'
B = 'https://dormitory.hongik.ac.kr/dormitory'
PAGES = {
    'dorm_intro': f'{B}/0101.do',          # 기숙사 소개·연혁
    'dorm_office': f'{B}/0102.do',         # 행정업무 안내·상담시간·연락처
    'dorm_status': f'{B}/0104.do',         # 기숙사 현황(수용인원·시설)
    'dorm_rules': f'{B}/etc/0201.do',      # 생활규정(점호·외박·환불·퇴사)
    'dorm_rules_out': f'{B}/etc/0201.do',  # 생활규정 중 점호·폐문·외출·외박·외부인 조항만
    'dorm_rules_money': f'{B}/etc/0201.do',  # 생활규정 중 관리비·환불·퇴사 조항만
    'dorm_rules_join': f'{B}/etc/0201.do',   # 생활규정 중 사생선발·자격·입사·사실배정 조항만
    'dorm_rules_room': f'{B}/etc/0201.do',   # 생활규정 중 비품·냉난방·사실출입 조항만
    'dorm_points': f'{B}/0202.do',         # 상/벌점
    'dorm_notes': f'{B}/0203.do',          # 기타 유의사항(반입 허용 물품)
    'dorm_reading': f'{B}/0204.do',        # 열람실 이용 규정
    'dorm_apply': f'{B}/0301.do',          # 신청 안내
    'dorm_movein': f'{B}/0302.do',         # 입사 안내(건강진단서·반입금지)
    'dorm_moveout': f'{B}/0303.do',        # 퇴사 안내
    'dorm_council': f'{B}/0401.do',        # 사생회 소개
    'dorm_council_act': f'{B}/0402.do',    # 사생회 활동
    # 자주묻는 질문(FAQ) — 글 하나씩
    'dorm_faq_refund': f'{B}/0503.do?mode=view&articleNo=119295',
    'dorm_faq_mail': f'{B}/0503.do?mode=view&articleNo=119292',
    'dorm_faq_roommate': f'{B}/0503.do?mode=view&articleNo=119287',
    'dorm_faq_address': f'{B}/0503.do?mode=view&articleNo=119284',
    'dorm_faq_stay': f'{B}/0503.do?mode=view&articleNo=119280',
    'dorm_faq_storage': f'{B}/0503.do',   # 목록에만 펼쳐 있는 '짐보관실 이용 안내'
    # 자료실 상시 안내
    'dorm_doc_longout': f'{B}/0502.do?mode=view&articleNo=119311',
    'dorm_doc_internet': f'{B}/0502.do?mode=view&articleNo=119310',
    'dorm_doc_3rd': f'{B}/0502.do?mode=view&articleNo=119308',  # 제3기숙사 위치 및 전경
    'dorm_doc_wifi': f'{B}/0502.do?mode=view&articleNo=119309',  # 제2,3기숙사 무선인터넷 장애 시 조치방법(본문은 짧은 안내, 방법은 첨부 HWP)
    'dorm_doc_floor': f'{B}/0502.do?mode=view&articleNo=147515',  # [자료] 층장 지원서(양식)
    # 학기마다 바뀌는 금액 공지(가장 최근 학기 것) — 2026학년도 2학기
    'dorm_notice_fee': f'{B}/0501.do?mode=view&articleNo=154439',   # 기숙사 관리비 납부 및 룸메이트 신청 안내문
    'dorm_notice_meal': f'{B}/0501.do?mode=view&articleNo=154798',  # 제2기숙사 학생식당 정기식 신청 및 납부 안내문
    # 학기마다 바뀌는 모집·입사 공지(가장 최근 것) — 방학 모집은 2026학년도 동계방학, 잔류는 2026 동계, 택배함은 2026-2 입사 안내
    'dorm_notice_vacation': f'{B}/0501.do?mode=view&articleNo=159133',         # 방학 기숙사생 모집(지원 대상·제한·시설·기간·방법)
    'dorm_notice_vacation_movein': f'{B}/0501.do?mode=view&articleNo=159133',  # 같은 글의 '10. 입사 안내'(서류·지참물·동반인·주차)
    'dorm_notice_stay': f'{B}/0501.do?mode=view&articleNo=159075',             # 방학 잔류자 모집 공고
    'dorm_notice_parcel': f'{B}/0501.do?mode=view&articleNo=155435',           # [필독] 입사 안내 중 '택배 장소'만
    # FAQ '짐보관실 이용 안내'가 '자세한 일정은 공지사항에서'라고 보내는 학기별 짐보관실 공지(가장 최근 것 — 2026 하계방학).
    # 요금표는 그림으로만 있어 postprocess 가 그림 글(STORAGE_FEE)을 덧붙인다. 새 공지가 오면 글 번호와 STORAGE_FEE 를 함께 본다.
    'dorm_notice_storage': f'{B}/0501.do?mode=view&articleNo=154754',
    # 학기마다 나오는 상시 추가모집 공고(가장 최근 것 — 2026학년도 2학기). 모집 방식·지원 제한·방법만 옮긴다.
    'dorm_notice_extra': f'{B}/0501.do?mode=view&articleNo=155836',
    # 홍제 행복기숙사(학교 밖, 한국사학진흥재단 운영) 상시모집 안내 — 본문은 짧은 안내와 첨부 공고문(PDF)뿐.
    'dorm_notice_happy': f'{B}/0501.do?mode=view&articleNo=156142',
    # 학기마다 나오는 복학생 기숙사 모집 안내(가장 최근 것 — 2026학년도 2학기). '복학대기' 조건·지원 제한·선발 방식·우선배정만 옮긴다.
    'dorm_notice_returning': f'{B}/0501.do?mode=view&articleNo=154007',
    # 층장 모집 공고(가장 최근 것 — 2026 하계부터 근무할 층장 추가 모집, 마감). 자격·서류·근로장학금 안내가 상시 틀이라 옮긴다.
    'dorm_notice_floor': f'{B}/0501.do?mode=view&articleNo=154035',
    # 사생회가 올린 다음 학년도 남·여 사생장 선출 공고(2027학년도, 투표 2026. 11. 4.).
    'dorm_notice_council': f'{B}/0501.do?mode=view&articleNo=159066',
}
CONTENT = {'id': 'cms-content'}


# 생활규정에서 질문별로 골라 보여 줄 조항(제목 앞머리).
RULE_PICK = {
    'dorm_rules_out': ('생활규정(점호·외출·외박)', ('제5조', '제8조', '제9조', '제10조')),
    'dorm_rules_money': ('생활규정(관리비·환불·퇴사)', ('제7조', '제18조', '제19조')),
    'dorm_rules_join': ('생활규정(사생선발·입사자격)', ('제2조', '제3조', '제4조')),
    'dorm_rules_room': ('생활규정(비품·냉난방·사실출입)', ('제13조', '제16조', '제21조')),
}

# 학기 공지에서 옮길 번호 덩어리(1. 2. …). 나머지(입사 날짜·납부 계좌 등)는 그 학기에만 맞는 안내라 뺀다.
NOTICE_KEEP = {
    'dorm_notice_fee': ('1', '2', '3'),          # 기숙사비 납부·금액표·식비 안내
    'dorm_notice_meal': ('1', '3', '4', '6', '7'),  # 식당 이용·이용 시간·식비·환불·기타
    'dorm_notice_vacation': ('1', '2', '3', '4', '5', '6', '7'),  # 지원 대상·제한·시설·지원 기간·거주 기간·방법·발표
    'dorm_notice_vacation_movein': ('10',),                      # 입사 안내
    'dorm_notice_stay': ('1', '2', '3', '4', '5', '6', '7', '8'),
    'dorm_notice_storage': ('1', '2', '4', '5', '6', '7'),   # 신청방법·대상·요금·초과요금·수령·운영수칙(날짜 표 3. 은 뺀다)
    'dorm_notice_extra': ('1', '3', '4', '5', '6'),           # 모집 방식·지원 제한·방법·발표·납부(입사 안내 9. 는 입사 안내 페이지와 같다)
    'dorm_notice_returning': ('1', '2', '6', '7', '9'),       # 지원 자격·제한·방법·선발(성적순, 거리 미반영)·우선배정(시설 3.·입사 안내 10. 은 다른 페이지와 같다)
}
# 글 맨 앞 안내 줄을 빼고 번호 덩어리만 옮길 키, 덩어리 제목에 붙일 말.
NOTICE_NOHEAD = {'dorm_notice_vacation_movein': ' · 입사 안내'}
# 덩어리를 '1. …' 같은 큰 번호 줄로만 다시 나눌 키('가.'·'바.' 같은 작은 번호는 항목으로 둔다).
NOTICE_FLAT = ('dorm_notice_vacation', 'dorm_notice_vacation_movein', 'dorm_notice_stay', 'dorm_notice_storage', 'dorm_notice_extra', 'dorm_notice_returning')

# 짐보관실 공지(글 154754)의 요금표 그림 두 장을 옮겨 적은 것. 글 번호가 바뀌면 그림을 다시 보고 고친다.
STORAGE_FEE = {
    '154754': {
        '4': ['[요금표] 박스 1개당 요금(박스 최대 3개 보관 가능): 1일~14일 5,000원 / 15일~30일 10,000원 / ~9월 30일 15,000원'],
        '5': ['[초과 요금표] 1~7일 초과 +5,000 / 8~14일 초과 +10,000 / 15~21일 초과 +15,000 / 22일~28일 초과 +20,000 / 29일 초과 폐기'],
    },
}


# 홍제 행복기숙사 상시모집 글(156142)의 첨부 공고문(PDF, 그림만 있다)을 옮겨 적은 것(공고일 2026. 8. 31., 한국사학진흥재단 홍제 행복기숙사).
# 글 번호가 바뀌면 새 첨부를 다시 보고 고친다. 학기마다 같은 틀(대상·선발·비용·환불·서류)이다.
HAPPY_PDF = {
    '156142': [
        {'title': '첨부 공고문 · 1. 일정 및 선발인원', 'items': [
            '2026-2학기 상시모집 신청기간: 2026. 9. 1.(화) ~ 선발 완료 시까지',
            '※ 유형별 공석 및 신청 현황에 따라 신청 접수는 마감 및 재개될 수 있습니다.',
            '상시 모집은 공실이 발생했을 경우에만 진행되며, 신청일시 우선순으로 선발(사회적 배려자 최우선)',
            '1인실은 장애인만 신청 가능',
            '거주기간: 개별 입주일 ~ 2027. 2. 21.(월) — 합격한 주의 금요일로 입주 시작일이 산정되며, 2026년 12월경 거주기간 연장 신청을 통해 6개월 단위 연장 거주 가능']},
        {'title': '첨부 공고문 · 2. 신청대상 및 선발기준', 'items': [
            '2026년 2학기 기준 수도권(서울, 경기, 인천) 지역 대학교 대학생(대학원생 포함)',
            '고등교육법상 제2조에 해당하는 대학의 재학생',
            '취업준비생 : 대학 졸업한 지 2년 이내로서 재직중이지 않은 자',
            '만 39세 이하 청년',
            '신청 및 선발 불가: 2년 초과 휴학생, 2년 초과 졸업유예학생(학사), 법정감염병 질환자 및 결핵 보균자, 기존 징계(강제)퇴사 경력이 있는 자, 직전학기 중도퇴사자(1년이내), 기숙사 운영정책에 이의가 있는 자, 성범죄 경력이 있는 자',
            '선발 고려 기준: 1번 사회적 배려자(사회적배려자 순위), 2번 신청 일시(선착순)',
            '사회적 배려자 순위: 1순위 장애인(본인), 2순위 기초생활수급 가구 자녀, 3순위 차상위계층 가구 자녀, 4순위 청소년복지시설 입·퇴소 청소년·보호종료아동·한부모가정 자녀·다문화가정 자녀·국가유공자 자녀·다자녀 가구 자녀, 5~7순위 소득 기준(전년도 도시근로자 월평균 소득 30%·50%·70% 이하 등)',
            '참여 대학: 경기대, 디지털서울문화예술대, 배화여대, 서강대, 서울여자간호대, 숙명여대, 연세대, 이화여대, 홍익대, 감리교신학대, 추계예술대, 국민대, 성신여대',
            '※ 협약 지자체에 거주하거나 참여 대학 재학생인 경우 기숙사비 지원금 지급 대상이며, 지원금 대상자 선발기준 등 세부사항은 각 담당자에게 문의바랍니다.',
            '* 상시 입주생에 대한 지원은 국민대, 서울여자간호대, 숙명여대, 추계예술대학생만 해당함',
            '참여 대학 담당부서 연락처(2026. 8. 31. 기준): 홍익대 02-338-7440']},
        {'title': '첨부 공고문 · 3. 비용안내', 'items': [
            '기숙사비(상시모집은 일시납만 가능): 1인실(장애인실)·2인실 1일 기숙사비 11,100원, 4인실 1일 기숙사비 8,394원 — 입주지정일에 따라 청구됨',
            '보증금: 300,000원(1인실·2인실·4인실 같음)',
            '2학기 전체 기숙사비(180일 거주 기준): (1,2인실) 1,998,000원, (4인실) 1,510,920원 — 실제 금액은 개인별 선발 및 입주 일자에 따라 일할 계산하여 청구하므로 상이',
            '식비: A식(1일 1식) 4,250원×172식 731,000원 / B식(1일 1.5식) 3,950원×258식 1,019,100원 / C식(1일 2식) 3,800원×344식 1,307,200원(180일 기준, 입주지정일에 따라 청구됨)',
            '식비는 2회 분납이며, 11월 초 2차 식비 납부 예정',
            '입주생은 식당 이용 필수(최소 1일 1식 신청)',
            '입주 시작일 이후 공지사항 내 식수 유효기간 필히 확인, 미사용분에 대한 환급 없음']},
        {'title': '첨부 공고문 · 4. 납부 및 입주포기, 환불 안내', 'items': [
            '계좌이체: 납부기간 내에 기숙사 홈페이지 "마이페이지"에서 가상계좌 및 납부금액 확인 가능',
            '카드결제: 납부기간 내에 "마이페이지"에서 "카드결제하기" 선택 — 우리카드 및 BC카드로만 결제가능, 기숙사비 및 보증금만 카드결제 가능, 식비는 계좌이체만 가능',
            '입주포기: 납부 전 미납시 자동 합격 취소(상시모집 재신청 가능) / 합격한 주의 화~목요일 납부금액 전액 환급 / 금요일 기숙사비 및 식비 1일분 공제 / 토요일 2일분 공제 / 일요일 3일분 공제(위약금 면제, 중도퇴사 처리되어 상시모집 및 다음 2개 학기 간 입주 불가) / 차주 월요일 이후 일자별 기숙사비, 식비 및 남은기간에 대한 10% 위약금 공제 후 환급',
            '중도퇴사: 퇴사일로부터, 입주 잔여일수를 일할 정산한 금액에서 10%를 공제(위약금)한 후 환불(식비 동일 적용). 거주종료일(27. 2. 21.) 기준 잔여일수가 30일 이하인 퇴사는 기숙사비 환불 없음(보증금만 환불됨)',
            '모든 퇴사자는 마이페이지에서 퇴사일 7일 전 퇴사 신청을 해야 하며, 미리 하지 않은 경우 7일분의 금액을 추가적으로 제외하고 환불',
            '특별사유(군입대, 개인신병, 직계가족 병간호, 해외유학·교환학생 등, 휴학 및 졸업)에 해당하는 경우 위약금 공제를 적용하지 않음']},
        {'title': '첨부 공고문 · 5. 신청방법', 'items': [
            '홍제 행복기숙사 홈페이지(https://happydorm.or.kr/hongje/) → 구글 OTP 어플(Google Authenticator) 설치 → 회원가입 후 로그인 → 입주신청(입주/퇴사안내 → 입주신청 → 해당하는 모집일정 선택 후 신청)',
            '※ 회원가입을 해야 연장신청이 가능하므로 반드시 회원가입부터 진행바랍니다.']},
        {'title': '첨부 공고문 · 6. 기타 유의사항', 'items': [
            "입주 신청 기본 서류('26년 9월 이후 발급한 원본 스캔 파일, PDF만 허용): 사진 1장, 신분증 사본 1부, 재학증명서 또는 휴학증명서 1부, 부모님 주민등록등본 1부, 성적증명서 1부(직전 학기성적 포함), 본인 명의 통장사본 1부",
            "입주 당일 행정실 제출 서류: 입사등록카드 및 서약서 1부, ('26년 발급)기숙사 입주용 건강진단서 1부(필수 검사항목: 'B형간염', '결핵(흉부X선 촬영)')",
            '입주 이후 인실 변경 신청은 연장 신청 기간에만 가능',
            '합격자에 한해 개별 문자 연락하며, 대기 순번은 별도 안내하지 않음',
            '기타 문의사항은 행정실로 연락 바랍니다(02-396-7002, 7020)']},
    ],
}


def _flat_numbered(secs):
    lines = [l for s in secs for l in ([s['title']] if s['title'] else []) + s['items'] if l.strip()]
    out = [{'title': '', 'items': [], 'ordered': False}]
    for l in lines:
        m = re.match(r'\s*(\d{1,2})\.\s*(.+)', l)
        if m and len(l) <= 70:
            head, _, rest = m.group(2).partition(' : ')
            out.append({'title': f'{m.group(1)}. {head.strip()}', 'items': [rest.strip()] if rest.strip() else [], 'ordered': False})
        else:
            out[-1]['items'].append(l)
    return [s for s in out if s['items']]

# FAQ 목록 페이지에서 고를 질문(글 번호가 목록에 드러나지 않는 것).
FAQ_PICK = {'dorm_faq_storage': '짐보관실 이용 안내'}


def postprocess(key, page, raw):
    if key in FAQ_PICK:
        hit = [secs for q, secs in faq_list(raw) if q.strip() == FAQ_PICK[key]]
        page['title'] = FAQ_PICK[key]
        page['sections'] = hit[0] if hit else []
        return page
    if key == 'dorm_notice_parcel':
        # 글 머리의 '● 택배 장소 ●' 묶음만(그 학기 입사일·거주기간 같은 날짜 안내는 뺀다).
        title, _ = article(raw)
        lines = [i for s in reextract(raw, {'class': 'fr-view'}, h1=True, spans=True) for i in [s['title']] + s['items'] if i.strip()]
        a = next((n for n, l in enumerate(lines) if '택배 장소' in l), None)
        b = next((n for n, l in enumerate(lines) if a is not None and n > a and re.match(r'1\.\s*입사', l.strip())), len(lines))
        page['title'] = re.sub(r'^\[[^\]]*\]\s*', '', title)
        page['sections'] = [{'title': '택배 장소', 'items': [l for l in lines[a + 1:b] if l.strip() != '*호실 필수 기입*'], 'ordered': False}] if a is not None else []
        return page
    if key in NOTICE_KEEP:
        title, _ = article(raw)
        page['title'] = re.sub(r'^\[[^\]]*\]\s*', '', title)
        page['sections'] = reextract(raw, {'class': 'fr-view'}, h1=True, spans=True)
        page = split_numbered(page, max_len=40)
        if key in NOTICE_FLAT:
            page['sections'] = _flat_numbered(page['sections'])
        keep, num, out = NOTICE_KEEP[key], None, []
        for sec in page['sections']:
            m = re.match(r'(\d+)\.', sec['title'])
            if m:
                num = m.group(1)
            elif num is None:  # 글 맨 앞(제목 줄·안내 한 줄)
                if key in NOTICE_NOHEAD:
                    continue
                sec['items'] = [i for i in sec['items'] if i.strip() != page['title'] and not i.strip().endswith('안내문')]
                if sec['items']:
                    out.append(sec)
                continue
            if num in keep:
                out.append(sec)
        page['sections'] = out
        fee = STORAGE_FEE.get(re.search(r'articleNo=(\d+)', PAGES[key]).group(1), {}) if key == 'dorm_notice_storage' else {}
        fixed = []
        for sec in page['sections']:
            m = re.match(r'(\d+)\.', sec['title'])
            if m and m.group(1) in fee:
                head, sep, rest = sec['title'].partition(' · ')
                if sep and re.match(r'\d+\.', rest):  # 글이 없는 번호 줄(그림만 있는 '5.')이 다음 번호와 붙은 경우 다시 나눈다
                    fixed.append({'title': head, 'items': fee[m.group(1)], 'ordered': False})
                    fixed.append({**sec, 'title': rest})
                    continue
                sec['items'] = sec['items'] + fee[m.group(1)]
            fixed.append(sec)
        page['sections'] = fixed
        page['title'] += NOTICE_NOHEAD.get(key, '')
        return page
    if 'mode=view' in PAGES[key]:
        title, secs = article(raw)
        page['title'] = re.sub(r'^\[[^\]]*\]\s*', '', title)  # '[공지]장기외박신청서' → '장기외박신청서'
        if key == 'dorm_doc_3rd':
            # '마을버스로 5분, 걸어서 20분'은 2017년 글이고, 최근 모집 공고(2026)는 '마포08로 10분, 도보 40분'이라 서로 다르다.
            # 오래된 소요시간 줄만 빼고(거리 1.3km 는 두 글이 같다) 사진 안내 줄도 뺀다.
            for sec in secs:
                text = '\n'.join(sec['items']).replace('때문에, 교외에 위치한 기숙사이지만\n', '때문에, 교외에 위치한 기숙사이지만 ')
                text = re.sub(r'\s*마을버스로[^.\n]*거리입니다\.', '', text)
                sec['items'] = [i for i in text.split('\n') if i.strip() and '이미지' not in i and i.strip() != '참고하시기 바랍니다.']
        if key == 'dorm_notice_happy':
            secs = secs + [{**sec, 'ordered': False} for sec in HAPPY_PDF.get(re.search(r'articleNo=(\d+)', PAGES[key]).group(1), [])]
        if key == 'dorm_notice_floor':
            # '◎ 지원자격◎' 같은 제목 아래 '1. …' 목록이 이어지는 글 — 번호 줄을 제목으로 보지 않고 ◎ 제목으로만 나눈다.
            i = raw.find('<div class="fr-view">')
            ends = [k for k in (raw.find('<div class="b-file', i), raw.find('<div class="b-pager-box"', i)) if k > 0]
            secs = [{'title': '', 'items': [], 'ordered': False}]
            for line in text_lines(raw[i:min(ends) if ends else len(raw)]):
                m = re.fullmatch(r'◎\s*(.+?)\s*◎', line)
                if m:
                    secs.append({'title': m.group(1), 'items': [], 'ordered': False})
                elif line.replace(' ', '') == '홍익대학교기숙사행정실':
                    break
                elif line != '※ 층장모집 ※':
                    secs[-1]['items'].append(line)
            secs = [s for s in secs if s['items']]
        page['sections'] = secs
        return page
    page['title'] = menu_title(raw)
    # 이 사이트는 큰 제목을 <h1> 로 쓰고, 상/벌점·반입금지 표는 칸을 합쳐 둔다.
    secs = drop_empty_titles(reextract(raw, CONTENT, h1=True, spans=True))
    for s in secs:
        t = s.get('table')
        if t and len(t) > 2 and t[0][0] == t[1][0] == '구분':  # 머리줄 두 줄(구분|품목 / 구분|불허용|허용) → 아랫줄만
            s['table'] = t[1:]
    if key in RULE_PICK:
        page['title'], heads = RULE_PICK[key]
        secs = [s for s in secs if s['title'].startswith(heads)]
    page['sections'] = secs
    return page
