# 작업 로그

커밋되지 않은 작업과 그 배경을 기록한다. 커밋 히스토리는 [`커밋별-작업내역.docx`](./커밋별-작업내역.docx) 참고. 새 항목을 쓸 때 형식은 [`worklog-guide.md`](./worklog-guide.md) 참고.

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

### 4. 검증 라운드를 거치며 추가로 잡은 것

`d36708d` 커밋 시점에 이미 반영된, 검증 과정에서 나온 수정들:

- **정규식 파서 버그**: 제4공학관 T동의 "3층, 5층" 공유 지점(계단/승강기 하나가 두 층에서 다 접근되는 경우)을 콤마로 이어 적었는데, 파서가 첫 번째 층만 읽고 "5층" 쪽을 조용히 흘렸다. 층 문자열을 "3층, 5층" 그대로 저장하도록 고쳐, `T5`·`T3` 어느 쪽으로 찾아도 같은 지점이 나오게 함
- **홍문관 R동 1층(37.552444974659736, 126.92507658905335) 삭제 확정**: 처음 삭제 요청과 이후 "전체 내용 업데이트"로 다시 포함된 값이 한 번 충돌해 보류했다가, 재확인 요청에 사용자가 다시 삭제를 확인해 최종 반영
- Z1동 1층·2층 좌표를 사용자가 준 새 사각형 배치(37.5509552/37.5501280 × 3개 경도값)로 교체

### 5. 연결 표기 규칙 합의 (다음 회차부터 사용)

좌표를 매번 옮겨 적지 않고 `connect T5 - Z2 4 - S3` 처럼 **건물 약칭+층**을 대시로 이은 축약 표기로 연결 관계를 받기로 했다. 같은 건물·층에 지점이 하나뿐이면 바로 찾아 연결하고, 여럿이면(현재 111개 지점 중 22개 건물·층 조합이 중복) 좌표를 덧붙여 특정해달라고 요청한다. 새 지점은 좌표를 한 번만 주면 이후 같은 축약형으로 참조 가능.

### 6. 작업 로그 형식 문서화

`docs/worklog-guide.md` 신규 — 이 로그를 계속 같은 형식(목표 → 변경된 파일 표 → 번호 매긴 서술 → `> **미결**`, 파일 끝의 "다음 작업"/"미결 질문"은 매번 새로 안 만들고 갱신)으로 쓰기 위한 가이드. `worklog.md` 상단에서 링크. 아직 커밋 전.

---

## 2026-08-25

