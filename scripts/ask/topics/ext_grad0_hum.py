"""학과별 졸업요건(hum 갈래): 문과대학 영어영문·독어독문·불어불문·국어국문학과, 디자인·예술경영학부(디자인경영·예술경영전공).
형식은 topics/__init__.py 를 본다.

출처
- data/pages-curr_hum.json(sites/curr_hum.py): 2026 교과과정책자 문-1~8·디-1~5(PDF 118~131쪽) 학년별 전공필수·졸업논문 과목.
- data/pages-deptrule_hum.json(sites/deptrule_hum.py): 학과 홈페이지 공지 상단 고정 글의 졸업 규정
  (영어영문 졸업레포트, 독어독문 논문대체, 디자인·예술경영학부 논문대체원).
- 공통 요건 숫자는 data/pages-curriculum.json 'curriculum_eng_lawecon'(책자 15쪽, PDF 17쪽) — 버튼으로도 붙인다.

ext_grad_arts.py 'grad-req-humanities'(문과대학 등 공통)보다 파일 이름이 앞서 같은 점수면 여기 학과 답이 이긴다.
학과 이름 낱말은 grad-req-humanities 의 낱말을 모두 포함해 점수가 낮아지지 않게 했다.
영어영문·독어독문·디자인·예술경영은 학과 원문에 졸업논문(대체) 규정이 있어 '졸업논문' 물음도 받는다.
불어불문·국어국문은 학기별 일정 글만 있어 '졸업논문' 물음을 core 'thesis' 로 둔다.
"""

GRADW = ['졸업학점', '졸업요건', '졸업조건', '졸업기준', '졸업하려면', '졸업하려', '졸업하기', '졸업에필요', '졸업가능',
         '졸업할수', '졸업이수', '졸업']
MORE = ['전공필수', '전필', '필수과목', '교과과정', '이수체계', '커리큘럼', '전공학점', '이수요건', '몇학점']
THESIS = ['졸업논문', '졸논', '논문대체', '대체원', '졸업레포트', '레포트', '논문작성']
NOT = ['졸업식', '졸업사진', '앨범', '가운', '유예', '조기졸업', '졸업작품', '졸작', '졸업전시', '졸전', '졸업시험', '졸업증명',
       '증명서', '학위수여', '졸업공연', '졸업사정', '대학원', '석사', '박사', '세종', '과사', '사무실', '장학']
NOT_THESIS = ['졸업논문', '졸논']

ENGLISH = ['영어영문', '영어영문학과', '영문과', '영문학', '영문학과', '영영과']
GERMAN = ['독어독문', '독어독문학과', '독문과', '독문학', '독문학과', '독일어문', '독어과', '독일어과']
FRENCH = ['불어불문', '불어불문학과', '불문과', '불문학', '불문학과', '프랑스어문', '불어과', '프랑스어과']
KOREAN = ['국어국문', '국어국문학과', '국문과', '국문학', '국문학과']
DESIGNMGMT = ['디자인경영', '디자인경영전공', '디자인경영융합', '디자인경영융합학부', '디경',
              '디자인예술경영학부디자인경영전공', '디자인·예술경영학부디자인경영전공']
ARTSMGMT = ['예술경영', '예술경영전공', '예경', '디자인예술경영학부예술경영전공', '디자인·예술경영학부예술경영전공']
DAM = ['디자인예술경영', '디자인·예술경영', '디자인예술경영학부', '디자인·예술경영학부', '디예경']

_LAWECON = ('총 132학점 이상(2010~2015학년도 입학생은 140학점), 전공필수를 포함한 전공 50학점 이상, '
            '전공기초영어(Ⅰ/Ⅱ) 중 한 과목, 졸업논문')


def _match(dept, thesis=False):
    paths = [[dept, GRADW], [dept, MORE]]
    if thesis:
        paths.append([dept, THESIS])
    return paths


