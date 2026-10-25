"""수강·성적·졸업 주제. 형식은 topics/__init__.py 설명을 본다.

lead 는 모두 data/pages.json·data/faq.json 원문에서 줄였다(출처 페이지 키를 주석으로 단다).
질문은 공백·문장부호를 지우고 비교하므로 낱말도 붙여 쓴다('p/f' → 'pf', '1.75' → '175').
한 페이지에 답이 여럿인 수강신청·성적·사이버강좌는 주제를 나눠 같은 페이지를 보여 주되 lead 로 바로 답한다.
"""

# 수강신청 페이지(education_application-for-classes) 안 다른 주제로 가야 할 말.
_NOT_CLASSES = ['계절', '사이버', '재수강', '폐강', '장학', 'ocu']

TOPICS = [
    # ── 수강 ─────────────────────────────────────────
    # education_semester-retake
    dict(id='semester-retake', page='education_semester-retake',
         lead='학기재수강은 성적이 안 좋은 학기를 통째로 지우고 같은 학년·학기를 다시 다니는 제도예요. 지우려는 학기부터 직전 학기까지 모두 신청해야 하고, 1학기 신청기간(2월)엔 1학기부터, 2학기 신청기간(8월)엔 2학기부터 지울 수 있어요.',
         match=[[['학기재수강', '학기재수', '학기삭제', '학기성적삭제', '유급']],
                [['학기', '학년'], ['통째', '통으로', '다지우', '전부지우', '다시다니', '처음부터다시']]],
         exclude=['계절'], phones=['grade'], facility='support', faq=['재수강(과목재수강 및 학기재수강)']),
    # faq '4학년 학생의 과목재수강 선삭제'
    dict(id='retake-predelete', faqs=['4학년 학생의 과목재수강 선삭제'],
         match=[[['선삭제', '먼저삭제', '미리삭제', '먼저지우', '미리지우', '빨리지우', '빨리삭제']],
                [['재수강', '재수'], ['4학년', '미리', '먼저', '빨리', '언제지워', '언제삭제', '언제없어']]],
         phones=['grade'], facility='support'),
    # education_course-retake
    dict(id='course-retake', page='education_course-retake',
         lead='C+ 이하 과목은 같은 과목을 다시 수강신청하면 자동으로 재수강이 돼요(계절학기는 성적과 상관없이 가능). 학기당 1과목까지(F 과목은 개수에서 빼요)이고, 최고 성적은 A0예요. 새 성적이 더 나빠도 새 성적이 남아요.',
         match=[[['재수강', '재수', '다시들', '다시수강', '재이수', '다시신청']],
                [['재수강', '재수'], ['계절']]],
         phones=['grade'], facility='support',
         faq=['재수강(과목재수강 및 학기재수강)', '4학년 학생의 과목재수강 선삭제']),
    # education_application-for-classes '수강정정'
    dict(id='course-change', page='education_application-for-classes',
         lead='수강정정은 개강일부터 일주일 동안 수강신청시스템(sugang.hongik.ac.kr)에서 해요. 인원이 다 찬 과목은 학생 클래스넷 › 수강신청 › 「인원초과 과목 수강정정 신청」으로 신청하고, 담당교수가 승인하면 처리돼요.',
         match=[[['수강정정', '정정기간', '수강변경', '과목변경', '과목바꾸', '수업바꾸', '강의바꾸', '분반바꾸', '분반변경', '인원초과', '정원초과', '증원']]],
         exclude=['폐강', '성적', '학적', '계절'],
         phones=['class'], facility='support'),
    # education_application-for-classes '수강철회'·'추가 수강철회'
    dict(id='course-drop', page='education_application-for-classes',
         lead='수강철회는 정정기간이 끝난 뒤 1~3일(2026-2학기는 9.8 하루), 그리고 개강 후 3~4주차 중 2일(추가 수강철회)에 클래스넷 › 수강신청 › 정규학기 수강신청 › 「수강신청 철회하기」에서 해요. 신청학점이 15학점 밑이면 다음 학기 교내장학금, 12학점 밑이면 국가장학금 자격에 못 미칠 수 있어요.',
         match=[[['수강철회', '철회', '수강취소', '과목취소', '수업취소', '드랍', '드롭', '수강포기', '과목포기', '수업포기']]],
         exclude=['휴학', '유예', '복수전공', '부전공', '계절'],
         phones=['class'], facility='support'),
    # education_application-for-classes '폐강공고 및 폐강과목 수강정정'
    dict(id='course-cancelled', page='education_application-for-classes',
         lead='폐강 공고는 수강철회 기간이 끝난 뒤 대학공지·학생 클래스넷 공지에 올라오고, 학생이 직접 확인해야 해요. 폐강된 과목은 공고일부터 하루 동안 수강신청시스템에서 한 번만 다른 과목으로 정정할 수 있어요.',
         match=[[['폐강']]], exclude=['계절'],
         phones=['class'], facility='support'),
    # education_application-for-classes
    dict(id='classes', page='education_application-for-classes',
         lead='수강신청은 수강과목 사전선택(미리 담아두기) → 학년별 수강신청(4·3·2·1학년 순) → 개강 후 일주일 수강정정 → 수강철회 순서예요. 자세한 날짜는 매 학기 대학공지에 올라와요.',
         match=[[['수강신청', '수강싱청', '수강신쳥', '수강과목', '장바구니', '미리담', '담아두', '과목담기', '사전선택', '강의시간표',
                  '수업시간표', '시간표조회', '시간표짜', '모의수강', '수강시스템', '올클']],
                [['수강']]],
         exclude=_NOT_CLASSES, phones=['class'], facility='support', faq=['학점 및 성적관리']),
    # education_info-cyber-lecture '군 e-러닝 수강 안내'(cyber 보다 앞에 둬 '군대 사이버강좌' 동점을 가져온다)
    dict(id='military-elearning', page='education_info-cyber-lecture',
         lead='군 휴학 중(입영 또는 복무 중)에는 국방부 e-러닝(나라사랑포털)으로 본교 정규학기 사이버강좌 중 교양교과목을 들을 수 있어요. 한 학기 최대 3학점, 군 복무 기간 중 최대 6학점까지이고 수강료는 본교 계절학기 수강료 기준이에요.',
         match=[[['군이러닝', '군e러닝', '나라사랑포털', '국방부이러닝', '국방부e러닝']],
                [['군', '입대', '복무', '군휴학', '군대', '군인'], ['이러닝', 'e러닝', '사이버', '온라인강의', '인강', '학점따', '수업듣', '강의듣', '학점취득']]],
         phones=['cyber'], facility='support'),
    # education_info-cyber-lecture 'OCU컨소시엄'
    dict(id='ocu', page='education_info-cyber-lecture',
         lead='OCU(한국열린사이버대학교) 공동개설교과목은 3학년 이상 재학생이 본교 클래스넷으로 수강신청하고, 일반선택으로 인정돼요. 시스템사용료를 안 내면 F 처리되고 재수강도 안 되니, 안 들을 거면 본교 수강철회 기간에 꼭 철회해요.',
         match=[[['ocu', '열린사이버', '오씨유', '오시유']]],
         phones=['cyber'], facility='support'),
    # education_info-cyber-lecture '특성화교양 교과목 수강 안내'
    dict(id='special-liberal', page='education_info-cyber-lecture',
         lead='2019학번부터는 특성화교양 3과목(컴퓨팅사고·디자인씽킹·창업과실용법률) 중 1과목을 따야 졸업할 수 있어요. 단과대학·전공에 따라 들을 수 없는 과목이 있어요.',
         match=[[['특성화교양', '컴퓨팅사고', '디자인씽킹', '창업과실용법률', '컴퓨터프로그래밍', '특교']]],
         phones=['cyber'], facility='support'),
    # education_info-cyber-lecture '사이버강좌 수강 및 출석 인정 안내'
    dict(id='cyber', page='education_info-cyber-lecture',
         lead='사이버강좌는 학기당 최대 2과목(외국인 학생은 1과목)까지 듣고, 졸업까지 2022학번부터 누적 24학점, 2016~2021학번 26학점, 2015학번까지 28학점까지예요. 주차별 강의를 출석 인정기간 안에 90% 이상 봐야 출석으로 인정돼요.',
         match=[[['사이버강좌', '사이버강의', '사이버수업', '사이버과목', '온라인강의', '온라인수업', '인강', '이러닝', '원격강의',
                  '원격수업', '동영상강의', '비대면강의', '비대면수업', '녹화강의']]],
         phones=['cyber'], facility='support', faq=['사이버강좌 수강안내']),
    # faq 'PF 교과목'
    dict(id='pf', faqs=['PF 교과목'], match=[[['pf', '패스페일', '논패스', '패논패', 'pass', 'p과목', 'p학점', '패스과목']]],
         phones=['grade'], facility='support'),
    # faq '영어전용강좌'
    dict(id='english-course', faqs=['영어전용강좌'],
         match=[[['영어전용', '영어강의', '영어강좌', '원어강의', '영강', '영어로진행', '영어로하는', '영어수업', '전공영어', '영어과목']]],
         phones=['class'], facility='support'),
    # faq '취업공결제 관련 안내'
    dict(id='job-absence', faqs=['취업공결제 관련 안내'],
         match=[[['취업공결', '조기취업', '취업계', '취업으로결석', '취업결석']],
                [['취업', '회사', '입사', '출근', '재직'], ['출석', '결석', '수업', '공결', '학점', '빠지', '빠져']]],
         phones=['class'], facility='support'),
    # faq '출석인정 절차 안내'
    dict(id='attendance', faqs=['출석인정 절차 안내'],
         match=[[['출석인정', '출결인정', '출석처리', '공결', '병결', '결석계', '결석사유', '출석인정원', '결석', '출석', '경조사']],
                [['예비군', '민방위', '훈련', '동원', '신체검사', '입원', '장례', '결혼'], ['출석', '결석', '수업', '빠지', '빠져', '못가']],
                [['아파', '아픈', '아프', '감기', '몸살', '병원'], ['수업빠', '수업못', '빠짐', '빠졌', '빠져', '빠지', '못갔', '못가']]],
         phones=['class'], facility='support'),
    # education_grades '출석의무'
    dict(id='absence-limit', page='education_grades',
         lead='한 학기 수업시간의 3분의 1 이상 결석한 과목은 성적을 인정하지 않아요. 시험·과제 점수와 상관없이 F가 되니, 필수과목이면 다시 들어야 해요.',
         match=[[['결석', '출석', '결강', '빠지', '빠져', '안나가'], ['몇번', '몇회', '몇주', '몇시간', '3분의1', '삼분의일', '에프', 'f', '기준', '넘으면', '한도', '최대', '제한', '까지']]],
         exclude=['사이버', '인정', '공결', '취업'],
         phones=['grade'], facility='support'),
    # education_seasonal-semester-registration + education_application-for-classes '계절학기 수강신청'
    dict(id='seasonal', page='education_seasonal-semester-registration', faqpage='education_application-for-classes',
         lead='계절학기는 15일 동안 열리고, 수강신청은 1차 학년별 → 2차 전학년(하루) → 수강철회 → 폐강과목 공지 순서예요. 수강료는 고지서의 전체 금액을 가상계좌로 내야 하고, 1차 수강료를 안 내면 1차 수강신청 내역이 지워져요.',
         match=[[['계절학기', '계절수업', '계절학기수강', '여름학기', '겨울학기', '썸머스쿨', '윈터스쿨', '방학수업', '방학때수업', '방학중수업', '방학에수업', '계절']]],
         phones=['class'], facility='support'),
    # faq '기말고사 전에 군입대하는 경우 성적처리'
    dict(id='military-grade', faqs=['기말고사 전에 군입대하는 경우 성적처리'],
         match=[[['군입대', '입대', '입영', '군대가', '군대'], ['성적', '기말', '학점인정', '시험', '성적대체']]],
         phones=['leave'], facility='support'),

    # ── 성적 ─────────────────────────────────────────
    # faq '성적확인'
    dict(id='grade-check', faqs=['성적확인'],
         match=[[['성적확인', '성적조회', '성적열람', '성적공개', '성적발표', '성적이의', '성적문의', '성적정정', '금학기성적', '전체성적']],
                [['성적', '학점'], ['언제', '나와', '나오', '뜨', '떴', '확인', '조회', '보는', '볼수', '이의', '정정', '정정기간']]],
         exclude=['증명', '경고', '장학', '졸업', '수료', '재수강'],
         phones=['grade'], facility='support'),
    # faq '평점계산 및 백점으로 환산하는 방법'
    dict(id='gpa', faqs=['평점계산 및 백점으로 환산하는 방법'],
         match=[[['평점', '평균평점', '백점', '100점', '환산', 'gpa', '학점계산', '평균학점', '학점평균', '평점계산', '성적계산', '학점몇점', '45만점']]],
         exclude=['장학', '조기졸업', '경고'],
         phones=['grade'], facility='support'),
    # education_academic-warning
    dict(id='warning', page='education_academic-warning',
         lead='직전 학기 평균평점이 1.75에 못 미치거나 F가 2과목 이상이면 성적경고를 받아요. 성적경고를 받으면 이수학점이 제한될 수 있고, 3개 학기 연속 받으면 제적돼요.',
         match=[[['성적경고', '학사경고', '학고', '학점경고']],
                [['성적경고', '학사경고', '학고'], ['제적', '3번', '세번', '연속', '3회', '삼진']],
                [['경고'], ['성적', '학점', '평점']],
                [['평점', '학점'], ['175']]],
         phones=['grade'], facility='support', faq=['성적경고와 제적']),
    # education_grades '성적평가'(상대평가 표)
    dict(id='relative-grading', page='education_grades',
         lead='교양·1~3학년 전공·전공기초·일반선택은 상대평가예요. 21명 이상 수업은 A가 최대 40%, A+B가 최대 80%이고, 4·5학년 전공과 영어전용강좌는 절대평가예요.',
         match=[[['상대평가', '절대평가', '학점비율', 'a비율', '성적비율', '등급비율', 'a몇퍼', '몇퍼센트', '학점컷', '성적컷']]],
         phones=['grade'], facility='support'),
    # education_grades '이수학점'
    dict(id='credit-limit', page='education_grades',
         lead='한 학기에는 12학점 이상 17학점까지 듣는 게 원칙이에요(2015학년도 이전 입학생은 18학점까지). 직전 학기 성적이 평균 B+ 이상이면 3학점을 더 들을 수 있어요.',
         match=[[['최대학점', '최소학점', '몇학점까지', '몇학점들', '몇학점신청', '몇학점이상', '학점제한', '이수학점', '수강학점', '신청학점',
                  '학점한도', '학점상한', '초과이수', '학점추가', '학점더', '수강제한학점', '이수한계']]],
         exclude=['졸업', '수료', '장학', '사이버', '영어', '영강', '원어', 'pf', '패스', '전공', '교직'],
         phones=['grade'], facility='support'),
    # education_grades
    dict(id='grades', page='education_grades',
         lead='성적은 A+(4.5)부터 F(0.0)까지 매기고, D0 이상이 취득학점이 돼요. 수업의 3분의 1 이상 결석한 과목은 F이고, 한 학기에 12~17학점을 듣는 게 원칙이에요.',
         match=[[['성적', '학점', '등급', 'a+', 'a0', '에이쁠', 'f학점', '에프', 'f받', 'f맞', 'f뜨', '에프받']]],
         exclude=['장학', '증명', '학점교류', '에프터', '애프터', '성적표출력', '성적표뽑', '성적표발급', '성적표떼', '성적표프린트', '성적표인쇄'],
         phones=['grade'], facility='support', faq=['성적확인', '학점 및 성적관리']),

    # ── 졸업 ─────────────────────────────────────────
    # education_early-graduation
    dict(id='early-graduation', page='education_early-graduation',
         lead='7학기(5년제 건축학전공은 9학기) 동안 졸업요건을 모두 채우고 평균평점이 A0(4.0) 이상이면 조기졸업을 신청할 수 있어요(편입생 제외). 1학기는 7월 중, 2학기는 1월 중에 주전공 학과사무실에 조기졸업신청서와 성적증명서를 내고, 신청 후에는 취소할 수 없어요.',
         match=[[['조기졸업', '일찍졸업', '빨리졸업', '조졸', '7학기졸업', '7학기만에', '3년반']]],
         phones=['grad'], facility='support', faq=['조기졸업']),
    # education_deferred-system
    dict(id='deferred', page='education_deferred-system',
         lead='졸업요건을 다 채우고도 졸업을 미루고 싶으면 학사학위취득유예를 신청해요. 1학기는 5월 초~7월 말, 2학기는 11월 초~1월 말에 클래스넷에서 본인이 신청하고, 유예는 한 학기씩이라 더 미루려면 매 학기 다시 신청해요.',
         match=[[['졸업유예', '학위취득유예', '학사학위취득유예', '졸업연기', '졸업미루', '졸업을미', '졸업늦', '졸업보류', '졸업안하', '유예신청', '유예제']]],
         phones=['grad'], facility='support'),
    # faq '졸업논문'
    dict(id='thesis', faqs=['졸업논문'],
         match=[[['졸업논문', '졸논', '졸업작품', '졸작', '졸업시험', '졸업전시', '졸전', '졸업프로젝트', '졸업과제', '논문']]],
         exclude=['표절', '대학원', '석사', '박사'], phones=['grad'], facility='support'),
    # education_completion-credit + faq '졸업논문'
    dict(id='graduation-credit', page='education_completion-credit',
         lead='학교 안내의 4학년 수료 요건은 정규 8학기 이상 등록과 132학점 이상 취득이에요(2015학년도 입학생까지는 140학점). 4학년은 졸업논문을 내서 심사를 통과해야 졸업할 수 있고, 학과에 따라 실험·작품·시험 등으로 대신해요.',
         match=[[['졸업학점', '졸업요건', '졸업조건', '졸업기준', '졸업하려면', '졸업하려', '졸업가능', '졸업할수', '졸업에필요', '졸업사정', '졸업하기']],
                [['졸업'], ['학점', '몇학점', '132', '140']]],
         exclude=['조기', '유예', '증명', '논문', '사진', '앨범', '가운', '학위수여', '졸업식'],
         phones=['grad'], facility='support', faq=['졸업논문', '수료학점 및 수료(예정)증명서']),
    # education_completion-credit
    dict(id='completion', page='education_completion-credit', match=[[['수료']]],
         lead='수료는 학년마다 정해진 학기 이상 등록하고 학점을 채우면 인정돼요. 2016학년도 입학생부터 4학년 수료는 정규 8학기 이상 등록과 132학점 이상 취득이에요(2015학년도 입학생까지는 140학점).', phones=['grad'], facility='support',
         faq=['수료학점 및 수료(예정)증명서']),
]
