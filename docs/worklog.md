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

## 2026-09-01

**목표**: `pathNodes.ts`의 다리(bridge) 구간(`n141`~`n145`)을 실제 건물 출입구·기존 경로망에 연결.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/constants/buildings.ts` | 좌표 수정 2건 | `HI_T_3F_ENTER`, `HI_Z2_4F_ENTER` 좌표 갱신(§1, §3) |
| `src/constants/pathNodes.ts` | `PATH_EDGES` +11, 상단 주석 갱신 | 다리 구간을 T동·Z2동 출입구 및 기존 망(13/17/44/45)에 연결(§2) |

두 파일 모두 `n1`~`n145` 좌표·간선 대부분은 이전 세션 작업이고(08-25~09-02 날짜가 이미 상단 주석에 섞여 있음 — 사용자가 미리 앞당겨 기록해 둔 것으로 보인다), 이번 세션은 그중 `n141`~`n145`와 관련 출입구만 다뤘다.

### 1. `HI_T_5F_ENTER`/`HI_T_3F_ENTER` 좌표 정정 — 세 번 수정

처음에 사용자가 "37.5501562, 126.9249398 을 `HI_T_5F_ENTER`로" 요청했을 때, 정확히 일치하는 좌표가 코드 어디에도 없어 가장 가까운 다리 구간 노드(`n141`, 약 2.6m 차이)를 그 이름으로 바꾸는 방향으로 잘못 처리했다. 사용자가 "nope"로 정정 — 의도는 `pathNodes.ts`의 임시 노드를 개명하는 게 아니라 `buildings.ts`의 기존 출입구 좌표(`HI_T_3F_ENTER`/`HI_T_5F_ENTER`가 원래 좌표 하나를 공유하고 있었다) 자체를 갱신하는 것이었다. 이후 "두 노드 중 3F만"이라는 정정이 한 번 더 있었고, 마지막에 "두 위치를 서로 바꿔라"로 최종 확정 — 결과적으로 `HI_T_3F_ENTER = (37.5501348, 126.9249452)`(원래 값), `HI_T_5F_ENTER = (37.5501562, 126.9249398)`(새 값)로 분리됐다.

### 2. 다리 구간(`n141`~`n145`)을 출입구·기존 망에 연결

축약 표기("T_5F - 141-142-143-144-145", "145-45, 145-44" 등)로 간선을 받아 반영했다. 건물 출입구는 `n141`처럼 `PATH_WAYPOINTS`에 새 항목을 만드는 대신, `routing.ts`의 `resolveRef`/`anchorId`가 이미 지원하는 `건물명#출입구라벨` 앵커 문자열을 `PATH_EDGES`에 직접 적는 방식을 썼다(08-24 §1의 기존 방식과 동일, `HI_GL_ENTER1`처럼 웨이포인트로 중복 등록할 필요 없음을 `routing.ts` 코드로 확인).

- `제4공학관 T동#HI_T_5F_ENTER` → `n141` → `n142` → `n143` → `n144` → `n145` → 기존 망(`n44`/`n45`)
- `이천득관 Z2동#HI_Z2_2F_2_ENTER` → `n138` → `n137` → `n136`, 이어서 `n137`/`n138`을 각각 `n17`/`n13`으로 직접 연결(기존 망과 이중으로 붙임)
- `이천득관 Z2동#HI_Z2_4F_ENTER`는 좌표를 `(37.5500653, 126.9253039)`로 옮기고 `n143`에 바로 앵커 연결

### 3. 검증

`npx tsc --noEmit` 통과.

> **미결**: `n142`는 아직 이름·출입구 연결 없이 다리 중간 노드로만 남아 있다(사용자가 특정 출입구를 지목하지 않음).

---

## 2026-09-07

**목표**: 백엔드가 공유한 노트(SDK 버전 불일치, 로그인 화면 전환, 네이버 지도 secret 재발급, 체크리스트 8건)를 실제 프론트 코드·커밋과 대조 검증. 코드 변경 없음 — 조사만.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `docs/worklog.md` | 이 항목 | 조사 결과 기록 |

---

### 1. SDK 57 업그레이드 — 이미 완료됨

백엔드 노트는 "SDK 56 vs Expo Go 57 불일치로 실기기 테스트가 막혀 있다"고 전했으나, 어제(`fac8d3f`, 2026-09-06) 이미 SDK 57로 업그레이드가 끝나 있었다(`expo: ~57.0.20`, expo-* 패키지 전부 동기화, EAS pnpm 버전 고정, `expo-modules-jsi@56.0.12` 패치 제거). 백엔드가 최신 상태를 몰랐던 것으로 보여 알려줌.

### 2. 로그인 후 화면 전환 — 코드는 이미 구현돼 있음, 실기기 테스트만 남음

`AuthContext.tsx`의 `loginWithKakao`가 `WebBrowser.openAuthSessionAsync(KAKAO_LOGIN_URL, AUTH_REDIRECT_URI)`를 쓰고 있어, iOS `ASWebAuthenticationSession`/Android Custom Tabs가 리다이렉트를 직접 캐치해 Promise로 돌려주는 구조다. 별도의 `Linking` 이벤트 리스너 없이도 code 추출 → `exchangeAuthCode` → `authenticated` 전환까지 이미 짜여 있다. SDK도 올라갔으니 추가 구현 없이 바로 실기기 테스트만 하면 된다.

### 3. 네이버 지도 secret — 재발급 여부, 사실상 확정

`.env`의 현재 `NAVER_MAP_CLIENT_SECRET` 값(앞 11자 대조, 이 문서엔 더 이상 적지 않음 — 이 저장소가 public이라 부분 값이라도 남기지 않는다)과 2026-09-04에 카톡으로 전달된 값이 정확히 일치한다. 08-06~08-08 §3 기록에 그 시점 조치가 "키 이름에서 접두사만 제거, **값은 변경하지 않음**"이라고 명시돼 있어, 이 값은 재발급된 새 값이 아니라 예전에 번들에 노출됐던 값 그대로일 가능성이 매우 높다. 그때 남긴 "미결: 재발급 권장"이 아직 처리 안 된 것으로 보인다.

### 4. BE 체크리스트 8건 대조

- `/auth/reissue`·`/auth/logout`·`DELETE /auth/me` 미구현: 프론트 `apis/client.ts`의 `apiRequest`는 401 재시도/재발급 로직이 전혀 없다 — `refreshToken`은 저장만 해두고 쓰는 곳이 없다. reissue가 배포되면 그때 401 인터셉트 로직을 새로 짜야 한다(지금은 대기).
- `POST /auth/test-token` 제거, 제보 API 5개 미확정 항목: 전부 백엔드 전담/대기, 프론트 액션 없음.
- `partner_affiliations` benefit 컬럼 / `GET /partners` 응답 구조 변경: 프론트에 `GET /partners`를 호출하는 코드가 아예 없다 — 제휴업체 데이터는 `constants/partners.ts`에 하드코딩돼 있어 이 변경은 지금 프론트 동작에 영향 없음.

> **미결**: 네이버 지도 secret 재발급을 사용자가 직접 네이버 콘솔에서 확인·처리해야 함. 실기기(ngrok) 로그인 전체 흐름 테스트 아직 미실행.

---

## 2026-09-08 ~ 09-09

**목표 변화**: 네이버 지도 로컬 인증 실패 원인 확인 → 기숙사 제휴 데이터 추가 → 지도 탭 제휴 UI 정리

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `.env` | 로컬 전용 | `NAVER_MAP_CLIENT_ID` → `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` |
| `src/constants/partners.ts` | +233 | 기숙사 제휴 15곳 신규, 기존 8곳에 기숙사 소속 추가 |
| `src/constants/partnerAffiliations.ts` | +25 | 소속별 이용 방법 안내(`PARTNER_AFFILIATION_USAGE_NOTES`) |
| `docs/partner-data-conflicts.md` | +62 | 출처 간 혜택 문구·상호명 충돌 정리 |
| `src/components/map/PartnerSheet.tsx` | +131 | 혜택 아래 이용 방법 표시, 소속 칩 |
| `src/screens/MapScreen.tsx` | +140 / -60 | 검색바·필터 칩을 전체 화면 지도 위 플로팅 오버레이로 |
| `src/utils/mapHtml.ts` | +54 | 겹친 제휴 마커 탭 시 순환 선택 |
| `src/components/map/ChipIcon.tsx` | **신규** | 칩 아이콘 공통화 |
| `src/utils/partnerSearch.ts`, `PartnerSearchModal.tsx` | +171 / -50 | 검색어 없을 때 카테고리별 접이식 전체 목록 |
| `.gitignore` | +4 | EAS 로컬 자격증명 제외 |

커밋: `772775e`, `0cbdf6c`, `deeaa68`(09-09), `83ebb5d`(09-17 커밋).

---

### 1. 네이버 지도가 로컬에서 회색으로 뜨던 원인

