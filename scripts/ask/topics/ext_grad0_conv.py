"""융합전공별 이수요건(conv 갈래): 2026 교과과정책자에 실린 융합전공 13개.
형식은 topics/__init__.py 를 본다.

출처
- data/pages-curr_conv.json(sites/curr_conv.py): 책자 '융합전공 이수요건'(PDF 26~28쪽)과 융-1~26(PDF 62~87쪽)의
  주전공별 이수요건·필수 이수 조건·전공필수·졸업논문 학수번호.
- data/pages-deptrule_conv.json(sites/deptrule_conv.py): 경영학부 공지 '융합전공(문화예술경영전공) 졸업 요건'.
- 융합전공 공통 규정(36학점 이상, 주전공과 겹치는 과목 12학점 이하 중복 인정, 전공별 문의처)은
  data/pages.json 'education_convergence-major'(core 'convergence-major' 와 같은 페이지) — 버튼으로 붙인다.

길
- core 'convergence-major'(academic.py)는 '융합전공'·'융전' 한 낱말로 받는다(점수 4). 여기는 전공 이름(대부분 5자 이상) +
  졸업·이수 낱말이나 '융합전공'으로 점수를 더 올려 전공 이름이 있는 물음만 가져온다. 전공 이름 없는 물음은 core 에 둔다.
- '공연예술'은 공연예술학부(ext_dept.py 'dept-grad-perform' 등)와 겹쳐, 융합 낱말이 함께 있을 때만 받는다.
- '데이터사이언스'는 '스마트도시데이터사이언스' 안에 들어 있어 grad-conv-datasci 는 '스마트도시'를 뺀다.
- 신청·철회·자격취득 같은 절차 물음, 학과 사무실·전화 물음, 졸업식·졸업논문 물음은 각 주제로 둔다(NOT).
lead 는 책자·학교 안내·학과 공지 원문에 적힌 사실만 줄여 썼다.
"""

# ext_grad0_hum.py 에서 옮겨 적은 낱말(다른 주제 파일을 import 하지 않는다).
GRADW = ['졸업학점', '졸업요건', '졸업조건', '졸업기준', '졸업하려면', '졸업하려', '졸업하기', '졸업에필요', '졸업가능',
         '졸업할수', '졸업이수', '졸업']
MORE = ['전공필수', '전필', '필수과목', '교과과정', '교육과정', '이수체계', '커리큘럼', '전공학점', '이수요건', '이수조건', '몇학점',
        '이수학점', '필수']
CONV = ['융합전공', '융전', '융합']
NOT = ['졸업식', '졸업사진', '앨범', '가운', '유예', '조기졸업', '졸업논문', '졸논', '졸업작품', '졸작', '졸업전시', '졸전', '졸업시험',
       '졸업증명', '증명서', '학위수여', '졸업공연', '졸업사정', '대학원', '석사', '박사', '장학']
# ext_dept.py OFFICE 에서 옮겨 적음(사무실·전화 물음은 dept-office·phone-search 로).
OFFICE = ['과사', '과사무실', '학과사무실', '학과사무소', '과사무소', '학부사무실', '학과사무', '전공사무실', '학과행정실', '과행정실',
          '사무실', '전화', '번호', '연락처']
# 신청·철회 같은 절차 물음은 core 'convergence-major'.
APPLY = ['신청', '철회', '포기', '선발', '합격', '지원자격', '자격취득', '등록금']
EXCL = list(dict.fromkeys(NOT + OFFICE + APPLY))

CULTURE = ['문화예술경영', '문화예술경영전공', '문예경']
ARCHSPACE = ['건축공간예술', '건축공간예술전공']
PERFORM_CONV = ['공연예술융합', '공연예술융합전공']
PERFORM = ['공연예술']
LANDSCAPE = ['환경조경디자인', '환경조경', '조경디자인', '조경']
IOT = ['사물인터넷', '사물인터넷공학', 'iot']
ROBOT = ['지능로봇', '지능로봇공학']
SMARTCITY = ['스마트도시데이터사이언스', '스마트도시·데이터사이언스', '스마트도시데이터', '스마트도시']
DESIGNENG = ['디자인엔지니어링', '디자인엔지']
BIGBIZ = ['빅데이터비즈니스', '빅데이터비즈', '빅비즈']
MOBILITY = ['미래모빌리티']
DATASCI = ['데이터사이언스', '데이터사이언스전공', '데사']
MEDAI = ['의료헬스케어ai', 'ai의료헬스케어', '의료헬스케어', '헬스케어ai', '의료ai']
HEALTHSVC = ['헬스케어서비스']

