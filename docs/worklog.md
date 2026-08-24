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

## 2026-08-20

**목표**: 백엔드 없이 제보 기능 화면 확인 가능하게 만들기 + 편의시설 종류 추가

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/lib/mockReportsStore.ts` | **신규** | AsyncStorage 기반 로컬 제보 저장소 |
| `src/lib/reportsApi.ts` | 재작성 | `apiRequest`/`apiUpload` 호출을 로컬 스토어 호출로 교체 (함수 시그니처는 그대로 유지) |
| `src/components/map/ReportComposerModal.tsx` | 대폭 수정 | 로그인 게이트 제거, 카테고리 '+' 직접 입력 칩 추가, 등록 완료 안내 문구 수정 |
| `src/components/map/ReportSheet.tsx` | 수정 | 로그인 게이트 제거, 직접 입력한 카테고리 라벨을 배지에 표시 |
| `src/screens/MapScreen.tsx` | 수정 | 제보 등록 후 레이어가 켜져 있으면 목록 새로고침 |
| `src/utils/mapHtml.ts` | 수정 | 제보 롱프레스 시 근처 건물 탐색을 반경 제한 없이 항상 반환하도록 변경, `편의점` 핀 아이콘 추가 |
| `src/types/index.ts` | 수정 | `customCategoryLabel` 필드 추가, `FacilityKind`에 `편의점` 추가 |
| `src/constants/map.ts` | 수정 | 반경 제한을 걷어내며 쓸모없어진 `TAP_RADIUS_METERS` 제거 |
| `src/constants/report.ts` | 수정 | `REPORT_CUSTOM_CATEGORY_MAX_LENGTH` 추가 |
| `src/constants/facilityKinds.ts` | 수정 | `편의점` 칩 메타(아이콘·색) 추가 |
| `public/map.html` | 재생성 | 위 `mapHtml.ts` 변경분을 `generate-map-html.ts`로 다시 반영 |
| `package-lock.json` | **신규** | async-storage 등 의존성 설치 반영 |

커밋 `870ae38`에 위 표 중 제보 관련 항목이 모두 담겼다. `편의점` 관련 3개 파일(`types/index.ts`, `constants/facilityKinds.ts`, `mapHtml.ts`/`map.html`)은 아직 커밋 전이다.

---

### 1. 제보 기능을 백엔드 없이 화면에서 확인 가능하게

`docs/report-api-spec.md`는 제안 문서일 뿐 백엔드 구현은 아직이라, 제보를 만들어도 화면에 아무것도 뜨지 않는 상태였다(`.env`의 `EXPO_PUBLIC_API_BASE_URL` 미설정 → 모든 호출이 즉시 에러). 화면 검증용으로 로컬 저장소를 얹었다.

- `mockReportsStore.ts` — AsyncStorage에 제보를 저장/조회/삭제/신고 처리. 운영자 검토 화면이 없으므로 등록 즉시 `ACTIVE`로 올린다(원래는 `PENDING` → 검토 후 `ACTIVE`).
- `reportsApi.ts`의 함수 시그니처는 그대로 두고 내부만 이 스토어를 부르도록 바꿔, 백엔드가 준비되면 이 파일 안쪽만 `apiRequest`/`apiUpload` 호출로 되돌리면 되게 했다.
- 신고 누적 3회면 자동으로 `HIDDEN` 처리(운영자 화면이 없어 정한 임시 값).

### 2. 로그인 없이도 제보·신고 테스트 가능

화면만 확인하려는데 로그인 절차가 막고 있어, `ReportComposerModal`·`ReportSheet`의 로그인 게이트를 제거했다. 토큰이 없으면 빈 문자열을 대신 넘기는데, 로컬 목업 스토어는 이 값을 쓰지 않는다.

### 3. 제보 위치 설명 — 좌표 대신 항상 "근처 건물명"

지도를 롱프레스했을 때 40m 반경 안에 건물이 없으면 좌표(`37.55080, 126.92370`)가 그대로 노출됐다. `mapHtml.ts`의 `nearestBuildingWithin(lat, lng, radius)`를 반경 없는 `nearestBuilding(lat, lng)`로 바꿔 항상 가장 가까운 건물을 후보로 올리도록 했다. 이제 좌표가 뜨는 경우는 없다. 반경 제한이 없어지며 쓸모없어진 `TAP_RADIUS_METERS`도 같이 지웠다.

### 4. '무슨 일인가요?' 카테고리 직접 입력

고정된 5개 칩(행사·공연·간식행사·부스·기타) 옆에 '+' 칩을 추가했다. 누르면 인라인 입력창(최대 12자)이 펼쳐지고, 체크로 확정하면 그 텍스트가 칩에 반영되며 내부적으로는 `category: 'ETC'`로 전송된다(서버 스펙에 없는 값이라 유니온을 늘리는 대신 `customCategoryLabel` 필드로 얹었다). 취소하면 이미 확정해 둔 라벨은 건드리지 않고 입력 중이던 값만 버린다.

### 5. 편의시설에 '편의점' 추가

`FacilityKind`에 `편의점`을 추가하고 칩 아이콘(`storefront`)·색(`#D97706`)과 지도 핀용 인라인 SVG(차양 + 문 자리를 뚫은 매대 박스)를 넣었다. `MapFilterChips`는 `FACILITY_KINDS` 배열을 그대로 순회하는 구조라 다른 코드 변경은 없었다.

> **미결**: `constants/facilities.ts`의 `FACILITIES` 배열은 비어 있다(위치가 확인된 항목만 넣는 규칙). 실제 편의점 위치(건물명·층)를 알려주면 칩에 카운트가 붙는다.

