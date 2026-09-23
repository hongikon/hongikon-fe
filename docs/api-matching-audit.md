# 프론트-백엔드 API 매칭 감사 (2026-09-23)

`hongikon-fe/src/apis/*.ts` 전부와 `hongikon-be` 컨트롤러(`@*Mapping` 전수 grep, 커밋
`0700b06`/백엔드 `origin/main` 기준)를 직접 대조했다. 백엔드 저장소에 커밋돼 있는
`api-docs.json`은 `/auth/me` DELETE 같은 실제 존재하는 엔드포인트가 빠져 있어 **오래된
스냅샷**이다 — 신뢰하지 말고 컨트롤러 소스가 기준.

## 🔴 실제 버그 (반드시 고쳐야 함)

1. **`POST /feedback` 이 백엔드에 없다.** `FeedbackModal`이 문의를 보낼 때마다 404로
   실패한다 — "문의하기" 기능이 지금 프로덕션에서 100% 작동하지 않는다.
   - 고치는 법: 백엔드에 `FeedbackController`를 새로 만들거나(별도 테이블 필요),
     당장 급하면 프론트에서 문의 내용을 이메일/슬랙 웹훅 등으로 우회 전송하도록 바꾼다.

2. **Access token이 30분 뒤 만료되는데 자동 갱신이 없다.**
   - `AuthContext.tsx`: 로그인 시 `refreshToken`을 저장은 하지만(`saveTokens`), 이후
     **어디서도 다시 읽지 않는다.** `apis/client.ts`도 401을 받으면 그냥
     "로그인이 만료되었습니다" 메시지만 띄우고 끝 — 재시도·갱신 로직이 없다.
   - 백엔드엔 이미 `POST /auth/reissue`가 있다(`AuthController.java:45`) — 프론트가 그냥
     안 부르고 있다.
   - 영향: `jwt.access-token-expiration=1800000`(30분) 이라, **로그인하고 30분만 지나면
     구독·북마크·제보 등 인증이 필요한 모든 요청이 401로 깨진다.** 리프레시 토큰은
     14일짜리라 원래 이럴 필요가 없다.
   - 고치는 법: `client.ts`의 `send()`가 401을 받으면 `/auth/reissue`로 한 번 갱신 시도 후
     원래 요청을 재시도하는 로직 추가 (다른 요청과 동시에 여러 번 reissue 호출 안 되게
     in-flight promise 공유 필요).

3. **`logout()`이 백엔드 `/auth/logout`을 호출하지 않는다.**
   - `AuthContext.logout()`은 로컬 토큰만 지우고 끝. 백엔드에 이미
     `POST /auth/logout`이 있는데(`AuthController.java:52`) 안 부른다.
   - 영향: 로그아웃해도 refresh token이 서버에서 폐기되지 않아, 탈취되면 최대 14일간
     유효하다. 심각도는 낮지만(로컬 저장소도 같이 지우므로 정상 사용자 흐름엔 지장 없음)
     보안 위생 문제.

## 🟡 클라이언트 코드는 있는데 아무 화면도 안 부름 (죽은 코드)

- `getNews` / `getNewsById` (`apis/news.ts`, `GET /news`, `GET /news/{id}`) — 어디서도
  호출 안 함. 뉴스 화면(`NewsScreen`)은 백엔드가 아니라 로컬 `NEWS_DATA` 상수만 쓴다.
- `getDepartments` (`apis/departments.ts`, `GET /departments`) — 어디서도 호출 안 함.
- `getKeywordSubscriptions` / `createKeywordSubscription` / `deleteKeywordSubscription`
  — 코드 자체 주석에 "아직 이 기능을 쓰는 화면이 없다"고 이미 적혀 있음. 확인만.

## 🟠 백엔드엔 API가 있는데 프론트에 클라이언트 코드조차 없음

- **`/users/me/bookmarks`(GET/POST/DELETE)** — `src/apis/`에 관련 파일 자체가 없다.
  북마크(`NewsScreen`의 "북마크" 탭)는 전부 로컬 `SettingsContext.bookmarkedNews`
  (AsyncStorage)로만 저장된다. 기기를 바꾸거나 재설치하면 사라지고, 서버는 이
  사용자가 뭘 북마크했는지 전혀 모른다.
- **`/users/me/departments`(GET/POST/DELETE)** — 클라이언트 코드 없음. 학과 구독
  (`SettingsContext.subscribedDepts`)도 로컬 저장만 하고 서버에 절대 동기화 안 함.
  **만약 백엔드가 학과 기준으로 알림 대상을 골라 푸시를 보내는 로직을 갖고 있다면,
  그 로직이 참조할 사용자별 구독 데이터가 서버에 하나도 없어서 항상 빈 결과일
  것이다** — 학과 알림 기능이 있다면 사실상 죽어 있는 셈. (반대로 "구독 소식 알림"
  자체는 카테고리 기준(`notification-categories`)이라 이건 정상 동기화되고 있음 —
  혼동하지 말 것.)

## 🟢 의도된 것으로 보임 — 확인만 필요

- **`/buildings`, `/places`, `/partners`(GET 전부 + POST/DELETE)** — 프론트는 이 셋 다
  로컬 하드코딩 상수(`constants/buildings.ts`, `facilities.ts`, `partners.ts`)로
  그린다. 각 파일 주석에 "좌표는 사용자가 직접 확인한 값만 넣는다, 추정값 금지"라고
  명시돼 있어 **의도적인 데이터 품질 정책**으로 보인다(`docs/worklog.md`엔 RDS에
  buildings 27건/places 72건이 들어가 있다고도 기록돼 있어, 백엔드 데이터 자체는
  존재함). 다만:
  - 백엔드 `partners`엔 POST/DELETE(쓰기 API)까지 있는데 이걸 실제로 쓰는 클라이언트가
    있는지(관리자 도구? Postman으로 수동 등록?) 확인이 필요.
  - 두 데이터가 서로 다른 소스로 따로 굴러가면, 언젠가 어긋날 위험(백엔드 DB엔
    있는데 앱엔 없는 건물, 혹은 그 반대)이 있다 — 의도된 정책이면 최소한 "이 셋은
    로컬이 정본(source of truth)"이라는 걸 백엔드 쪽 README에도 남겨두는 걸 권한다.

## 우선순위 제안

1. 🔴 1번(`/feedback` 404) — 사용자가 실제로 누르는 버튼이 항상 실패하니 최우선.
2. 🔴 2번(토큰 자동 갱신) — 로그인 유지 시간이 30분이라는 건 거의 모든 사용자가
   금방 체감하는 문제. 배포 전에 반드시 고쳐야 함.
3. 🟠 북마크/학과 구독 서버 동기화 — 기능 자체는 동작하는 것처럼 보이지만(로컬엔
   저장되니까) 서버와 안 맞아 다기기·재설치 시나리오에서 조용히 깨진다. 배포는
   가능하지만 빠른 시일 내 처리 권장.
4. 🔴 3번(logout이 서버 세션 안 지움) — 보안 위생, 급하지 않지만 기록.
5. 🟢 나머지는 의도된 설계인지 팀 확인 후 스킵하거나 후속 작업으로.
