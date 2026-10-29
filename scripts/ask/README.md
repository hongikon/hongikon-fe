# 물어보기 답 만들기

학교 홈페이지 안내를 받아 `src/constants/askPages.ts`(챗봇 답)를 만든다. 직접 손본 답은 `src/constants/askAnswers.ts`에 있다. 질문이 들어오면 두 파일의 흐름을 함께 보고 점수가 가장 높은 답으로 간다(`matchAskFlow`).

서버 쪽 흐름(고르기 → 답 쓰기 → 검사)과 키·설정은 BE `docs/ask-architecture.md` 에 있다.

## 안내 만들기

```sh
python3 -I scripts/ask/crawl.py     # 학교 홈페이지 → cache/(HTML, git 에 안 올림). 대상은 sources.py · sites/
python3 -I scripts/ask/extract.py   # cache/ → data/pages*.json · data/faq.json
python3 -I scripts/ask/gen.py       # data/ + topics/*.py → src/constants/askPages.ts (fixes.py 를 함께 적용)
node scripts/ask/test-routing.mjs   # cases/*.json 정답표로 질문 → 답 경로 검사
node scripts/ask/export-catalog.mjs # 흐름 → 백엔드 ask/catalog.json·sources.json(서버 LLM 분류 /ask/route 가 고르는 목록). 흐름을 바꾸면 다시 돌린다
```

- **어떤 질문에 어떤 답:** `topics/*.py` 주제표. 형식은 `topics/__init__.py` 에 적혀 있다.
- **최신 공지 기준:** `fixes.py` 가 학교 안내 페이지 문구 중 최신 학사 공지와 어긋나는 곳을 바로잡는다(2026-10-25 운영진 요청). `gen.py` 가 읽는다.
- **정답표:** `cases/*.json` 에 `{"q": "질문", "expect": "흐름" | "흐름/단계" | "none"}`. 낱말을 바꾸면 꼭 테스트를 돌린다.
- **전화·위치:** `contacts.py`. 전화는 학교 부서 안내 담당정보 표(`adminOffices.ts`)와 안내 페이지에 적힌 번호만 쓴다.
- 학교 페이지가 바뀌면 crawl → extract → gen 을 다시 돌리고 `askPages.ts` 차이를 확인한다.
- `ts-hooks.mjs`: 앱 소스(.ts)를 Node 로 바로 읽게 확장자 없는 import 를 잇는다(스크립트들이 내부에서 쓴다).

## RAG 색인용 원문(학과 홈페이지)

```sh
python3 -I scripts/ask/depthome.py  # 학과 홈페이지 메뉴 → data/rag-depthome.json
```

- 원문을 그대로 넣고 낱말 목록은 짜지 않는다. 백엔드 `tools/embed-server/build_index.py` 가 `data/rag-*.json` 을 색인에 함께 넣는다. 이 파일이나 `sources.json` 이 바뀌면 색인을 다시 만든다(BE `docs/ask-embedding-plan.md`).
- **개인정보:** 교수·교직원·연구실 소개는 내용(연락처·연구실·이메일)을 옮기지 않고 페이지 위치만 남긴다(10-28 운영진 결정). 학번 줄과 게시판 목록은 빼고, 휴대전화 번호는 지운다. 새 학과를 넣으면 결과 파일에 실명·연락처가 남지 않았는지 확인한다.

## 평가(로컬 서버)

질문마다 LLM 을 부르니 **로컬 서버(local 프로필)에만** 돌린다. 결과는 `cache/eval/`(git 에 안 올림)에 남는다.

| 정답표 | 문항 | 보는 것 |
|---|---|---|
| `cases/*.json` | 2,749 | 질문 → 안내 경로. 서버 평가는 여기서 표본을 뽑는다 |
| `cases-scope/scope.json` | 39 | 범위 밖 거절·다른 대학 섞임. 매번 전부 돈다 |
| `cases-criteria/criteria.json` | 32 | 몇 과목·몇 학점·마감 같은 핵심 조건이 답에 있는지. 매번 전부 돈다 |
| `cases-dept/dept.json` | 40 | 학과 공지를 찾아 답하는지(`board`·`must`). 돌리는 스크립트는 아직 저장소에 없다 — `eval-server.mjs` 에 붙일 몫 |
| `cases-reason/reason.json` | 44 | 추론형 질문("어떻게·어떤 순서로·나는 어떻게 되나"). 아래 reason-eval |

```sh
# 일반·범위·기준 정답표
ASK_DEV_KEY=... node scripts/ask/eval-server.mjs [--n 300] [--seed 1] [--base http://localhost:8080] [--scope-only] [--criteria-only]

# 추론형 질문: 답 모으기 → Opus 5.5 로 채점
cd scripts/ask/reason-eval
ASK_DEV_KEY=... node run.mjs <label> http://localhost:<port>
ANTHROPIC_API_KEY=... node judge.mjs <label>...
```

- `ASK_DEV_KEY` 는 `/dev/ask` 암호키 원문이다. 서버에는 그 SHA-256 값(`ASK_DEV_KEY_SHA256`)이 들어 있다.
- `judge.mjs` 는 `@anthropic-ai/sdk`·`zod` 가 필요하다. 앱 의존성에 없으니 따로 설치한 폴더에서 돌린다.
- `reason-extra.txt` 는 모델 비교 때 답 쓰기 지시에 덧붙인 추론형 지시다. 이걸 쓰는 서버 설정은 실험 빌드에만 있다.
- 결과 읽는 법과 지난 결과: BE `docs/ask-architecture.md` 5절, `docs/ask-reasoning-eval.md`.
- 키는 셸 환경변수로만 넘긴다. 파일·커밋·채팅에 적지 않는다.
