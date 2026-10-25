"""대학생활(증명서·기숙사·학식·편의시설·체육시설·대관·상담·인권·장애학생·취업·창업·학습·봉사·국제학생증·학생회·동아리) 주제.
형식은 topics/__init__.py 설명을 본다.

같은 페이지를 여러 주제가 쓰는 건 질문마다 맨 위 요약(lead)을 그 질문의 답으로 바꿔 보여 주려고서다.
점수가 같으면 앞 주제가 이기므로 좁은 주제를 앞에 둔다.
lead 는 원문 페이지(data/pages.json)에 적힌 사실만 줄여 쓴다. 전화는 adminOffices 담당정보 표나 원문 페이지에 적힌 번호만.
"""

# 원문 페이지에 적힌 번호(페이지 키를 옆에 적는다).
COUNSEL_MAIN = ('학생상담센터', '02-320-1356')            # life_seoul-student-support-list
CAREER_MAIN = ('취업진로지원센터', '02-320-1361')          # life_seoul-student-support-list
COUNCIL_ROOM = ('총학생회', '02-320-1440')                 # life_seoul-activity-list
CLUB_UNION = ('총동아리연합회', '02-320-1451')             # life_seoul-activity-list
HONGARAM = ('홍아람', '02-320-2051')                       # life_seoul-activity-list
DORM3 = ('제3기숙사', '02-338-7440')                       # life_dormitory
CAFETERIA = ('학생식당(기숙사식당)', '02-320-2452')        # life_facility
PRINT_CENTER = ('출력센터(에이제이네트웍스)', '02-320-1838')  # life_facility
BANK = ('신한은행(홍문관)', '02-6023-3950')                # life_facility
STORE_R = ('편의점 바이스마트(홍문관)', '02-332-1742')     # life_facility
STORE_DORM = ('편의점 이마트24(제2기숙사)', '1577-9621')   # life_facility
BOOKSTORE = ('서점 대학서적', '02-320-1562')               # life_facility
STATIONERY = ('문구·화방 한가람문구', '02-3141-8470')      # life_facility
PHOTO = ('사진관 스튜디오홍대', '02-325-1967')             # life_facility
# adminOffices 담당정보 표(hi-g-2f-office-02 학생지원팀).
WELFARE = ('학생지원팀 · 후생시설(학생·교직원 식당)', '02-320-3208')
CLUB_SPACE = ('학생지원팀 · 동아리·학생활동시설', '02-320-3207')
HONGARAM_DESK = ('학생지원팀 · 홍아람 홍보대사단', '02-320-1052')
COLLEGE_A = ('학생지원팀 · 단과대 학생회(공대·건도대·법대·공연·캠자)', '02-320-3207')
COLLEGE_B = ('학생지원팀 · 단과대 학생회(미대·사대·문대·경영·경제·디예경)', '02-320-3208')

PROPERTY_ROOM = 'hi-mh-1f-office-03'   # 관재팀(체육관 관리·행사장 대관)
STARTUP_ROOM = 'hi-mh-8f-office-04'    # 창업교육센터
LEARN_ROOM = 'hi-q-2f-office-03'       # 교수학습지원센터

DORM = ['기숙사', '생활관', '긱사', '기숙사비']
CLUB = ['동아리', '중앙동아리', '동방', '동아리방']
NOT_RIGHTS = ['성희롱', '성폭력', '성추행', '스토킹', '인권']
NOT_CAREER = ['공결', '취업계', '출석', '결석']


def college(cid, page, words, name, room, phone):
    return dict(id=cid, page=page, match=[[words, ['학생회', '학생회실']]], exclude=['학생회관', '총학'],
                lead=(f'{name} 학생회실은 {room}에 있어요. 학생회 조직·집행부·월별 행사 안내예요.' if room
                      else f'{name} 학생회 조직·집행부·월별 행사 안내예요.'),
                phones=[phone], facility='studentteam')


def club(cid, page, field, words, names):
    return dict(id=cid, page=page, match=[[CLUB, words], [names]],
                lead=f'총동아리연합회 {field} 분과 중앙동아리예요. 동아리마다 소개와 동아리방 위치가 있어요.',
                phones=['club', CLUB_UNION], facility='studentteam')