**목표 변화**: 캠퍼스 편의시설 표를 `FACILITIES`에 반영 → 실외 경로망 웨이포인트(`pathNodes.ts`) 확장

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/constants/facilities.ts` | 빈 배열 → 68건 | 사용자 제공 표를 건물 단위로 옮겨 채움 |
| `src/types/index.ts` | `FacilityKind`에 +5 | `스터디룸`·`라운지`·`수면실`·`흡연구역`·`엘리베이터` 추가(같은 파일의 `Report*`/`MapLayer` 관련 나머지 diff는 이전 세션 작업이라 이번 항목 아님) |
| `src/constants/facilityKinds.ts` | +5 | 위 5종 칩 아이콘·색 메타 추가 |
| `src/utils/mapHtml.ts` | 편의시설 아이콘 5종 추가 | `FACILITY_ICONS`에 위 5종 인라인 SVG 추가(같은 파일의 `entranceDebugMode`/`pickerActive` 관련 나머지 diff는 이전 세션 작업) |
| `src/constants/pathNodes.ts` | `PATH_WAYPOINTS` +18, `PATH_EDGES` +8/-3 | 파일 전체가 아직 커밋 전(untracked)이라 `n1`~`n49`와 그 간선은 이전 세션 작업이고, 오늘은 `n50`~`n67` 추가 + 그중 일부를 기존 망에 연결 |

다섯 파일 모두 아직 커밋 전.

---

### 1. 원본 표 → 기존 `Facility` 스키마 변환

표의 9개 컬럼(`location_id`/`building_code`/`floor_id`/`amenity_id`/`location_scope`/`quantity`/`location_detail`/`operation_status`/`verified_at`)과 기존 타입(`id`/`kind`/`buildingName`/`floor?`/`note?`)이 맞지 않아, 진행 전 사용자에게 네 가지를 확인받았다.

- **새 종류 5개**(`NAP_ROOM`/`LOUNGE`/`STUDY_ROOM`/`SMOKING_BOOTH`/`ELEVATOR`)는 전부 추가하기로 함 → `수면실`/`라운지`/`스터디룸`/`흡연구역`/`엘리베이터`
- **`quantity`/`operation_status`/`verified_at`**은 표 전체에서 값이 비어 있거나(`quantity`) 균일해서(`active`/`8.24.26`) 걷어내도 정보 손실이 없다고 판단, `Facility` 타입은 확장하지 않음
- **`location_detail`**은 기존 `note` 필드 용도(건물 안 위치 설명)와 정확히 맞아 그대로 사용

### 2. 매칭 실패·불명확 항목 제외

- **`HI_E_BUILDING_ELEVATOR`**: `buildings.ts`에 "E동"이 없음(A·B·C·D 다음이 F로 건너뜀) — 제외, 실제 건물 확인되면 추가
- **R동 "LF"(카페나무/세미나실/증명서 출력기 3건)**, **P동 "NF"(카페) 1건**: 앱의 층 표기(`1F`/`B1` 정수)와 맞지 않는 표기라 일괄 제외했다가, 사용자가 뒤이어 "R동 L층 증명서 발급은 실재한다"고 확인해 그 1건만 `floor`를 비운 채(`note`에 "L층, 정확한 층수 미확인") 다시 포함시켰다. 카페·스터디룸 2건과 P동 N층 카페(원표에도 "확인필요"로 적혀 있었음)는 계속 제외 상태

### 3. 백그라운드 조사 에이전트의 범위 이탈

`mapHtml.ts`의 `FACILITY_ICONS` 구조만 읽어 보고하도록 fork 서브에이전트를 띄웠는데, 대화 맥락을 통째로 물려받다 보니 사용자의 확인(AskUserQuestion) 응답을 기다리지 않고 타입 추가·데이터 채움까지 먼저 끝내버렸다. 결과는 이후 받은 실제 답변과 대부분 일치했으나, "LF/NF 행을 어떻게 할지"만 어긋났다(fork는 `floor`를 비운 채 남겼는데, 사용자는 완전 삭제를 골랐다) — 이 부분만 다시 걷어내는 수작업이 필요했다. 앞으로 fork에 좁은 조사만 시킬 때는 "쓰기 작업 금지"를 더 명시해야 함.

### 4. 검증

`tsc --noEmit` 통과. `id` 중복 없음(68건), `buildingName`이 전부 `buildings.ts`의 실제 건물명과 일치함을 스크립트로 확인.

### 5. 좌표 18개 → `pathNodes.ts` 웨이포인트로 추가

편의시설 작업 막바지에 사용자가 좌표 18개를 붙여넣고 "add those"라고만 했을 때는 용도(웨이포인트/외곽선/출입구)를 밝히지 않아 반영을 미뤘다. 이후 "outdoor path waypoints for pathNodes.ts"라는 확인을 받아, 기존 마지막 id인 `n49` 다음부터 `n50`~`n67`로 이어 붙였다. 이 시점에는 간선(`PATH_EDGES`) 없이 좌표만 등록 — 세 뭉치(6+5+7개, 원문에서 빈 줄로 나뉘어 있던 순서 그대로)가 서로도, 기존 `n1`~`n49` 망과도 안 이어진 상태로 남겨뒀다. 연결 관계를 추측하면(특히 라우팅처럼 틀리면 조용히 잘못된 경로를 안내하는 데이터는) `buildings.ts`의 "좌표는 확인된 값만 채운다" 원칙에 어긋나므로, 간선은 항상 사용자가 명시한 것만 넣기로 했다.

### 6. 새 웨이포인트를 기존 망에 연결

사용자가 "connect 2-32, 31-55-3, remove 32-3, connect 53-54-51-52-36-50-16, remove 36-37 connect 63-64-65-66-67, 66-61-62, connect 56-56-58-59-60"(이후 "remove 19-20" 추가) 형태의 축약 표기로 간선을 지정했다. `56-56`은 `56-57`의 오타로 해석했다(어차피 기존에 이미 있던 간선이라 결과는 같음).

- **추가**: `n2-n32`, `n31-n55`, `n55-n3`, `n54-n51`, `n52-n36`, `n36-n50`, `n50-n16`, `n66-n61`(나머지 지정 간선은 이미 존재해 no-op)
- **삭제**: `n32-n3`, `n36-n37`, `n19-n20` — 삭제해도 `n37`은 `n37-n38`로, `n20`은 `n20-n21`/`n23-n20`으로 계속 본 망에 붙어 있어 끊어지는 노드는 없었다
- 결과로 **`n50`~`n55`가 `n36`/`n16`(양쪽에서 두 번 연결)과 `n31`/`n3` 경로로 기존 망에 합쳐져 55개 노드짜리 하나의 컴포넌트**가 됐다. `n56`~`n60`, `n61`~`n67`은 사용자가 연결점을 안 줘서 계속 별도 섬으로 남음(`n61`~`n67`은 `66-61`로 자기들끼리는 고리가 됨)
- 연결 판단에는 사용자가 공유한 아티팩트(`claude.ai/code/artifact/d94278bd-...`, "Hongik Footpath Graph")가 참고가 됐다 — `pathNodes.ts` 원본 데이터를 그대로 시각화해, 새 노드들이 기존 어느 노드와 지리적으로 가까운지(`n54`≈`n33`, `n55`≈`n3`/`n2` 등) 보여줬다

### 7. 검증

union-find로 컴포넌트를 다시 계산해 확인: 총 67개 노드·77개 간선, 자기 자신을 잇는 간선·중복 간선 없음, 컴포넌트 3개(본 망 55개 + `n56`~`n60` 5개 + `n61`~`n67` 7개). `tsc --noEmit` 통과.

> **미결**: `n56`~`n60`, `n61`~`n67` 두 갈래를 본 망에 어떻게 연결할지 아직 안 받음.

### 8. 추가 간선 조정 (같은 세션 후반)

§7 검증 이후에도 축약 표기로 간선 수정 요청이 이어졌다: `connect 35-38, remove 35-36` / `remove 36-52` / `remove node 50` / `connect 36-37, 51-36, 37-43` / `remove edge 36-37` / `connect 14-36` / `connect 30-28` / `remove 55-30`(해당 없는 간선이라 no-op).

- **`n50` 완전 삭제** — 좌표와 거기 걸린 간선(`n50-n51`, `n36-n50`, `n50-n16`) 셋 다 제거. 이후 `n51`~`n55` 갈래는 한동안 `n31-n55-n3` 경로로만 본 망에 붙어 있었다(`n36`/`n16` 쪽 연결이 끊김).
- 곧이어 `n36-n51`이 다시 추가돼(요청 "51-36") 양쪽 연결이 복구됐고, `n36-n37`·`n37-n43`도 추가됐다가 `n36-n37`은 바로 다음 요청으로 다시 삭제됐다. 대신 `n14-n36`이 새로 추가돼 `n36`은 지금 `n14`·`n16`·`n51` 세 갈래로 본 망에 붙어 있다.
- `n35-n36`을 `n35-n38`로 교체, `n30-n28` 추가로 `n28-n29-n30` 삼각 루프 생성.
- **동시 편집 충돌을 두 번 감지**했다 — 파일이 직전에 읽은 상태와 달라져 있었는데, 두 번 다 다른 세션이 같은 요청을 먼저 처리한 결과라 "되돌리지 않고 인정 + 요청에 없던 부분만 짚어 확인"으로 처리했다(`worklog-guide.md`에 이 판단 기준을 추가할 만함). 한 번은 `n50`~`n67` 세 뭉치를 원문 나열 순서대로 잇는 간선 4개(`n50-n51`,`n52-n53`,`n54-n55`,`n62-n63`)가 사용자가 명시하지 않았는데도 이미 들어가 있어 `AskUserQuestion`으로 확인받았다(사용자가 "유지" 선택).
- 시각화 아티팩트도 매 라운드 함께 갱신했다. 노드가 67 → 77개 간선까지 늘며 범례·컴포넌트 목록·통계를 손으로 맞추다 `n19-n20` 삭제를 하마터면 놓칠 뻔해, degree·연결 컴포넌트를 간선 배열에서 매번 다시 계산하는 방식으로 리팩터링했다(하드코딩된 집합 대신).

**최종 상태**: `n1`~`n67` 중 `n50` 삭제로 66개 노드, 77개 간선. 컴포넌트 3개 유지 — 본 망(54개) + `n56`~`n60`(5개, 고립) + `n61`~`n67`(7개, 자기들끼리는 `n66-n61`로 고리). `tsc --noEmit` 매 변경마다 통과 확인.

> **미결**: 확인 안 된 것 세 가지 — (1) `n19-n20` 간선이 사용자 요청 없이 사라졌는데 복원할지, (2) `remove 55-30`이 존재하지 않는 간선이라 no-op 처리했는데 `55-31`을 잘못 말한 것인지, (3) `n50` 완전 삭제가 의도적이었는지(좌표 자체가 틀렸다는 뜻인지 단순 재구성인지).

---

## 2026-08-26

**목표**: hongikon-be(스웨거) 기준으로 프론트를 실제 백엔드에 연결.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/apis/reports.ts` | 재작성 | `mockReportsStore` 대신 실제 `POST/GET/DELETE /reports`, `POST /reports/{id}/flags` 호출로 교체 |
| `src/lib/mockReportsStore.ts` | 삭제 | 위 교체로 더 이상 쓰이지 않음 |
| `src/apis/client.ts` | +1 | `apiRequest` 메서드 유니온에 `PATCH` 추가(알림 카테고리 토글용) |
| `src/apis/notifications.ts` | 신규 | 알림 카테고리 조회/토글(`/users/me/notification-categories*`), 키워드 구독 CRUD(`/users/me/keyword-subscriptions*`) |
| `src/apis/devices.ts` | 신규 | 기기 등록/비활성화(`/users/me/devices*`) — 백엔드 계약만 맞춰둠, 호출부 없음(§4) |
| `src/contexts/SettingsContext.tsx` | +조회/토글 연동 | 로그인 시 서버 알림 카테고리로 로컬 값을 덮고, 토글마다 `PATCH` 전송 |
| `src/components/map/ReportComposerModal.tsx`, `ReportSheet.tsx` | 로그인 가드 추가 | 실제 백엔드는 제보 작성/신고에 로그인을 요구(401) — 있었지만 호출부 없이 방치돼 있던 `promptLogin` 유틸을 연결 |
| `src/utils/reports.ts` | 주석 수정 | 삭제된 `mockReportsStore` 언급 제거 |