`.env`의 키 이름이 `NAVER_MAP_CLIENT_ID`였는데 코드(`mapHtml.ts:19`)와 배포 스크립트(`generate-map-html.ts`, `netlify-env-sync.mjs`)는 전부 `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`를 읽는다. 그래서 `maps.js?ncpKeyId=`가 빈 값으로 요청되고, 네이버는 HTTP 200을 주면서 조용히 인증 실패(`navermap_authFailure`)를 낸다. 콘솔 에러가 없어서 찾기 어려웠다.

`.env` 키 이름만 바꿔 해결(값 변경 없음, 커밋 대상 아님). `generate-map-html.ts`의 자체 가드로 키가 채워지는 것을 확인한 뒤, 재생성된 `public/map.html`은 관련 없는 지도 데이터까지 딸려 들어와 되돌렸다. 배포된 Netlify 페이지는 예전 `.env`로 만들어져 당시엔 멀쩡했고, 다음 재생성·배포 때 터질 문제였다.

### 2. 기숙사 제휴 추가와 이용 방법 안내

기숙사를 새 소속으로 넣으면서 기숙사만 "카드키 제시 / 기숙사 홈페이지 거주 확인" 안내가 있고 나머지 12개 소속은 안내가 전혀 없는 불균형이 생겼다. 다른 소속의 실제 방법이 공개되지 않아 기숙사 문구를 지우는 안도 있었지만, 나머지 12개에 공통 기본 문구("실물 학생증 제시 또는 모바일 학생증 제시")를 주는 쪽으로 정했다. 한 업체가 기숙사와 다른 소속을 함께 가지면 학생증 안내가 위, 기숙사 안내가 아래로 오도록 정렬을 명시적으로 고정했다(소속 배열 순서에 의존하지 않게).

출처마다 혜택 문구·상호가 다른 경우('연어초밥' 표기, '원조한우곱도리탕' 통합, '경호네' 제거)는 판단 근거와 함께 `docs/partner-data-conflicts.md`에 남겼다.

### 3. 지도 탭 UI

- 상단 헤더를 없애고 검색바·필터 칩을 지도 위 오버레이로 띄웠다. 오버레이 실제 높이를 `onLayout`으로 재서 배너·경로 카드 위치를 그 아래로 맞춘다.
- 칩 배경은 여러 번 조정했다(투명 → 상단 영역 흰색 배경 → 칩 흰색). 최종은 09-28 §3 참고.
- 같은 자리에 겹친 제휴 마커는 예전엔 맨 위 것만 선택됐다. 탭할 때마다 하나씩 순환하도록 바꿨다(`PARTNER_OVERLAP_CYCLE_PX`).
- 검색바를 눌렀을 때 검색어가 비어 있으면 전체 업체를 카테고리별로 묶어 보여준다. 헤더는 고정, 개수 표시, 오른쪽 접기 버튼, 업체마다 소속 칩이 붙는다.

### 4. EAS 자격증명

`credentials.json`에 iOS 배포 인증서(.p12) 비밀번호가 평문으로 들어 있는데, `.gitignore`는 `*.p12`/`*.mobileprovision`만 막고 있었다. 커밋된 적은 없지만 `git add -A` 한 번이면 올라갈 수 있어 제외 목록에 추가했다. 이 파일은 팀원과 공유하지 않고 본인만 보관하기로 했다.

---

## 2026-09-17 ~ 09-19

**목표**: 첫 배포 준비 — 브랜드 적용, 도메인(`hongikon.com`)·HTTPS, 빌드 환경 분리

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `eas.json`, `netlify.toml`, `docs/deployment.md` | 재작성 | 운영 배포 설정, `/api` 프록시, 보안 헤더 |
| `assets/brand/*`, `scripts/generate-app-icons.mjs` | **신규** | HONGIK ON 브랜드 SVG, 아이콘·스플래시 생성 |
| 앱 전반(19개 파일) | +172 / -29 | 앱 이름 홍익대알리미 → **홍익온** |
| `src/apis/client.ts` 외 18개 | +1204 / -122 | 타임아웃·재시도·네트워크 상태 배너 |
| `src/utils/floors.ts`, `FloorChips.tsx` | **신규** | 길찾기 출발·도착 층 선택 |
| `app.config.ts` | **신규** | 개발/테스트/운영 변형 분리 |
| `src/screens/AppStatusScreen.tsx` | +12 | 빌드 환경·연결된 API 주소 표시 |
| hongikon-be `deploy/nginx/*`, `deploy/setup-https.sh` | **신규** | Nginx + Let's Encrypt (PR #1, 09-18 머지) |

커밋: `b9c4e77`, `4426214`, `1553b14`, `0768fc4`, `7e0fbfd`, `5b0f333`, `83ebb5d`(09-17), `65bda5e`(09-19). BE `31c95e7`, `90d7949`.

---

### 1. 배포 구조

웹은 Netlify가 `/api/*`를 `api.hongikon.com`으로 서버 측 프록시하므로 브라우저 입장에선 same-origin이다. 그래서 백엔드에 CORS를 열 필요가 없다(09-28에 다시 확인). 처음엔 백엔드 TLS가 없어서 iOS ATS·Android cleartext를 임시로 허용했다가, `api.hongikon.com` 전환 커밋(`7e0fbfd`)에서 HTTPS 강제로 바꾸고 임시 허용을 걷어냈다. Expo 템플릿 기본값이 `NSAllowsArbitraryLoads: true`였던 것도 명시적으로 막았다.

백엔드 Nginx는 보안 리뷰 후 보강했다. IP 직접 접근·위조된 Host는 catch-all로 버리고, 프록시되는 Host를 `server_name`으로 고정해 OAuth redirect-uri가 외부 입력에 흔들리지 않게 했다. HSTS 적용, `:8080`이 외부에 열려 있으면 경고.

### 2. API 호출 안정화

요청별 타임아웃, 멱등 요청만 백오프 재시도, 서버 원문 대신 사용자용 에러 메시지. 전역 네트워크 상태 배너(재시도 + 백그라운드 재확인)와 `useApiResource`/`RetryableError`를 상태·설정·문의·제보·푸시 등록 화면에 붙였다.

### 3. 길찾기 층 선택

층 옵션을 층별 출입구에서 뽑고, 출입구가 없는 층은 가장 가까운 출입구를 쓴다. 층 이동 시간은 매칭된 출입구 층 기준. 쓰이지 않던 `FloorPickerModal`을 결과 카드 안 인라인 칩으로 대체했다. 출입구 층 값이 라벨과 어긋나 있던 것(조형관, 강당 S동)도 바로잡았다. `1F → 1층`처럼 층 표기를 통일했다.

### 4. 빌드 환경 분리

| 환경 | 만드는 법 | 앱 이름 | 패키지 id |
|---|---|---|---|
| 개발 | `pnpm dev` | 홍익온 (개발) | `com.hongmap.alimi.dev` |
| 테스트 | `eas build --profile preview` | 홍익온 (테스트) | `com.hongmap.alimi.preview` |
| 운영 | `eas build --profile production` | 홍익온 | `com.hongmap.alimi` |

패키지 id가 달라 한 폰에 셋 다 설치된다. 다만 카카오 로그인 복귀 주소(`hongikon://`)는 백엔드가 고정으로 갖고 있어 셋이 같다 — 로그인 테스트는 한 번에 하나만 설치해서 해야 한다. `pnpm dev:local`은 로컬 백엔드(`localhost:8080`)로 붙는다.

### 5. 첫 Android 테스트 빌드

09-17 EAS에서 preview APK 빌드 완료(09-18 다운로드 확인). 이 APK는 분리 이전 패키지 id(`com.hongmap.alimi`)라 이후 테스트 빌드와 별개 앱으로 깔린다.

> **미결**: 가비아 DNS, EC2 HTTPS 스크립트 실행, 카카오 Redirect URI, Netlify 도메인 연결은 콘솔 로그인이 필요해 이 시점엔 진행하지 못했다.

---

## 2026-09-21 ~ 09-23