TOPICS = [
    # 출처: curr_hum_english(책자 문-1·2, PDF 124·125쪽) + deptrule_hum_english(학과 공지 [졸업01]).
    dict(id='grad-english', page='curr_hum_english', faqpage=['deptrule_hum_english', 'curriculum_eng_lawecon'],
         match=_match(ENGLISH, thesis=True),
         exclude=NOT,
         lead=f'영어영문학과는 문과대학 공통 졸업요건({_LAWECON})에 더해 학과 요건이 있어요. '
              '졸업논문은 영어영문학과 졸업레포트 4편을 내는 것이고(복수전공·편입생은 2편), 토익 등으로 대체할 수 없어요. '
              '전공필수는 1학년 영문법·영문학입문·영문학사(19세기이후)·영어학입문, 2학년 영문학사(19세기 이전)·미국문학사예요. '
              '학과 졸업 요건 안내와 문과대학 공통 요건은 아래 버튼에서 봐요.'),
    # 출처: curr_hum_german(책자 문-3·4, PDF 126·127쪽) + deptrule_hum_german(학과 공지 '논문대체관련 Q&A').
    dict(id='grad-german', page='curr_hum_german', faqpage=['deptrule_hum_german', 'curriculum_eng_lawecon'],
         match=_match(GERMAN, thesis=True),
         exclude=NOT,
         lead=f'독어독문학과는 문과대학 공통 졸업요건({_LAWECON})에 더해 학년별 전공필수가 있어요. '
              '1학년 기초독일어(2)·기초독일어회화(2), 2학년 독일문학사(1)·독일어연습(1)·독일문학사(2), 3학년 논문작성(2학기 개설)이에요. '
              '기초독일어(1)은 전공필수에서 전공선택으로, 독일어연습(1)은 전공선택에서 전공필수로 바뀌었어요. '
              "학과 공지 '논문대체관련 Q&A'에 따르면 논문 작성 과목을 수강 완료한 뒤 이름·학번·입학년도-학기를 독문과 사무실 이메일로 내야 해요."),
    # 출처: curr_hum_french(책자 문-5·6, PDF 128·129쪽).
    dict(id='grad-french', page='curr_hum_french', faqpage='curriculum_eng_lawecon',
         match=_match(FRENCH),
         exclude=NOT + NOT_THESIS,
         lead=f'불어불문학과는 문과대학 공통 졸업요건({_LAWECON})을 따라요. '
              '학년별 전공필수는 1학년 프랑스어(1)·프랑스어(2), 2학년 프랑스문학과역사·프랑스언어학의이해·프랑스문화사예요. '
              '졸업논문(002717)은 4학년 일반선택으로 1·2학기에 있어요. 문과대학 공통 요건은 아래 버튼에서 봐요.'),
    # 출처: curr_hum_korean(책자 문-7·8, PDF 130·131쪽).
    dict(id='grad-korean', page='curr_hum_korean', faqpage='curriculum_eng_lawecon',
         match=_match(KOREAN),
         exclude=NOT + NOT_THESIS,
         lead=f'국어국문학과는 문과대학 공통 졸업요건({_LAWECON})을 따라요. '
              '학년별 전공필수는 1학년 국문학개론·국어학개론·논문작성법, 2학년 현대문학사, 3학년 고전소설론이에요. '
              '졸업논문(002718)은 4학년 일반선택으로 1·2학기에 있어요. 문과대학 공통 요건은 아래 버튼에서 봐요.'),
    # 출처: curr_hum_designmgmt(책자 디-1~3, PDF 118~120쪽) + deptrule_hum_iim(학부 공지 '졸업논문 및 논문대체원 안내').
    dict(id='grad-designmgmt', page='curr_hum_designmgmt', faqpage=['deptrule_hum_iim', 'curriculum_eng_lawecon'],
         match=_match(DESIGNMGMT, thesis=True),
         exclude=NOT,
         lead=f'디자인·예술경영학부 디자인경영전공(구.디자인경영융합학부)은 공통 졸업요건({_LAWECON})을 따라요. '
              '전공필수는 1학년 경제학원론·디자인론·기업과경영(학부 공통), 2학년 인간공학, 3학년 기업법이에요. '
              '졸업논문은 논문을 써서 심사를 통과하거나, 논문대체원(전공필수를 포함해 50학점 이상 고른 전공과목 평점 평균 3.0 이상인 '
              '전공성적확인서, 또는 TOEIC 700점 이상 등 공인어학성적표)을 내서 합격해야 해요. '
              '2026학년도 4학년은 디자인경영융합학부 교과과정이에요. 학부 논문대체원 안내와 공통 요건은 아래 버튼에서 봐요.'),
    # 출처: curr_hum_artsmgmt(책자 디-1·4·5, PDF 118·121·122쪽) + deptrule_hum_iim.
    dict(id='grad-artsmgmt', page='curr_hum_artsmgmt', faqpage=['deptrule_hum_iim', 'curriculum_eng_lawecon'],
         match=_match(ARTSMGMT, thesis=True),
         exclude=NOT,
         lead=f'디자인·예술경영학부 예술경영전공은 공통 졸업요건({_LAWECON})을 따라요. '
              '전공필수는 1학년 경제학원론·디자인론·기업과경영(학부 공통), 2학년 예술경영입문, 3학년 기업법이에요. '
              '졸업논문은 논문을 써서 심사를 통과하거나, 논문대체원(전공필수를 포함해 50학점 이상 고른 전공과목 평점 평균 3.0 이상인 '
              '전공성적확인서, 또는 TOEIC 700점 이상 등 공인어학성적표)을 내서 합격해야 해요. 학부 논문대체원 안내와 공통 요건은 아래 버튼에서 봐요.'),
    # 전공 이름 없이 학부 이름만: 학부 공통 졸업논문(대체원) 규정을 답하고 전공별 교과과정을 버튼으로 붙인다.
    # '디자인예술경영'이 '예술경영'을 품어 grad-artsmgmt 도 걸리지만 낱말이 더 길어 이쪽이 이긴다. 전공 이름이 있으면 전공 주제로 보낸다.
    dict(id='grad-dam', page='deptrule_hum_iim', faqpage=['curr_hum_designmgmt', 'curr_hum_artsmgmt', 'curriculum_eng_lawecon'],
         match=_match(DAM, thesis=True),
         exclude=NOT + ['경영전공', '디경', '예경'],
         lead=f'디자인·예술경영학부(구.디자인경영융합학부)는 공통 졸업요건({_LAWECON})을 따라요. '
              '졸업논문은 논문을 써서 심사를 통과하거나 논문대체원(전공성적확인서·공인어학성적표)을 내서 합격해야 해요. '
              '전공별 전공필수는 아래 버튼(디자인경영전공·예술경영전공)에서 봐요.'),
]