### 1. 스코프를 좁힌 이유

hongikon-be의 컨트롤러 13개(제보/뉴스/북마크/건물/시설/제휴업체/경로/알림카테고리/키워드구독/학과/유저학과/기기/인증)를 전부 조사한 결과, "전부 연결"은 지금 시점에 안전하지 않다고 판단했다:

- **백엔드 테이블이 전부 비어 있다** — 시드 스크립트(`data.sql` 등)가 없고, README도 로컬 `gradlew bootRun` + 로컬 MySQL만 안내한다. 배포된 인스턴스도 없고 `EXPO_PUBLIC_API_BASE_URL`도 어디에도 설정돼 있지 않다.
- **뉴스/북마크**: hongikon-be README가 스스로 "크롤러 아키텍처 방향 미확정(프론트 Node 크롤러 정적 파일 vs 백엔드 DB+API)"이라고 적어 뒀다. FE 뉴스(`crawledNews.ts`)는 이미지·첨부파일·조회수·소스명을 갖고 학과별 여러 소스를 스크래핑한 결과인데, 백엔드 `News`는 `title/content/category/sourceUrl/departmentId/buildingId`뿐인 얇은 관리자 입력 모델이다. 북마크(`newsId: Long`)도 FE의 크롤러 문자열 id와 대응이 안 된다.
- **건물/시설/제휴업체**: FE `buildings.ts`(외곽선·층별 출입구 등 직접 검증한 데이터)·`facilities.ts`(68건)·`partners.ts`(1191줄, 이 세션과 무관하게 커밋 전 수정 중)가 백엔드 엔티티보다 훨씬 풍부하고, 백엔드 테이블은 비어 있다. `partners.ts`의 새 필드 `affiliationBenefits`(제휴처별 혜택 문구)는 백엔드 `Partner`에 대응 컬럼이 없다.
- **경로 탐색**: 백엔드가 자체 그래프(`RouteNode`/`RouteEdge`, `pointNo`/`hasRoof`/`isBarrierFree` 등)를 갖고 있는데 이 테이블도 비어 있고, FE는 여전히 `pathNodes.ts` 위 클라이언트 Dijkstra를 쓴다(08-25 §미결 "경로망을 건물에 연결"과 같은 계열 문제). 데이터 스왑이 아니라 엔진 자체가 다르다.
- **학과**: `GET /departments`도 비어 있어, FE 학과 트리(`useTreeSearch`) 연결은 지금 해봐야 빈 목록만 나온다.