---

## 2026-08-24

**목표**: 캠퍼스 길찾기(실외 경로망 + 층별 출입구) 데이터 수집 시작. 첫 단계로 건물별 출입구 좌표를 검증하는 임시 도구를 마련.

`src/utils/routing.ts`(Dijkstra + Yen's k-shortest paths)와 `src/constants/pathNodes.ts`(`PATH_WAYPOINTS`/`PATH_EDGES`)는 이전 세션에 이미 뼈대만 갖춰진 상태였다 — 로직은 완성돼 있지만 데이터가 비어 있어 길찾기는 전부 직선거리 추정(`straightLineFallback`)으로 대체되고 있었다. 이번 세션은 그 데이터를 채우기 전, 사용자가 실측한 좌표를 실제 지도 위에서 눈으로 확인할 수 있는 임시 검증 도구를 만드는 데 썼다.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/debug/entranceCheckData.ts` | **신규** | 대화로 전달받은 출입구/층간·건물간 연결 좌표를 정규식으로 파싱한 임시 데이터(현재 111개 지점, 15개 연결) |
| `src/screens/TempEntranceDebugScreen.tsx` | **신규** | 웹 전용 디버그 화면. 위 데이터를 네이버 지도 위에 점·연결선으로 그린다 |
| `App.tsx` | +17 | `window.location.pathname`이 `/temp/dots`면(웹만) `NavigationContainer`를 거치지 않고 위 화면을 바로 띄우는 분기 |
| `src/utils/mapHtml.ts` | `buildMapHTML`에 `showEntranceDebug` 매개변수 추가 | 기본값 `false`라 일반 지도 화면(`MapScreen`)에는 영향 없음. `true`일 때만 디버그 오버레이(점·연결선) 블록 렌더 |

네 파일 모두 커밋 `d36708d`에 반영·푸시됨. **`buildings.ts`/`pathNodes.ts`의 실제 데이터는 아직 하나도 안 바뀌었다** — 이 도구는 검증용이고, 좌표가 확정돼야 옮겨 적는다.

### 1. 출입구 좌표를 문자열로 받아 검증하는 흐름

사용자가 건물별·층별 좌표를 들여쓰기 목록(마크다운 불릿) 형태로 전달하면:

1. 정규식 파서로 건물명·층·좌표·부가설명(연결 정보, "수정 필요" 표시 등)을 추출
2. 같은 줄에 "OO동 N층으로 연결 [좌표]" 처럼 다른 건물의 좌표가 같이 적힌 경우, 그 좌표는 해당 건물 쪽 지점으로 별도 등록하고 두 지점을 잇는 연결선으로 기록
3. 결과를 `entranceCheckData.ts`에 반영, `mapHtml.ts`가 이걸 읽어 실제 네이버 지도(로컬 개발 서버) 위에 점·점선으로 그린다
4. 사용자가 위성/일반 지도 배경과 비교해 잘못된 점을 지적하면 반영 → 재생성, 반복

### 2. 확인된 것 / 남은 것

- **확인됨**: `E동` = `조형관`, `M동` = `체육관` (둘 다 `buildings.ts`에 이미 있는 이름인데, 이번에 받은 원본 텍스트에는 로마자/약칭만 적혀 있어 좌표 범위로 추정했던 것을 사용자가 직접 확인해줬다)
- **확인됨**: Z2동·Z3동 각 3층은 원래 좌표 하나만 받아 어느 건물 것인지 모호했으나, 재확인을 거쳐 두 건물 각각의 좌표 + 둘을 잇는 연결선으로 정리됨
- 값이 겹치거나(같은 문을 두 번 측정) 첫 측정치가 나중에 더 정확한 값으로 대체된 경우가 여러 건 있었다(T동·S동 1층, Z1동 등) — 대화 중 하나씩 확인하며 정리
- **미결**: `A동 1층 (37.5509723, 126.9260261)`로 전달받은 좌표가 A동의 실제 외곽선·다른 지점들과 약 110m 떨어져 있어(F동/Q동 쪽에 더 가까움), 오타인지 다른 건물인지 아직 확인 안 됨
- **미결**: `Q동 3층`에 "H 4층과 연결"이라는 메모가 있지만 H동에는 4층 자체가 데이터에 없어 연결선을 못 그렸다 — H동 쪽 좌표 필요

### 3. 네이버 지도 도메인 인증 — 미결 이슈 재확인

08-06~08-08 기록에 남아 있던 "네이버 콘솔에 등록된 서비스 URL을 모른다"는 미결 사항이 이번에도 그대로 걸렸다. `/temp/dots`를 로컬(`localhost:8081`)에서 열었을 때 인증이 통과하는지는 사용자가 직접 확인하기로 했고, 결과는 아직 공유되지 않았다.

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
| 7 | 출입구 좌표 검증 계속 + `buildings.ts`/`pathNodes.ts` 반영 | `/temp/dots`로 확인 중. 확정되면 `entranceCheckData.ts`·`TempEntranceDebugScreen.tsx`·`App.tsx`의 분기·`buildMapHTML`의 `showEntranceDebug` 매개변수를 통째로 제거 |

### 미결 질문

- 네이버 콘솔에 등록된 서비스 URL은 무엇인가 (`/temp/dots` 로컬 접속으로 재확인 시도 중)
- 소식 갱신을 EAS Update로 할 것인가, 백엔드에서 받을 것인가
- 어느 플랫폼부터 출시할 것인가
- `A동 1층 (37.5509723, 126.9260261)` 좌표가 실제 A동이 맞는가
