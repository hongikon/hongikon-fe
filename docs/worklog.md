# 작업 로그

커밋되지 않은 작업과 그 배경을 기록한다. 커밋 히스토리는 [`커밋별-작업내역.docx`](./커밋별-작업내역.docx) 참고.

---

## 2026-08-06 ~ 08-08

**목표 변화**: 실기기 테스트 → (제보 기능 검토) → **앱 출시 준비**

백엔드는 별도로 진행되는 것으로 확인되어, 제보 기능 구현은 계획 문서만 남기고 보류. 출시 준비로 방향 전환.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `eas.json` | **신규** | 빌드 프로파일 3종 |
| `app.json` | +7 / -2 | `buildNumber`, `versionCode` 추가 · `expo-splash-screen` 플러그인 자동 등록 |
| `package.json` | +14 / -14 | Expo 56 기준 의존성 정렬 |
| `pnpm-lock.yaml` | +446 / -218 | 위 정렬 반영 |
| `src/utils/mapHtml.ts` | +10 | 네이버 지도 인증 실패 감지 |
| `src/screens/MapScreen.tsx` | +35 | 인증 실패 배너 · 메시지 분기 보완 |
| `docs/report-feature-plan.md` | **신규** | 제보 기능 계획 (보류, 백엔드 인계용) |
| `docs/커밋별-작업내역.docx` | **신규** | 커밋 8개 작업 내역 문서 |

---

### 1. 커밋별 작업 내역 문서화

`git log`/`git show`로 커밋 8개(2026-06-21 ~ 08-05)의 실제 diff를 확인해 `docs/커밋별-작업내역.docx` 생성. 커밋 메시지가 `update`, `.` 처럼 내용을 알 수 없는 것이 3개라 diff를 읽고 작성.

### 2. 실기기 테스트 시도

**의존성 정렬** — `react-native-webview` 14.0.1(기대 13.16.1), `async-storage` 3.1.1(기대 2.2.0) 등 메이저 버전이 어긋나 Expo Go에서 지도가 깨질 수 있는 상태였다. `expo install --fix`로 7개 패키지 정렬. 타입 체크 통과.

**터널 연결** — 공용 Wi-Fi의 기기 격리로 LAN 접속이 막혀 `--tunnel` 사용. `@expo/ngrok` 전역 설치. 주소 `i7qbjxm-anonymous-8082.exp.direct` (`.expo/settings.json`의 `urlRandomness`에서 파생되어 포트 유지 시 고정).

**Expo Go 경로 차단 확인** — iOS App Store의 Expo Go 최신 버전이 **54.0.2 (2025-09-23)** 로 SDK 54까지만 지원. 프로젝트는 SDK 56이라 아이폰에서 실행 불가. 안드로이드는 `Expo-Go-56.0.4.apk` 사이드로드로 가능. 아이폰은 사파리 웹으로 대체 확인(접속 성공).

> SDK ↔ Expo Go 대응: 54 → 54.0.7 / **56 → 56.0.4** / 57 → 57.0.6

### 3. 시크릿 번들 노출 — 조치 완료

터널은 URL만 알면 외부에서 접근 가능하므로 번들을 검사한 결과, `.env`의 **`EXPO_PUBLIC_NAVER_MAP_CLIENT_SECRET`(40자)이 개발 번들에 그대로 포함**되어 있었다.

원인은 Expo CLI가 `EXPO_PUBLIC_` 접두사 값을 **코드에서 참조하든 안 하든 전부** 번들에 주입하기 때문. 해당 시크릿은 코드 어디서도 읽지 않는 값이었다(지도는 `CLIENT_ID`만 사용).

**조치**: 키 이름에서 접두사만 제거(`EXPO_PUBLIC_NAVER_MAP_CLIENT_SECRET` → `NAVER_MAP_CLIENT_SECRET`). 값은 변경하지 않음. 재빌드 후 번들 내 포함 횟수 **1 → 0** 확인. 원본은 `.env.bak.<타임스탬프>`로 백업.

> **미결**: 한 번 번들에 실린 이력이 있으므로 네이버 콘솔에서 재발급 권장.

### 4. 네이버 지도 인증 실패 — 진단 및 계측

사파리에서 지도가 뜨지 않아 원인을 추적했다.