조사 결과를 사용자에게 보고하고 "지금 준비된 것만" 진행하기로 범위를 좁혔다(`AskUserQuestion` 응답: "Do what's actually ready").

### 2. 제보(Reports) — 실연결

Mock(`AsyncStorage` 기반 `mockReportsStore.ts`)을 걷어내고 `apis/reports.ts`가 직접 `apiRequest`를 호출하도록 재작성했다. FE 타입(`Report`/`CreateReportInput` 등)은 이미 백엔드 스펙에 맞춰 주석까지 달려 있어 그대로 옮기면 됐다.

- `customCategoryLabel`·`imageUrl`은 백엔드에 대응 필드가 없다(주석에 이미 명시돼 있던 사실). 요청 바디에서는 빼고, 생성 직후 응답에만 로컬로 다시 붙여 작성자 화면에서는 그대로 보이게 했다 — 새로고침하거나 다른 사용자가 보면 사라진다(기존에 문서화된 동작 그대로).
- `POST /reports`·`POST /reports/{id}/flags`는 `anyRequest().authenticated()`에 걸려 로그인이 필요하다. 이전에는 목업이라 토큰 없이도(`accessToken ?? ''`) 동작했는데, 실제 백엔드는 401을 던진다. `src/utils/reports.ts`에 정확히 이 상황을 위해 만들어 뒀지만 어디서도 호출하지 않던 `promptLogin`을 `ReportComposerModal`·`ReportSheet`에 연결해, 토큰이 없으면 API를 부르기 전에 로그인 유도 얼럿을 띄우게 했다.
- `GET /reports`는 `live`/`buildingId` 둘 다 옵셔널 쿼리라 그대로 전달. 백엔드 컨트롤러 주석을 보면 `live` 값과 무관하게 항상 "진행중" 목록만 돌려주지만(`live=false` 케이스 미구현), 의도를 분명히 하려고 `live=true`는 계속 보낸다.
- `deleteReport`는 호출부가 없다(본인 제보 삭제 UI 자체가 아직 없음) — 함수만 실제 엔드포인트로 바꿔 뒀다.

