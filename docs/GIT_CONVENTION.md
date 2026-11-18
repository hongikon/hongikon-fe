# Git 규칙: 브랜치 · 커밋 · PR (2026-11-18)

홍익온 두 저장소(`hongikon-be` 서버, `hongikon-fe` 앱·웹)가 같이 쓰는 규칙이다. 같은 파일이 두 저장소 `docs/GIT_CONVENTION.md` 에 있다 — 고치면 둘 다 고친다.
저장소마다 다른 점(검사 명령, 배포 방식)은 표에 따로 적었다. 브랜치 전략의 짧은 요약은 각 저장소 `docs/branching.md`.

---

## 1. 한눈에

```
작업 브랜치(feat/· fix/· …) ──PR──▶ dev ──릴리스 PR(dev → main)──▶ main ──▶ 운영
         (필요할 때만)            평소 작업은 여기에 바로 커밋          서버: 자동 배포 / 앱: OTA·스토어
```

- `main` 은 **운영**이다. `dev` 를 합칠 때만 바뀐다. 직접 커밋하지 않는다.
- `dev` 는 **다음 릴리스에 나갈 것**을 모은다. 평소 작은 작업은 `dev` 에 바로 커밋한다(2026-10-06 결정).
- 작업 브랜치는 크거나 위험한 작업, 팀원 검토가 필요한 작업에만 만든다. `dev` 에서 갈라 `dev` 로 합친다.

| | 서버 `hongikon-be` | 앱·웹 `hongikon-fe` |
|---|---|---|
| `main` 에 합치면 | CI → 이미지 → **운영 서버 자동 배포** | **hongikon.com 웹 자동 배포(Netlify)**. 앱은 손으로 OTA |
| 올리기 전 검사 | `./gradlew test` (CI 가 PR·push 마다 `./gradlew build`) | `pnpm exec tsc --noEmit -p .` · `pnpm test` |
| 꼭 같이 고칠 것 | `docs/worklog.md` 한 항목, 엔티티를 바꾸면 `db/*.sql` | 사용자가 알아챌 변화면 `src/constants/changelog.ts`, 지도 페이지를 바꾸면 `public/map.html` 다시 만들기 |

---

## 2. 브랜치 이름

### 모양

```
<종류>/<주제>-<짧은-설명>
```

- **영어 소문자 + 숫자 + 하이픈(-)** 만 쓴다. 한글·공백·밑줄(_)·대문자는 쓰지 않는다.
- 종류 뒤에는 `/` 를 하나만 쓴다(`feat/ask/club` ✕).
- 주제는 아래 커밋 scope(§3)와 같은 말을 쓴다: `ask`, `map`, `route`, `push`, `report`, `nearby` …
- 무엇을 하는지 2~4 단어로. 전체 40자 안쪽.
- 사람 이름, `test1`, `tmp`, `new` 처럼 뜻 없는 이름은 쓰지 않는다.

### 종류

| 종류 | 쓰는 때 | 실제 예 |
|---|---|---|
| `feat/` | 새 기능 | `feat/avoid-stairs`, `feat/ask-course-db` |
| `fix/` | 버그 수정 | `fix/ask-walk-route`, `fix/route-tap-dest-pin` |
| `ui/` | 화면·문구·색·아이콘처럼 보이는 것만 (앱) | `ui/logotype-app-icon` |
| `hotfix/` | 운영에 나간 급한 버그 | `hotfix/ask-android-keyboard`, `hotfix/1.0.0-update-notice` |
| `data/` | 코드 없이 데이터만 (제휴·카탈로그 등, 서버) | `data/partners-student-council-1110` |
| `chore/` | 설정·빌드·의존성·브랜치 맞추기 | `chore/sync-main-1115`, `chore/embed-log-source` |
| `docs/` | 문서만 | `docs/deploy-order-2026-10` |
| `test/` | 시험용으로 잠깐 띄우는 것(합치지 않을 수 있음) | `test/route-server-1109` |

- **날짜**는 데이터 갱신·브랜치 맞추기처럼 같은 이름이 또 생길 때만 끝에 `-MMDD` 로 붙인다.
- **두 저장소에 걸친 작업**은 양쪽 브랜치 이름을 똑같이 한다. 예: 서버·앱 모두 `fix/ask-double-major-credits`. PR 끼리 서로 링크한다(§4).
- `dependabot/…` 은 자동으로 생기는 것이라 손대지 않는다.

