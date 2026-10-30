# 물어보기 답 만들기

학교 홈페이지 안내를 받아 `src/constants/askPages.ts`(챗봇 답)를 만든다. 직접 손본 답은 `src/constants/askAnswers.ts`에 있다. 질문이 들어오면 두 파일의 흐름을 함께 보고 점수가 가장 높은 답으로 간다(`matchAskFlow`).

```sh
python3 -I scripts/ask/crawl.py     # 학교 홈페이지 → cache/(HTML, git 에 안 올림). 대상은 sources.py
python3 -I scripts/ask/extract.py   # cache/ → data/pages.json · data/faq.json
python3 -I scripts/ask/gen.py       # data/ + topics/*.py → src/constants/askPages.ts
node scripts/ask/test-routing.mjs   # cases/*.json 정답표로 질문 → 답 경로 검사
node scripts/ask/export-catalog.mjs # 흐름 → 백엔드 ask/catalog.json(서버 LLM 분류 /ask/route 가 고르는 목록). 흐름을 바꾸면 다시 돌린다
node scripts/ask/graph/validate.mjs # 규정 그래프 후보(graph/candidates.json)를 sources.json 원문에 대조. export-catalog 뒤에 돌린다
node scripts/ask/graph/export.mjs <백엔드>/src/main/resources/ask/rule-graph.json # 사람이 확인한(reviewed) 선만 내보내기
```

- **어떤 질문에 어떤 답:** `topics/*.py` 주제표. 형식은 `topics/__init__.py` 에 적혀 있다.
- **정답표:** `cases/*.json` 에 `{"q": "질문", "expect": "흐름" | "흐름/단계" | "none"}`. 낱말을 바꾸면 꼭 테스트를 돌린다.
- **전화·위치:** `contacts.py`. 전화는 학교 부서 안내 담당정보 표(`adminOffices.ts`)와 안내 페이지에 적힌 번호만 쓴다.
- 학교 페이지가 바뀌면 crawl → extract → gen 을 다시 돌리고 `askPages.ts` 차이를 확인한다.
- **규정 그래프:** `graph/candidates.json` 의 선(결과·선행조건·예외·제한·기간)은 모두 `guide`·`quote`(안내 원문 그대로)가 있어야 한다. 학사 규정을 아는 운영진이 확인한 선만 `reviewed` 를 "YYYY-MM-DD 이름"으로 채우고, 그 선만 내보낸다. 설계는 백엔드 `docs/ask-rule-graph-plan.md`.