### 3. 알림 카테고리 — 실연결

`SettingsContext`의 `subscribedCategories`(공지·장학·행사·수강·시설·취업·상담)가 백엔드 `NotificationCategoryService.CATEGORIES`와 문자열까지 정확히 일치함을 확인했다(양쪽 다 "확인 필요"로 표시돼 있었지만 이미 같은 값으로 맞춰져 있었다). 로그인 상태(`accessToken` 존재)일 때만:
- 마운트 시 `GET /users/me/notification-categories`로 서버 값을 가져와 로컬 값을 덮는다(서버가 진실 소스).
- 토글마다 `PATCH /users/me/notification-categories/{category}`를 fire-and-forget으로 보낸다(실패하면 `console.warn`, 로컬 상태는 낙관적으로 유지).

게스트(토큰 없음)는 기존처럼 로컬 저장만 쓴다.

### 4. 키워드 구독 / 기기 등록 — API 계층만

- **키워드 구독**(`KeywordSubscriptionController`, 자유 텍스트 알림)은 이 앱에 대응하는 화면이 없다. `SubscriptionManagerModal`이 다루는 "구독"은 학과 단위(`subscribedDepts`)라 축이 다르고, 학과 구독에 대응하는 백엔드 엔드포인트는 아예 없다(있는 건 "내 학과"=`UserDepartmentController`, 마이페이지용 소속 정보로 의미가 다름). `apis/notifications.ts`에 CRUD 함수만 만들어 뒀다 — 새 입력 UI가 생기면 바로 쓸 수 있다.
- **기기 푸시 토큰 등록**(`UserDeviceController`)도 `apis/devices.ts`에 계약만 맞춰 뒀다. 이 레포에 `expo-notifications`가 아직 없어(패키지 목록 확인) 실제 권한 요청·토큰 발급 플로우를 검증 없이 새 네이티브 의존성과 함께 붙이는 건 위험하다고 판단해 호출부는 만들지 않았다.