TOPICS = [
    # 증명서 — 발급기·팩스/우편·인터넷을 나눠 맨 위 요약을 바꾼다.
    dict(id='certificate-kiosk', page='life_certificate-issuance',
         match=[[['증명서', '증명발급'], ['발급기', '무인', '키오스크', '기계', '어디서', '어디', '위치', '몇시', '시간', '직접', '문헌관', '학교에서', '오프라인']],
                [['증명서발급기', '증명발급기', '무인발급기']]],
         exclude=['봉사', '학생증', '수료증명', '수료예정', '납부'],
         lead='학적증명서는 문헌관(MH동) 1층 증명서 발급기에서 08:00~21:00에 뗄 수 있어요. 인터넷증명발급센터에서도 발급돼요.',
         phones=['cert', 'certsys'], facility='support'),
    dict(id='certificate-mail', page='life_certificate-issuance',
         match=[[['증명서', '증명발급'], ['팩스', 'fax', '우편', '우체국', '수수료', '얼마', '비용', '가격', '주민센터', '행정복지센터', '민원']]],
         exclude=['봉사', '학생증', '수료증명', '수료예정', '납부'],
         lead='행정복지(주민)센터에서 FAX민원으로 신청하면 3시간 이내에 받을 수 있어요. 우편민원은 우체국에서 신청하고 평일 기준 3~5일 걸려요. '
              '1부 수수료는 재학생 국문 500원·영문 1,000원, 졸업생 국문 1,000원·영문 1,500원이에요.',
         phones=['cert', 'certsys'], facility='support'),
    dict(id='certificate', page='life_certificate-issuance',
         match=[[['증명서', '재학증명', '졸업증명', '성적증명', '휴학증명', '졸업예정증명', '증명발급', '재직증명', '원천징수']],
                [['성적표'], ['출력', '뽑', '발급', '떼', '프린트', '인쇄']]],
         exclude=['봉사', '학생증', '수료증명', '수료예정', '납부'],
         lead='학적증명서(재학·졸업·성적 등)는 인터넷증명발급센터나 문헌관(MH동) 1층 발급기(08:00~21:00)에서 뗄 수 있어요.',
         phones=['cert', 'certsys'], facility='support'),

    # 학식·편의시설 — 편의시설 페이지 하나를 가게 종류별 요약으로 나눈다(기숙사 질문보다 앞).
    dict(id='cafeteria', page='life_facility',
         match=[[['학식', '학생식당', '교직원식당', '기숙사식당', '구내식당', '천원의아침', '천원아침', '아침밥', '학교밥', '밥먹', '밥어디', '밥집', '식당', '저녁먹', '저녁밥']],
                [['점심', '저녁', '아침'], ['밥', '먹', '메뉴', '식사']],
                [DORM, ['밥', '식당', '식사', '조식', '석식', '중식', '메뉴']]],
         exclude=['중식당'],
         lead='학생식당(기숙사식당)은 제2기숙사 지하2층에 있어요. 학생은 아침 1,000원(천원의 아침밥, 정원 초과 시 5,800원), 점심·저녁 5,800원이에요. '
              '조식 08:00~09:00, 중식 11:30~14:00, 석식 17:30~18:50이고 방학 중 주말·공휴일은 쉬어요. 교직원식당(문헌관 16층)은 점심·저녁 9,000원이고 학생도 이용할 수 있어요.',
         phones=[CAFETERIA, WELFARE]),
    dict(id='cafe', page='life_facility',
         match=[[['카페', '커피', '빵집', '베이커리', '북카페', '카페드림', '카페나무', '그라찌에', '파브리카', '과일주스', '음료']], [DORM, ['카페']]],
         lead='교내 카페는 인문사회관(A동) 1층 카페드림, 홍문관(R동) 2층 그라찌에·파브리카, 중앙도서관(H동) 3층 북카페, 제2기숙사 지하1층 캠퍼 등이 있어요. 카페마다 영업시간이 달라요.'),
    dict(id='convenience-store', page='life_facility',
         match=[[['편의점', '매점', '이마트', '바이스마트', '24시']], [DORM, ['편의점', '매점']]],
         exclude=['열람', '도서관', '스터디'],
         lead='편의점은 제2기숙사 지하1층 이마트24(24시간)와 홍문관(R동) 3층 바이스마트(무인운영 05:30~23:00)가 있어요.',
         phones=[STORE_DORM, STORE_R]),
    dict(id='bank', page='life_facility',
         match=[[['은행', 'atm', '신한', '현금인출', '인출기', '자동화기기', '현금뽑']]],
         lead='홍문관(R동) 로비층에 신한은행이 있어요. 영업점은 평일 09:00~16:00, 자동화기기(ATM)는 07:00~23:30에 쓸 수 있어요.',
         phones=[BANK]),
    dict(id='print-center', page='life_facility',
         match=[[['출력센터', '출력기', '에이제이', '사이버머니', '티머니', '교통카드']],
                [['프린트', '프린터', '출력', '인쇄'], ['학생회관', '홍문관', '지하2층', '센터']],
                [['프린트', '출력', '인쇄'], ['어디', '하는곳', '할곳', '되는곳', '인쇄소']]],
         # '프린터'(기계) 위치는 PC실 답(pc-room), '프린트·출력할 곳'은 출력센터.,
         lead='출력센터(에이제이네트웍스)는 학생회관(G동) 1층과 홍문관(R동) 지하2층에 있어요. 각 건물 출력기에서 후불교통카드(T-머니·신용카드)로 사이버머니를 충전해 출력해요.',
         phones=[PRINT_CENTER]),
    dict(id='bookstore', page='life_facility',
         match=[[['서점', '문구', '화방', '전공책', '교재', '책사', '책구매', '책파는', '한가람', '대학서적', '모형재료', '미술용품', '미술재료']]],
         lead='서점(대학서적)은 홍문관(R동) 지하2층, 문구·화방(한가람문구)은 홍문관(R동) 로비층에 있어요.',
         phones=[BOOKSTORE, STATIONERY]),
    dict(id='photo-studio', page='life_facility',
         match=[[['사진관', '증명사진', '여권사진', '학사모', '스튜디오홍대', '반명함']]],
         lead='사진관(스튜디오홍대)은 홍문관(R동) 지하2층에 있어요. 증명사진(반명함·여권·비자 등)과 학사모 촬영을 해요.',
         phones=[PHOTO]),
    dict(id='facility', page='life_facility', lead='서울캠퍼스 카페·편의점·서점·문구·은행 같은 편의시설의 위치·전화·영업시간이에요.',
         match=[[['편의시설', '여행사', '꽃집', '꽃다발', '전자제품', '컴퓨터매장', '비젼플러스', '중식당', '향차이', '샤브', '뷔페', '후생시설']]]),

    # 메이커스페이스
    dict(id='makerspace', page='life_youthhostel005',
         match=[[['메이커스페이스', '메이커', '3d프린터', '3d프린팅', '레이저커팅', '레이저커터', '레이저조각', '목공실', '목공', '포토스튜디오',
                  '모형제작실', '공유오피스', '창작새길']]],
         lead='홍익 메이커스페이스는 제2기숙사 지하 1·2층에 있는 제작·교육 공간이에요. 정규 안전교육을 이수한 재학생은 공유 공간과 3D프린터·레이저 커팅기·목공 장비를 쓸 수 있어요.'),

    # 체육시설·대관
    dict(id='facility-rental', page='life_seoul-sports-facilities',
         match=[[['대관', '빌리', '빌려', '대여', '예약', '추첨', '사용신청', '이용신청', '쓸수있'],
                 ['운동장', '체육관', '농구장', '배구장', '배드민턴장', '풋살', '축구장', '강당', '행사장', '시설', '장소', '공간', '강의실']],
                [['시설대관', '장소대관', '행사장대관', '체육관대관', '운동장대관', '강의실대관']]],
         exclude=['노트북', '우산', '도서', '책'],
         lead='체육관·대운동장 같은 체육시설은 관재팀에 문의해 이용해요. 대운동장과 농구장은 학기 전에 학생지원팀이 일괄 추첨하고, 학기 중에는 관재팀에 문의해요. '
              '학생회·동아리 행사 장소 배정은 학생지원팀이 맡아요.',
         phones=['property', CLUB_SPACE], facility=PROPERTY_ROOM),
    dict(id='gym', page='life_seoul-sports-facilities',
         match=[[['헬스', '체력단련', '웨이트', '운동기구', '헬스반']], [DORM, ['헬스', '체력단련']],
                [['헬스', '체력단련'], ['학생증', '이용', '등록', '회원', '얼마', '가격', '시간', '몇시']]],
         exclude=['동아리'],
         lead='체력단련실(헬스장)은 제2기숙사 지하 4층에 있고 07:00~22:00에 열어요. 재학생은 제2기숙사 지하 3층 헬스반에서 일반회원으로 등록해 이용해요(이용료 월 2만원).'),
    dict(id='sports', page='life_seoul-sports-facilities', lead='서울캠퍼스 체육시설(농구장·배구장·탁구장·대운동장 등)의 위치·이용시간·이용방법이에요.',
         match=[[['체육관', '운동장', '농구', '배구', '테니스', '풋살', '축구', '체육시설', '탁구', '배드민턴', '검도장', '태권도실', '기구실', '운동하', '운동할', '공빌리']]],
         exclude=['다쳤', '다치', '부상', '넘어졌', '넘어져', '삐었', '삐끗', '접질', '골절'],
         phones=['property'], facility=PROPERTY_ROOM),

    # 기숙사
    dict(id='dorm-apply', page='life_dormitory',
         match=[[DORM, ['신청', '지원', '모집', '선발', '입사', '언제', '기간', '일정', '합격', '붙', '뽑', '들어가', '성적', '커트']]],
         exclude=['사생활'],
         lead='기숙사는 홈페이지(dormitory.hongik.ac.kr)에서 온라인으로 지원해요. 1학기는 매년 1월부터 신입생·재학생·복학생 순으로 모집하고, 하계방학은 5월, 2학기는 7월, 겨울방학은 11월 중에 모집해요. '
              '신입생·재학생 중 성적을 고려해 선발해요.',
         phones=['dorm', DORM3]),
    dict(id='dorm-rooms', page='life_dormitory',
         match=[[DORM, ['시설', '방', '호실', '몇인실', '인실', '준비물', '이불', '가져', '챙겨', '샤워', '화장실', '세탁', '전열', '드라이기', '택배', '열람실', '주소', '위치', '어디']]],
         exclude=['사생활'],
         lead='제2기숙사(와우산로 94)는 2인 1실, 제3기숙사(성미산로 55)는 1인 1실(남)·2인 1실이에요. 방마다 화장실·샤워실이 있고, 이불·베개·세면도구는 직접 챙겨야 해요. '
              '헤어드라이어 말고 전열기구는 반입할 수 없어요.',
         phones=['dorm', DORM3]),
    dict(id='dorm', page='life_dormitory', lead='서울캠퍼스 기숙사는 성적을 고려해 선발하고, 기숙사 홈페이지(dormitory.hongik.ac.kr)에서 온라인으로 지원해요.',
         match=[[DORM + ['사생']]], exclude=['사생활'], phones=['dorm', DORM3]),

    # 공용 PC실(정보전산원). 쿼터·충전은 it_campus 'printer-quota', 설치 소프트웨어는 'pc-software' 가 맡는다.
    # 출력센터(교통카드 사이버머니 출력기)는 print-center.
    dict(id='pc-room', page='life_seoul-public-computer-room',
         lead='공용 PC실 C414·R915는 학기 중 09:00~20:00(방학 중 09:00~17:00)에 열어요. B105·K611은 학기 중 09:00~17:00만 열어요. PC실별 소프트웨어와 프린터 안내예요.',
         match=[[['컴퓨터실', 'pc실', '공용컴퓨터', '실습실', '전산실', 'c414', 'r915', 'b105', 'k611']],
                [['프린터', '프린트', '인쇄', '출력']]],
         exclude=['고지서', '증명', '영수증', '확인서', '제출', '성적표'],
         phones=['pc'], facility='it'),

    # 학생상담센터
    dict(id='psych-test', page='life_seoul-student-counseling-center',
         match=[[['심리검사', 'mbti', 'mmpi', '성격검사', '적성검사', '진로검사', '진로사고검사', 'tci', '홀랜드', 'holland', '스트레스검사', '옴니핏', '검사해석']]],
         lead='학생상담센터에서 MMPI-2·MBTI·TCI·Holland 같은 심리검사를 받을 수 있어요. 신청서를 내면 검사를 하고, 결과는 전문 상담사와 1대1 해석상담(40~50분)으로만 확인해요.',
         phones=['test', COUNSEL_MAIN], facility='counsel'),
    dict(id='counseling', page='life_seoul-student-counseling-center',
         match=[[['상담센터', '학생상담', '심리상담', '상담받', '상담하고', '상담신청', '집단상담', '개인상담', '우울', '불안', '스트레스', '고민상담',
                  '마음이힘', '힘들어', '멘탈', '정신건강', '자살', '죽고싶', '외로워', '외롭', '상담사', '게이트키퍼']],
                [['유학생', '외국인'], ['상담']]],
         exclude=NOT_RIGHTS,
         lead='학생상담센터는 재학생에게 심리상담·심리검사·특강을 제공해요. 개인상담은 신청서를 내면 접수상담과 심리검사 뒤 상담자를 배정해 주 1회(50분) 진행해요.',
         phones=[COUNSEL_MAIN, 'counsel', 'test'], facility='counsel'),

    # 인권센터
    dict(id='human-rights', page='life_seoul-human-rights-center',
         match=[[['인권', '성희롱', '성폭력', '성추행', '괴롭힘', '갑질', '차별', '스토킹', '폭력', '불법촬영', '몰카', '추행']]],
         lead='인권센터는 성희롱·성폭력·괴롭힘 같은 인권침해 피해를 접수하고 상담해요. 피해자에게는 심리상담과 보호·법적·의료적 지원을 연계해요.',
         phones=['rights'], facility='rights'),

    # 장애학생지원. '장애'만으로는 '와이파이 장애' 같은 고장 질문도 걸려서 막는다.
    dict(id='disability', page='life_seoul-students-disabilities-support',
         match=[[['장애학생', '장애인', '장애가', '장애등급', '장애유형', '장애학우', '휠체어', '청각장애', '시각장애', '지체장애', '속기사', '수어통역', '수어지원', '수화통역']],
                [['장애'], ['기숙사', '수강신청', '장학금', '도우미', '시험', '학교생활', '지원', '센터']],
                [['장애']]],
         exclude=['와이파이', 'wifi', '접속', '서버', '클래스넷', '시스템', '오류', '네트워크', '인터넷', '메일', '먹통', '전산', '홈페이지', '사이트', '포털'],
         lead='장애학생지원센터는 우선수강신청, 교육지원인력(도우미·속기사·수어통역), 시험 등 수업 편의, 기숙사 장애인실 우선배정, 복지장학금을 지원해요.',
         phones=['disab'], facility='disab'),

    # 취업진로지원센터
    dict(id='field-practice', page='life_seoul-career-support-center',
         match=[[['현장실습', '인턴', '실습학기', '표준현장']], [['현장실습', '인턴'], ['학점', '신청', '기간', '지원', '언제']]],
         exclude=NOT_CAREER,
         lead='표준현장실습학기제는 3·4·5학년이 기업 등 실습기관에서 1~2개월(단기) 또는 3~6개월(장기) 현장실습을 하는 제도예요.',
         phones=['intern', CAREER_MAIN], facility='career'),
    dict(id='language-test-fee', page='life_seoul-career-support-center',
         match=[[['응시료', '응시장학', '응시지원']],
                [['토익', '토플', '오픽', 'toeic', 'opic', 'toefl', '어학시험', '어학인증', '어학성적'], ['지원', '장학', '돈', '비용', '환급', '지원금', '내줘']]],
         lead='취업진로지원센터는 4학기 이상 이수한 재학생에게 어학인증시험 응시료를 응시장학금으로 지원해요(TOEIC·TOEFL·OPIc·IELTS 등 11종, 취업진로지원센터 홈페이지 기준).',
         phones=[CAREER_MAIN, 'career'], facility='career'),
    dict(id='career-consulting', page='life_seoul-career-support-center',
         match=[[['자소서', '자기소개서', '이력서', '모의면접', '면접준비', '면접연습', '면접코칭', '취업면접', '컨설팅', '첨삭', '취업상담', '취업컨설팅']]],
         exclude=NOT_CAREER,
         lead='취업진로지원센터는 3·4학년에게 취업 컨설턴트와 1:1 대면 컨설팅(취업상담·이력서·자기소개서 첨삭·면접코칭)을 해요. 4학년은 실전모의면접도 받을 수 있어요.',
         phones=['career', CAREER_MAIN], facility='career'),
    dict(id='career', page='life_seoul-career-support-center',
         match=[[['취업', '진로', '취준', '채용', '일자리', '구직', '직무', '멘토링', '부트캠프', '추천채용', '채용설명회', '리크루팅', '자격증프로그램']]],
         exclude=NOT_CAREER,
         lead='취업진로지원센터는 취업교과목, 1:1 취업 컨설팅, 취업특강·취업스쿨, 현직자 멘토링, 현장실습, 기업 추천채용 같은 취업지원 프로그램을 운영해요.',
         phones=[CAREER_MAIN, 'career', 'intern'], facility='career'),

    # 창업
    dict(id='hive', page='life_seoul-hive', match=[[['하이브', 'hive', '벤처']]],
         lead='HIVe(하이브)는 창업에 관심 있는 학생들의 벤처창업기관이에요. 3월·9월에 신규 부원을 모집하고 창업 팀을 꾸려요.',
         facility='studentteam'),
    dict(id='startup', page='life_seoul-entrepreneurship-education-center',
         match=[[['창업', '스타트업', '사업자', '아트앤디자인밸리', '창업경진', '창업페스티벌', '창업동아리', '창업장학', '창업캠프', '창업특강', '창업교육']]],
         lead='창업교육센터는 창업 교과목, 홍익인 창업페스티벌(창업경진대회), 창업동아리·창업캠프, 창업장학금, 창업특강을 운영해요.',
         facility=STARTUP_ROOM),

    # 교수학습지원센터
    dict(id='learning', page='life_seoul-learning-support-center',
         match=[[['교수학습', '학습지원', '튜터', '학습법', '학습전략', '글쓰기', '스터디그룹', '스터디', '학습동아리', '자기주도학습', '전공마스터', '말하기대회', '글쓰기대회', '독서']]],
         exclude=['스터디룸', '스터디카페'],
         lead='교수학습지원센터는 학습법·학습전략 워크숍, 스터디그룹, 글쓰기 워크숍·클리닉 같은 학습·소통 프로그램을 운영해요. 일정과 신청은 학교 학생공지와 센터 홈페이지 공지사항을 봐요.',
         phones=['learn'], facility=LEARN_ROOM),

    # 봉사
    dict(id='overseas-volunteer', page='life_seoul-overseas-service',
         match=[[['해외봉사', '국제봉사', '봉사단', '월드프렌즈', '국제사회봉사']]],
         lead='홍익국제사회봉사단은 학생지원팀이 공지·신청서 접수·면접으로 참가자를 뽑아요. 봉사 후 결과보고서를 내면 사회봉사 1학점을 받아요. 월드프렌즈코리아 청년봉사단은 하계(7월)·동계(1월) 방학에 해요.',
         phones=['volunteer'], facility='studentteam'),
    dict(id='volunteer-cert', page='life_seoul-community-service',
         match=[[['봉사'], ['확인서', '증명서', '발급', '출력', '뽑']]],
         exclude=['봉사장학'],
         lead='사회봉사활동 확인서는 클래스넷에서 직접 출력해요. 학교 주관 봉사활동(사회봉사과목·해외봉사·농촌봉사 등) 내역만 발급되니, 외부 봉사 증빙 원본은 직접 보관해요.',
         phones=['volunteer'], facility='studentteam'),
    dict(id='volunteer', page='life_seoul-community-service',
         match=[[['사회봉사', '봉사활동', '봉사시간', '봉사학점', '봉사실적', '봉사']]],
         exclude=['봉사장학'],
         lead='사회봉사활동 실적은 봉사활동 증명서·상장 같은 증빙 사본을 학부(과) 사무실에 내면 등록돼요. 실적은 교내장학생(홍익인간·자주·창조·협동) 선발에 쓰여요(4학년은 상관없어요). 이 페이지에는 15시간 이상으로 적혀 있지만, 교내장학금 안내에는 26-2학기 선발부터 10시간 이상으로 나와 있어요.',
         phones=['volunteer'], facility='studentteam'),

    # 국제학생증 — '학생증 발급'(앱 흐름)보다 점수가 높게 두 묶음 길도 둔다.
    dict(id='isic', page='life_seoul-international-student-card',
         lead='ISIC 국제학생증은 학부·대학원 재학생과 휴학생이 ISIC 홈페이지에서 신청해요(졸업생은 신청할 수 없어요).',
         match=[[['국제학생증', 'isic']],
                [['국제학생증', 'isic'], ['발급', '신청', '만들', '받', '어디', '방법', '혜택', '할인', '졸업생', '휴학생', '체크카드', '분실', '재발급']]]),

    # 학생회·홍보대사·국제학생회
    dict(id='council', page='life_seoul-intro-student-council',
         match=[[['총학생회', '총학', '학생회', '단과대학생회', '학생복지위원회', '대동제', '축제', '총졸업준비']]],
         exclude=['학생회관'],
         lead='총학생회는 학생 자치기구예요. 학생복지위원회가 택배 대리 수령·물품 대여 같은 상시 사업을, 총졸업준비위원회가 졸업 앨범 업무를 맡아요. 총학생회실은 학생회관(G동) 3층 310호예요.',
         phones=[COUNCIL_ROOM, 'student'], facility='studentteam'),
    college('council-architecture', 'life_seoul-architecture-and-urbanism', ['건축도시', '건도대', '건축대', '건축학과', '건축'], '건축도시대학', '와우관(L동) 5층 503호', COLLEGE_A),
    college('council-art', 'life_seoul-art', ['미술대학', '미대'], '미술대학', '학생회관(G동) 3층 315호', COLLEGE_B),
    college('council-business', 'life_seoul-business-school', ['경영대학', '경영대', '경영학'], '경영대학', '인문사회관(B동) 1층 103호', COLLEGE_B),
    college('council-autonomous', 'life_seoul-campus-autonomous-major', ['캠퍼스자율전공', '캠자', '자율전공'], '캠퍼스자율전공', '학생회관(G동) 3층 316호', COLLEGE_A),
    college('council-design-management', 'life_seoul-design-and-management', ['디자인경영', '디예경'], '디자인경영융합학부', None, COLLEGE_B),
    college('council-economics', 'life_seoul-economics', ['경제학부', '경제학과', '경제'], '경제학부', '인문사회관(C동) 2층 208호', COLLEGE_B),
    college('council-education', 'life_seoul-education', ['사범대학', '사범대', '사대', '교육학과'], '사범대학', '인문사회관(C동) 6층 639호', COLLEGE_B),
    college('council-engineering', 'life_seoul-engineering', ['공과대학', '공대'], '공과대학', '제1공학관(K동) 6층 607호', COLLEGE_A),
    college('council-law', 'life_seoul-law-school', ['법과대학', '법대', '법학'], '법과대학', '홍문관(R동) 4층 412호', COLLEGE_A),
    college('council-liberal-arts', 'life_seoul-liberal-arts', ['문과대학', '문과대', '문대'], '문과대학', '인문사회관(C동) 2층 207호', COLLEGE_B),
    college('council-performing-arts', 'life_seoul-performing-arts', ['공연예술', '뮤지컬전공', '실용음악'], '공연예술학부', '대학로캠퍼스 교육동 지하층(220-1호 뮤지컬전공, 220-2호 실용음악)', COLLEGE_A),
    dict(id='hongaram', page='life_seoul-hongaram', match=[[['홍아람', '홍보대사', '캠퍼스투어', '캠투', '홍익방문의날']]],
         lead='홍아람은 홍익대학교 공식 홍보대사단이에요. 캠퍼스 투어·의전 활동 등을 하고, 신입기수는 11월에 모집·면접을 거쳐 12월에 선발해요.',
         phones=[HONGARAM, HONGARAM_DESK], facility='studentteam'),
    dict(id='vois', page='life_test', match=[[['vois', '유학생위원회', '유학생회', '외국인학생회']]],
         lead='VOIS(유학생위원회)는 학부 유학생들이 만든 커뮤니티예요. 수강신청·외국인등록증(ARC) 신청을 돕고 건강보험 같은 행정 절차를 지원해요.'),
    dict(id='hisc', page='life_seoul-hisc', match=[[['hisc', '국제학생회', '버디', '국제교류학생회']]],
         lead='HISC는 홍익대 학부생과 교환학생으로 이뤄진 국제학생회예요. 교환학생의 학교생활 적응을 돕고 문화행사를 열어요.'),

    # 동아리 — 분야를 말하면 그 분과 목록으로 바로, 아니면 분야를 되묻는다.
    club('club-performance', 'life_seoul-performance', '공연',
         ['밴드', '공연', '노래', '음악', '댄스', '춤', '연극', '뮤지컬', '기타', '합창', '오케스트라', '마술', '풍물', '우쿨렐레', '힙합', '영화', '락'],
         ['블랙테트라', '뚜라미', '히아모', '홍익극연구회', '비츠플로우', '빛의소리', '알로하', '매직스', '브레인스워즈', '네페르', '와우풍물패', '소리얼', '스놀']),
    club('club-sports', 'life_seoul-sports', '스포츠',
         ['운동', '스포츠', '축구', '농구', '야구', '배드민턴', '수영', '테니스', '탁구', '태권도', '검도', '핸드볼', '미식축구', '사격'],
         ['일레븐킥스', '위너스', '카우보이스', '홍익태권', '팡팡', '물빛', 'hittc', 'hitc']),
    club('club-leisure', 'life_seoul-leisure', '레저',
         ['볼링', '등산', '클라이밍', '스키', '스노보드', '보드게임', '여행', '게임', '러닝', '헬스', '바이크', '캠핑'],
         ['볼케이노', '터사랑', '하이러닝', '애륜', '유스호스텔']),
    club('club-academic', 'life_seoul-scholarship', '학술',
         ['학술', '영어회화', '영어', '일본', '컴퓨터', '코딩', '프로그래밍', '금융', '투자', '마케팅', '광고', '천문', 'ted'],
         ['보에라', 'hicc', 'hecc', 'enactus', '인액터스', '애뜨림', '아이시떼루', '개밥바라기', '짜라투스트라', 'tedx']),
    club('club-religion', 'life_seoul-religion', '종교',
         ['종교', '기독교', '교회', '가톨릭', '천주교', '성당', '선교', '성경', '예배'],
         ['가듐', 'ccc', 'ubf', 'ivf', '예수전도단']),
    club('club-society', 'life_seoul-society', '사회',
         ['봉사', '봉사활동', '동물', '고양이', '유기동물', '해비타트', '사회'],
         ['그루터기', '멍냥부리', 'aiesec', '아이섹', '영원한미소', 'kusa', '호우회']),
    club('club-exhibition', 'life_seoul-exhibition', '전시',
         ['전시', '사진', '미술', '그림', '만화', '서예', '캘리', '문학', '글쓰기', '문예창작'],
         ['글샘문학회', '모래알사진반', '미사랑', '민화반', '서우회']),
    dict(id='clubs', pages=['life_seoul-performance', 'life_seoul-sports', 'life_seoul-leisure', 'life_seoul-scholarship',
                            'life_seoul-religion', 'life_seoul-society', 'life_seoul-exhibition'],
         match=[[['동아리', '총동아리', '총동연', '중앙동아리', '동방', '동아리방']]], question='어떤 분야 동아리가 궁금하세요? (총동아리연합회 중앙동아리)',
         phones=['club', CLUB_UNION], facility='studentteam'),
]
