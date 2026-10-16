"""학교 홈페이지 규정집의 '도서관 규정'(제7편 부속기관 › 1) 도서관 규정). 규정 본문이 HTML(div.fr-view)로 실려 있다.

중앙도서관 홈페이지 안내 페이지는 robots.txt 로 막혀 있어, 열람시간·휴관일·열람자격·대출·반납·제재 같은 학생용 조문은
이 규정 원문을 옮긴다. 대출 권수·기간·연체료 금액은 규정에 없고 '관장이 따로 정한다'로 되어 있다(권수·기간은 sites/honors.py).
키마다 같은 규정 페이지를 받고, 장(章)·조(條) 묶음만 다르게 잘라 쓴다. 조문 문장은 원문 그대로 둔다.
"""
import html, re

LABEL = '학교 홈페이지 규정집'
URL = 'https://www.hongik.ac.kr/kr/introduction/regulations-book.do?mode=list&srCategoryId=234'
PAGES = {
    'libregs_use': URL + '#use',        # 제6장 열람: 열람시간·휴관일·열람자격·열람대출증·소지품
    'libregs_loan': URL + '#loan',      # 제20조 열람시간 + 제7장 대출: 대출시간·자격·지정도서·전대 금지·즉시 반납·대출 금지 자료
    'libregs_copy': URL + '#copy',      # 제9장 복제: 학술연구 목적·저작권·수수료
    'libregs_penalty': URL + '#penalty',  # 제10장 제재: 분실 변상·연체료·미이행 조치·이용 제한
}
CONTENT = {'class': 'fr-view'}

# 키 → (페이지 제목, 옮길 조 번호 목록)
PICK = {
    'libregs_use': ('도서관 규정 · 열람', ['20', '21', '22', '23', '24', '25']),
    'libregs_loan': ('도서관 규정 · 대출', ['20', '26', '27', '28', '29', '30', '31']),
    'libregs_copy': ('도서관 규정 · 자료의 복제', ['34', '35', '36']),
    'libregs_penalty': ('도서관 규정 · 제재', ['37', '38', '39', '40', '41']),
}


def _paragraphs(raw):
    i = raw.find('<div class="fr-view">', raw.find('b-regulation-con-box'))
    j = raw.find('</div>', i)
    out = []
    for p in re.findall(r'(?is)<p[^>]*>(.*?)</p>', raw[i:j]):
        t = html.unescape(re.sub(r'<[^>]+>', '', re.sub(r'(?i)<br\s*/?>', ' ', p))).replace('\xa0', ' ')
        t = re.sub(r'\s+', ' ', t).strip()
        if t:
            out.append(t)
    return out


def _revised(raw):
    m = re.search(r'<span>개정</span>\s*<span>\s*([\d.]+)\s*</span>', raw)
    return m.group(1) if m else ''


def postprocess(key, page, raw):
    title, wanted = PICK[key]
    secs, cur = [], None
    for p in _paragraphs(raw):
        m = re.match(r'제(\d+)조(?:의\d+)?\(([^)]*)\)\s*(.*)', p)
        if m:
            cur = None
            if m.group(1) in wanted:
                body = m.group(3)
                cur = {'title': f'제{m.group(1)}조({m.group(2)})', 'items': [body] if body else [], 'ordered': False}
                secs.append(cur)
            continue
        if re.match(r'제\d+장', p) or p.startswith('부'):
            cur = None
            continue
        if cur is not None:
            # 삭제된 호('3. <삭제> <개정 …>')는 옮기지 않는다.
            if '<삭제>' in p:
                continue
            cur['items'].append(p)
    # 개정 표시 '<개정 2018.5.1.>' 같은 꼬리는 원문이지만 답에서는 읽기만 방해해 뗀다.
    for s in secs:
        s['items'] = [re.sub(r'\s*<(?:개정|신설)[^>]*>', '', i).strip() for i in s['items']]
        s['items'] = [i.replace('도 서관', '도서관') for i in s['items'] if i]  # 원문 '금지)도 서관' 띄어쓰기 오타
    page['revised'] = _revised(raw)  # 규정 개정일(참고용, 답에는 안 나감)
    page['title'] = title
    page['sections'] = secs
    return page