### 5. 검증

`npx tsc --noEmit` 통과(변경 때마다 재확인). 실제 백엔드가 로컬에도 배포본에도 안 떠 있어(§1) 런타임 왕복은 아직 못 해봤다 — `EXPO_PUBLIC_API_BASE_URL`을 로컬 `gradlew bootRun` 주소로 채우고 `/auth/test-token`으로 받은 토큰을 넣어야 실제 테스트가 가능하다.

> **미결**: 로컬 백엔드를 띄워 리포트 생성 → 목록 조회 → 신고 → 알림 카테고리 토글까지 실제 왕복 테스트를 아직 못 했다(백엔드 미기동, `EXPO_PUBLIC_API_BASE_URL` 미설정).

---

## 2026-08-27

**목표**: 푸시 알림 최소 구현 — 권한 요청 → Expo 푸시 토큰 발급 → 기기 등록(`POST /users/me/devices`) → 알림 탭 시 화면 이동.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/lib/pushNotifications.ts` | 신규 | `usePushNotifications` 훅 — 권한 요청 → 토큰 발급 → 로그인 상태면 서버 등록 |
| `src/navigation/navigationRef.ts` | 신규 | `NavigationContainer` 밖(알림 응답 리스너)에서 화면을 전환하기 위한 참조 |
| `src/utils/notificationFormat.ts` | 신규 | 알림 `data` payload → 표시용 제목/본문 포맷 |
| `src/apis/devices.ts` | 재작성 | 08-26엔 계약만 맞춰 두고 호출부가 없었는데, 이번에 `usePushNotifications`가 실제로 불러 쓰게 되며 인자 형태를 객체 하나에서 positional 4개로 바꿈 |
| `App.tsx` | +10 | `NavigationContainer`에 `navigationRef` 연결, `PushNotificationsBridge`(빈 컴포넌트)로 훅 마운트 |
| `app.json`, `package.json`, `pnpm-lock.yaml` | 의존성 추가 | `expo-notifications` 플러그인·패키지 등록 |
| `src/constants/news.ts` | +1 | `NEWS_BY_ID` — 알림의 `newsId`로 상세 화면에 넘길 항목을 찾는 맵 |
| `src/types/index.ts` | +1 타입 | `PushNotificationData`(`NEWS`/`REPORT` 두 갈래) |
| `src/screens/AppStatusScreen.tsx` | +개발자 도구 | `__DEV__` 전용 "알림 포맷 미리보기" 버튼 |

### 1. 권한 → 토큰 → 서버 등록

`usePushNotifications`는 로그인 상태(`accessToken` 존재)일 때만 권한을 요청하고, 허용되면 `Notifications.getExpoPushTokenAsync`로 받은 토큰을 `POST /users/me/devices`에 등록한다. `UserDeviceController`가 로그인을 요구해 게스트는 건너뛴다. 웹은 원격 푸시를 지원하지 않아 `Platform.OS === 'web'`이면 바로 종료.

### 2. 알림 탭 → 화면 이동

`NavigationContainer` 밖(알림 응답 리스너)에서 네비게이션하려면 `ref`가 필요해 `navigationRef.ts`를 새로 뒀다. `NEWS` 타입은 로컬 `NEWS_DATA`에서 `newsId`로 찾아 상세 화면으로, `REPORT` 타입은 일단 지도 탭(기본 탭)으로만 보낸다 — 좌표로 지도를 자동 포커스하는 기능은 `MapScreen`이 아직 알림발 좌표를 받을 방법이 없어 후속 작업으로 남겼다.

### 3. Payload 계약은 가안

`PushNotificationData`는 프론트가 임의로 정한 타입이다 — `hongikon-be`엔 기기 등록(`UserDevice`) 엔티티만 있고 실제로 푸시를 발송하는 코드 자체가 없다(2026-08-27 확인). 백엔드에 발송부가 생기면 실제 payload와 이 타입을 맞춰봐야 한다.

### 4. 검증

원격 푸시 발송부가 없어 실기기 왕복 테스트가 불가능하다. 대신 `AppStatusScreen`에 같은 `data` payload로 로컬 알림을 바로 띄우는 개발자 전용 버튼을 추가해, 포맷(`formatPushNotification`)과 탭 시 라우팅만은 눈으로 확인할 수 있게 했다. `npx tsc --noEmit` 통과.

> **미결**: 백엔드 발송부가 없어 실제 원격 푸시 왕복 테스트 불가. EAS FCM/APNs 자격 증명도 아직 설정 안 됨(`eas credentials`).

---

## 2026-08-27 (2)

**목표**: `hongikon-be`의 크롤러/학과 구조를 조사하고, `GET /news`·`GET /departments`용 API 클라이언트를 추가.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/apis/news.ts` | 신규 | `GET /news`(필터), `GET /news/{id}` 호출 |
| `src/apis/departments.ts` | 신규 | `GET /departments` 호출 |

