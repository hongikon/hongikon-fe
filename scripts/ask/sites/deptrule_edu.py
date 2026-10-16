"""사범대학 학과 홈페이지 — 학과 고유 졸업 규정(졸업논문 대체·교직소양 디지털교육).

학과 공지사항을 '졸업'으로 찾아(srSearchKey=article_title&srSearchVal=졸업) 날짜와 상관없는 규정 문장만 옮긴다.
신청 기간·서식·담당자 같은 학기별 내용은 옮기지 않는다. 원문에 그 문장이 그대로 있을 때만 남긴다(별표·공백은 비교에서 뺀다).
- 수학교육과(math.hongik.ac.kr): '졸업요건, 교원자격증 취득요건, 졸업논문 대체과목 안내' 글 + 첨부 '수학교육과 졸업논문에 관한 내규'(PDF).
  PDF 는 postprocess 가 cache/deptrule_edu/math_thesis.pdf 로 한 번 받아(없을 때만) pypdf 로 읽고, 옮긴 줄의 한글 낱말·숫자가
  그 PDF 글자에 모두 있는지 검사한다(글자 순서가 숫자 둘레에서 뒤섞여 한글은 한글끼리만 이어 비교한다).
- 국어교육과(koredu): 졸업논문 작성 안내 글의 학칙 문장과 대체 조건(대체 과목 표는 그림이라 옮기지 않았다).
- 영어교육과(engedu): '나의 졸업가능여부 확인하기' 글의 안내 문장.
- 교육학과(edu): '나의 졸업가능여부 확인하기' 글(논문대체과목 변경·교직소양), '디지털교육(교직소양) 신설 관련 안내'.
- 역사교육과(hisedu): 공지사항에 졸업 규정 글이 없다(2026-10 확인).
다음 학기 글이 올라오면 PAGES 의 articleNo 를 바꾼다.
"""
import html, os, re, sys, urllib.request

LABEL = '사범대학 학과 홈페이지'
PAGES = {
    'deptrule_edu_math': 'https://math.hongik.ac.kr/math/0401.do?mode=view&articleNo=150542',
    'deptrule_edu_kor': 'https://koredu.hongik.ac.kr/koredu/0401.do?mode=view&articleNo=151557',
    'deptrule_edu_eng': 'https://engedu.hongik.ac.kr/engedu/0401.do?mode=view&articleNo=98003',
    'deptrule_edu_edu': 'https://edu.hongik.ac.kr/edu/0401.do?mode=view&articleNo=97776',
    'deptrule_edu_digital': 'https://edu.hongik.ac.kr/edu/0401.do?mode=view&articleNo=148270',
}
CONTENT = {'class': 'fr-view'}

TITLES = {
    'deptrule_edu_math': '수학교육과 졸업요건 확인·졸업논문 대체 내규',
    'deptrule_edu_kor': '국어교육과 졸업논문·졸업논문 대체 조건',
    'deptrule_edu_eng': '영어교육과 졸업요건 확인',
    'deptrule_edu_edu': '교육학과 졸업논문 대체과목·교직소양',
    'deptrule_edu_digital': '디지털교육(교직소양) 신설 안내(교육학과 공지)',
}

# 키 → [(단면 제목, [원문 문장 …])]
_RULES = {
    'deptrule_edu_math': [
        ('졸업요건·교원자격증 취득요건 확인', [
            '수학교육과 졸업요건 확인 [클래스넷] - [졸업정보] - [졸업요건조회]',
            '※ 본인의 졸업요건을 시스템으로 확인하는 것이 가장 정확합니다.',
            '교원자격증 취득요건 확인 [클래스넷] - [교직] - [교원자격증 취득요건조회]',
            '졸업논문 대체과목은 홈페이지에서 자동 조회가 불가능합니다.',
        ]),
    ],
    'deptrule_edu_kor': [
        ('졸업논문', [
            '졸업을 하려면 졸업논문 심사에 통과해야 합니다.(학칙 53조-1)',
            '졸업 논문 제출 시기는 졸업학년도의 마지막 학기입니다.(학칙 54조)',
            '졸업 논문을 대체하려면 아래 조건을 모두 만족해야 합니다.',
            '① 전공이수학점 63점 이상',
            '② 대체 과목 중 2과목 이상 수강',
        ]),
    ],
    'deptrule_edu_eng': [
        ('졸업요건 확인', [
            '졸업 가능 여부를 확인하고자 하는 경우 자기 학번에 맞는 졸업요건 체크리스트를 다운받아 확인하시기 바랍니다.',
            '※ 아래 파일은 졸업요건과 교원자격증 취득 요건을 모두 포함한 체크리스트로 교원자격증 취득을 하지 않고 졸업 하기를 희망 하는 경우 학과 사무실로 문의 하시기 바랍니다.',
        ]),
    ],
    'deptrule_edu_edu': [
        ('졸업논문 대체과목', [
            "'교육심리학세미나'가 폐지됨에 따라, '교육학세미나'가 논문대체과목으로 변경되었습니다.",
            "기존 '교육심리학세미나'를 수강한 학생은 졸업논문 대체과목으로 인정됩니다.",
            "'한국교육사'가 폐지됨에 따라, 25학번부터 '교육과정'이 논문대체과목으로 변경되었습니다. (이전 학번들은 교육과정이 논문대체과목으로 적용되지 않습니다.)",
            "기존 '한국교육사'를 수강한 학생은 졸업논문 대체과목으로 인정됩니다.",
        ]),
        ('교직소양', [
            '24학번부터 디지털교육(1학점/교직소양)이 교직소양 필수이수과목으로 지정되었습니다.',
            '이에 따라 기존 교직실무 과목은 1학점으로 조정되었으며, 아직 교직실무를 이수하지 않은 24학번 이전 학생들 또한 교직소양 6학점을 충족하기 위해 디지털교육 과목을 반드시 수강해야 합니다.',
            '(*교직소양 : 학교폭력예방및학생의이해(2), 특수교육론(2), 교직실무(1), +디지털교육(1) 총 6학점)',
        ]),
    ],
    'deptrule_edu_digital': [
        ('디지털교육(교직소양)', [
            '디지털교육(교직소양) : 3학년 2학기 개설, 1학점',
            '24학번부터 반드시 이수해야 되는 교직소양 과목으로, 졸업을 위하여 [특수교육론, 교직실무, 학교폭력예방및학생의이해, 디지털교육] 총 4과목을 이수하여 6학점을 충족해야 함.',
            '[디지털교육]의 신설로 인하여, 기존의 [교직실무]과목이 1학점으로 변경되었음.',
            '따라서 24학번 이전 학번이더라도 [교직실무] 2학점 과목을 수강하지 않았다면, "교직소양 6학점 이수"라는 필수요건을 충족하기 위하여 반드시 [디지털교육]을 수강해야 함.',
            '교직실무 2학점을 이미 이수한 학생들은 해당사항 없음.',
        ]),
    ],
}