### 만들고 지우기

```bash
git switch dev && git pull
git switch -c fix/route-smooth-detours
# 작업·검사·커밋
git push -u origin fix/route-smooth-detours   # → PR base 는 dev
```

- 합친 브랜치는 지운다(GitHub PR 화면의 Delete branch, 또는 `git push origin --delete <이름>`).
- 발표·실험처럼 합치지 않을 브랜치도 쓰임이 끝나면 지운다. 지우기 전 팀에 한 번 묻는다.

---

## 3. 커밋 메시지

### 모양

```
<종류>(<scope>): <무엇을 했는지, 한국어 한 줄>

<필요하면 본문: 왜 바꿨는지, 무엇이 달라지는지>
```

예 (실제 커밋):

```
fix(route): 2·3순위 후보가 짧은 구간만 피해 옆으로 튀는 혹을 가장 빠른 길로 펴기
feat(ask): 수강신청 제한인원 학년 차례 표에 열마다 색을 싣는다
fix(map): 앱이 앞으로 돌아올 때 지도가 죽었거나 비었으면 다시 불러오기
docs(changelog): 11-18 건물 안 내 위치 길찾기·지도 흰 화면 고침
```

### 종류

지난 커밋에서 실제로 쓰는 것만 쓴다.

| 종류 | 뜻 |
|---|---|
| `feat` | 새 기능, 기능 넓히기 |
| `fix` | 버그 수정 |
| `docs` | 문서 (worklog·changelog 포함) |
| `chore` | 설정·빌드·의존성·정리 |
| `refactor` | 동작은 그대로, 코드 구조만 |
| `perf` | 빠르게 하기 |
| `test` | 테스트만 |
| `data` | 데이터만 (서버) |
| `ui` · `style` · `copy` | 보이는 것 / 꾸밈 / 문구만 (앱) |
| `revert` | 되돌리기 |

### scope (자주 쓰는 것)

- 서버: `ask`, `walkroute`(·`route`), `report`, `push`, `admin`, `map`, `user`, `auth`, `db`, `crawler`, `comment`
- 앱: `map`, `nearby`, `report`, `settings`, `ask`, `web`, `route`, `path-survey-v3`, `news`, `legal`, `admin`, `push`, `changelog`

scope 가 마땅치 않으면 생략한다(`chore: …`).

### 지킬 것

- **요약 줄은 한국어로, 무엇이 달라지는지 쓴다.** "코드 수정", "Update X.java" 처럼 뜻 없는 요약은 쓰지 않는다.
- 커밋 하나에 **한 가지 변경**. 기능과 상관없는 정리는 따로 커밋한다.
- 검사(§1 표)를 통과한 것만 push 한다.
- 이미 push 한 커밋은 고쳐 쓰지 않는다(amend·rebase 후 force push 금지). 틀렸으면 새 커밋으로 고친다.
- AI 도구로 만든 커밋은 끝에 `Co-Authored-By:` 줄을 남긴다.
- 서버 변경은 같은 커밋(또는 바로 다음 커밋)에 `docs/worklog.md` 항목을 남긴다.

---

## 4. PR

### PR 종류

| 종류 | base ← head | 제목 | 언제 |
|---|---|---|---|
| 작업 PR | `dev` ← `feat/…` 등 | 커밋 메시지와 같은 모양: `feat(ask): …` | 작업 브랜치를 합칠 때 |
| 릴리스 PR | `main` ← `dev` | `release: <나가는 것 요약>` | 운영에 낼 때 |
| 핫픽스 | `dev` ← `hotfix/…` 후 바로 릴리스 PR | `fix(…): …` → `release: hotfix …` | 운영 급한 버그 |

