"""학과별 졸업요건(fine 갈래): 미술대학 순수계열(동양화·회화·판화·조소)·예술학과·미술대학 공통 전공선택. 형식은 topics/__init__.py.

본문
- data/pages-curr_fine.json (sites/curr_fine.py): 2026 교과과정책자 미-1~미-9·미-22·23(PDF 156~164·177·178쪽) 학과별 교과과정.
- data/pages-deptrule_fine.json (sites/deptrule_fine.py): 회화과 학과 내규(졸업전시 = 졸업 논문 대체), 판화과 졸업요건 안내,
  예술학과 졸업논문 안내.
- 단과대학 공통 요건: data/pages-curriculum.json 'curriculum_arts_fineart'(미술대학, 예술학과 제외), 예술학과는 'curriculum_eng_lawecon'.

ext_grad_arts.py 'grad-req-fineart'·'grad-req-humanities' 는 학과 이름(2자) + 졸업 낱말로 받는다. 여기는 학과 이름을 더 길게(…과·…전공)
넣고 이 파일이 먼저 읽혀(같은 점수면 앞 주제) 학과 물음은 학과 답으로 온다. 학과 이름 없는 '미대 졸업요건'은 grad-req-fineart 에 둔다.
졸업식·졸업사진·유예·조기졸업·과사 같은 물음은 다른 주제로 둔다(NOT). 졸업전시·졸업논문 낱말은 학과 원문에 규정이 있는 학과만
받는다(회화과·판화과 졸업전시, 회화과 졸업논문 대체, 예술학과 졸업논문). 일정 물음('언제' 등)은 core thesis 로 둔다.
lead 는 위 원문에 적힌 사실만 줄여 썼다.
"""

# 낱말 묶음은 ext_grad_eng.py 에서 베껴 왔다(다른 주제 파일을 가져오지 않는다).
GRADW = ['졸업학점', '졸업요건', '졸업조건', '졸업기준', '졸업하려면', '졸업하려', '졸업하기', '졸업에필요', '졸업가능',
         '졸업할수', '졸업이수', '졸업']
CREDIT = ['몇학점', '총학점', '전공학점', '이수학점', '학점']
CURR = ['전공필수', '전필', '필수과목', '교과과정', '이수체계', '커리큘럼', '전공과목', '필수']
_THESIS = ['졸업논문', '졸논', '졸업작품', '졸작', '졸업전시', '졸전']
NOT = ['졸업식', '졸업사진', '앨범', '가운', '유예', '조기졸업', '졸업시험', '졸업증명', '증명서', '학위수여', '졸업공연', '졸업사정',
       '대학원', '석사', '박사', '세종', '과사', '사무실'] + _THESIS
WHEN = ['언제', '일정', '기간', '마감', '날짜', '며칠', '장소', '어디서']

ORIENTAL = ['동양화과', '동양화전공', '동양화']
PAINTING = ['회화과', '회화전공', '회화']
PRINTMK = ['판화과', '판화전공', '판화']
SCULPTURE = ['조소과', '조소전공', '조소']
ART = ['예술학과', '예술학전공', '예술학']
FINE = ['미대', '미술대학', '미술대']

EXHIBIT = ['졸업전시', '졸전', '졸업작품', '졸작']
EXHIBIT_ASK = ['하려면', '하려', '조건', '요건', '필수', '수강', '들어야', '과목', '대체', '참여', '휴학', '복수전공', '복전']


MAJORCREDIT = ['전공학점', '졸업학점', '총학점', '이수학점', '몇학점']


def _paths(dept):
    return [[dept, GRADW], [dept, CREDIT, GRADW], [dept, CURR], [dept, MAJORCREDIT]]