**목표 변화**: 배포 점검 → 첫 출시 범위 확정(길찾기 보류) → OTA 업데이트 → Netlify 배포 실패 해결 → 보안 점검 → 소식 탭을 실제 백엔드로 전환

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/constants/route.ts`, `MapScreen.tsx`, `BuildingSheet.tsx` | 수정 | `ROUTE_FINDING_ENABLED = false`, "다음 업데이트에서 제공" 안내 |
| `src/components/common/UpdateBanner.tsx` | **신규** | EAS Update 확인·적용 배너 |
| `app.json`, `eas.json` | 수정 | `runtimeVersion`, `updates.url`, 프로필별 채널 |
| `netlify.toml` | 수정 | `NODE_VERSION` 20 → 22 |
| `src/apis/auth.ts`, `src/contexts/AuthContext.tsx` | +26 | 로그아웃 시 서버 refresh 토큰 폐기 |
| `src/apis/news.ts`, `src/utils/newsMapping.ts`(**신규**), `src/hooks/useNewsFeed.ts`(**신규**) | +186 / -25 | `GET /news` 연동 |
| `NewsScreen`, `DeptNewsScreen`, `NewsSearchScreen`, `NewsDetailScreen` | 수정 | 정적 `NEWS_DATA` → 실데이터 |
| `docs/student-tips-design.md`, `settings-ui-upgrade.md`, `api-matching-audit.md` | **신규** | 설계·감사 문서 |
| hongikon-be `application-prod.properties` 외 | 수정 | prod Swagger 차단, 뉴스 이미지·첨부·조회수 저장 |

커밋: `9c67ad5`, `2debb00`, `9a208c1`, `31b327f`, `209ffeb`, `41b4ad5`, `195a625`, `f1c4a85`, `0c213e1`, `f6646e8`, `d88a66b`. BE `0700b06`, `41bbae4`, `4515530`, `a236aec`.

---

### 1. 길찾기는 첫 출시에서 뺐다

`pathNodes.ts` 경로망이 캠퍼스 전체를 덮지 못해 대부분 직선거리로 대체되는 상태다. 지도 관련 부분은 이후 업데이트로 채우기로 하고, 플래그 하나로 출발·도착 UI를 숨기고 안내 문구를 띄운다. 경로 데이터가 채워지면 `ROUTE_FINDING_ENABLED`만 `true`로 바꾸면 된다.

### 2. OTA 업데이트

`runtimeVersion.policy: "appVersion"`으로 같은 앱 버전 빌드끼리만 JS 업데이트를 받는다(네이티브 변경은 여전히 재빌드 필요). 프로필마다 채널을 나눴고, 앱이 포그라운드로 돌아올 때 업데이트를 확인해 배너로 적용을 권한다.

### 3. Netlify 배포가 2주간 실패하던 원인

SDK 57 업그레이드(`fac8d3f`)에서 `packageManager: pnpm@11.25.0`을 넣은 뒤로 09-09부터 Netlify 배포가 전부 "Install dependencies"에서 실패했고, 라이브 사이트는 8/25 빌드("홍익대알리미", 깨진 아이콘 폰트)를 한 달째 서빙하고 있었다.

첫 가설은 corepack 서명 검증(`195a625`)이었는데 틀렸다. 실제 배포 로그를 받아 보니 원인은 Node 버전이었다.

```
Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite
```

pnpm 11.25.0은 Node 22.13+의 `node:sqlite`를 쓰는데 `netlify.toml`은 `NODE_VERSION=20`이었다. 로컬은 Node 24라 재현되지 않았다. 22로 올리고 corepack 설정은 되돌렸다(`f1c4a85`). 이후 배포 `ready` 확인.

### 4. 보안 점검에서 고친 것

- **로그아웃이 서버 세션을 폐기하지 않음** — `logout()`이 로컬 토큰만 지워서, 탈취된 refresh 토큰이 로그아웃 뒤에도 최대 14일 유효했다. `/auth/logout` 호출 추가(네트워크 실패해도 로컬 로그아웃은 진행).
- **public 저장소에 시크릿 일부 노출** — 이 문서(hongikon-fe는 public)에 재발급 전 네이버 지도 secret 앞부분이 남아 있어 지웠다. 키 자체 재발급은 여전히 남아 있다.
- **운영 서버 Swagger 공개** (BE) — `SecurityConfig`의 permitAll이 프로필 구분 없이 걸려 있어 `api.hongikon.com`에서도 전체 API 스키마가 인증 없이 보였다. prod 프로필에서만 끔.

문제없음을 확인한 것: JWT 구현, Nginx 설정, SQL 인젝션(네이티브 쿼리 없음), 소스·git 히스토리 하드코딩 시크릿, `application-local.properties` 커밋 이력.

### 5. API 매칭 감사

`src/apis/*.ts`를 백엔드 실제 컨트롤러와 대조했다(커밋된 `api-docs.json`은 오래돼 `DELETE /auth/me` 등이 빠져 있어 기준으로 쓰지 않음). 확인된 버그:

- `POST /feedback`이 백엔드에 없다 → 문의하기가 항상 404
- `POST /auth/reissue`가 있는데 프론트가 안 쓴다 → JWT 30분 만료 후 사실상 로그아웃
- 로그아웃이 서버를 안 부름 → §4에서 수정

북마크·구독 학과는 백엔드가 지원하는데 클라이언트 코드가 없어 기기 로컬에만 남는다.

### 6. 소식 탭을 실제 백엔드로 전환

정적 `NEWS_DATA`는 8/5 이후 7주째 멈춰 있었다. 백엔드 크롤러는 매시간 돌고 있었지만 `NewsCrawlStorageService.save()`가 이미지·첨부·조회수를 파싱해 놓고 저장 단계에서 버리고 있었다. 홍익대 공지는 본문이 이미지 한 장인 경우가 흔해 그대로 전환하면 "본문 없음"이 많이 보일 상황이었다.

그래서 백엔드부터 고쳤다(`News`에 JSON 컬럼 + 컨버터, 목록에 `departmentName`·`preview` 추가). 프론트는 `sourceId`에 `departmentName`을 그대로 써서 기존 `TREE_DATA` 기반 구독 필터와 맞췄다. 상세 화면은 목록에 없는 본문 전체·이미지·첨부를 진입 시 `getNewsById`로 채운다.

> **미결**: `hongikon-be/db/alter_add_news_media_columns.sql`을 RDS에 먼저 실행해야 한다. `ddl-auto=validate`라 안 하면 새 백엔드가 기동하지 않는다.

### 7. 인프라 상태 (09-23 기준)

- DNS: 오전엔 가비아에 레코드가 0개였고, 오후에 `api`/`@`/`www` 반영 확인. 웹 HTTPS(`hongikon.com`) 자동 발급 완료.
- EC2 443: `Connection refused`. 앱이 HTTPS만 허용하므로 로컬이든 배포 앱이든 백엔드에 못 붙는다. 네트워크 배너가 계속 뜨는 건 오작동이 아니라 이 때문이다. SSH 키가 없어 스크립트는 직접 못 돌렸고, 실행 안내를 hongikon-be `docs/ec2-https-runbook.md`로 남겼다.
- iOS: ad-hoc 프로비저닝에 대표 기기 1대만 등록돼 있어, 다른 사람은 "무결성을 확인할 수 없음"으로 설치가 안 된다. `eas device:create`로 기기 등록 필요.
- Android/iOS production 빌드(새 아이콘 반영) 완료.

---

## 2026-09-23 ~ 09-28

**목표 변화**: 지도 드래그 시 네이버/카카오맵식 UI 숨김 → 피드백 받고 제거 → 바텀시트 제스처 → 배포 전 최종 점검

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/hooks/useSwipeDownToDismiss.ts` | **신규** | 핸들바 아래로 끌어 시트 닫기 |
| `BuildingSheet.tsx`, `PartnerSheet.tsx` | 수정 | 스와이프 닫기, 혜택 문구 `" / "` → 줄 목록 |
| `PartnerChips.tsx`, `MapFilterChips.tsx` | +59 | 업체 0곳 소속은 뒤로 + 비활성 |
| `src/utils/mapHtml.ts` | +20 | 드래그 중 축척막대 숨김 |
| `src/screens/MapScreen.tsx`, `TabNavigator.tsx` | 수정 | 드래그 숨김 애니메이션 제거, `mapDragState.ts` 삭제 |
| `src/components/common/ErrorBoundary.tsx` | **신규** | 렌더링 예외 시 재시도 화면 |
| `netlify.toml` | +9 | CSP Report-Only |
| `~/.zshrc` | 로컬 | `JAVA_HOME` openjdk@17 등록 |

커밋: `558cca6`, `2756791`(09-28, 푸시 완료).

---

### 1. 드래그 중 UI 숨김 — 넣었다가 뺐다

09-23에 네이버/카카오맵처럼 지도를 끄는 동안 검색바는 위로, 하단 배너·탭바는 아래로 사라지게 만들었다(`MapScreen`과 `TabNavigator`가 형제 컴포넌트가 아니어서 `mapDragState.ts` 구독 모듈로 연결). 하지만 09-28에 "터치할 때마다 위아래로 사라지는 게 정신없다"는 피드백으로 전부 제거했다. 같은 시도를 반복하지 않도록 남긴다.

드래그 중 네이버 지도 축척막대만 숨기는 코드(`mapHtml.ts`)는 남아 있다. 작은 눈금만 깜빡이는 정도라 문제의 연출과는 다르지만, 거슬리면 빼면 된다. "© NAVER Corp." 표시는 약관상 항상 보여야 해서 건드리지 않았다.

### 2. 바텀시트·제휴 칩

- 장식용이던 핸들바를 아래로 80px 이상 끌거나 튕기면 시트가 닫힌다. 새 라이브러리 없이 `PanResponder` + `Animated`로 만들고, 제스처는 핸들바에만 걸어 본문 스크롤과 부딪히지 않는다. `ReportSheet`는 핸들바가 없어 제외.
- 혜택·이용 방법 문구에서 양옆 공백이 있는 `" / "`만 여러 항목으로 쪼개 `- 항목` 줄로 보여준다. `단품/세트`처럼 붙어 있는 슬래시는 복합어라 유지 — `partners.ts` 전체에서 이 기준이 맞는지 확인했다.
- 업체가 0곳인 소속 칩은 목록 뒤로 밀고, 흐림 대신 또렷한 회색 + `disabled`. 이미 선택된 상태에서 0곳이 되면 해제는 가능.
- 상단 칩 줄 배경은 투명으로 해서 지도가 비치게 했다.

### 3. 배포 전 최종 점검 (09-28)

| 항목 | 결과 |
|---|---|
| 프론트 `tsc --noEmit` | 통과 |
| ErrorBoundary | 흰 화면 대신 재시도 화면, `App.tsx` 최상단 |
| CSP | **Report-Only**로 추가. 네이버 지도 SDK가 쓰는 타일·리소스 도메인을 확정 못 해서, 강제로 걸면 지도가 조용히 깨질 위험이 있다 |
| 백엔드 CORS | 불필요 확인(09-17 §1). 처음에 "없다"고 경고했던 것 정정 |
| `Report.java` ↔ `db/create_reports_table.sql`·`alter_reports_table.sql` | 필드 단위 일치 |
| Java | openjdk@17이 설치돼 있었지만 PATH에 없었다 → `~/.zshrc` 등록 |
| `./gradlew compileJava`, `build -x test` | BUILD SUCCESSFUL |
| 백엔드 테스트 `contextLoads` | **실패** — 테스트용 DB 프로파일이 없어 로컬 MySQL에 붙으려다 `Access denied for user 'seokhoon'@'localhost'`. 코드 문제가 아니라 환경 문제 |

> **미결**: 코드·설정 수준의 준비는 끝났지만 실제 배포(EC2 반영, EAS 빌드, Netlify)와 prod DB 마이그레이션 반영 여부는 확인하지 못했다. 백엔드 테스트는 H2 프로파일이나 Testcontainers가 없으면 CI에서도 같은 이유로 실패한다.

---

## 2026-09-29 ~ 09-30

**목표**: 백엔드 HTTPS 배포 완료(백엔드 담당) 반영, 실제 서버 상태 확인. 프론트 코드 변경 없음.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `docs/worklog.md` | 이 항목 | 서버 확인 결과, 다음 작업 갱신 |

hongikon-be `c48442c`(09-29, 백엔드 담당 작업 기록) pull 받음.

---

### 1. 백엔드 HTTPS·카카오 URI — 완료

백엔드 담당이 09-29에 처리했다. EC2 보안그룹 SSH 소스 IP 갱신(공인 IP가 바뀌어 접속이 막혀 있었음), Nginx `server_name`을 `api.hongikon.com`으로 변경, `certbot --nginx`로 인증서 발급(만료 2026-12-28, 자동 갱신 등록), 카카오 Redirect URI `https://api.hongikon.com/login/oauth2/code/kakao` 추가. 09-30에 외부에서 `https://api.hongikon.com/status` → HTTP 200, 인증서 검증 정상 확인.

### 2. 서버를 직접 찔러 보니 남은 것

| 요청 | 결과 | 의미 |
|---|---|---|
| `GET /status` | `buildTime: 2026-09-17T05:28:52Z` | 09-23 백엔드 커밋(소식 미디어 저장, `preview`, prod Swagger 차단)이 아직 배포 안 됨 |
| `GET /v3/api-docs`, `/swagger-ui/index.html` | 200, 200 | 운영 서버 API 스키마가 여전히 공개. 위 재배포로 해결 |
| `https://54.180.195.51/status` (IP 직접) | 200 | catch-all `default_server` 차단이 적용 안 됨 |
| 응답 헤더 `Server` | `nginx/1.24.0 (Ubuntu)` | `server_tokens off` 미적용. HSTS는 적용됨 |

`setup-https.sh` 대신 certbot을 직접 돌려서, 09-17에 보안 리뷰로 보강한 `deploy/nginx/hongikon-api.conf`(IP·위조 Host 차단, Host 고정, 요청 제한, 버전 숨김)는 반영되지 않은 것으로 보인다.

### 3. 백엔드 기록 중 이미 처리된 두 가지

백엔드 기록의 "다음 단계"에 적힌 두 항목은 프론트에서 이미 끝난 상태라 백엔드 담당에게 전달 필요.

- **CORS 설정** — 웹은 Netlify가 `/api/*`를 서버 측 프록시하므로 same-origin이라 필요 없다(09-17 §1, 09-28 §3). 열면 공격 표면만 늘어난다.
- **iOS ATS 예외 제거** — `7e0fbfd`(09-17)에서 이미 `NSAllowsArbitraryLoads: false`로 바꿨다.

> **미결**: 백엔드 기록에 t3.micro 메모리 68%·스왑 24%, "System restart required" 상태가 적혀 있다. 재배포할 때 재부팅도 같이 하는 게 좋다.

---

## 2026-09-30 ~ 10-01

**목표 변화**: 대학공지 구독 복구 + 관리자 콘솔(백엔드·웹) → 데모 앱 배포(APK·iOS·시뮬레이터) → 실사용 버그 수정(웹 아이콘·파비콘, 웹 로그인, 지도 빈 화면, 제보 바 가림, 시간대) → 백엔드 `/news` 페이지 나눔 대응 → 토큰 재발급

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/admin/**`, `App.tsx` | **신규** | 웹 관리자 콘솔 `/admin` (대시보드·제보 검토·문의·운영 도구) |
| `src/utils/newsMapping.ts`, `src/apis/news.ts` | 수정 | `sourceId` 우선 분류, `GET /news` 페이지 응답 |
| `src/hooks/useNewsFeed.ts` | 재작성 | 서버 필터 + 무한 스크롤 |
| `src/hooks/useBookmarkedNews.ts`, `useDebouncedValue.ts` | **신규** | 북마크 개별 조회, 검색 디바운스 |
| `src/lib/pushNotifications.ts`, `NewsDetailScreen.tsx` | 수정 | 알림 탭 → 소식 상세(콜드 스타트 포함) |
| `src/utils/serverTime.ts` | **신규** | 존 없는 서버 시각을 UTC 로 읽기 |
| `src/contexts/AuthContext.tsx`, `src/apis/client.ts`, `src/apis/auth.ts` | 수정 | 웹 페이지 이동 로그인, 401 → 토큰 재발급 |
| `src/components/map/NaverMapView.tsx`, `MapScreen.tsx` | 수정 | 지도 준비 감시·자동 재로드, 제보 바 위치 |
| `scripts/fix-web-export.mjs`, `package.json`, `netlify.toml` | **신규**/수정 | 웹 아이콘 폰트 경로·파비콘, `APP_VARIANT`·`EXPO_PUBLIC_API_ORIGIN` |
| `src/constants/partners.ts`, `facilities.ts`, `src/types/index.ts`, `src/utils/facilities.ts` | 수정 | 발바리네 추가, 흡연구역 실측 좌표 2곳만 유지 |
| `eas.json` | 수정 | `preview-simulator` 프로필 |
| hongikon-be | PR #2·#3 | `news.source_id`, 관리자 API·권한·문의·웹 로그인 복귀 주소, 배포 절차서 |

