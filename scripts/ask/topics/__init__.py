"""물어보기 주제표. 분야별 파일(academic·courses·money·life·it_campus)의 TOPICS 를 모은다.

주제 하나(dict)의 키:
  id          흐름 id(앱 ASK 흐름 id 와 겹치면 안 된다)
  (page·pages·faqs 가 모두 없으면 lead + tips 만으로 답한다 — 학교 페이지에 없는 운영진 정리)
  page        답 본문으로 옮길 안내 페이지 키(data/pages.json, sources.key_of 규칙). 또는
  pages       여러 페이지를 버튼으로 고르게 할 때(question 필요). 또는
  faqs        학사·장학 FAQ 질문 제목 목록(data/faq.json 의 q). 둘 이상이면 question 필요
  match       들어오는 길 목록. 길 하나 = 낱말 묶음 목록(묶음끼리 AND, 묶음 안 OR). 공백 없이, 소문자로 쓴다
  exclude     이 낱말이 질문에 있으면 이 주제로 오지 않는다(다른 주제와 겹칠 때)
  lead        답 맨 위 요약. 페이지 원문에 있는 사실만 줄여 쓴다. 없으면 본문 첫 문장을 쓴다
  question    pages/faqs 여러 개일 때 되묻는 말(pages 주제에 lead 가 있으면 되묻기 앞에 먼저 쓴다)
  pages_text / pages_label  pages 쪽마다 붙는 첫 줄·출처 이름('{title}' 자리). 없으면 페이지 출처대로
  phones      contacts.P 키, 또는 ('라벨', '번호') 튜플(adminOffices 담당정보 표에 있는 번호만)
  facility    contacts.F 키, 또는 지도 시설 id('hi-…', src/constants/adminOffices.ts 의 키)
  faq         답 아래 '자주 묻는 질문' 버튼으로 붙일 FAQ 제목 / faqpage  함께 붙일 다른 페이지 키(여러 개면 목록 — 답 아래 버튼마다 하나)
  only        page 원문 중 이 제목의 덩어리만 붙일 때(한 페이지에 주제가 여럿)
  max_sections 페이지가 길 때 앞에서 몇 덩어리만 옮길지
  tips        page 답에서 학교 원문보다 먼저 보일 정리 [('제목', ['줄', …])]. 학교 공식 문구가 아니면 제목에 '홍익온 정리'를 단다
  see         답 아래 다른 안내로 넘어가는 버튼 [('라벨', '흐름 id')]
  links       page 답에 덧붙일 바깥 출처 [('라벨', 'url')] — 학교 페이지에 없는 사실을 lead 에 쓸 때 그 출처
"""
import importlib, pkgutil

# 분야 파일 순서가 곧 같은 점수일 때의 우선순위다. 부속 사이트 주제(ext_*.py)는 그 뒤에 이름순으로 붙는다.
_CORE = ['academic', 'courses', 'money', 'life', 'it_campus']
_EXTRA = sorted(m.name for m in pkgutil.iter_modules(__path__) if m.name not in _CORE)
TOPICS = [t for name in _CORE + _EXTRA for t in importlib.import_module(f'{__name__}.{name}').TOPICS]