### 1. 크롤러 구조 확인

08-26 항목에서 "크롤러 아키텍처 미확정"이라 적었던 것과 달리, `hongikon-be`엔 이미 완성된 크롤러가 있었다(`crawler` 패키지) — `CrawlerScheduler`가 매시 정각 `CrawlerService.crawlAll()`을 돌려 학과·행정기관 게시판 36개 + 대학공지 6개 분류를 훑고, `NewsCategoryClassifier`(제목 키워드 → 7종 카테고리, `NotificationCategoryService`와 값 일치 확인됨)로 분류해 `News`로 저장한다. FE `scripts/crawler/*.mjs`를 그대로 포팅한 것이라 게시판 목록도 대부분 일치한다.

**막혀 있는 지점**: `NewsLocationMatcher.matchDepartment()`가 `Department.name`을 게시판의 `sourceId`와 정확히 일치시켜 찾는데, `departments` 테이블이 비어 있다(시드 SQL·Flyway·시더 클래스 전부 없음, 스키마 자체도 `ddl-auto=validate`라 자동 생성 안 됨). 지금 크롤러를 돌리면 소식은 저장되지만 전부 `department_id = null`로 남는다.

### 2. FE 구독 트리 ↔ 크롤러 게시판 대조

`TREE_DATA`(`constants/news.ts`)의 리프 노드와 `CrawlerBoards.DEPARTMENT_BOARDS`의 `sourceId`를 전부 대조했다. 크롤러 쪽 orphan(트리에 없는 게시판)은 없었지만, 트리에는 있는데 게시판이 없는 리프가 9개 있었다: `기초과학과`, `디자인경영전공`/`예술경영전공`(학부 공지 게시판만 있음, FE 주석에 이미 명시돼 있던 사실), `자율전공`(미술대학), `바이오헬스융합학부`(학과 전체), `융합전공` 4개 전공 전부. 이 9개를 구독해도 지금은 영원히 소식이 안 온다 — `Department` 시드에 포함할지, 포함해도 크롤러 커버리지가 없다는 걸 알릴지는 아직 결정 안 됨.

### 3. API 클라이언트 추가 (화면 연결은 보류)

`src/apis/news.ts`/`departments.ts`를 백엔드 DTO에 맞춰 추가했다. `GET /news` 응답(`BackendNewsSummary`/`Detail`)은 FE 크롤러 데이터(`NewsItem`)보다 훨씬 얇다 — `images`/`attachments`/`views`/출처명이 없다(08-26에도 확인했던 내용). `NewsScreen`은 여전히 `NEWS_DATA`(FE 크롤러 정적 스냅샷)를 그대로 쓴다 — 백엔드 `news`/`departments` 테이블이 비어 있고 배포된 인스턴스도 없는 상태에서 화면을 이 API로 바꾸면 목록이 통째로 비어 보이는 눈에 띄는 회귀라, API 계층만 만들고 화면 연결은 보류했다(§1의 시딩, 배포 이후로 미룸).

> **미결**: `Department` 시드(34개 학과, §2의 9개 미매칭 리프 포함 여부), FE 크롤러(`scripts/crawler`)와 백엔드 크롤러 중 어느 쪽을 실제 소스로 쓸지, `NewsScreen`을 언제 이 API로 옮길지 — 전부 배포/시딩 이후로 미뤄진 결정.

---

## 다음 작업

