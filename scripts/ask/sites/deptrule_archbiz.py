"""학과 홈페이지의 학과 고유 졸업 규정 — 실내건축학전공·도시공학과·경영대학·경제학부·법과대학.

학기마다 같은 내용으로 다시 올라오는 졸업 안내 글에서 날짜·양식·담당자와 상관없는 규정 문장만 옮긴다(sites/dept_ce.py 와 같은 방식).
문장(또는 그 조각)이 원문에 그대로 있을 때만 옮긴다. 공백·별표는 비교에서 뺀다. 다음 학기 글이 올라오면 PAGES 의 글 번호를 바꾼다.

- 실내건축학전공: 건축학부 홈페이지 공지 '학부 졸업 포트폴리오 심사 안내 – 실내건축학전공'(심사 합격(P)이 졸업 조건).
- 도시공학과: 학과 홈페이지 '교과과정 > 학부과정 > 도시공학과'(졸업 132학점·전공 50학점).
- 경영대학: 공지 '[졸업] 졸업논문대체서류 제출 기한 공지'(졸업논문 대신 대체서류 4가지 중 1가지 + 졸업신청서).
- 경제학부: 공지 '[졸업] 경제학부 졸업 요건'(전공 59학점 이상이면 졸업논문 대체).
- 법과대학: 공지 '[졸업] 졸업논문 대체서류 제출 안내'(대체서류 5가지 중 1개, 영어 점수 기준).
건축학전공 홈페이지(arch.hongik.ac.kr)에는 교과과정 소개·KAAB 인증 소개 외에 졸업 규정 글을 찾지 못해 넣지 않았다.
"""
import html, re

LABEL = '학과 홈페이지'
PAGES = {
    'deptrule_archbiz_interior': 'https://arch.hongik.ac.kr/kor/news/notice.php?m=v&idx=jnQp6o2aTNJLhu1-sDCMcXRJb5rT_EeY4kGmrlrmYsM&pNo=1&code=YykqByXbsb1IZcT_rNmuXNFHqSU-Fczcpl5UwimUvHE',
    'deptrule_archbiz_urban': 'https://urban.hongik.ac.kr/53',
    'deptrule_archbiz_bizadmin': 'https://bizadmin.hongik.ac.kr/bizadmin/0401.do?mode=view&articleNo=157385',
    'deptrule_archbiz_econ': 'https://economics.hongik.ac.kr/economics/0401.do?mode=view&articleNo=136335',
    'deptrule_archbiz_law': 'https://law.hongik.ac.kr/law/0401.do?mode=view&articleNo=156070',
}