TOPICS = [
    # 출처: curr_fine_common(책자 미-1, PDF 156쪽). 학과 이름 없이 미대 공통 전공선택·전공기초를 물을 때.
    dict(id='grad-fineart-common', page='curr_fine_common', faqpage=['curriculum_arts_fineart'],
         match=[[['기초평면', '기초입체']], [['공통전공선택', '공통전선', '미대공통', '미술대학공통']],
                [FINE, ['공통전공', '공통선택', '전공기초', '기초과목']]],
         exclude=NOT + WHEN + ['예술학과'],
         lead='미술대학(예술학과 제외)은 2016학년도 입학생부터 공통 전공선택 과목 중 2과목(4학점)을 반드시 들어야 하고, '
              '공통 전공선택 학점은 최대 8학점까지만 인정돼요. 전공기초 기초평면(1)·기초입체(1)은 모두 필수이고, '
              '기초평면(2)·기초입체(2)는 순수계열(동양화과·조소과·판화과·회화과)만 필수예요(2010~2015년 입학생은 넷 다 필수). '
              '이 과목들은 미술대학 학생만 들을 수 있어요. 미대 졸업요건 전체는 아래 버튼에서 봐요.'),
    # 출처: curr_fine_oriental(미-2·3, PDF 157·158쪽) + curriculum_arts_fineart. 학과 홈페이지 공지사항엔 글이 없다.
    dict(id='grad-oriental-painting', page='curr_fine_oriental', faqpage=['curr_fine_common', 'curriculum_arts_fineart'],
         match=_paths(ORIENTAL),
         exclude=NOT + WHEN,
         lead='동양화과는 미술대학 졸업요건(총 132학점 이상, 전공필수를 포함한 전공 48학점 이상, 미술대학 공통 전공선택 2과목(4학점), '
              '졸업논문)에 더해 학과 전공필수가 있어요. 순수계열이라 기초평면(1)(2)·기초입체(1)(2)를 모두 들어야 하고, '
              '전공필수는 1학년 기초수묵화(1)(2), 2학년 현대수묵화(1)(2)·채색화표현기법·채색화재료기법이에요(3·4학년은 전공선택만 있어요). '
              '4학년에는 졸업작품연구(1)(2)가 열려요. 미대 공통 요건은 아래 버튼에서 봐요.'),
    # 출처: deptrule_fine_painting(회화과 학과 내규) + curr_fine_painting(미-4·5, PDF 159·160쪽) + curriculum_arts_fineart.
    dict(id='grad-painting', page='curr_fine_painting',
         faqpage=['deptrule_fine_painting', 'curr_fine_common', 'curriculum_arts_fineart'],
         match=_paths(PAINTING) + [[PAINTING, EXHIBIT, EXHIBIT_ASK], [PAINTING, ['졸업논문', '졸논']]],
         exclude=[w for w in NOT if w not in _THESIS] + WHEN + ['어회화', '회화수업', '회화반', '회화스터디'],
         lead='회화과는 미술대학 졸업요건(총 132학점 이상, 전공필수를 포함한 전공 48학점 이상, 미술대학 공통 전공선택 2과목(4학점) 등)에 더해 '
              '학과 요건이 있어요. 학과 내규에 따르면 졸업전시가 졸업요건(졸업 논문 대체)이고, 졸업전시에 참여하려면 4학년 '
              '졸업작품제작(1)·(2)를 모두 들어야 해요(9월 입학 외국인 학생은 (2)만 들어도 돼요). 졸업전시 오프닝 때 작품 설치를 마치지 못하면 '
              '참여하지 않은 것으로 보아 졸업할 수 없어요. 전공필수는 1학년 기초회화(1)(2), 2학년 회화실기(1)(2), 3학년 회화실기(3), '
              '4학년 졸업작품제작(1)이고, 순수계열이라 기초평면(2)·기초입체(2)도 필수예요.'),
    # 출처: deptrule_fine_printmk(판화과 졸업요건 안내) + curr_fine_printmk(미-6·7, PDF 161·162쪽) + curriculum_arts_fineart.
    dict(id='grad-printmaking', page='curr_fine_printmk',
         faqpage=['deptrule_fine_printmk', 'curr_fine_common', 'curriculum_arts_fineart'],
         match=_paths(PRINTMK) + [[PRINTMK, EXHIBIT, EXHIBIT_ASK], [PRINTMK, ['판화사', '포스트프린트']]],
         exclude=[w for w in NOT if w not in EXHIBIT] + WHEN,
         lead='판화과는 미술대학 졸업요건(총 132학점 이상, 전공필수를 포함한 전공 48학점 이상, 미술대학 공통 전공선택 2과목(4학점), 졸업논문)에 더해, '
              '학과 안내에 따라 판화사와 포스트프린트를 반드시 들어야 졸업할 수 있어요. 졸업전시회를 하려면 4학년 1학기에 '
              '프린트아트연구(1)·프린트아트제작(1)을 모두, 2학기에 프린트아트연구(2)·프린트아트제작(2) 중 1과목을 들어야 해요'
              '(타과 복수전공생은 학기마다 두 과목 중 1과목). 2학기에 휴학한 상태로는 졸전을 할 수 없어요. '
              '전공필수는 1학년 기초판화기법(1)(2)·디지털무빙이미지, 2학년 동판화기초연구·석판화기초연구예요.'),
    # 출처: curr_fine_sculpture(미-8·9, PDF 163·164쪽) + curriculum_arts_fineart. 학과 홈페이지 공지사항엔 글이 없다.
    dict(id='grad-sculpture', page='curr_fine_sculpture', faqpage=['curr_fine_common', 'curriculum_arts_fineart'],
         match=_paths(SCULPTURE),
         exclude=NOT + WHEN,
         lead='조소과는 미술대학 졸업요건(총 132학점 이상, 전공필수를 포함한 전공 48학점 이상, 미술대학 공통 전공선택 2과목(4학점), '
              '졸업논문)에 더해 학과 전공필수가 있어요. 순수계열이라 기초평면(1)(2)·기초입체(1)(2)를 모두 들어야 하고, '
              '전공필수는 1학년 소조실기(1)(2), 2학년 조각(1)·오브제연구·조형과 이미지, 4학년 환경조각연구예요(3학년은 전공선택만 있어요). '
              '미대 공통 요건은 아래 버튼에서 봐요.'),
    # 출처: curr_fine_art(미-22·23, PDF 177·178쪽) + deptrule_fine_art(졸업논문 안내) + curriculum_eng_lawecon(PDF 17쪽).
    dict(id='grad-art-studies', page='curr_fine_art', faqpage=['deptrule_fine_art', 'curriculum_eng_lawecon'],
         match=_paths(ART) + [[ART, ['졸업논문', '졸논', '논문'],
                               ['분량', '몇장', '장수', '휴학', '초과학기', '한학기', '1년', '클래스넷', '조건', '요건', '필수', '어떻게']]],
         exclude=[w for w in NOT if w not in ('졸업논문', '졸논')] + WHEN + ['공연', '뮤지컬', '실용음악', '지도교수', '양식'],
         lead='예술학과는 미술대학(예술학과 제외) 요건이 아니라 문과대학 등과 같은 졸업요건을 따라요. 총 132학점 이상(2010~2015학년도 입학생은 140학점), '
              '전공필수를 포함한 전공 50학점 이상, 전공기초영어(Ⅰ/Ⅱ) 중 한 과목, 졸업논문이 필요하고, 2016학년도 입학생부터 교양은 최대 50학점까지 인정돼요. '
              '전공필수는 1학년 미술사입문·미학입문, 2학년 미술원서강독·예술학입문이에요. 졸업논문은 한 학기 과정(1·2학기 모두 시행)이고, '
              '최종논문 분량은 표지·도판목록·참고문헌 목록을 빼고 20장 내외예요.'),
]