**확인한 사실** — `maps.js`를 세 조건으로 호출한 결과가 **바이트 단위로 동일**했다.

| 요청 | 응답 |
|---|---|
| 정상 키 + 터널 도메인 | HTTP 200, 333,436 B |
| 가짜 키 + 터널 도메인 | HTTP 200, 333,436 B |
| 키 없음 + 터널 도메인 | HTTP 200, 333,436 B |

즉 스크립트 로드 단계에서는 키도 도메인도 검사하지 않는다. 검증은 지도 생성 시점에 일어나고 실패는 `window.navermap_authFailure` 콜백으로만 알려지는데, **코드에 그 콜백이 없어 조용히 실패**하고 있었다.

**조치**:
- `mapHtml.ts` — 지도 생성 **전에** `navermap_authFailure` 정의, 실패 시 `{ type: 'mapAuthFailure' }` 전달
- `MapScreen.tsx` — 해당 메시지 수신 시 경고 배너 표시. `partnerDismiss` 분기에 누락돼 있던 `return` 보완

타입 체크 통과, 웹 번들 반영 확인.

> **미결**: 배너가 실제로 뜨는지 미확인(터널 서버 종료됨). 원인이 도메인 미등록이라면 네이버 콘솔에 서비스 URL 추가가 필요하다. 실기기(WebView)에서는 origin이 없어 `baseUrl` 지정이 필요할 수 있는데, **등록된 도메인을 알 수 없어 값을 넣지 않았다**.

### 5. 제보 기능 — 계획만 수립 후 보류

로그인한 사용자가 지도 핀 위치에 진행 중인 행사를 제보하는 기능. 조사 결과 앱은 완전한 오프라인 읽기 전용(`src/`에 `fetch` 0건)이라 백엔드가 필수. 자체 서버 / Spring Boot 4.1 / JDK 21 / Docker MySQL / 로그인 필수로 방향을 정하고 JDK 21 설치까지 진행했으나, **백엔드가 별도로 진행 중임이 확인되어 중단**.

계획은 [`report-feature-plan.md`](./report-feature-plan.md)에 남겨 백엔드 쪽 스펙으로 인계 가능. `reports`·`report_flags` DDL은 기존 `schema.sql` 규약(BIGINT PK, utf8mb4, UTC 저장)에 맞춰 작성.

> 설치한 JDK 21(`/opt/homebrew/opt/openjdk@21`, keg-only)은 불필요 시 `brew uninstall openjdk@21`.

### 6. 출시 준비 — 빌드 설정

- **`eas.json` 신규** — `development` / `preview` / `production`. `preview`는 `buildType: "apk"`로 스토어 계정 없이 폰에 직접 설치 가능
- **`app.json`** — `ios.buildNumber: "1"`, `android.versionCode: 1` 추가 (스토어 제출 필수인데 누락돼 있었음)
- **`expo` 56.0.18 → 56.0.19**
- **검증**: `expo-doctor` 20/21 → **21/21 통과**

문서에서 확인하지 못한 필드(`autoIncrement`, `submit`)는 넣지 않았다.

---

## 다음 작업

| 우선순위 | 항목 | 비고 |
|---|---|---|
| 1 | **안드로이드 preview APK 빌드** | `eas build --profile preview --platform android`. Expo 무료 계정 필요(로그인은 대화형). 실기기에서 지도가 뜨는지 확인할 유일한 경로 |
| 2 | **소식 데이터 갱신 구조** | `src/data/news.cs.json`이 2026-08-05 스냅샷. 지금 출시하면 사용자는 그날 공지만 계속 본다. EAS Update 또는 백엔드 연동 필요 |
| 3 | 개인정보 처리방침 공개 URL | 스토어 심사 필수. 앱 내 화면은 있으나 웹 URL 없음 |
| 4 | 지도 `baseUrl` 지정 | 네이버 콘솔 등록 도메인 확인 후 |
| 5 | 스토어 계정 개설 | Apple $99/년, Google Play $25 1회. 현재 둘 다 없음 |
| 6 | 스토어 스크린샷·설명 | 계정 개설 후 |

### 미결 질문

- 네이버 콘솔에 등록된 서비스 URL은 무엇인가
- 소식 갱신을 EAS Update로 할 것인가, 백엔드에서 받을 것인가
- 어느 플랫폼부터 출시할 것인가
