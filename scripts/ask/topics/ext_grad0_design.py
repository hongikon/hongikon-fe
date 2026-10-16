"""학과별 졸업요건(design 갈래): 미술대학 디자인·공예 학과, 공연예술학부 뮤지컬·실용음악전공. 형식은 topics/__init__.py.

- 본문: data/pages-curr_design.json(sites/curr_design.py) — 2026 교과과정책자 학과 쪽(학년별 전공필수·졸업 과목).
- 학과 고유 규정 버튼: data/pages-deptrule_design.json(sites/deptrule_design.py) — 학과 홈페이지 공지의 상시 규정,
  공연예술학부는 학과 홈페이지 '졸업요건'(data/pages-dept_grad.json, ext_dept.py 'dept-grad-perform' 이 쓰던 쪽).
- 단과대학 공통 요건 버튼: curriculum_arts_fineart(미술대학) · curriculum_arts_performing(공연예술학부).
- 이 파일은 ext_grad_arts.py 보다 먼저 읽혀 같은 점수면 학과 답이 이긴다. ext_dept.py('dept-grad-perform')는 더 먼저 읽히므로
  '졸업' 낱말 묶음을 하나 더 걸어 점수를 2 올렸다(졸업 낱말은 모두 '졸업'을 품는다).
- 졸업식·졸업사진·유예·조기졸업·과사 같은 물음은 다른 주제로 둔다(NOT). 졸업전시·졸업프로젝트·졸업공연은 학과 규정이 있는 학과만 받는다.
lead 는 위 원문에 적힌 사실만 줄여 썼다.
"""

GRADW = ['졸업학점', '졸업요건', '졸업조건', '졸업기준', '졸업하려면', '졸업하려', '졸업하기', '졸업에필요', '졸업가능',
         '졸업할수', '졸업이수', '졸업']
CREDIT = ['몇학점', '총학점', '전공학점', '이수학점', '학점']
CURR = ['전공필수', '전필', '필수과목', '교과과정', '이수체계', '커리큘럼']
NOT = ['졸업식', '졸업사진', '앨범', '가운', '유예', '조기졸업', '졸업논문', '졸논', '졸업작품', '졸작', '졸업전시', '졸전',
       '졸업시험', '졸업증명', '증명서', '학위수여', '졸업공연', '졸업사정', '대학원', '석사', '박사', '세종', '과사', '사무실']


def _not(*allow):
    return [w for w in NOT if w not in allow]


def _paths(dept, extra=()):
    paths = [[dept, ['졸업'], GRADW], [dept, CREDIT, GRADW], [dept, CURR]]
    if extra:
        # 졸업공연·졸업전시처럼 '졸업'을 품은 낱말은 '졸업' 묶음을 하나 더 걸어 앞 주제(ext_dept·core thesis)보다 점수를 올린다.
        paths.append([dept, ['졸업'], list(extra)] if all('졸업' in w for w in extra) else [dept, list(extra)])
    return paths


VD = ['시각디자인', '시디', '시각디']
ID = ['산업디자인', '산디']
METAL = ['금속조형', '금속디자인', '금속과', '금속']
CERAMIC = ['도예유리', '도예·유리', '도예', '유리과', '도자']
WOOD = ['목조형', '목조', '가구학과', '가구디자인']
TEXTILE = ['섬유미술', '패션디자인', '섬유', '섬패', '패디']
MUSICAL = ['뮤지컬']
APPLIED = ['실용음악', '실음']

_FINE = ('미술대학 졸업요건(총 132학점 이상, 전공기초를 뺀 전공 48학점 이상, 미술대학 공통 전공선택 2과목(4학점), '
         '기초평면(1)·기초입체(1), 졸업논문)에 더해')
_PERF = ('공연예술학부 졸업요건(전공기초를 뺀 전공 50학점 이상, 총 132학점 이상, 졸업논문은 졸업공연 혹은 졸업공연에 준하는 졸업시험)에 더해')
_PERF_PHONE = [('공연예술학부', '02-3668-3747')]

