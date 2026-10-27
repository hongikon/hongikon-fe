
- (저녁) 최신 학교 공지 기준으로 기존 안내 바로잡기(운영진 요청): `scripts/ask/fixes.py` 새 표 — gen.py 가 학교 페이지에서 옮긴 문구 중 최신 학사 공지와 어긋나는 것을 (옛 문구 → 새 문구)로 바꾸고, 옛 문구가 사라지면 멈춘다.
  - 군입대휴학 '입영일 전일까지' → '입영일까지'(공지 2052·2068·2093), 개강 뒤 전역자 증빙은 서울 구글 설문·세종 이메일(2093), 휴·복학 공지 시기 1월·7월 중순~말(2026-2는 7.13).
  - 분납 미납: 1회차는 일시납 전환·2~4회차만 미등록 제적(2071·2049). 은행 창구는 신한은행만(2066).
  - 학기재수강 FAQ: 방문 접수 → 클래스넷, '직전학기만' → 지우려는 학기부터 최근 학기까지 연이어, 신청기간 1~2월·7~8월, 수업연한 8·10학기(2089·1900).
  - 분반 정정: 교원 승인 확인 뒤 기존 분반 철회해야 반영(2076). 수강철회 '정정기간 이후 2~3일' → '1~3일(2026-2는 9.8 하루)'(2078).
  - 손으로 쓴 휴학 안내(askAnswers.ts)도 같은 기준으로: 군휴학 마감, 공지 시기·위치, 추가 휴학 기간(2026-2 9.11~9.16).
  - test-routing 2692/2692, tsc 통과.
- (밤) 이어 묻기: 낱말 찾기(서버 답이 없을 때)와 서버에 넘기는 후보(hint)가 앞 대화를 본다(AskChat `followUpMatch`). 앞 질문과 합쳐 다시 찾고, 그래도 없으면 이어 묻는 말투('어떻게', '신청', '서류' …)의 짧은 질문(공백 빼고 20자 이하)은 바로 앞에 본 안내로 간다. '학생포상 신청' → '어떻게 신청해?'가 엉뚱한 부서로 가던 것(운영 /dev/ask).
  - 원인 확인: 운영 서버 POST /ask/route 가 키 없이 404 — 운영 .env 에 ASK_DEV_KEY_SHA256 이 없어 서버 답이 꺼져 있고, 운영 /dev/ask 의 답은 모두 낱말 찾기였다(로컬은 같은 요청에 403). 서버 답은 앞 대화 3턴을 이미 쓴다(로컬에서 학생포상 3턴 이어 묻기 확인).
- (밤) 서비스 전체 정합성 점검(운영진 요청) — 에이전트 4개가 분야별(학사·돈/장학·생활/시설·국제/부속기관)로 안내끼리·안내 대 최신 공지를 비교하고, 1개가 낱말 찾기 충돌(질문 약 650개)을 찾았다. 다른 에이전트가 근거를 다시 확인해 맞는 것만 고쳤다.
  - 내용: 82건 중 49건 고침(`scripts/ask/fixes.py` '10-25 정합성 점검 2차' 블록 + askAnswers.ts 문구), 29건 보류(전화번호·매달 바뀌는 예약 링크·원문끼리 다르고 공지가 없어 학교 확인 필요), 4건 버림. 주요: 군휴학 소급(입영일 지나면 이메일), 학기초과자 0학점은 수료생만 일괄 등록(미수료생 미등록 제적), 학생증 수령(신한은행 홍문관 지점·문자 후 1개월), 교직원식당 식권 10.30까지, 출석인정 클래스넷 전산 신청(2026-2), 교환학생 내부선발 시기·서류 100%·5지망, 버디 20만원·10시간, 현장실습 학점, 장학 봉사 10시간, 분납·대출·납부확인서 세부.
  - 낱말 찾기: 41개 질문 바로잡음(entries 만). '재학생 증명서'→증명서, '3주차'→주차장 아님, '도서관 책 연장'→대출 연장, '졸업 연기하면 등록금'→졸업유예, '컴공 학생회'→공대 학생회 등. 기존 정답 2줄 변경('기숙사 에어컨'→기숙사 냉난방, '인터넷 강의'→사이버강좌). test-routing 2738/2738.
  - 학과 공지 정답표 `scripts/ask/cases-dept/dept.json`(40문항, 23개 게시판).
  - 평가(로컬): 기준 정답표 29 → 31/32, 학과 공지 정답표 23 → 35~36/40, 범위 21/21 거절·잘못 거절 0.
  > **미결(학교 확인 필요)**: 재무팀 등록금 번호(안내 3139 vs 공지 3137·3138·1069), 세종 학자금대출 번호, 외국인 휴학·제적 시 출국 14일 vs 30일, 기숙사 입사 기한 7일 vs 10일, 반입 전자제품, 사이버강좌 '교양만 2과목' vs '최대 2과목' 등 25건 — 목록은 scratchpad audit 결과.
  > **남은 구조 문제**: 낱말 찾기 점수가 같으면 앞 흐름이 이긴다(library·dorm·grades·classes 같은 넓은 흐름이 이김). officeAsk.ts 동점 처리 변경은 따로.