_BUTTON = 'education_convergence-major'
_36 = '융합전공 교과목 36학점 이상을 들어야 해요'
_OVER = '주전공과 겹치는 과목은 12학점까지만 중복으로 인정돼요.'
_BTN = '융합전공 공통 규정은 아래 버튼에서 봐요.'


def _match(names, extra=()):
    return [[names, GRADW], [names, MORE], [names, CONV], [names, CONV, GRADW + MORE]] + list(extra)


TOPICS = [
    # 출처: curr_conv_culture(책자 융-1·2, PDF 62·63쪽) + deptrule_conv_culture(경영학부 공지) + education_convergence-major.
    dict(id='grad-conv-culture', page='curr_conv_culture', faqpage=['deptrule_conv_culture', _BUTTON],
         match=_match(CULTURE),
         exclude=EXCL,
         lead=f'문화예술경영 융합전공은 {_36}. 과목을 연 학과별로 최소 학점이 있어요. '
              '경영학과 소속 과목 4과목(12학점) 이상(문화예술경영·문화콘텐츠산업론·문화예술경제학·문화예술정책 중 2과목 이상 포함), '
              '문과대 소속 과목 4과목(12학점) 이상(문화학입문·프랑스학2 중 1과목 이상, 영화와서사·국문학개론 중 1과목 이상 포함), '
              '예술학과 소속 과목 12학점 이상(미학입문·중국미술사·예술학특론·서양근세미술사II·포스트모더니즘미술론 중 2과목 이상 포함)이에요. '
              f'{_OVER} 문의는 경영학부(02-320-1142)로 해요. 경영학부 졸업 요건 안내와 {_BTN}'),
    # 출처: curr_conv_archspace(책자 융-3·4, PDF 64·65쪽) + education_convergence-major.
    dict(id='grad-conv-archspace', page='curr_conv_archspace', faqpage=_BUTTON,
         match=_match(ARCHSPACE),
         exclude=EXCL,
         lead=f'건축공간예술 융합전공은 {_36}. 그중 세계건축사(1)·세계건축사(2)·한국건축사·건축공간론·현대건축·건축이론 중 '
              '네 과목 이상(최소 11학점)과, 미학입문·중국미술사·현대미술분석및실습·서양근세미술사II·전시기획및실습·모더니즘미술론 중 '
              '네 과목 이상(최소 11학점)을 반드시 들어야 해요. 한국건축사는 2026년 9월 1일부터 3학년 1학기에서 2학년 2학기로 옮겨져요. '
              f'{_OVER} 문의는 건축학부(02-320-1106)로 해요. {_BTN}'),
    # 출처: curr_conv_perform(책자 융-5·6, PDF 66·67쪽) + education_convergence-major. 공연예술학부와 겹쳐 융합 낱말이 있어야 받는다.
    dict(id='grad-conv-perform', page='curr_conv_perform', faqpage=_BUTTON,
         match=[[PERFORM_CONV], [PERFORM_CONV, GRADW + MORE], [PERFORM, CONV, GRADW], [PERFORM, CONV, MORE], [PERFORM, CONV]],
         exclude=EXCL,
         lead='공연예술 융합전공은 공연예술융합전공 교과목을 36학점 이상 들어야 졸업요건을 채워요. 전 과목 수업은 대학로캠퍼스에서 해요. '
              f'학년별 개설 과목은 모두 전공선택이에요. {_OVER} 문의는 공연예술대학원(02-3668-3704)으로 해요. {_BTN}'),
    # 출처: curr_conv_landscape(책자 융-7·8, PDF 68·69쪽) + education_convergence-major.
    dict(id='grad-conv-landscape', page='curr_conv_landscape', faqpage=_BUTTON,
         match=_match(LANDSCAPE),
         exclude=EXCL,
         lead=f'환경조경디자인 융합전공은 {_36}. 전공필수는 2학년 기초디자인스튜디오·조경계획(1학기), 환경조경디자인스튜디오1(정원설계)(2학기), '
              '3학년 환경조경디자인스튜디오2(공원설계)(1학기)예요. 교과과정표에서 학수번호가 없는 과목은 운영 검토 중이에요. '
              f'{_OVER} {_BTN}'),
    # 출처: curr_conv_iot(책자 24쪽·융-10, PDF 26·71쪽) + education_convergence-major(문의처).
    dict(id='grad-conv-iot', page='curr_conv_iot', faqpage=_BUTTON,
         match=_match(IOT),
         exclude=EXCL,
         lead='사물인터넷공학 융합전공은 소속학과(주전공) 졸업요건을 채우고 사물인터넷공학 융합전공 전공교과목으로 36학점을 따야 해요. '
              '전자·전기공학부·컴퓨터공학과·산업·데이터공학과 학생은 주전공 전공 이수학점 중 12학점까지 중복 인정되고, 다른 학과 학생은 중복 인정이 없어요. '
              '캠퍼스자율전공 학생이 주전공으로 졸업하려면 전공 50학점·MSC 24학점(대학수학(1)·응용수학(1)·대학물리(1) 필수) 등을 포함해 '
              f'총 132학점 이상과 졸업논문이 필요해요. 문의는 전자전기공학부(02-320-1123)로 해요. {_BTN}'),
    # 출처: curr_conv_robot(책자 25쪽·융-12, PDF 27·73쪽) + education_convergence-major(문의처).
    dict(id='grad-conv-robot', page='curr_conv_robot', faqpage=_BUTTON,
         match=_match(ROBOT),
         exclude=EXCL,
         lead='지능로봇공학 융합전공은 소속학과(주전공) 졸업요건을 채우고 지능로봇공학 융합전공 전공교과목으로 36학점을 따야 해요. '
              '지능로봇융합설계프로젝트(1)·(2)는 꼭 들어야 하고, 제어공학(또는 자동제어)·메카트로닉스개론·임베디드시스템·임베디드시스템및실험·'
              '전동기제어·로봇공학(또는 로봇시스템공학)·기계학습기초(또는 인공지능및머신러닝, 데이터캡스톤디자인) 7과목 중 4과목 이상'
              '(캠퍼스자율전공 학생은 5과목 이상)을 들어야 해요. 기계·시스템디자인공학과·전자·전기공학부·컴퓨터공학과·산업·데이터공학과 학생은 '
              f'주전공 전공 이수학점 중 12학점까지 중복 인정돼요. 문의는 기계시스템디자인공학과(02-320-1125)로 해요. {_BTN}'),
    # 출처: curr_conv_smartcity(책자 25쪽·융-14, PDF 27·75쪽) + education_convergence-major(문의처).
    dict(id='grad-conv-smartcity', page='curr_conv_smartcity', faqpage=_BUTTON,
         match=_match(SMARTCITY),
         exclude=EXCL,
         lead='스마트도시데이터사이언스 융합전공은 소속학과(주전공) 졸업요건을 채우고 융합전공 전공교과목으로 36학점을 따야 해요. '
              '전공필수 모빌리티와ITS(구.스마트시티와ITS, 3학년 2학기)는 꼭 들어야 해요. 도시공학과·컴퓨터공학과·산업·데이터공학과 학생은 '
              '주전공 전공 이수학점 중 12학점까지 중복 인정되고, 다른 학과 학생은 중복 인정이 없어요. 스마트도시종합설계프로젝트는 전공선택으로 바뀌었어요. '
              f'문의는 도시공학전공(02-320-1107)으로 해요. {_BTN}'),
    # 출처: curr_conv_designeng(책자 24쪽·융-16, PDF 26·77쪽) + education_convergence-major(문의처).
    dict(id='grad-conv-designeng', page='curr_conv_designeng', faqpage=_BUTTON,
         match=_match(DESIGNENG),
         exclude=EXCL,
         lead='디자인엔지니어링 융합전공은 소속학과(주전공) 졸업요건을 채우고 디자인엔지니어링 융합전공 교과목으로 36학점을 따야 하고, '
              '그중 24학점 이상은 디자인엔지니어링 핵심과목군(22과목)에서 들어야 해요. 기계·시스템디자인공학과·전자·전기공학부·컴퓨터공학과·'
              '산업·데이터공학과 학생은 주전공 전공 이수학점 중 12학점까지 중복 인정돼요. 공과대학 주전공 학생은 공대 공통전공 '
              '스케칭과시각적사고·3D프로토타이핑·제품형상과기능 학점을 빼고도 주전공 졸업요건을 채우면 이 학점을 융합전공 학점으로 인정받아요. '
              f'문의는 기계시스템디자인공학과(02-320-1125)로 해요. {_BTN}'),
    # 출처: curr_conv_bigbiz(책자 융-17·18, PDF 78·79쪽) + education_convergence-major(문의처: 세종캠퍼스).
    dict(id='grad-conv-bigbiz', page='curr_conv_bigbiz', faqpage=_BUTTON,
         match=_match(BIGBIZ),
         exclude=EXCL,
         lead=f'빅데이터비즈니스 융합전공은 {_36}. 전공필수는 1학년 컴퓨터SW기초, 2학년 빅데이터의이해예요. '
              '컴퓨터응용통계·데이터분석과활용·데이터사이언스·인공지능응용 중 1과목 이상, 상경대학 또는 광고홍보학부 소속 과목 중 2과목 이상'
              '(경영데이터분석(초급)·경영통계학 제외), 게임학부 또는 AID융합과학기술대학 소프트웨어융합학과 소속 과목 중 2과목 이상을 들어야 해요. '
              f'{_OVER} 학교 안내에는 세종캠퍼스 소프트웨어융합학과(044-860-2392)가 문의처로 적혀 있어요. {_BTN}'),
    # 출처: curr_conv_mobility(책자 융-20, PDF 81쪽) + education_convergence-major(문의처: 세종캠퍼스).
    dict(id='grad-conv-mobility', page='curr_conv_mobility', faqpage=_BUTTON,
         match=_match(MOBILITY, [[['모빌리티'], CONV], [['모빌리티'], CONV, GRADW + MORE]]),
         exclude=EXCL,
         lead=f'미래모빌리티 융합전공은 {_36}. 전공필수는 3학년 미래모빌리티일반(1학기), 4학년 모빌리티캡스톤디자인(1)(1학기)·'
              '모빌리티캡스톤디자인(2)(2학기)예요. AID융합과학기술대학 학생에게는 모빌리티캡스톤디자인(2)·인공지능디자인·미래공학기술과서비스가 '
              f'융합전공 이수내규 제2장 9조 4항의 12학점에 들어가지 않아요. {_OVER} '
              f'학교 안내에는 세종캠퍼스 공학교육혁신센터(044-860-2769)가 문의처로 적혀 있어요. {_BTN}'),
    # 출처: curr_conv_datasci(책자 26쪽·융-21·22, PDF 28·82·83쪽) + education_convergence-major(문의처).
    dict(id='grad-conv-datasci', page='curr_conv_datasci', faqpage=_BUTTON,
         match=_match(DATASCI),
         exclude=EXCL + ['스마트도시'],
         lead='데이터사이언스 융합전공은 소속학과(주전공) 졸업요건을 채우고 전공필수를 모두 포함해 데이터사이언스 전공교과목으로 36학점을 따야 해요. '
              '1학년 전공선택은 통계·수학·전산 영역별로 1과목씩 꼭 들어야 하고(영역별 1과목만 인정), 전공필수는 2학년 데이터사이언스·빅데이터의이해 중 '
              '1과목, 4학년 시스템분석·시스템설계(캡스톤디자인)예요. 주전공에서 들은 과목과 겹치면 12학점까지 중복 인정돼요. '
              f'문의는 산업공학전공(02-320-1132)으로 해요. {_BTN}'),
    # 출처: curr_conv_medai(책자 융-23·24, PDF 84·85쪽) + education_convergence-major(문의처).
    dict(id='grad-conv-medai', page='curr_conv_medai', faqpage=_BUTTON,
         match=_match(MEDAI),
         exclude=EXCL,
         lead=f'의료헬스케어AI 융합전공은 {_36}. 그중 바이오헬스융합학부 소속 과목에서 18학점 이상을 따야 해요. '
              f'학년별 개설 과목은 모두 전공선택이에요. {_OVER} 문의는 바이오헬스융합학부(02-2098-2853)로 해요. {_BTN}'),
    # 출처: curr_conv_healthsvc(책자 융-25·26, PDF 86·87쪽) + education_convergence-major(문의처).
    dict(id='grad-conv-healthsvc', page='curr_conv_healthsvc', faqpage=_BUTTON,
         match=_match(HEALTHSVC),
         exclude=EXCL,
         lead=f'헬스케어서비스 융합전공은 {_36}. 그중 바이오헬스융합학부 소속 과목에서 18학점 이상을 따야 해요. '
              f'학년별 개설 과목은 모두 전공선택이에요. {_OVER} 문의는 바이오헬스융합학부(02-2098-2853)로 해요. {_BTN}'),
]