TOPICS = [
    # 출처: curr_design_vd(책자 미-10·11, PDF 165·166). 학과 홈페이지(sidi)는 자바스크립트 사이트라 규정을 못 옮겼다.
    dict(id='grad-vd', page='curr_design_vd', faqpage=['curriculum_arts_fineart'],
         match=_paths(VD, ['졸업프로젝트', '졸프']),
         exclude=_not() + ['기시디'],
         lead=f'시각디자인전공은 {_FINE} 학년별 전공필수가 있어요. 2학년은 커뮤니케이션디자인(1)·(2)와 타이포그라피(2), '
              '3학년은 한국디자인사(1)·(2)예요. 4학년 2학기에는 졸업프로젝트(5학점)가 전공선택으로 열려요. 미술대학 공통 요건은 아래 버튼에서 봐요.'),
    # 출처: curr_design_id(PDF 167·168) + deptrule_design_id(학과 공지 '코스트랙 및 졸업요건 추가 상세설명').
    dict(id='grad-id', page='curr_design_id', faqpage=['deptrule_design_id', 'curriculum_arts_fineart'],
         match=_paths(ID, ['코스트랙']),
         exclude=_not(),
         lead=f'산업디자인전공은 {_FINE} 학년별 전공필수가 있어요. 2학년은 디자인진로탐구·UX분석과응용·실무드로잉·혁신방법론과프로세스, '
              '3학년은 취창업포트폴리오예요. 학과 안내에 따르면 UX분석과응용은 2021년도 이후 전공필수예요(2020년도 2학기까지 들은 학생은 전공선택으로 인정). '
              '전공필수를 대체한 전공선택 과목은 졸업요건 전공선택 개수로 인정되지 않고, 듣지 못한 폐지 전공필수는 대체 과목을 듣고 졸업사정 때 사유서를 써야 해요.'),
    # 출처: curr_design_metal(PDF 169·170) + deptrule_design_metal(학과 홈페이지 hongik-mad.com '복수/부전공 졸업자격').
    dict(id='grad-metal', page='curr_design_metal', faqpage=['deptrule_design_metal', 'curriculum_arts_fineart'],
         match=_paths(METAL, ['졸업전시', '졸전']),
         exclude=_not('졸업전시', '졸전'),
         lead=f'금속조형디자인과는 {_FINE} 학년별 전공필수가 있어요. 1학년은 기초금속표현기법(1)·(2)와 기초금속주얼리, '
              '2학년은 주얼리제작실기(1)과 응용금속제작기법이에요. 학과의 복수/부전공 졸업자격 안내에 따르면 금속조형디자인과의 졸업논문은 졸업전시 참여예요. '
              '졸업전시에 참여하는 학생은 세공분야 1개와 대공분야 1개를 이수하고 분야별 작품을 내야 해요'
              '(산업장신구(1)(2) 또는 아트장신구(1)(2) 중 하나, 금속조명가구디자인(1)(2) 또는 금속오브젝트(1)(2) 중 하나). '
              '졸업전시는 1년 프로젝트라 특별한 사유가 없으면 그 학년도 1·2학기를 이어서 들어요.'),
    # 출처: curr_design_ceramic(PDF 171·172) + deptrule_design_ceramic(학과 공지 '복,부전공 졸업 요건').
    dict(id='grad-ceramic', page='curr_design_ceramic', faqpage=['deptrule_design_ceramic', 'curriculum_arts_fineart'],
         match=_paths(CERAMIC, ['졸업전시', '졸전']),
         exclude=_not('졸업전시', '졸전'),
         lead=f'도예·유리과는 {_FINE} 학년별 전공필수가 있어요. 2학년은 물레심화(1)·유리기법(1)·CLAYWORK전공심화(2)·석고기법(2), '
              '3학년은 공예론·도예론이에요. 학과의 복·부전공 안내에 따르면 복수전공생은 전공필수를 포함해 36학점 이상을 듣고 2학기 졸업전시에 참여해야 하고, '
              '졸업전시 참여자는 그 해 1·2학기 4학년 전공 과목을 1과목 이상 들어야 해요. 부전공은 전공 21학점 이상(평균평점 C° 이상)이에요.'),
    # 출처: curr_design_wood(PDF 173·174) + deptrule_design_wood(학과 공지).
    dict(id='grad-wood', page='curr_design_wood', faqpage=['deptrule_design_wood', 'curriculum_arts_fineart'],
         match=_paths(WOOD),
         exclude=_not(),
         lead=f'목조형가구학과는 {_FINE} 학년별 전공필수가 있어요. 1학년은 기초공구기법과조형·특수공구기법과조형·가구드로잉·기초디자인, '
              '2학년은 가구디자인프로세스, 4학년은 현대가구디자인사예요. 학과는 안전상의 이유로 기초공구기법과조형(1학기)과 '
              '특수공구기법과조형(2학기)을 차례대로 듣게 해요(복·부전공생 포함).'),
    # 출처: curr_design_textile(PDF 175·176). 학과 홈페이지(textile) 공지에는 졸업 규정 글이 없었다.
    dict(id='grad-textile', page='curr_design_textile', faqpage=['curriculum_arts_fineart'],
         match=_paths(TEXTILE, ['졸업프로젝트', '졸프']),
         exclude=_not(),
         lead=f'섬유미술·패션디자인과는 {_FINE} 학년별 전공필수가 있어요. 1학년은 섬유패션그래픽디자인(1)·(2), '
              '2학년은 패션일러스트레이션과 현대패션디자인사예요. 4학년에는 졸업프로젝트(1)·(2)(각 6학점)가 전공선택으로 열려요. 미술대학 공통 요건은 아래 버튼에서 봐요.'),
    # 출처: curr_design_musical(PDF 181~183) + 학과 홈페이지 졸업요건(dept_grad_musical, ext_dept.py 'dept-grad-perform' 내용).
    dict(id='grad-musical', page='curr_design_musical', faqpage=['dept_grad_musical', 'curriculum_arts_performing'],
         match=_paths(MUSICAL, ['졸업공연', '졸업시험']),
         exclude=_not('졸업공연', '졸업시험'),
         lead=f'뮤지컬전공은 {_PERF} 전공 요건이 있어요. 전공기초 기초연기(1)·시창청음(1)·기초연기(2)를 모두 들어야 하고, '
              '전공필수는 2학년 뮤지컬레퍼토리실습(1)·(2)와 뮤지컬개론, 3학년 뮤지컬제작실습(1)·(2)예요. 학과 홈페이지 졸업요건은 아래 버튼에서 봐요.',
         phones=_PERF_PHONE),
    # 출처: curr_design_appliedmusic(PDF 181·184·185) + 학과 홈페이지 졸업요건(dept_grad_music).
    dict(id='grad-appliedmusic', page='curr_design_appliedmusic', faqpage=['dept_grad_music', 'curriculum_arts_performing'],
         match=_paths(APPLIED, ['졸업공연', '졸업시험']),
         exclude=_not('졸업공연', '졸업시험'),
         lead=f'실용음악전공은 {_PERF} 전공 요건이 있어요. 전공기초 기초연기(1)·시창청음(1)·시창청음(2)를 모두 들어야 하고, '
              '전공필수는 1·2학년 기초전공실기(1)~(4), 3학년 심화전공실기(1)·(2)(학기마다 1학점)예요. '
              '실용음악전공의 전공필수과목은 실용음악전공 학생만 들을 수 있어요. 학과 홈페이지 졸업요건은 아래 버튼에서 봐요.',
         phones=_PERF_PHONE),
]