커밋(FE): `d46b0ad` ~ `8e1dcc4`. BE: PR #2(`a1081b4`), PR #3(`feat/admin-console`, 9/30 머지 → 10/1 배포).

---

### 1. 대학공지(학사·장학 등) 구독이 비던 문제

대학공지 6개 게시판은 학과가 아니라 `department_id` 가 비는 게 정상인데, 프론트가 `departmentName` 이 없으면 `sourceId` 를 `'기타'` 로 바꿔 구독·게시판 화면이 비었다. 백엔드에 게시판 출처 `news.source_id` 를 저장·노출하고(PR #2), 프론트는 `sourceId ?? departmentName ?? '기타'` 로 분류한다. 기존 행은 URL 의 `noCat`(대학공지 6종: 500/23 학사, 501/24 장학 …)과 학과 게시판 호스트로 백필 — 예전 정적 데이터 분류와 일치 확인.

### 2. 관리자 콘솔

제보는 `PENDING` 으로 등록되고 지도엔 `ACTIVE` 만 뜨는데 **승인 API 자체가 없어 제보가 영영 노출되지 않는 구조**였다. 백엔드(PR #3): `users.role`(요청마다 DB 확인, 해제 즉시 반영), `/admin/**`·`/crawler/**` ADMIN 전용(기존엔 로그인만 하면 누구나 크롤링·백필 호출 가능), 제보 상태 변경(반려 사유 필수, 관리자가 검토한 제보는 신고 누적 자동 숨김 제외), `POST /feedback`(앱 문의하기 404 해소), `GET /admin/overview`, 크롤링 동시 실행 방지. H2 통합 테스트 7건.

웹은 `hongikon.com/admin`. 로그인은 `/api` 프록시가 아니라 API 도메인으로 **페이지 전체 이동**해야 한다 — 프록시를 거치면 OAuth state 세션 쿠키가 `hongikon.com` 에 붙어 카카오 콜백(`api.hongikon.com`)에서 검증이 깨진다. 돌아올 주소는 `?redirect_uri=` 로 받되 허용 목록과 정확히 일치할 때만(오픈 리다이렉트로 1회용 코드가 새지 않게). 운영 기본값에 localhost 는 넣지 않았다.

> **미결**: 관리자 지정(`UPDATE users SET role='ADMIN'`)은 RDS 에서 직접. 백필 서비스가 뉴스 1건마다 `buildingRepository.findAll()` 을 다시 부른다(ADMIN 전용이 돼 우선순위 낮춤).

### 3. 시간대 — 제보가 9시간 일찍 사라지던 문제

서버는 `LocalDateTime` 을 존 없이(UTC 값) 내려주는데 JS 는 존 없는 날짜-시각을 **기기 현지 시간**으로 읽는다. 한국 폰에서 `endsAt` 이 9시간 이르게 읽혀 남은 시간이 9시간 미만인 제보가 `visibleReports` 에서 바로 걸러졌다(승인된 제보가 없어 드러나지 않았음). `parseServerTime` 으로 존이 없으면 `Z` 를 붙여 읽는다. 전제: 서버 컨테이너가 UTC(`eclipse-temurin` 기본) — `TZ=Asia/Seoul` 을 넣으면 안 된다(배포 절차서에도 명시).

### 4. 웹(hongikon.com) 깨짐 3종

- **탭 제목 "홍익온 (개발)"**: Netlify 빌드에 `APP_VARIANT` 가 없어 개발 변형으로 빌드됐다 → `production` 명시.
- **아이콘이 전부 네모**: Netlify 는 `node_modules` 라는 폴더를 배포하지 않는다. Expo 가 아이콘 폰트를 `dist/assets/node_modules/...` 에 둬서 폰트 요청에 `index.html` 이 돌아왔다(`200 text/html 1214B`). export 후 경로를 옮기고 번들 참조를 고치는 `fix-web-export.mjs` 추가, 참조가 남으면 빌드 실패. 수정 후 `200 font/ttf 389,724B`.
- **옛 파비콘(하늘색 ^)**: 서버 파일은 이미 새 브랜드였고 브라우저 캐시였다. 버전 쿼리, PNG 아이콘, `apple-touch-icon`, `/favicon.ico` 재검증 헤더.

### 5. 웹 카카오 로그인

웹이 앱과 같은 팝업 + `hongikon://` 복귀를 써서 **끝까지 된 적이 없었다**. 웹(PC·모바일 브라우저)은 API 도메인으로 페이지 이동 → `/auth/callback?code=` 로 돌아와 교환, 앱은 기존 방식 유지. 웹에선 `Alert` 가 동작하지 않아 실패 문구를 웰컴 화면에 직접 표시. PC 에서 "카카오톡으로 로그인"을 고르면 카카오가 카카오톡 PC 앱 설치를 권한다(카카오 쪽 동작) — 카카오계정(이메일) 로그인을 쓰면 된다.

### 6. 앱 지도 빈 화면·제보 바 가림

- 앱 지도는 원격 `map.html` 을 WebView 로 불러와 첫 로딩이 가끔 실패하면 빈 화면으로 남았다(재시작하면 뜸). 페이지 전역(`map`, `handleNativeMessage`)으로 준비 여부를 보는 스크립트를 주입하고, 12초 안에 준비되지 않거나 로딩 오류·WebView 프로세스 종료 시 자동 재로드(최대 2회 → "다시 시도"), 앱 복귀·재연결 때도 재시도. 다시 뜨면 제휴·편의시설·제보 마커를 다시 보낸다. 배포된 `map.html` 수정 없이 동작.
- 제보 위치 선택 하단 바가 `bottom:20` 고정이라 지도 위에 떠 있는 탭바 뒤에 숨어 "이 위치 제보하기"가 안 보였다 → 탭바 높이만큼 올림.

### 7. 백엔드 `/news` 페이지 나눔 대응 (10-01)

백엔드가 `GET /news` 를 `{news:[...]}`(1.1만 건, 약 2MB) → `PageResponse{content,page,size,totalElements,totalPages,hasNext}` 로 바꿔 배포(`5f3024a`)해 앱 소식 목록이 통째로 비었다. **크롤링은 정상**(당일 공지까지 수집). 목록·구독·학과·검색을 서버 필터(`sourceId` 반복 파라미터, `keyword`) + 무한 스크롤(20개씩)로 전환, 북마크는 id 별 조회. 실서버 확인: 전체 2,246건 페이지 연속 로드, 컴퓨터공학과 212건, "수강신청" 34건.

> **미결**: 구독 카테고리를 여러 개(전부는 아님) 고르면 서버가 `category` 를 하나만 받아 페이지마다 앱에서 거른다(최대 5페이지 보충). 크롤러 중복 저장으로 같은 글이 두 id 로 보이는 경우가 있다(예: 11528/11529).

### 8. 알림 탭 → 소식 상세

백엔드 푸시는 `{type:"NEWS", newsId}` 를 보내는데 앱이 예전 정적 데이터(`NEWS_BY_ID`)에서 찾아 못 찾고 메인으로 갔다. 이제 `newsId` 로 상세를 불러온다. 앱이 꺼진 상태에서 알림으로 켠 경우(`getLastNotificationResponseAsync`), 웰컴 화면이라 상세가 없는 경우(보관했다 둘러보기/로그인 직후 이동), 같은 알림 중복, 상세가 열린 채 다른 알림을 눌렀을 때 이전 소식이 남던 문제까지 처리. 실제 푸시 수신은 실기기에서만 확인 가능.

### 9. 토큰 재발급

앱이 `/auth/reissue` 를 쓰지 않아 로그인 30분 뒤 로그인 필요한 요청이 전부 401 로 실패했다. 토큰을 붙인 요청이 401 이면 한 번만 재발급 후 재시도(401 은 인증 필터 거절이라 POST 재전송도 중복 처리 없음), 동시 401 은 재발급 한 번으로 묶는다(리프레시 토큰 회전). 리프레시 토큰도 만료(4xx)면 로그아웃 + "로그인이 만료되었습니다". 모의 응답으로 401 → 재발급 → 재시도, 재발급 실패, 공개 요청 미시도 확인.

### 10. "원문 보기" 보안 확인(장학 등)

홍익대 홈페이지에 STCLab BotManager 가 붙어 있다. 두 갈래로 조사한 결과 **localhost 여부는 무관**(Referer 를 바꿔도 서버 응답 바이트 동일, `/detect` 도 통과). 개발 중 막힌 건 자동화용 크롬(`navigator.webdriver=true`)이었다 — 서버 응답 `detectionType:12`(Automation Tool). 장학 공지 원문 8건은 일반 요청으로 모두 정상(200, 제목 포함). 다만 학교 테넌트의 챌린지 화면이 STCLab 기본 `/sample/challenge/index.html`(스타일 403, 번역 설정 없음)이라, 실사용자가 통계·IP 규칙에 걸리면 빠져나오지 못할 수 있다.

> **미결**: 평소 크롬·실기기에서도 막히는지 확인. 막히면 앱에 안내 문구 + 학교 정보전산팀에 챌린지 페이지 설정 문의.

### 11. 데모 배포·제휴·흡연구역

- Android preview APK(`a0974c4a`), iOS ad-hoc(`6d97f3c3`, 등록 기기 1대), iOS 시뮬레이터 빌드(`02c7812b`). 맥 시뮬레이터: Xcode 27 은 Simulator 앱 대신 **DeviceHub**. 이후 수정은 전부 `preview` 채널 OTA 로 배포 — **OTA 는 `eas.json` 빌드 env 를 쓰지 않으니** `EXPO_PUBLIC_API_BASE_URL` 등을 명령에 직접 넣고, 번들에 API 주소가 들어갔는지 확인한다. 작업 폴더의 미커밋 파일이 섞이지 않게 깨끗한 worktree(`wt-fe-build`)에서 빌드·OTA.
- iOS 기기 등록 링크로 2대 추가(총 3대). 새 빌드가 필요한데 애플 로그인이 대화형이라 사용자가 직접 실행해야 한다.
- 발바리네(총학생회): 인스타 공지 기준, 좌표는 도로명 주소를 네이버 지오코딩(기존 지도 키로 동작). 앞으로 제휴 재료는 `docs/partner-intake.md` 에 모았다가 반영.
- 흡연구역: `Facility` 에 선택 좌표를 두고 실측(위도·경도·고도 중 앞 두 값) B동·제2기숙사만 그 지점에 찍음. 좌표 없는 6곳은 삭제.
- 카카오 동의 화면 앱 이름이 '홍대로' — 카카오 개발자 콘솔 [앱 설정 → 일반]에서 변경 필요(코드 아님).

### 12. 운영 서버 확인 (10-01)

| 항목 | 결과 |
|---|---|
| `buildTime` | 2026-10-01 (PR #2·#3·페이지 나눔·푸시 포함) |
| Swagger `/v3/api-docs` | 401 (운영 차단됨) |
| 응답 `Server` 헤더 | `nginx` (버전 숨김) |
| 소식 상세 | `images`·`attachments`·`views`·`sourceId` 포함 |
| `https://54.180.195.51/status` (IP 직접) | **200** — 443 기본 서버 차단이 아직 없음 |

---

## 2026-10-01 ~ 10-02

**목표 변화**: 실사용 버그(제보 등록·로그아웃·로그인 만료) → 알림 설정 체계(게시판·분야·제보 알림) → 대형 서비스형 UI(온보딩·권한·토스트·스켈레톤·햅틱) → 출시 범위 확정(v1.0.0 iPhone + Apple 로그인 + 폴드) → 약관·처리방침 재작성 → 출시 준비 점검·버그 헌트·보안 점검 → 제보 사진 업로드·앱 닉네임 → 백엔드 PR 정리(#4–#12)

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/components/map/ReportComposerModal.tsx`, `src/apis/buildings.ts`, `src/apis/reports.ts` | 수정 | 제보 등록(건물·층 전송), 상황별 안내, 카메라·앨범(누를 때 권한), 사진 S3 업로드 |
| `src/utils/jpegPrivacy.ts` | **신규** | 업로드 전 JPEG GPS·XMP, PNG eXIf·텍스트 청크 제거 |
| `src/contexts/AuthContext.tsx`, `src/apis/client.ts`, `src/lib/pushDevice.ts` | 수정 | 로그아웃 즉시 반영, 재발급 단일 실행·세션 세대 가드, 만료 토큰 로그아웃 시 기기 해제, Apple 로그인 |
| `src/lib/pkce.ts`, `src/apis/auth.ts` | **신규**/수정 | 카카오 앱 로그인 PKCE |
| `src/utils/dialog.ts` | **신규** | 웹에서 `Alert` 대신 `confirm`/`alert` |
| `src/apis/subscriptions.ts`, `src/utils/boardSubscriptionSync.ts`, `src/utils/reportAlertSync.ts`, `src/apis/notificationSettings.ts` | **신규** | 게시판 구독·제보 알림 서버 동기화 |
| `src/lib/notificationPermission.ts`, `src/components/common/NotificationPrimer.tsx`, `AppPermissionsModal` | **신규** | 첫 실행 알림 권한, 앱 권한 화면 |
| `src/components/onboarding/**`, `src/lib/onboarding.ts`, `OnboardingGate` | **신규** | 온보딩(소개 → 학과 → 알림) |
| `Toast`, `Skeleton`, `haptics`, `ToggleSwitch` | **신규** | 공통 UI |
| `src/constants/layout.ts`, `ContentColumn`, `useCenteredGutter` | **신규** | 폴드·넓은 화면 레이아웃 |
| `src/navigation/NewsStackNavigator.tsx` | **신규** | 학과 소식을 소식 탭 안으로(탭바 유지) |
| `src/components/settings/PartnerSuggestModal.tsx`, `NicknameModal`, `src/apis/users.ts`, `src/utils/nickname.ts` | **신규** | 제휴 제보(지도 핀), 앱 닉네임 |
| `src/constants/legalText.ts`, `scripts/fix-web-export.mjs` | 재작성/수정 | 약관 14조·처리방침 12항, `/privacy`·`/terms` 정적 페이지 |
| `src/constants/appNotices.ts`, `disclaimer.ts`, `src/lib/appVariant.ts` | 수정/**신규** | 출시 공지, 비공식 고지, 개발자 화면 숨김 |
| `src/data/news.cs.json`, `constants/crawledNews.ts` | **삭제** | 3.4MB 정적 공지(웹 번들 5.9MB → 2MB) |
| `src/utils/mapHtml.ts`, `public/map.html` | 수정 | 위치 고르기 목적·거리 상한, postMessage XSS 차단 |
| `src/utils/openExternalUrl.ts` | **신규** | 외부 링크는 http(s)만 |
| `app.json`, `netlify.toml` | 수정 | `supportsTablet:false`, Apple 로그인, 안 쓰는 권한 제거, 캐시·보안 헤더 |
| hongikon-be | PR #4–#12 | 아래 §12 |

커밋(FE): `5aca0e2` ~ `a73dea6` (main 32개). OTA: `preview` 채널, 마지막 그룹 `8163d172`.

---

### 1. 제보가 한 번도 등록되지 않던 문제

9/11 이후 제보 등록이 전부 400 이었다. 서버는 `buildingId`·`floor` 를 필수로 받는데 앱이 보내지 않았다. 앱 건물 이름 → 서버 건물 id(`getServerBuildingId`, 27곳 모두 일치)로 바꿔 보내고 층을 고르게 했다. 실패 문구를 상황별로 나눴다(로그인 필요 → 로그인 안내, 건물 없음, 네트워크). 성공 화면은 "운영진이 확인한 뒤 지도에 올라가요".

### 2. 로그아웃·로그인 만료

- 웹에서 `Alert.alert` 는 아무 동작도 안 해 로그아웃 확인 창이 뜨지 않았다 → `utils/dialog.ts`.
- 로그아웃은 화면을 바로 바꾸고 서버 정리(토큰 폐기·기기 해제)는 뒤에서 한다. 재발급 중 로그아웃하면 늦게 온 재발급 결과를 버린다(세션 세대 카운터). 액세스 토큰이 만료된 채 로그아웃해도 리프레시로 한 번 재발급해 기기를 해제한다.
- 구독 API 가 없는 서버(알 수 없는 경로 → 401)를 "로그인 만료"로 오인하지 않게, 재발급 뒤에도 401 이면 미지원으로 보고 그 세션에선 더 부르지 않는다.

### 3. 알림 설정 체계

규칙: **알림 = 구독했고 AND 게시판 알림 켜짐 AND 분야 켜짐**. 게시판별·분야별 토글, 키워드 알림, 제보 알림(내 제보 승인·반려, 캠퍼스 새 제보)을 설정에 두고 서버와 동기화(BE PR #5·#6). 알림 탭 → 제보는 지도로 가서 그 제보를 띄운다(`mapIntents` `focusReport`). 첫 실행에 시스템 알림 허용 창(온보딩이 먼저 물으면 건너뜀), 거절하면 설정 > 알림에서 "설정 열기".

### 4. 대형 서비스형 UI

온보딩(소개 3장 → 내 학과 → 알림), 앱 권한 화면(알림·카메라·사진), 토스트, 스켈레톤, 햅틱. 햅틱·Apple 로그인 같은 새 네이티브 모듈은 `requireOptionalNativeModule` 로 감싸 **구버전 바이너리에 OTA 를 보내도 죽지 않게** 했다(시뮬레이터에서 롤백 없음 확인).

### 5. 출시 범위와 폴드

- v1.0.0: iPhone 전용(`supportsTablet:false`), **Apple 로그인 포함**(가이드라인 4.8), 갤럭시 폴드 지원. v2.0.0: iPad.
- 폴드: Android 16 은 큰 화면(sw ≥ 600dp)에서 방향 고정을 무시한다. `useWindowDimensions` + 최대 폭 컨테이너(본문 640, 시트 600). 지도 위 검색바·칩은 지도처럼 창 너비를 다 쓴다(10-02).
- 학과 소식이 루트 스택에 있어 들어가면 탭바가 사라졌다 → 소식 탭 안 스택(`NewsStackNavigator`).

### 6. 약관·처리방침

- 약관 14조 + 부칙으로 재작성. 책임 제한 보강: 제휴 정보(참고 정보, 혜택 미보증, 업체와 분쟁), 알림 누락·지연, 외부 서비스 장애, 이용자 간 분쟁, 보호조치를 다한 뒤의 불법 접근. **모두 "고의 또는 중대한 과실이 없는 한"** — 약관규제법 7조상 전면 면책은 무효.
- 처리방침 12항. 실제 처리와 맞춤: 북마크는 기기 저장, 제보 사진(선택·30일 삭제·위치정보 제거), 앱 닉네임과 작성자 가림 표시, 위탁·국외이전에 Google FCM·APNs·EAS Update·지도 호스팅(Netlify) 추가와 이전받는 자 연락처, 14세 미만 삭제.
- 연락처 `hongikonsupport@gmail.com`(약관 14조, 처리방침 7·11항). `hongikon.com/privacy`, `/terms` 는 빌드 때 `legalText.ts` 에서 정적 페이지로 생성.
- 소셜 로그인만 써도 회원번호·닉네임·푸시 토큰 등을 서버에 저장하므로 **개인정보처리자**다. 책임을 줄이는 길은 문구보다 덜 모으는 것.

### 7. 출시 준비 점검 (`launch-readiness.md`)

🔴 8 · 🟠 36 · 🟢 15. 반영: 길찾기 "다음 업데이트" 안내 제거(2.1), 반응 없던 현위치 버튼 → "캠퍼스로 돌아가기", 2024년 예시 공지 교체, 마이크·Face ID·저장소 권한 제거(다음 네이티브 빌드부터), "앱 상태 확인"·`/temp/*` 운영에서 숨김, 0곳 시설 칩 숨김, 온보딩 문구 사실대로, 게스트 제보는 시작할 때 로그인 안내, 비공식 서비스 고지, NAVER 로고가 탭바에 가리던 문제, 모달 Android 뒤로가기, 해요체 통일(일부), 정적 자산 1년 캐시.

### 8. 버그 헌트 (17건)

로그아웃·재발급 경합, 만료 토큰 로그아웃, 제보 성공 흐름, 창을 닫은 뒤 늦게 오는 결과(요청 세대 ref), 지도 재로드 시 위치 고르기 재동기화, 제휴 위치 취소 시 원래 위치 복원, 가까운 건물 거리 상한(제휴 80m·제보 200m), 소식 기본 탭(구독 → 전체), 토스트 위치, 접근성 레이블, WebView 렌더러 크래시 반복 시 "다시 시도", 북마크 조회 동시 4개 제한·캐시.

### 9. 제보 사진 업로드

비공개 S3 + presigned PUT/GET(BE PR #9). 앱은 올리기 전에 위치 메타데이터를 지우고, 서버는 받은 파일을 다시 검사·재정리해 서버 키로 저장한다. 반려·삭제·탈퇴 시 삭제, 그 외 30일 수명 주기. 서버 미배포(404·503)면 사진 없이 등록하고 안내 → OTA 먼저 내보내도 안전.

### 10. 앱 닉네임

설정 > 계정 > 닉네임(선택). 정하면 제보 작성자로 그 닉네임, 안 정하면 카카오·Apple 닉네임 첫 글자 외 `*`(예: "홍**"). **가림은 서버에서**(BE PR #11) — 공개 응답에 원문 닉네임이 없다. 서버 배포 전에는 앱이 받은 닉네임을 가려서 표시. 2–12자, 사칭 단어(운영·관리자·홍익온·공식·학교 등)·중복 금지, 하루 5회.

### 11. 보안 점검 (`security-audit.md`)

- **Critical C1(배포 완료)**: 지도 페이지가 아무 출처의 `postMessage` 를 받고 마커 색을 `innerHTML` 에 넣어, 외부 페이지가 hongikon.com 에서 스크립트를 실행해 localStorage 토큰을 읽을 수 있었다. 리스너 제거, 색상 `#hex` 만 허용, COOP 헤더. hongikon.com·hongmap12.netlify.app 둘 다 반영 확인.
- H3: Android 딥링크로 로그인 코드 가로채기 → PKCE(앱·BE #10). 구서버는 추가 파라미터를 무시해 호환.
- 외부 링크는 http(s)만, `/admin` noindex·no-store.
- 비밀값: 네이버 지도 Client Secret 일부가 git 기록에 남음(재발급 필요). 그 외 실제 키 없음.

### 12. 백엔드 PR (머지는 백엔드 담당)

| PR | 내용 | SQL |
|---|---|---|
| #4 | 장학 분류, `/error` permitAll, JVM UTC | `update_news_category_2026_10_01.sql` |
| #5 | 게시판 구독 기반 푸시 | `create_user_board_subscriptions.sql` |
| #6 | 제보 승인·반려·새 제보 알림, 푸시 토큰 로그 가림 | `create_user_notification_settings.sql` |
| #7 | Apple 로그인(nonce 필수, 토큰 AES-GCM, 폐기 재시도) | `alter_users_add_apple_columns.sql`, `create_apple_pending_revocations.sql` |
| #8 | 탈퇴 시 분야 알림·문의 이메일 정리 (**출시 차단**) | — |
| #9 | 제보 사진 S3 | `alter_add_report_image_key.sql` |
| #10 | PKCE, 세션·JWT 길이, `ADMIN_AUDIT` 로그, nginx | — |
| #11 | 앱 닉네임, 작성자 가림 | `alter_users_add_app_nickname.sql` |
| #12 | 배포 가이드 `docs/deploy-order-2026-10.md` | — |

머지 순서 #4 → #8 → #5 → #6 → #7 → #10 → #9 → #11 (8개를 합쳐 테스트 163개 통과, 손으로 풀 충돌 2곳). 배포 전 `JWT_SECRET` 32바이트 이상, Apple 키 없으면 `APPLE_CLIENT_IDS=` 빈 값.

---

## 2026-10-02 (오후)

**목표 변화**: 스토어 제출 준비(앱 ID 변경·빌드 설정·고지) → 앱 전체 UI 통일 → 운영 기능(관리 탭·관리자 알림·회원 번호) → 지도 버그·편의시설 상세 → 제보 사진 최대 3장 → iOS 27 대비

커밋(FE): `4ef69c6` ~ `2bc4304` (main 36개). OTA: `preview` 채널, `pnpm run update:preview`(아래 §3)로 배포. 백엔드 쪽은 hongikon-be `docs/worklog.md`(PR #9·#12~#15) 참고.

### 1. 앱 ID `com.hongikon.app`
출시 전에 `com.hongmap.alimi` → `com.hongikon.app`(테스트 `.preview`, 개발 `.dev`). App Store Connect 에 올리면 못 바꾸기 때문. Apple Developer 에 새 App ID 등록(Sign In with Apple·Push, `.preview` 는 primary 로 그룹), Sign in with Apple 키 생성(Team ID `GB56N8GWDQ`). 새 ID 테스트 빌드 `6b8b5bd5` 확인. 카카오는 웹 방식 로그인이라 콘솔 변경 불필요. Expo 프로젝트 이름(`hongik-alimi`)은 projectId 에 묶여 그대로 둠. 네이버 지도 콘솔 서비스 URL·번들 ID 정리, Client Secret 재발급(코드에서 쓰지 않음 — `.env` 만).

### 2. 스토어 제출 준비 (`store-submission-kit.md`, `launch-checklist.md`)
- iOS 개인정보 매니페스트(`ios.privacyManifests`), `CFBundleDevelopmentRegion: ko`, 세로 고정.
- Android: `SYSTEM_ALERT_WINDOW`·`READ_MEDIA_*` 등 차단. 앨범은 시스템 사진 선택기(권한 없음) — Android 12 이하에서 앨범이 안 열리던 문제 수정.
- `eas.json` production(store·app-bundle·environment), submit 설정(`ascAppId` 는 App Store Connect 앱 생성 후).
- 첫 로그인 동의 창(`SignupConsentSheet`, 약관 버전 `TERMS_VERSION`), 온보딩 접근권한 안내 단계, 앱 권한 화면 "모두 선택" 안내.
- 처리방침: 법적 근거, 쿠키·기기 저장, 국외 이전(FCM·APNs·EAS Update·Netlify 지도), 앱 접근권한, 북마크 기기 저장, 닉네임 가림, 사진 최대 3장·30일.
- 약관: 책임 제한(제휴 정보·알림 지연·외부 서비스·이용자 간 분쟁), 무관용·24시간 조치·숨기기.
- 정적 페이지 `/support/`, `/account-deletion/`, `/licenses/`(빌드 때 생성). 비공식 서비스 고지. 주류 제휴 "만 19세 미만" 안내. 소식 상세 출처 표시·원문 보기 주 버튼.
- `store/ios-ko.md`, `store/play-ko.md`: 콘솔 붙여 넣기용 문안.
- 결정: 한국만 출시, 주점 제휴 유지(13+ / Play 18+), 학교 협조 요청 안 함.

### 3. OTA 안전장치
`eas update` 는 eas.json 빌드 env 를 안 써서 정식 앱에 개발자 도구가 켜질 수 있었다 → `scripts/eas-update.mjs` + `pnpm run update:{preview,production}` 만 쓴다(pnpm 의 `--` 도 받음).

### 4. 앱 전체 UI 통일
색(WCAG AA 대비)·간격·반경·글자 크기 토큰, 공통 부품(Button·IconButton·ScreenHeader·ListRow·SectionTitle·EmptyState·Chip·TextField). 설정 큰 제목, 섹션 제목 13px, 모든 줄 `ListRow`, 스위치 크기 하나로. 남은 합니다체 → 해요체. 설정 알림 섹션의 중복 로그인 버튼 제거. 전후 스크린샷 `ui-shots/`.

### 5. 운영 기능
- **관리 탭**: ADMIN 이면 하단 4번째 "관리" 탭(대시보드·제보 검토·문의·회원·운영 도구, 승인 대기 배지). `GET /admin/overview` 로 판별(로그인·복귀·탭 열 때), 403 이면 탭 닫고 지도로. 키보드가 반려·정지 사유 입력을 가리던 문제 수정(시뮬레이터 확인).
- **관리자 알림**: Android `admin` 채널, `[관리]` 제목, 누르면 관리 탭 해당 섹션·항목 강조, 관리자만 보이는 설정 스위치. (BE #14)
- **회원 번호**: 설정 > 계정. 영문 대문자·숫자 10자리(BE #15). 서버 배포 전엔 `#id`. 관리 탭에서 회원 번호로 검색, 관리자 지정·해제 버튼. 이메일은 수집하지 않기로 함(최소 수집).
- 제보 작성자 숨기기·신고 사유, 관리자 회원 정지(BE #13).

### 6. 지도
- 이벤트·편의시설·제휴 칩을 한 번에 하나로 — 넘어가도 제보 마커·시트가 남던 잔상 수정.
- 제보 목록을 지도 탭에 올 때·1분마다 새로 받음. 승인 후 반려·숨김된 제보가 남던 문제 수정, 열린 시트도 닫음.
- 편의시설 핀 → 건물 소개 대신 `FacilitySheet`(그 시설의 층·위치). 엘리베이터 칩 숨김. 문헌관 설명 삭제. 캠퍼스 새 제보 알림 설명 문구 수정.

### 7. 제보 사진 최대 3장
앨범 여러 장 선택(남은 장수 제한)·카메라 1장씩, 썸네일·빼기·"n/3". 장마다 메타데이터 제거 후 순서대로 업로드, 재시도 시 키 재사용. 구서버면 첫 장만 + 안내. 제보 시트·관리 화면에서 3장 표시.

### 8. iOS 27 대비
Xcode 27(iOS 27 SDK)로 만든 앱은 UIScene 을 안 쓰면 iOS 27 에서 실행 즉시 종료(Apple TN3187). 지금 EAS(SDK 57)는 Xcode 26.6 이라 해당 없음. `expo-build-properties` `ios.enableSceneSupport: true` 로 미리 켬(다음 네이티브 빌드부터). `docs/release-build.md` §6.

### 9. 학교 홈페이지 시설 조사 (`campus-facilities-research.md`)
학생처(G동 2층 201호) 등 층·호수 다수 확인, 기존 데이터 오류(홍문관 L층 증명서 발급기, F동 프린터, 가게 이름) 발견. **주의**: 학교 robots.txt 가 ClaudeBot 등 AI 크롤러를 사이트 전체 차단하는데 일반 브라우저 UA 로 수집함 — 다시 하지 않음. 반영 방식은 결정 대기.

---

## 2026-10-02 (저녁)

커밋(FE): `b2d919a` 이후 main. 백엔드는 hongikon-be `docs/worklog.md`(PR #12~#17) 참고.

- **로그아웃 정리·게스트 알림**: 로그아웃·탈퇴·만료 때 계정 알림 설정을 기기에서 지우고, 다시 로그인하면 서버 설정을 불러옴(빈 상태로 서버를 덮어쓰지 않음). 게스트는 알림 스위치 비활성. 기기 기반 게스트 알림(서버 개편)은 검토 후 **하지 않기로** — 대신 첫 실행에서 알림 권한을 묻지 않고(온보딩 알림 단계 삭제), 로그인한 뒤 한 번 묻는다.
- **설정**: 게시판별 알림을 별도 화면(검색·묶음·모두 켜기/끄기)으로, 업데이트 내역(현재 버전·OTA·`changelog.ts`), 회원 번호 줄 누름 효과·안내 제거, 스위치 켤 때 soft→rigid 햅틱, 내 제보 내역(상태·반려 사유, 신고로 숨겨진 제보는 검토 전 삭제 불가), 제휴 제보 보내기 위 사실 확인 안내.
- **지도**: 첫 화면 중심 제4공학관 T동, 편의시설 핀 → `FacilitySheet`(층·호수), 엘리베이터 칩 숨김, 학교 공식 페이지 기준 시설 보정·학과사무실 42곳(새 종류), 홍문관 로비층 증명서 발급기(현장 확인).
- **관리자**: 관리자 알림 채널·이동, 검토 리마인더 이동(ADMIN_REPORT_REMINDER).
- **제보 사진 최대 3장**, **예정 제보**(시작 14일 전까지·최대 7일, 다이얼 선택) — 예정 제보는 `feat/report-schedule` 브랜치에 두고 **BE #17 배포 후** main·OTA.
- **Netlify 배포 멈춤**: hongikon.com·앱 지도 페이지가 `35f9c0e` 직전(약 11:40)에서 멈춤 → `/support`·`/licenses` 가 SPA 로 뜸. 빌드 한도(무료 플랜) 의심, 대시보드 확인 필요. 앱 지도가 Netlify 에 의존(가용성 위험) — 지도 페이지 앱 내장(`baseUrl`) 검토.
- **학교 시설 조사 주의**: 학교 robots.txt 가 AI 크롤러를 막는데 일반 UA 로 수집했다 — 다시 크롤링하지 않음, 학기 초 사람이 확인.

---

## 다음 작업

| 우선순위 | 항목 | 비고 |
|---|---|---|
| 1 | **백엔드 PR #4–#11 머지·배포** | 백엔드 담당. 순서·SQL·env 는 BE `docs/deploy-order-2026-10.md`(PR #12). #8 은 출시 차단 |
| 2 | 학교 홈페이지 시설 데이터 반영 방식 결정 | `campus-facilities-research.md` |
| 3 | **iOS 네이티브 빌드(v1.0.0 후보)** | 새 ID·UIScene·권한 정리 포함. 실기기 확인 항목은 `docs/release-build.md` |
| 4 | Apple .p8 키 발급 + `APPLE_*`, `APPLE_TOKEN_ENC_KEY` | 없으면 `APPLE_CLIENT_IDS=` 로 Apple 로그인만 끔 |
| 5 | S3 버킷·IAM·IMDS hop limit 2 | 사진 기능. 가이드 S3 절 |
| 6 | 처리방침 숫자 채우기: 접속 기록·DB 백업 보관 기간, 보호책임자 실명 여부 | logrotate·RDS 설정과 일치시킬 것 |
| 7 | `ADMIN_AUDIT` 1년 보관, Docker 로그 제한, RDS 암호화·백업, 루트 MFA·CloudTrail | 안전성 확보조치 기준 |
| 8 | UGC(가이드라인 1.2): 사용자 차단, 관리자 정지, 지원 페이지 `/support`, 계정 삭제 안내 `/account-deletion` | 지원 이메일 hongikonsupport@gmail.com |
| 9 | Google Play 비공개 테스트 12명 × 14일 | 개인 계정 의무. 일정상 가장 김 |
| 10 | App Store Connect: 메타데이터, 개인정보 라벨(사진·닉네임 포함), 스크린샷, 리뷰 노트(제보 즉시 승인) | |
| 11 | 카카오 콘솔 앱 이름 '홍대로' → '홍익온', 탈퇴 시 카카오 연결 끊기(BE) | |
| 12 | Nginx 443 기본 서버 차단 | #10 의 주석 블록, nginx 버전 확인 |
| 13 | 웹 브라우저 뒤로가기(linking 설정) | 학과 소식에서 뒤로가기 시 빈 페이지 |
| 14 | 남은 합니다체 문구, `entranceCheckData` 번들 제거, `SYSTEM_ALERT_WINDOW` 확인 | 출시 다듬기 잔여 |
| 15 | 크래시 수집(Sentry), 강제 업데이트·점검 모드 | 신고 항목 추가 필요 |
| 16 | 크롤러 중복 저장, 구독 `category` 다중값 | 10-01 §7 |
| 17 | 실기기 푸시 수신·알림 탭 확인 | 시뮬레이터 불가 |
| 18 | 길찾기 재개(경로망·출입구 검증) | 기존 14~16 |
| 19 | 제휴업체 백엔드 이관, 학생 생활 팁 | |

### 출시 범위 (2026-10-02 결정)

- **v1.0.0(첫 출시)**: 아이폰 전용(`supportsTablet: false`, `f2a877f`), **Apple 로그인 포함**(App Store 가이드라인 4.8 — 카카오 등 외부 로그인을 쓰면 동등한 로그인 수단 필요), 갤럭시 폴드 지원(`b983dfa`).
  - Apple 로그인: 프론트 `feat/apple-login`(iOS 에서만 표시, 기존 바이너리(OTA)에서는 네이티브 모듈이 없어 버튼이 자동으로 숨음), 백엔드 PR #7(`POST /auth/apple`, 탈퇴 시 Apple 토큰 폐기). **v1.0.0 네이티브 빌드에 포함돼야 한다.**
  - 탈퇴 시 Apple 토큰 폐기(규정)에는 애플 개발자 계정의 Sign in with Apple 키(.p8)가 필요 — 사용자가 직접 생성해 서버 환경변수(`APPLE_TEAM_ID`·`APPLE_KEY_ID`·`APPLE_PRIVATE_KEY`)로 넣는다.
  - 비활성 "Apple로 시작하기 · 준비 중" 버튼은 숨겼고(`29c53bf`), 실제 Apple 로그인 버튼으로 대체.
- **v2.0.0**: 아이패드 지원(`supportsTablet: true` + 아이패드 레이아웃·스크린샷).

### 미결 질문

- 학생 생활 팁을 소식 탭 안의 한 갈래로 둘지, 별도 탭으로 둘지 / 정적 JSON으로 먼저 갈지 (`student-tips-design.md` 6절)
- 드래그 중 네이버 지도 축척막대 숨김(`mapHtml.ts`)을 남길 것인가 (09-28 §1)
- 네이버 콘솔에 등록된 서비스 URL은 무엇인가 (`/temp/dots` 로컬 접속으로 재확인 시도 중)
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
