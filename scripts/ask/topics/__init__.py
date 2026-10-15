"""물어보기 주제표. 분야별 파일(academic·courses·money·life·it_campus)의 TOPICS 를 모은다.

주제 하나(dict)의 키:
  id          흐름 id(앱 ASK 흐름 id 와 겹치면 안 된다)
  page        답 본문으로 옮길 안내 페이지 키(data/pages.json, sources.key_of 규칙). 또는
  pages       여러 페이지를 버튼으로 고르게 할 때(question 필요). 또는
  faqs        학사·장학 FAQ 질문 제목 목록(data/faq.json 의 q). 둘 이상이면 question 필요
  match       들어오는 길 목록. 길 하나 = 낱말 묶음 목록(묶음끼리 AND, 묶음 안 OR). 공백 없이, 소문자로 쓴다
  exclude     이 낱말이 질문에 있으면 이 주제로 오지 않는다(다른 주제와 겹칠 때)
  lead        답 맨 위 요약. 페이지 원문에 있는 사실만 줄여 쓴다. 없으면 본문 첫 문장을 쓴다
  question    pages/faqs 여러 개일 때 되묻는 말
  phones      contacts.P 키, 또는 ('라벨', '번호') 튜플(adminOffices 담당정보 표에 있는 번호만)
  facility    contacts.F 키, 또는 지도 시설 id('hi-…', src/constants/adminOffices.ts 의 키)
  faq         답 아래 '자주 묻는 질문' 버튼으로 붙일 FAQ 제목 / faqpage  함께 붙일 다른 페이지 키
  max_sections 페이지가 길 때 앞에서 몇 덩어리만 옮길지
"""
from . import academic, courses, money, life, it_campus

TOPICS = academic.TOPICS + courses.TOPICS + money.TOPICS + life.TOPICS + it_campus.TOPICS