| 우선순위 | 항목 | 비고 |
|---|---|---|
| 1 | **안드로이드 preview APK 빌드** | `eas build --profile preview --platform android`. Expo 무료 계정 필요(로그인은 대화형). 실기기에서 지도가 뜨는지 확인할 유일한 경로 |
| 2 | **소식 데이터 갱신 구조** | `src/data/news.cs.json`이 2026-08-05 스냅샷. hongikon-be README도 "크롤러 아키텍처 방향 미확정"이라 적어 뒀다 — 프론트 EAS Update로 갱신할지, 백엔드 DB+API로 옮길지 팀 결정 필요(08-26 §1) |
| 3 | 개인정보 처리방침 공개 URL | 스토어 심사 필수. 앱 내 화면은 있으나 웹 URL 없음 |
| 4 | 지도 `baseUrl` 지정 | 네이버 콘솔 등록 도메인 확인 후 |
| 5 | 스토어 계정 개설 | Apple $99/년, Google Play $25 1회. 현재 둘 다 없음 |
| 6 | 스토어 스크린샷·설명 | 계정 개설 후 |
| 7 | 출입구 좌표 검증 계속 + `buildings.ts` 반영 | `/temp/dots`로 확인 중. 확정되면 `entranceCheckData.ts`·`TempEntranceDebugScreen.tsx`·`App.tsx`의 분기·`buildMapHTML`의 `entranceDebugMode` 매개변수를 통째로 제거 |
| 8 | `n56`~`n60`, `n61`~`n67` 갈래를 본 경로망에 연결 | 연결점(어느 기존 노드/건물과 이어지는지) 사용자 확인 필요 — 확인되면 `n56`~`n67` 값들도 §5 방식대로 반영 |
| 9 | 편의시설 데이터 + `pathNodes.ts` 커밋 | `facilities.ts` 등 5개 파일이 아직 커밋 전. 지금 커밋하면 §8의 미확인 3건도 같이 굳어지니 그 전에 정리 권장 |
| 10 | `pathNodes.ts` 웨이포인트를 건물/출입구에 연결 | 지금은 경로망 전체가 어느 건물과도 안 이어져 있어 `findRoutes()`가 항상 직선거리로 대체됨(§8 확인 후) |
| 11 | 로컬 백엔드 기동 + `EXPO_PUBLIC_API_BASE_URL` 설정 | 08-26 §5 참고. 리포트/알림카테고리 실연결을 실제로 왕복 테스트하려면 필요 |
| 12 | 백엔드 데이터 시딩(건물/시설/제휴업체/학과/뉴스) | 위 항목들 테이블이 전부 비어 있어(08-26 §1) 지금은 연결해도 빈 목록만 나온다. 시딩 방식(수동 INSERT vs 관리자 화면 vs FE 데이터 이관) 백엔드팀과 논의 필요 |

### 미결 질문

- 네이버 콘솔에 등록된 서비스 URL은 무엇인가 (`/temp/dots` 로컬 접속으로 재확인 시도 중)
- 소식 갱신을 EAS Update로 할 것인가, 백엔드에서 받을 것인가
- 어느 플랫폼부터 출시할 것인가
- `A동 1층 (37.5509723, 126.9260261)` 좌표가 실제 A동이 맞는가
- `HI_E_BUILDING_ELEVATOR`가 실제로 어느 건물인지
- R동 "L층"(카페나무·세미나실)과 P동 "N층"(카페)의 정확한 층수 또는 실존 여부
- `n56`~`n60`, `n61`~`n67`이 본 경로망 어디에 연결되는지
- `n19-n20` 간선을 복원해야 하는지 (사용자 요청 없이 사라짐)
- `remove 55-30`이 `55-31`의 오타인지 (해당 간선이 없어 no-op 처리함)
- `n50` 완전 삭제가 의도적이었는지 (좌표 오류인지 단순 재구성인지)
- 편의시설 내용 정리
- 건물/시설/제휴업체/학과/경로 데이터를 hongikon-be에 언제·어떤 방식으로 시딩할 것인가 (08-26 §1)
- `partners.ts`의 `affiliationBenefits`(제휴처별 혜택 문구)를 백엔드 `Partner` 스키마에 컬럼으로 추가할 것인가, FE 전용으로 남길 것인가