---

## 2026-10-26

**목표**: 근처 제휴 알림 A~C단계(`docs/nearby-partner-alert-impl-plan.md`) — 서버 필드, 판단 규칙, 앱 안 "내 주변 제휴". 백그라운드 알림(D)은 아직.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/lib/nearbyPartners/rules.ts` | 신규 | 판단 규칙(대상 업체, 가까운 19곳, 머무름·재진입 3분, 밤 시간·하루 횟수, 이미 반경 안, 여러 곳 묶기) |
| `src/lib/nearbyPartners/copy.ts` | 신규 | 알림 문구("(광고)", 수신 거부 줄, 소속 혜택, "N곳 더") |
| `src/lib/nearbyPartners/platform.ts` · `platform.web.ts` | 신규 | 위치 한 번 읽기(앱: expo-location, 웹: 브라우저) |
| `src/components/map/NearbyPartners.tsx` | 신규 | 지도 검색 맨 위 "내 주변 제휴"(500m, 10곳) |
| `src/components/map/PartnerSearchModal.tsx` | +2 | 위 블록 넣기 |
| `src/admin/screens/PartnersScreen.tsx` · `src/admin/mock.ts` | 수정 | 관리자 "근처 알림 대상" 토글·배지 |
| `src/types/index.ts` · `src/apis/mapData.ts` | 수정 | `Partner.nearbyAlert`, `MapData.nearbyAlertsEnabled` |
| `src/constants/legalText.ts` | 수정 | 처리방침: 위치(앱 사용 중) 추가, "GPS 수집 안 함" 문장 교체 |
| `app.json` · `package.json` | 수정 | expo-location 57.0.22 + 한국어 권한 문구(백그라운드 끔), `pnpm test` |
| `scripts/test/*` | 신규 | Node 내장 테스트 로더 + 규칙 테스트 12개 |

커밋 전.

### 1. 구버전 바이너리 보호
runtimeVersion 이 appVersion(1.0.0)이라 이 JS 가 OTA 로 예전 빌드에 가면 ExpoLocation 네이티브 모듈이 없다. `appleAuth.ts`와 같이 `requireOptionalNativeModule('ExpoLocation')` 이 있을 때만 `require` 하고, 없으면 "내 주변 제휴"를 그리지 않는다. 위치 권한·문구는 새 네이티브 빌드에서만 생긴다.

### 2. 확인
- `pnpm test` 12/12, `tsc --noEmit` 통과.
- `expo config --type introspect`: iOS NSLocation* 한국어 3개, Android COARSE·FINE 만(BACKGROUND 없음), UIBackgroundModes location 없음.
- `pnpm build:web` 성공. 웹 번들에 ExpoLocation 없음, 브라우저 geolocation 사용.
- 서버(hongikon-be, 같은 날): `./gradlew test` 668/668. 운영 배포 전 `db/alter_partners_nearby_alert_2026_10_26.sql` 필요(be worklog).

> **미결**: 실기기 확인(권한 거부·설정 열기·위치 꺼짐) 아직. 처리방침 적용일(14항 "2026년 10월 6일")은 출시일이 정해지면 바꾸고 7일 전 공지. 광고성 정보 수신 동의 문구는 D단계에서.

---

## 2026-10-27 · 근처 제휴 기기 테스트

**목표**: "내 주변 제휴"(C단계) 실기기 대신 Android 에뮬레이터로 자동 테스트하고, 안 되는 부분 고치기.

이 맥 미니에는 Xcode 가 없어(Command Line Tools 만) iOS 시뮬레이터는 못 썼다. Android 에뮬레이터(Android 36, arm64)를 깔고 preview APK 를 로컬 빌드해(`builds/hongikon-preview-1027b.apk`) adb 로 화면을 읽고 눌러 시나리오를 돌렸다.

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/lib/nearbyPartners/platform.ts` | 수정 | 위치 얻는 순서(Wi-Fi·기지국 5초 → 최근 위치 2분 → GPS 10초), 정확도 개선 창 끔, 권한 읽기·묻기, Android 위치 켜기, 개발 빌드 실패 로그 |
| `src/lib/nearbyPartners/platform.web.ts` | 수정 | 같은 이름 내보내기(웹은 없음) |
| `src/components/map/NearbyPartners.tsx` | 수정 | 상태를 검색 창이 들고 있게, 설정에서 돌아오면 자동으로 찾기, 문구, 위치 켜기 버튼, 500m 안에 없으면 가장 가까운 1곳 |
| `src/components/map/PartnerSearchModal.tsx` | 수정 | "내 주변 제휴" 상태 보관, 창 닫으면 지움 |
| `src/components/onboarding/PermissionNoticeStep.tsx` | 수정 | 앱 접근권한 안내에 위치 추가 |
| `src/components/settings/AppPermissionsModal.tsx` | 수정 | 설정 > 앱 권한에 위치 줄과 상태 |

커밋 전.

### 1. 1차 테스트에서 찾은 문제

| # | 문제 | 원인 |
|---|---|---|
| 1 | 온보딩 "앱 접근권한 안내"가 "위치 권한은 요청하지 않아요" | 처리방침만 고치고 안내 화면 두 곳(온보딩, 설정 > 앱 권한)을 빠뜨림 |
| 2 | 누를 때마다 Google "위치 정확도 개선" 창 | `getCurrentPositionAsync` 의 `mayShowUserSettingsDialog` 기본값이 켜짐 |
| 3 | "위치를 확인하지 못했어요"로 실패 | Balanced(Wi-Fi·기지국) 하나만 써서, 그 위치가 없거나 위 창에서 "괜찮습니다"를 누르면 통째로 실패. 에뮬레이터에서 `dumpsys location` 으로 GPS 요청이 OFF 인 것 확인 |
| 4 | 실패 이유를 알 수 없음 | `catch` 가 오류를 삼킴 |
| 5 | 한 번 거부 뒤 문구는 "설정에서 바꾸세요"인데 버튼은 "다시 시도" | 문구가 canAskAgain 을 안 봄 |
| 6 | 설정에서 허용하고 돌아와도 "꺼져 있어요" 그대로 | 앱 복귀를 듣지 않음 |

코드 검토로 더한 것: 캠퍼스에서 먼 곳이면 "없어요"로 끝남 → 가장 가까운 1곳과 거리, Android 위치 서비스 꺼짐에 "위치 켜기", 검색어를 쳤다 지우면 결과가 사라짐 → 검색 창이 상태 보관.

### 2. 2차 테스트(고친 APK, 새로 설치)

8개 시나리오 모두 통과: 온보딩 위치 항목, 한 번 거부 문구, 두 번 거부 → 설정 열기 → 허용하고 돌아오면 자동으로 목록(50m~170m, 10곳), 정확도 개선 창 안 뜸, 검색어 쳤다 지워도 유지, 잠실에서 "500m 안 없음 + 베스트 검진센터 강남점 5.4km", 위치 끔 → 위치 켜기 → 다시 찾음, 목록 줄 → 지도 시트(에그섬), 설정 > 앱 권한 "네 가지 · 위치 허용됨". logcat 에 JS 오류·크래시 없음. `pnpm test` 12/12, tsc, `pnpm build:web` 통과(웹 번들에 ExpoLocation 없음).

> **미결**: iOS 는 처음엔 Xcode 가 없어 못 봤다가 같은 날 확인(아래 3). 예전 바이너리(위치 모듈 없음)에 OTA 로 갔을 때 숨겨지는지는 그런 빌드가 없어 코드로만 확인. 최근 위치(2분) 대신 쓰는 탓에 2분 안에 크게 움직이면 옛 위치로 보일 수 있음(에뮬레이터처럼 Wi-Fi·기지국 위치가 없는 기기에서만).

### 3. iOS 시뮬레이터(같은 날)
Xcode 27.1 설치 뒤 preview-simulator 빌드를 iPhone 18 Pro(iOS 27.1)에 깔고 XCUITest 로 같은 흐름을 돌렸다. 온보딩 위치 항목, 거부 → 바로 "설정 열기"(iOS 는 한 번 거부하면 다시 묻지 않음), 허용 → 홍대 정문 근처 10곳(50m~), 줄 → 에그섬 시트, 잠실 → 가장 가까운 곳(km), 설정 > 앱 권한 "네 가지 · 위치 허용됨" 모두 통과. iOS 권한 창에 app.json 의 한국어 설명이 그대로 나옴.
> **미결(이번 기능과 별개, 기존 문제)**: iOS 첫 실행 온보딩에서 아이콘(방패·권한 줄 아이콘·뒤로 화살표)이 모두 빈 칸으로 보임. Android 는 정상이고 iOS 도 지도·검색 화면 아이콘은 정상 — 온보딩 때 아이콘 글꼴이 아직 안 불러와진 것으로 보임.

---

## 2026-10-27

**목표**: 제보 종료 시각 자동 맞춤, 검색으로 연 시설 시트가 잘려 보이던 것과 스크롤하다 줄이 눌리던 것(운영진 지적).

### 변경된 파일

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/components/map/ReportScheduleFields.tsx` | 수정 | 종료 시각을 먼저 고른 뒤 시작을 옮겨 그 종료를 쓸 수 없게 되면, 'N시간 뒤' 칩으로 돌리지 않고 원래 진행 시간만큼 새 시작 뒤로 자동으로 맞춘다(제보 시간 수정 창과 같은 동작). 맞췄을 때 요약 아래 한 줄로 알린다 |
| `src/hooks/useResizableSheet.ts` | 수정 | `useSheetSizing` 에 `openAt`('small' 기본 / 'mid') — 처음 열 크기 |
| `src/components/map/FacilitySheet.tsx` | 수정 | 검색으로 찾아온 줄이 있으면 보통 크기로 연다(작게 22%로 열고 그 줄을 맨 위로 올려, 학과사무실·행정 부서 줄과 안내가 반쯤 잘려 보였다). 행정·지원 줄은 `SheetTouchable` |
| `src/components/map/SheetScrollBody.tsx` | 수정 | `SheetTouchable`·`useSheetPress` — 누른 뒤 8px 넘게 움직였거나 스크롤이 멈춘 지 120ms 안이면 줄 누르기로 치지 않는다. 시트 끌기 넘김 때문에 스크롤이 JS 응답자를 맡지 않아(disableScrollViewPanResponder), 스크롤해도 줄의 누르기가 취소되지 않았다 |
| `src/components/map/BuildingSheet.tsx` | 수정 | '건물 안 시설' 줄도 `SheetTouchable` |

- 검증: `tsc --noEmit` 통과. 화면 확인은 운영진(웹 localhost:8081, 앱).
- 운영(main)에는 아직 10-22 '시작을 바꿔도 고른 종료 유지'(2aea1b6)도 없다 — dev→main 때 같이 나간다.
- 지도 핀을 누르면 확대하지 않고 지금 배율 그대로 가운데(시트 위)로만 옮긴다(운영진 요청 — 누를 때마다 19까지 들어갔다). `focusOn` 은 배율을 넘겨받을 때(검색·알림·미리보기)만 확대한다. `src/utils/mapHtml.ts`·`public/map.html`(앱이 원격으로 불러오는 페이지라 main 배포 때 Netlify 로 앱에도 바로 적용) 같이 고침. 건물 시트의 '건물 안 시설'도 확대 없이(`MapScreen` openFacilitySheet — 검색일 때만 FOCUS_ZOOM).
- 캠퍼스 밖(홍대 생활권) 제보(운영진 요청, 서버 7eecd12 와 짝): 학교 건물 200m 밖이라도 캠퍼스 중심 2.5km(`REPORT_OFF_CAMPUS_MAX_METERS`, 지도 범위와 같다) 안이면 제보할 수 있다. 건물·층 없이 올리고 장소 설명이 필수(비우면 '캠퍼스 밖 제보는 장소를 적어 주세요'). 층 다이얼 대신 안내 상자, 장소 칸 자리표시 '예: 홍대입구역 9번 출구 앞'. 2.5km 밖은 올릴 수 없다고 안내.
  - 위치 고르기 아래 줄: 건물 근처가 아니면 좌표 대신 '캠퍼스 밖 · 다음 화면에서 장소를 적어 주세요' / '캠퍼스에서 2.5km 밖은 제보할 수 없어요'.
  - `CreateReportInput.buildingId`·`floor` 선택. 내 제보 내역·관리자 제보 목록은 건물이 없으면 장소 설명을 보여 준다(관리자는 '캠퍼스 밖 · ○○'). 제보 시트·HOT 목록·공유는 이미 장소 설명을 먼저 쓴다.
  - 운영 반영 순서: 서버 DB SQL(`hongikon-be/db/alter_report_building_nullable.sql`) → 서버 배포 → 앱(OTA). 앱만 먼저 나가면 캠퍼스 밖 제보가 서버에서 400.
- 흡연구역 칩 다시 보이기(운영진이 11곳 좌표를 정리, 서버 `db/sync_facilities_2026_10_27_smoking.sql`): `MapFilterChips` 숨김 목록에서 빼고, 정보 제보 시설 종류에도 넣는다. 칩·시트 아이콘이 Ionicons `logo-no-smoking`(금연 표시, 뜻이 반대)이라 MaterialCommunityIcons `smoking`(사선 없는 담배, 지도 핀과 같은 모양)으로 바꿨다(`FacilityIconName`·`KindIcon`).