- 작업 PR 위에 또 PR 을 올릴 수 있다(예: #122 → #121 브랜치). 이때는 **아래 PR 부터** 합친다.
- 합칠 때는 **merge commit**(GitHub "Create a merge commit", 로컬이면 `--no-ff`). squash·rebase 로 합치지 않는다 — 릴리스마다 어떤 커밋이 나갔는지 그대로 남긴다.

### 작업 PR 본문

```markdown
## 왜
무엇이 문제였는지, 누가 요청했는지. 재현 방법이나 화면이 있으면 같이.

## 무엇을
- 바꾼 것 (파일·함수 이름은 `코드`로)
- 사용자에게 보이는 변화
- 일부러 안 한 것, 남은 한계

## 확인
- 돌린 테스트와 결과 (예: 백엔드 전체 통과, 앱 테스트 111 통과)
- 고치기 전에 실패하는 테스트를 확인했는지
- **확인 못 한 것**은 못 했다고 적는다 (예: 실제 기기에서는 아직 안 봄)

다른 저장소 PR: hongikon/hongikon-fe#00
```

### 릴리스 PR 본문

```markdown
## 변경
- `abc1234` 무엇이 바뀌는지 한 줄 (작업 PR 이 있으면 #번호)
- …

## 배포 순서 (있을 때만)
- 먼저 적용할 `db/*.sql`, 환경변수, 서버가 먼저 나가야 하는 앱 기능

## 확인
- 테스트 결과, 운영 데이터로 미리 돌려 본 결과

## 배포 뒤 확인
- [ ] 운영에서 눈으로 볼 것 (예: T동 → R동 후보에 Z1동 통과가 없는지)
```

- 릴리스 PR 을 만들기 전에 `git log origin/main..origin/dev` 로 **나가는 커밋을 모두 확인**한다. 다른 사람 작업이 섞여 있으면 본문에 같이 적는다.
- 본문 끝에 AI 도구로 쓴 PR 이면 그 표시를 남긴다.

### 리뷰·합치기

- 작업 PR 은 팀원 한 명이 보고 합친다. 혼자 하는 작은 작업은 `dev` 에 바로 커밋하므로 PR 이 없다.
- 릴리스 PR(`main`)은 **운영에 바로 나가므로** 합치기 전에 담당자 확인을 받는다.
- CI(서버)가 실패한 PR 은 합치지 않는다.

---

## 5. 운영에 내기

### 서버

1. 릴리스 PR(`dev` → `main`)을 합친다 → CI → 이미지 → 자동 배포.
2. 사이에 들어온 `db/*.sql`·환경변수는 `docs/deploy-runbook-*.md` 순서대로 **배포 전에** 적용한다.
3. 배포 뒤 릴리스 PR 의 "배포 뒤 확인"을 운영에서 본다.

### 앱·웹

1. 서버가 먼저 나가야 하는 기능이면 서버 배포를 확인한 뒤에 한다.
2. 릴리스 PR 을 합친다 → hongikon.com 웹이 자동 배포된다.
3. `main` 에서, 작업 트리가 깨끗한 상태로 OTA: `pnpm run update:production -m "무엇을 고쳤는지"`.
   - 먼저 시험: `pnpm run update:preview` 또는 테스트앱 `pnpm update:testflight` (운영 앱에는 가지 않는다).
   - 운영 OTA 는 `main` 커밋에서만 낸다(대시보드 Commit 값으로 나간 코드를 추적).
4. 네이티브 변경(패키지·`app.json`·권한·아이콘)은 OTA 로 못 나간다 → 스토어 빌드 (`docs/release-build.md`).
5. 끝나면 `dev` 를 `main` 에 맞춘다: `git switch dev && git merge --ff-only main && git push`.

---

## 6. 올리기 전 체크리스트

- [ ] `dev`(또는 작업 브랜치)가 최신 `origin/dev` 위에 있다 (`git pull`)
- [ ] 검사 통과 — 서버 `./gradlew test` / 앱 `tsc`·`pnpm test`
- [ ] 서버: `docs/worklog.md`, 엔티티를 바꿨으면 `db/*.sql`
- [ ] 앱: 사용자가 알아챌 변화면 `changelog.ts`, 지도 페이지를 바꿨으면 `public/map.html`
- [ ] 비밀값(키·토큰·`.env`)이 커밋에 없다
- [ ] 브랜치 이름 `<종류>/<주제>-<설명>`, 커밋 `종류(scope): 한국어 요약`
- [ ] PR 본문에 왜 / 무엇을 / 확인(못 한 것 포함)