# 수학교육과 첨부 '수학교육과 졸업논문에 관한 내규'(PDF 1쪽). 그림으로 띄워 보고 옮겼다.
MATH_PDF_URL = 'https://math.hongik.ac.kr/math/0401.do?mode=download&articleNo=150542&attachNo=87597'
_MATH_PDF_RULES = ('수학교육과 졸업논문에 관한 내규(첨부)', [
    '다음의 두 조건 중 하나 이상을 만족하는 자는 수학교육과의 졸업논문 심사에 합격한 것으로 인정한다.',
    '1. 아래의 졸업논문 대체과목 중 3과목에 대해, B0 이상의 평점을 취득하거나 과목별 졸업시험에 합격한 자 '
    '(단, 복수전공자의 경우 2과목에 대해 위의 조건을 만족한 자)',
    '- 과목별 졸업시험은 현재 해당 과목을 수강하고 있는 학생에 한해 신청할 수 있음',
    '- 졸업논문을 대체하는 과목은 범주1과 범주2의 과목들 가운데 각각 한 과목을 포함하여야 함',
    '2. 졸업논문 대체과목 4과목 이상을 포함하여 수학교육과 전공과목을 총 69학점 이상 이수한 자 (단, 이 항목은 2024년 8월 졸업예정자부터 시행함)',
    '졸업논문 대체과목(2025년 8월 이후 졸업예정자) 범주1: 고등미적분(2), 현대대수학(2), 복소해석학(2) / 범주2: 대수학특강, 해석학특강, 기하학특강',
])

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATH_PDF_PATH = os.path.join(_ROOT, 'cache', 'deptrule_edu', 'math_thesis.pdf')


def _flat(text):
    return re.sub(r'[\s*]+', '', text)


def _math_pdf_text():
    try:
        import pypdf
    except ImportError:
        print('deptrule_edu: pypdf 가 없어 수학교육과 내규(PDF)를 옮기지 않는다(pip install pypdf)', file=sys.stderr)
        return None
    if not os.path.exists(MATH_PDF_PATH):
        os.makedirs(os.path.dirname(MATH_PDF_PATH), exist_ok=True)
        req = urllib.request.Request(MATH_PDF_URL, headers={'User-Agent': 'Mozilla/5.0 (compatible; hongikon-ask-crawler; +https://hongikon.com)'})
        data = urllib.request.urlopen(req, timeout=60).read()
        if not data.startswith(b'%PDF'):
            print('deptrule_edu: 수학교육과 내규가 PDF 가 아니다', file=sys.stderr)
            return None
        open(MATH_PDF_PATH, 'wb').write(data)
    return ''.join(p.extract_text() or '' for p in pypdf.PdfReader(MATH_PDF_PATH).pages)


def _pdf_kept(text, lines):
    hangul = ''.join(re.findall(r'[가-힣]+', text))
    digits = re.sub(r'\s+', '', text)
    kept = []
    for line in lines:
        missing = [t for t in re.findall(r'[가-힣]+', line) if t not in hangul] + \
                  [t for t in re.findall(r'\d+', line) if t not in digits]
        if missing:
            print(f'deptrule_edu: 수학교육과 내규에 없는 낱말 {missing[:5]} → 줄 버림: {line[:40]}', file=sys.stderr)
            continue
        kept.append(line)
    return kept


def postprocess(key, page, raw):
    body = _flat(html.unescape(re.sub(r'<[^>]+>', ' ', raw)))
    sections = []
    for title, rules in _RULES.get(key, []):
        kept = []
        for rule in rules:
            if _flat(rule) in body:
                kept.append(rule)
            else:
                print(f'deptrule_edu: {key} 원문에 없는 문장 → 버림: {rule[:40]}', file=sys.stderr)
        if kept:
            sections.append({'title': title, 'items': kept, 'ordered': False})
    if key == 'deptrule_edu_math':
        text = _math_pdf_text()
        if text:
            kept = _pdf_kept(text, _MATH_PDF_RULES[1])
            if kept:
                sections.append({'title': _MATH_PDF_RULES[0], 'items': kept, 'ordered': False})
    return {'title': TITLES[key], 'sections': sections}
