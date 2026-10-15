"""IT 서비스·캠퍼스(주차·도서관·오시는 길·전화번호 찾기) 주제. 형식은 topics/__init__.py 설명을 본다.

맡지 않는 것(다른 흐름으로 간다):
  와이파이·eduroam → 손으로 쓴 'wifi' 흐름 / 학교 메일(Gmail·Office365 메일·아웃룩) → 'school-mail' 흐름
  모바일 학생증·헤이영캠퍼스 → 'student-card' 흐름 / PC실 운영 시간 일반 → life.py 'pc-room'
  서울캠퍼스 통학버스(셔틀)는 학교 홈페이지에 안내가 없다(통학버스 메뉴는 세종캠퍼스뿐) → 주제를 만들지 않는다.
"""

TOPICS = [
    # ── IT 서비스(정보전산원) ─────────────────────────────────────────────
    # 출처: life_office365-info(= it 02041). '오피스365' 낱말만 있으면 school-mail/office365 로 가고,
    # 설치·용량·졸업 뒤 사용처럼 프로그램을 묻는 말만 여기로 온다.
    dict(id='office365', page='life_office365-info',
         lead='학생용 Office365는 재학생(학부·대학원)이 가입 신청 링크에서 계정을 만들면 바로 써요. 계정은 아이디@mail.hongik.ac.kr 이고, 설치형 Office는 재학 중에 PC 5대·스마트폰 5대까지 깔 수 있어요.',
         match=[
             [['오피스', 'office', 'msoffice', '워드', '엑셀', '파워포인트', 'ppt', '피피티', '원드라이브', 'onedrive']],
             [['office365', '오피스365', 'ms365', 'm365', '오피스', 'office'],
              ['설치', '다운', '깔', '무료', '공짜', '용량', '2gb', '100gb', '졸업', '몇대', '5대', '맥북', '맥에', '기간']],
         ],
         exclude=['패스워드', '키워드', '메일', '비밀번호', '비번', '한컴', '오피스텔'],
         phones=['mail'], facility='it', faqpage='life_office365-findpw'),
    # 출처: life_office365-findpw. 'office365 비밀번호'처럼 두 낱말만이면 school-mail/password(같은 페이지를 잇는 답)가 먼저다.
    dict(id='office365-password', page='life_office365-findpw',
         lead='Office365 비밀번호는 portal.office.com 에서 재설정해요. 가입할 때 등록한 이메일과 휴대폰으로 인증코드를 받아 새 비밀번호를 넣어요.',
         match=[
             [['office365', '오피스365', '오피스', 'office'], ['비밀번호', '비번', '패스워드'], ['재설정', '까먹', '잊어', '잊었', '분실', '초기화', '찾', '모르']],
             [['오피스', 'office'], ['비밀번호', '비번', '패스워드']],
         ],
         phones=['mail'], facility='it'),
    # 출처: it 0201.
    dict(id='windows', page='0201',
         lead='Windows는 Microsoft Azure(구 Windows EDU) 학생 페이지에 학교 Office365 계정(아이디@mail.hongik.ac.kr)으로 로그인해서 제품키를 확인하고 내려받아요. Office365 계정부터 만들어 두세요.',
         match=[[['윈도우', '윈도', 'windows', 'win11', '윈11', 'azure', '애저', '제품키', '정품인증']]],
         phones=['pc'], facility='it'),
    # 출처: it 0203. 원문 '홍익대학교 포럼'은 MathWorks 의 학교 전용 페이지(tah-portal) 링크다.
    dict(id='matlab', page='0203',
         lead='학생용 MATLAB은 학교 메일(아이디@mail.hongik.ac.kr 또는 아이디@g.hongik.ac.kr)로 MathWorks 계정을 만든 뒤, MathWorks 홈페이지의 홍익대학교 페이지에서 내려받아 개인 PC에 설치해요.',
         match=[[['매트랩', '메트랩', '매틀랩', 'matlab', 'mathworks', '매스웍스']]],
         phones=['pc'], facility='it'),
    # 출처: it 0206.
    dict(id='adobe', page='0206',
         lead='학교 Adobe Creative Cloud는 Adobe 계정을 만든 뒤 안내 페이지의 설치 파일로 깔아요. 교내 인터넷(유선·Hongik_wifi)에서만 실행되고, 전에 깔린 Adobe 프로그램은 먼저 깨끗이 지워야 해요.',
         match=[[['어도비', 'adobe', '포토샵', '포샵', 'photoshop', '일러스트', 'illustrator', '프리미어', 'premiere',
                  '인디자인', 'indesign', '애프터이펙트', '에펙', '크리에이티브클라우드', 'creativecloud']]],
         phones=['pc'], facility='it'),
    # 출처: life_siemens-software(문의처 표 02-320-3281 = adminOffices SIEMENS-PACE센터 hi-r-9f-office-07).
    dict(id='siemens', page='life_siemens-software',
         lead='Siemens 소프트웨어(NX·Simcenter·Tecnomatix 등)는 Siemens-PACE 센터에 필요한 소프트웨어를 문의한 뒤 홍문관 PACE 센터 컴퓨터실에서 써요. 개인 PC에 깔려면 PACE 센터에 연락해 설치 절차를 따라요.',
         match=[[['지멘스', 'siemens', 'nx', 'simcenter', '심센터', 'tecnomatix', '테크노매틱스', 'starccm', 'amesim', 'madymo', 'prescan',
                  'pace센터', '페이스센터']]],
         phones=[('Siemens-PACE 센터', '02-320-3281')], facility='hi-r-9f-office-07'),
    # 출처: it 0202 프린터 출력 안내. PC실 운영 시간 일반은 life.py 'pc-room' 이 맡고, 쿼터·충전만 여기로.
    dict(id='printer-quota', page='0202',
         lead='정보전산원 실습용 PC실 프린터는 쿼터제라 개인 쿼터가 있어야 출력돼요. 쿼터는 C414호·R동 915호 PC실의 충전기에서 지폐로 천 원 단위로 충전해요(카드 불가, 충전 후 환불 불가).',
         match=[
             [['프린터', '프린트', '출력', '인쇄'], ['쿼터', '충전', '환불', '지폐', '현금', '카드', '돈', '요금', '얼마', '유료', '무료']],
             [['쿼터']],
         ],
         exclude=['증명', '성적표', '학생증', '고지서', '영수증'],
         phones=['pc'], facility='it'),
    # 출처: it 0202 PC실별 설치 소프트웨어 표.
    dict(id='pc-software', page='0202',
         lead='정보전산원 PC실에는 MS-Office 2024·한컴오피스 2024가 공통으로 깔려 있고, AutoCAD·SAS·MATLAB·Adobe CC 같은 프로그램은 PC실마다 달라요. 아래 표에서 PC실별로 확인하세요.',
         match=[
             [['오토캐드', 'autocad', '캐드', 'sas9', 'sas', '마야', 'maya', '3dmax', '3ds맥스', '쓰리디맥스']],
             [['pc실', '컴퓨터실', '실습실', '전산실'], ['매트랩', 'matlab', '어도비', 'adobe', '포토샵', '오피스', '엑셀', '한컴', '한글', '오토캐드', 'autocad', '캐드', 'sas', '마야', 'maya', '3dmax',
                                                  '소프트웨어', '프로그램', '깔려', '설치']],
         ],
         phones=['pc'], facility='it'),
    # 출처: it 0302.
    dict(id='alkeeper', page='0302',
         lead='알키퍼는 PC 안의 개인정보가 담긴 문서를 찾아 암호화·완전삭제·예외처리할 수 있게 돕는 프로그램이에요. 정보전산원 안내 페이지에서 내려받아 설치해요.',
         match=[[['알키퍼', 'alkeeper', '개인정보검색']]],
         facility='it'),

    # ── 캠퍼스 ──────────────────────────────────────────────────────────
    # 출처: introduction_parking-information(주차관리사무실 02-320-3446 = 원문·adminOffices 관재팀 안내).
    dict(id='parking', page='introduction_parking-information',
         lead='서울캠퍼스 주차장은 홍문관 지하 2~4층, 아트앤디자인밸리 지하 3~5층이에요. 일반 차량은 10분에 1,000원이고, 주차 정기권은 교직원만 발급받아요.',
         match=[[['주차', '정기권', '자차', '차가지고', '차끌고', '차몰고', '차를가지고', '전기차', '차댈', '차대도', '차세울']]],
         exclude=['자전거', '통학버스', '셔틀'],
         phones=['parking']),
    # 출처: introduction_directions. 주소는 같은 페이지 상단(실제 페이지, 10-15 확인).
    dict(id='directions', page='introduction_directions',
         lead='서울캠퍼스 주소는 서울특별시 마포구 와우산로 94(상수동)예요. 2호선 홍대입구역 9번 출구에서 정문까지 걸어서 9분, 6호선 상수역 2번 출구에서 후문까지 3분이에요.',
         match=[[['오시는길', '가는길', '오는길', '가는법', '오는법', '찾아가', '찾아오', '어떻게가', '지하철', '교통편', '학교주소', '캠퍼스주소', '홍익대주소',
                  '홍대주소', '주소', '홍대입구역', '홍대입구', '상수역', '몇번출구', '버스정류장', '몇번버스', '버스노선', '학교위치', '홍대위치', '캠퍼스위치']]],
         exclude=['메일', '통학버스', '셔틀', '스쿨버스', '세종', '기숙사', '도서관', '주소변경', '주소바꾸', '주소수정', '주소지'],
         ),
    # 출처: introduction_central-library-view(운영 시간 표), 대표번호 02-320-1305 는 introduction_library-list 원문.
    dict(id='library', page='introduction_central-library-view',
         lead='중앙도서관 자료실(본관 H동·정보통신센터 Q동)은 학기 중 평일 09:00~20:00, 토요일 09:00~15:00에 열어요. 열람실(본관 2·3층, 학생회관 5·6층)은 06:00~23:00이고, 제4공학관(T동)에는 24시간 여는 열람실이 1곳 있어요.',
         match=[
             [['도서관', '열람실', '책대출', '도서대출', '책빌리', '책빌려', '책반납', '반납', '연체', '대출자료실', '대출기간', '대출연장', '대출권수',
               '공동학습실', '스터디룸', '24시간열람', '중도']],
         ],
         exclude=['중도휴학', '중도포기', '중도탈락', '법학도서관', '법도서관', '법학자료', '학자금', '등록금', '장학',
                  '추워', '더워', '춥', '덥', '에어컨', '냉방', '난방', '히터'],
         phones=['lib', ('중앙도서관 대표번호', '02-320-1305')], facility='lib'),
    # 출처: introduction_library-list(법학도서관 위치·시간·전화), adminOffices 법학도서관 hi-r-8f-office-01.
    dict(id='law-library', page='introduction_library-list',
         lead='법학도서관은 홍문관(R동) 8층에 있어요. 학기 중 09:00~17:00, 방학 중 10:00~16:00에 열고, 노트북열람실은 06:00~23:00이에요. 법학 전공자뿐 아니라 홍익대 구성원 모두 쓸 수 있어요.',
         match=[[['법학도서관', '법도서관', '법학자료', '노트북열람실']]],
         phones=[('법학도서관', '02-320-3171')], facility='hi-r-8f-office-01'),
    # 출처: introduction_search-phone + introduction_search-for-faculty. 부서 이름을 넣은 질문은 부서 찾기(none)로 간다.
    dict(id='phone-search', page='introduction_search-phone',
         lead="학교 홈페이지 '전화번호 검색'에서 소속이나 전화번호로 교내 전화번호를 찾을 수 있어요. 교직원 전화번호는 '교직원 검색'에서 소속·이름·담당업무로 찾아요.",
         match=[[['교내전화', '전화번호검색', '전화번호찾', '번호찾', '전화번호부', '교직원검색', '교직원연락처', '교직원전화', '교수님연락처', '교수님전화',
                  '교수연락처', '교수전화', '교수님번호', '과사무실', '학과사무실', '과사번호', '과사전화', '과사연락처',
                  '학교전화', '대표전화', '홍익대전화', '홍대전화', '학교번호', '전화번호알려']]],
         exclude=['비밀번호', '비번', '학번'],
         faqpage='introduction_search-for-faculty'),
]