# 키 → (페이지 제목, [(단면 제목, [항목 …])]). 항목은 문장 하나 또는 원문 조각 튜플(조각마다 원문에 있는지 보고 ' ' 로 잇는다).
RULES = {
    'deptrule_archbiz_interior': ('실내건축학전공 졸업 포트폴리오 심사', [
        ('실내건축학전공 졸업 포트폴리오 심사 규정', [
            '제출한 포트폴리오를 학생 발표 없이 전임교수들이 심사',
            '심사위원 과반수 이상으로부터 합격 평가(P) 를 받아야 졸업 가능',
            '심사에 F학점을 받은 학생은 실내건축설계(6) 평점에 상관 없이 졸업 불가',
            '포트폴리오(졸업작품 필수 포함, 50페이지 이상, 자유형식)',
            '제출한 포트폴리오는 반환되지 않고 학과에 귀속됨.',
        ]),
    ]),
    'deptrule_archbiz_urban': ('도시공학과 졸업 학점', [
        ('도시공학과 학부과정', [
            '도시공학과 졸업을 위해서는 132학점 이상을 취득해야 하며 그중 전공과목은 50학점(전공필수 과목 모두 포함) 이상을 이수해야 합니다.',
            '졸업 시 공학사(Bachelor of Science)가 수여됩니다.',
        ]),
    ]),
    'deptrule_archbiz_bizadmin': ('경영대학 졸업논문 대체서류', [
        ('경영대학 졸업논문 대체 규정', [
            '졸업 학점을 모두 충족하였다고 해서 자동으로 졸업이 되는 것은 아닙니다!',
            "반드시 아래 표 안의 4개 요건 중 1가지 '졸업논문 대체서류'와 함께 '졸업신청서' 를 제출하여야 졸업으로 최종 승인됩니다.",
            ('1. 공인영어시험', '본 대학 입학이후 시험 본 공인영어시험이면 유효기간이 지나도 인정'),
            ('2. 전공성적확인서', '현재 졸업 직전학기까지 전공기초과목을 포함한 전공과목을 총 60학점 이상 취득 후, 성적 평균이 3.0 이상이 되어야함'),
            '복수전공자의 경우 전공기초과목을 제외한 35학점 이상, 평균 3.0 이상 / 편입생의 경우 45학점 이상 취득 평균 3.0 이상의 경우 인정',
            '3. 고시 및 자격증 취득',
            ('4. 졸업시험', '졸업시험은 한 번만 진행됩니다. (재시험 X)'),
        ]),
    ]),
    'deptrule_archbiz_econ': ('경제학부 졸업 요건(졸업논문 대체)', [
        ('경제학부 졸업논문 대체 요건', [
            '(1) 경제학 주 전공자: 경제학 전공과목 59학점 이상 이수자',
            '복수전공자: 45학점 이상 이수자 (복수전공 요건 36학점 + 추가 9학점)',
            ('마지막 학기에 전공학점을 이수하는 학생은 전공 과목 기말고사를 치른 이후 7일 이내에',
             '학부 사무실에 비치된 <졸업논문 대체 전공 학점 이수 확인서>에 담당 교수',
             '서명을 받은 다음 학부 사무실에 제출 합니다.'),
        ]),
    ]),
    'deptrule_archbiz_law': ('법과대학 졸업논문 대체서류', [
        ('법과대학 졸업논문 대체가능 서류(다음 요건 중 1개 선택, 복수전공·편입생 동일)', [
            ('① 영어성적인증', '토익 850점, 토플 IBT 99점, 텝스 700점, 뉴텝스 386점 이상'),
            '성적표에 기재된 유효기간만 인정, 연장된 유효기간은 인정되지 않음',
            ('② 국가공인자격증 최종합격자', '공인노무사, 감정평가사, 공인회계사, 법무사, 보험계리인, 세무사, 관세사'),
            ('③ 고시 1차 합격자', '행정고시, 법원행시', '국립외교관 외교관선발시험 및 이에 준하는 국가시험'),
            ('④ 공무원시험(7, 9급 등) 최종합격자', '국가직 및 지방직 둘다 가능'),
            ('⑤ 법학전공 90학점 이상 취득', '사법/공법 전공과목 통합 90학점 인정, 교양법학 안됨, 전공영어 추가점수 안됨'),
        ]),
        ('법과대학 졸업 유의사항', [
            '졸업요건을 모두 만족하지 못한 경우 유예신청을 하여도 반려되며, 등록금 납부 없이 자동으로 초과학기로 넘어갑니다.',
            '취업공결을 사용하고자 하는 경우 해당 학기에 졸업요건(졸업논문 포함)을 모두 만족할 수 있어야 합니다.',
        ]),
    ]),
}
# 법과대학 단면 제목의 조건 문구가 원문에 있는지도 본다.
_CHECK_TITLES = {'deptrule_archbiz_law': ['다음 요건 중 1개 선택(복수전공, 편입생 동일)']}


def _flat(text):
    return re.sub(r'[\s*]+', '', text)


def postprocess(key, page, raw):
    title, secs = RULES[key]
    body = _flat(html.unescape(re.sub(r'<[^>]+>', ' ', raw)))
    if not all(_flat(t) in body for t in _CHECK_TITLES.get(key, [])):
        return {'title': title, 'sections': []}
    sections = []
    for sec_title, items in secs:
        kept = []
        for item in items:
            parts = item if isinstance(item, tuple) else (item,)
            if all(_flat(p) in body for p in parts):
                kept.append(' '.join(parts))
        if kept:
            sections.append({'title': sec_title, 'items': kept, 'ordered': False})
    return {'title': title, 'sections': sections}
