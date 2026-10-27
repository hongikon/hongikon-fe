# 근처 제휴 알림 — 구현 구조

작성일: 2026-10-26 · 기획 문서: [nearby-partner-alert-plan.md](./nearby-partner-alert-plan.md)

기획 문서가 "무엇을, 어떤 규칙으로"를 정했다면, 이 문서는 "어느 파일에 어떤 순서로"를 정한다. 숫자(100m, 5분, 하루 2번 등)와 법·심사 판단은 기획 문서를 따르고 여기서 다시 적지 않는다.

## 전체 흐름

```
[서버] GET /map/data
   partners[].nearbyAlert, nearbyAlertsEnabled(긴급 끄기)
        │  (앱을 열 때 · 지도 데이터 새로 받을 때)
        ▼
[앱, 포그라운드] useNearbyPartnerAlerts
   ├─ 긴급 끄기면 → 지오펜스 전부 해제
   ├─ 대상 업체 고르기(rules.pickTargets) → 기기에 스냅샷 저장(store)
   └─ 현재 위치 → 가까운 19곳 + 큰 원 1개 등록(geofences.sync)
        │
        ▼
[운영체제] 지오펜스 진입·이탈 이벤트 (앱이 꺼져 있어도)
        ▼
[앱, 백그라운드] task.ts (index.ts 최상단에서 정의)
   ├─ 업체 진입 → rules.decideOnEnter(스냅샷, 기록, 지금 시각) → 5분 뒤 로컬 알림 예약 `nearby-<id>`
   ├─ 업체 이탈 → 예약 취소(재진입 3분 규칙)
   └─ 큰 원 이탈 → 마지막 위치로 다시 19곳 등록
        ▼
[알림 탭] pushNotifications → notificationRouting 'partner' → mapIntent focusPartner → 지도 업체 시트
```

위치 좌표는 이 흐름 어디에서도 서버로 가지 않는다. 서버로 가는 것은 "알림 받기 켬/끔"과 광고성 정보 수신 동의 시각뿐이다.

## 앱 파일 구조

새 폴더 `src/lib/nearbyPartners/` 하나에 모은다. 판단(순수 함수)과 부작용(위치·알림·저장)을 파일 단위로 나눠, 판단 로직은 기기 없이 테스트한다.

| 파일 | 역할 | 의존 |
| --- | --- | --- |
| `rules.ts` | 순수 함수만. `pickTargets(partners, affiliation, today)`, `pickNearest(targets, lat, lng, 19)`, `decideOnEnter(partnerId, history, now)` → `{ schedule: boolean, reason }`, `isQuietHour(now)`, `onExit(...)` | 없음(`utils/geo.haversineMeters`만) |
| `store.ts` | 기기 저장: 켬 여부, 고른 소속, 대상 업체 스냅샷(id·이름·혜택·좌표·소속), 알림 기록(업체별 마지막 시각·오늘 개수), 진입 시각 | AsyncStorage. 백그라운드에서도 읽혀야 하므로 React 컨텍스트를 거치지 않는다 |
| `geofences.ts` | `syncGeofences(snapshot, location)`: 19곳 + 큰 원으로 `Location.startGeofencingAsync` 다시 걸기. `stopGeofences()` | expo-location |
| `task.ts` | `TaskManager.defineTask(NEARBY_TASK, ...)`. 이벤트를 받아 `rules` 판단 후 `Notifications.scheduleNotificationAsync` / `cancelScheduledNotificationAsync` | expo-task-manager, expo-notifications, store, rules, geofences |
| `copy.ts` | 알림 제목·본문 만들기("(광고) 근처에 제휴업체가 있어요", 업체명 — 혜택). 소속별 혜택(`affiliationBenefits`)이 있으면 그 문구 | rules 와 같은 순수 함수 |
| `platform.ts` / `platform.web.ts` | 권한 요청·상태, 지오펜스 등록·해제, 설정 화면 열기, `capabilities`. 플랫폼별 내용은 아래 "플랫폼별 구성" | expo-location |
| `useNearbyPartnerAlerts.ts` | 앱 켤 때 한 번 쓰는 훅(`usePushNotifications` 옆). 지도 데이터가 바뀌면 스냅샷 갱신·재등록, 긴급 끄기 확인, 로그아웃·탈퇴 때 `disableAndWipe()` | 위 전부 + `useMapData`, `useAuth` |
| `index.ts` | `disableAndWipe()` 등 밖에서 쓸 것만 내보냄 | — |

기존 파일 수정:

| 파일 | 변경 |
| --- | --- |
| `index.ts`(앱 진입점) | 맨 위에 `import './src/lib/nearbyPartners/task'`. 앱이 꺼진 채로 깨어날 때도 작업이 정의돼 있어야 함 |
| `App.tsx` | `useNearbyPartnerAlerts()` 호출(`usePushNotifications` 바로 옆) |
| `app.json` | expo-location 플러그인: iOS `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, Android `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`. `isIosBackgroundLocationEnabled`·포그라운드 서비스는 켜지 않는다 |
| `src/types/index.ts` | `Partner.nearbyAlert?: boolean`, 지도 데이터 `nearbyAlertsEnabled?: boolean` |
| `src/utils/notificationRouting.ts` | `data.type === 'NEARBY_PARTNER'` → `{ kind: 'map', focusPartnerId }` |
| `src/lib/pushNotifications.ts` | 'map' 분기에서 `focusPartnerId`가 있으면 `requestMapIntent({ type: 'focusPartner', partnerId })` |
| `src/lib/mapIntents.ts` | `MapIntent`에 `{ type: 'focusPartner'; partnerId: string }` 추가. 지도 화면에서 처리 |
| `SettingsScreen` | 설정 > 알림에 "근처 제휴 알림" 스위치 + 소속 고르기. 켜면 안내 화면으로 |
| 새 화면 `NearbyAlertPrimer` | 기존 `NotificationPrimer`와 같은 모양. 설명, 서버 미전송, 소속, 광고성 정보 수신 동의 체크 |
| 로그아웃·탈퇴 처리(`AuthContext.logout`, `accountData`) | `disableAndWipe()` 호출 |
| `src/constants/legalText.ts` | "위치(GPS)는 수집하지 않습니다" 문장 교체, 선택 접근권한에 위치(항상) 추가. 기획 문서의 초안 문구 사용 |

## 서버 구조 (hongikon-be)

| 변경 | 위치 | 비고 |
| --- | --- | --- |
| `partners.nearby_alert BOOLEAN NOT NULL DEFAULT FALSE` | `Partner` 엔티티, `db/alter_partners_nearby_alert_2026_xx.sql` | 운영은 `ddl-auto=validate`라 SQL 먼저 실행. 기본 꺼짐 → 관리자가 고른 업체만 |
| `MapPartner.nearbyAlert` | `mapdata/dto/MapPartner.java` | true일 때만 내보냄(NON_NULL 패턴 유지) |
| 긴급 끄기 `nearbyAlertsEnabled` | `GET /map/data` 응답 최상위 | 앱이 어차피 받는 응답이라 새 API가 필요 없음. 값은 application properties 또는 설정 테이블 |
| 관리자 토글 | `AdminMapPartnerRequest`, FE `admin/screens/PartnersScreen.tsx` | "근처 알림 대상" 체크 |
| 광고성 정보 수신 동의 | `/users/me/notification-settings`에 `partnerAdConsentAt`(동의 시각, null=미동의) | 정보통신망법 2년 재안내에 시각이 필요. 탈퇴 시 함께 삭제 |
| 런북·worklog | `docs/deploy-runbook-nearby-alert.md`, `docs/worklog.md` | `deploy-runbook-partner-ends-on.md`와 같은 형식 |

## 반경, 가만히 있을 때, 여러 업체가 겹칠 때

(2026-10-26 질문 정리. 규칙은 `src/lib/nearbyPartners/rules.ts`, 테스트는 `scripts/test/nearbyPartnerRules.test.ts`.)

### 반경은 몇 m로

| 쓰는 곳 | 반경 | 이유 |
| --- | --- | --- |
| 업체 하나의 알림 영역 | 100m | iOS는 이보다 작게 잡아도 사실상 100~200m로 동작한다. 실내 GPS 오차도 수십 m라, 홍대 앞처럼 가게 사이가 10~20m인 곳에서는 줄여도 가게 단위로 구분되지 않는다. 늘리면 지나가는 사람에게 오탐이 는다 |
| 다시 고르기 큰 원 | 500m | 벗어나면 가까운 19곳을 새로 등록. 신호가 몇 분 늦을 수 있어 너무 작게 잡지 않는다 |
| 앱 안 "내 주변 제휴" | 500m, 최대 10곳 | 걸어서 6~7분. 위치 오차가 150m를 넘으면 "실제 거리와 다를 수 있어요"를 보여 준다 |

100m 원 안에 들어왔다고 그 가게 안이라는 뜻은 아니다. 그래서 알림 문구는 "근처에 있어요"로 하고 "○○에 계신가요?"는 쓰지 않는다.

### 가만히 있을 때(GPS가 움직이지 않을 때)

운영체제는 영역 경계를 넘을 때만 알려 준다. 그래서 "가만히 있다"를 따로 감지하지 않고, 아래처럼 처리한다.

| 경우 | 처리 |
| --- | --- |
| 들어와서 가만히 머묾 | 진입할 때 5분 뒤 알림을 예약하고, 나가는 신호가 오면 취소한다. 가만히 있으면 나가는 신호가 없어 예약이 그대로 남아 5분 뒤 뜬다. 이게 "머무름" 판단이다 |
| 이미 가게 안에 앉은 채로 기능을 켜거나, 업체를 바꿔 등록함 | 경계를 넘지 않았으니 진입 신호가 안 올 수 있다. 등록할 때 읽은 위치로 반경 안 업체를 직접 "지금 들어옴"으로 처리한다(`insideAtRegistration`). 운영체제도 진입을 알려 주면 이미 머무는 중인 업체라 무시한다 |
| 가만히 있는데 GPS가 흔들려 경계를 들락날락 | 나간 지 3분 안에 다시 들어오면 같은 머무름으로 본다(`stayStartedAt`). 예약은 업체마다 하나만 두고, 업체당 하루 1번이라 여러 번 오지 않는다 |
| 카페에 3시간 머묾 | 하루 1번 제한이라 처음 한 번만 |
| 위치가 오래됨(실내, 신호 약함) | 마지막 위치는 2분 안, 오차 200m 안일 때만 쓴다. 아니면 새로 읽고, 그것도 실패하면 기존 등록을 그대로 둔다 |

### 근처 업체를 다 알려야 하나

아니다. 알림 한 번에 한 곳만 이름을 내세우고, 나머지는 "근처에 제휴업체 N곳이 더 있어요" 한 줄로 묶는다(`alertGroup`, `copy.ts`).

- 내세울 곳은 그중 가장 오래 머문 곳이다. 지나쳐 온 가게는 먼저 벗어나므로, 실제로 들어간 가게일 가능성이 가장 높다.
- 오늘 이미 알린 업체는 묶음에서도 뺀다. 하루 전체 2번 제한도 그대로라, 가게가 몰린 거리를 걸어도 알림이 쏟아지지 않는다.
- 알림을 누르면 내세운 업체 시트를 연다. "N곳 더"가 있으면 시트에서 "내 주변 제휴" 목록으로 이어지게 한다(D단계).

## 플랫폼별 구성

판단 로직(`rules.ts`·`copy.ts`)과 서버는 세 플랫폼이 같다. 다른 것은 권한, 지오펜스 등록, 알림 표시, 심사다. 플랫폼 차이는 `Platform.OS` 분기를 여기저기 두지 않고, 이미 쓰는 파일 나누기(`NaverMapView.web.tsx`, `AdminEntry.web.tsx`)로 모은다.

```
src/lib/nearbyPartners/
  rules.ts, copy.ts            ← 세 플랫폼 공통(순수 함수)
  platform.ts                  ← iOS·Android 공통 구현 + 아래 표의 분기
  platform.web.ts              ← 웹: 백그라운드 없음, "지금 근처 보기"만
  task.ts / task.web.ts        ← task.web.ts 는 빈 파일(웹에는 TaskManager 가 없음)
```

`platform.ts`가 내보내는 것: `capabilities`(백그라운드 알림 가능 여부, 최대 등록 수), `requestPermissions()`, `permissionState()`, `syncGeofences()`, `stopGeofences()`, `openSystemSettings()`. 설정 화면과 훅은 `capabilities`만 보고 스위치를 보여 줄지 정한다.

`(확인)` 표시는 Expo SDK 57 문서와 실기기로 먼저 확인해야 하는 항목이다(AGENTS.md: 설치된 버전 문서 기준).

### iOS

| 항목 | 구성 |
| --- | --- |
| 권한 순서 | `requestForegroundPermissionsAsync` → 안내 화면 → `requestBackgroundPermissionsAsync`. iOS는 "항상"을 바로 주지 않고 나중에 "계속 허용할까요?"를 다시 물을 수 있다. 그래서 "항상"이 확정될 때까지 스위치는 "설정 중" 상태로 둔다 |
| 정확한 위치 | iOS 14 이상에서 "정확한 위치"를 끄면 지오펜스가 동작하지 않는다(확인). `permissionState()`가 대략 위치를 따로 알려 주고, 안내 문구로 "정확한 위치 켜기"를 보여 준다 |
| 등록 수 | 20개. 업체 19곳 + 큰 원 1개 |
| 반경 | 100m. iOS는 이보다 작게 잡아도 사실상 100~200m로 동작 |
| Info.plist | `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`(무엇을 위해, 서버로 안 보냄). `UIBackgroundModes: location`은 넣지 않는 것이 목표. 지오펜싱만으로 깨어나는지 확인(확인) |
| 앱이 꺼져 있을 때 | 영역 경계를 넘으면 운영체제가 앱을 잠깐 다시 띄운다. 사용자가 앱을 위로 밀어 강제 종료했을 때도 깨어나는지는 실기기로 확인(확인) |
| 알림 | 로컬 알림, 기본 중단 수준(시간 민감 알림 쓰지 않음). 소리 없이 표시 |
| 심사 | 심사 메모에 "항상" 권한 이유와 테스트 방법(관리자가 켠 테스트 업체 좌표) 적기. 홍보 알림이므로 앱 안 동의와 끄기(가이드라인 4.5.4) |
| 빌드 | `eas build --local -p ios` → `eas submit --path` |

### Android

| 항목 | 구성 |
| --- | --- |
| 권한 순서 | 정밀 위치 → 안내 화면 → 백그라운드 위치. Android 11 이상은 앱 안 팝업으로 "항상 허용"을 고를 수 없어 `openSystemSettings()`로 앱 위치 설정 화면을 연다. 돌아오면(`AppState` active) 상태를 다시 확인 |
| 대략 위치 | Android 12 이상에서 "대략적 위치"만 주면 지오펜스가 안 된다(확인). iOS와 같은 안내 |
| 알림 권한 | Android 13 이상 알림 권한은 기존 `NotificationPrimer` 흐름 재사용. 알림 권한이 없으면 근처 알림도 켤 수 없음 |
| 알림 채널 | `nearby-partner` 채널 새로 만들기(이름 "근처 제휴 알림", 중요도 DEFAULT). 관리자 채널(`ensureAdminNotificationChannel`)과 같은 방식. 사용자가 휴대폰 설정에서 이 채널만 끌 수 있음 |
| 등록 수 | 100개까지 되지만 iOS와 같은 20개로 통일(코드 하나) |
| 지오펜스가 지워지는 경우 | 재부팅, 앱 업데이트, 앱 데이터 삭제, 위치 끄기. 앱을 열 때마다 다시 등록하고, 부팅 직후 자동 등록은 expo-location 이 지원하는지 확인(확인). 안 되면 "재부팅 뒤 앱을 한 번 열어야 다시 동작" 안내 |
| 위치 정확도 개선 창 | `getCurrentPositionAsync` 는 기본으로 Google "위치 정확도 개선" 창을 띄우고, 거기서 "괜찮습니다"를 누르면 요청이 실패한다(10-27 에뮬레이터 확인). `mayShowUserSettingsDialog: false` 로 끄고, Wi-Fi·기지국 → 최근 위치 → GPS 순서로 얻는다(`platform.ts`). D단계 지오펜스도 같은 창을 피해야 한다 |
| 늦게 오는 신호 | 절전(Doze) 상태에서는 진입·이탈이 몇 분 늦을 수 있고, 5분 예약 알림도 정확한 시각을 보장하지 않는다. 정확한 알람 권한(`SCHEDULE_EXACT_ALARM`)은 쓰지 않는다. 몇 분 늦는 건 이 기능에 문제가 아니고 심사 부담만 늘기 때문 |
| 제조사 절전 | 삼성·샤오미 등은 백그라운드 작업을 막을 수 있음. 설정 화면에 "일부 휴대폰에서는 늦거나 오지 않을 수 있어요" |
| 매니페스트 | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`. 포그라운드 서비스 권한은 넣지 않음 |
| Play 심사 | 백그라운드 위치 권한 신고서 + 30초 안팎 시연 영상(안내 화면 → 권한 → 매장 근처 알림). 데이터 보안 양식: 위치는 기기 안에서만 처리, 수집·공유 안 함으로 신고(확인). 비공개 테스트 트랙에 먼저 올림 |
| Google Play 서비스 없는 기기 | 지오펜싱이 안 됨. `capabilities`에서 꺼서 스위치를 숨기거나 "이 휴대폰에서는 쓸 수 없어요" |
| 빌드 | `eas build --local -p android` → `eas submit --path`, 트랙은 internal/closed 먼저 |

### 웹 (hongikon.com)

| 항목 | 구성 |
| --- | --- |
| 근처 알림 | 만들지 않음. 브라우저는 앱이 닫힌 상태에서 위치 경계를 감시할 수 없고, 이 웹판은 원격 푸시도 쓰지 않는다(`usePushNotifications`가 웹에서 바로 종료). 설정의 스위치는 숨긴다 |
| 대신 | 지도·제휴 화면에 "내 주변 제휴 보기" 버튼(C단계). 누를 때만 브라우저 위치 권한을 묻고 한 번 읽어 거리순으로 보여 준다. 계속 추적하지 않고 저장하지 않음 |
| 안내 | 설정에 "근처 제휴 알림은 앱에서 쓸 수 있어요" 한 줄 + 앱 설치 링크 |
| 파일 | `platform.web.ts`(위치 한 번 읽기만), `task.web.ts`(빈 파일). 웹 빌드에 expo-task-manager 가 끌려 들어가지 않는지 `pnpm build:web`으로 확인 |
| HTTPS | 브라우저 위치는 HTTPS에서만 됨. hongikon.com·Netlify 미리보기 모두 HTTPS라 추가 작업 없음 |
| 처리방침 | 웹도 같은 `legalText.ts`를 쓰므로 "웹에서는 버튼을 누를 때만 위치를 한 번 읽고 저장하지 않음" 문장을 함께 넣는다 |

### 플랫폼별 테스트

| 플랫폼 | 확인할 것 |
| --- | --- |
| iOS | "앱 사용 중"만 줬을 때 스위치 상태, "정확한 위치" 끔, 앱 강제 종료 후 진입, 19곳 바꿔 등록 |
| Android | Android 11+ 설정 화면 왕복, 대략 위치만 줌, 재부팅 후 동작, `nearby-partner` 채널만 끔, 삼성 기기 절전 모드 |
| 웹 | 위치 거부 시 안내, 스위치가 안 보이는지, 웹 빌드 크기에 새 모듈이 안 들어가는지 |

## 만드는 순서

각 단계는 그 자체로 끝까지 동작하게 자른다. A·B는 OTA로 나갈 수 있고, C부터 네이티브 빌드가 필요하다.

| 단계 | 내용 | 배포 | 확인 |
| --- | --- | --- | --- |
| A. 서버 필드 | `nearby_alert`, `nearbyAlertsEnabled`, 관리자 토글, 동의 시각 저장 | BE dev → 운영 SQL | `/map/data`에 필드가 나오는지, 관리자 화면 토글 |
| B. 판단 로직 | `rules.ts`, `copy.ts` + 단위 테스트. 아직 아무 화면에도 연결하지 않음 | 코드만 | 테스트 통과 |
| C. 포그라운드 위치 | expo-location, `platform.ts`·`platform.web.ts`의 권한·한 번 읽기, 지도에 "근처 제휴 N곳"(기획 문서 2단계, 웹 포함). 처리방침 1차 수정(앱 사용 중 위치) | 네이티브 빌드 + 웹 배포 | 실기기·브라우저에서 거리순 목록 |
| D. 백그라운드 알림 | expo-task-manager, `store`·`geofences`·`task`·훅, 알림 탭 → 업체 시트, 설정·안내 화면, 로그아웃 정리, 처리방침 2차 수정 | 네이티브 빌드, Play는 비공개 테스트 트랙 먼저 | 기획 문서 "테스트 계획"의 걷기·배터리·재부팅 |
| E. 심사 | Play 백그라운드 위치 신고서·시연 영상, App Store 심사 메모 | 스토어 | 승인. Play가 거절하면 Android는 C까지만 |

C·D를 한 빌드로 묶을 수도 있지만, 따로 내면 "앱 사용 중" 권한만 쓰는 빌드가 먼저 심사를 통과해 두고 D의 심사 위험만 따로 남는다.

## 테스트

- 앱에는 아직 테스트 도구가 없다. `rules.ts`·`copy.ts`처럼 순수 함수만 대상으로 작은 테스트 도구를 하나 추가한다(개발 의존성만, 앱 번들에는 안 들어감). 시각과 좌표는 모두 인자로 받는다.
  - 대상 업체: `benefit` 없음 / `endsOn` 지남 / 소속 불일치 / `nearbyAlert` 꺼짐 / 캠퍼스와 겹침 → 제외
  - 19곳 고르기: 거리 → 혜택 → 순서 안정성
  - 진입 판단: 밤 21~8시 금지, 업체당 하루 1번, 전체 하루 2번, 점심·저녁 우선, 그 밖 하루 1번
  - 이탈: 3분 안 재진입은 이어서 머문 것으로
- 서버: 기존 partner 테스트에 `nearbyAlert` 직렬화, 관리자 토글, 동의 시각 저장·삭제 테스트 추가.
- 실기기: 기획 문서 "테스트 계획" 그대로.

## 위험

| 위험 | 가능성 | 대응 |
| --- | --- | --- |
| Play가 백그라운드 위치를 홍보 목적으로 보고 거절 | 높음 | C를 먼저 내 두고, D는 비공개 트랙으로 먼저 심사. 거절 시 Android는 C까지만 |
| 위치정보법 신고 필요 여부 미확인 | 확인 필요 | D 출시 전 KISA 위치정보지원센터 문의. 답이 오기 전에는 D를 운영에 내지 않음 |
| 처리방침과 실제 동작 불일치 | 중간 | `legalText.ts` 수정을 C·D 각 커밋에 같이 넣음 |
| 백그라운드 작업 정의 위치 실수(콜드 스타트에서 이벤트 유실) | 중간 | `index.ts` 최상단 import, 앱 강제 종료 후 실기기 확인 |
| 혜택 문구가 길어 알림에서 잘림 | 낮음 | `copy.ts`에서 길이 자르기, 전체는 시트에서 |

## 정할 것 (구조에 영향이 있는 것만)

- [ ] 알림 문구: 기획 문서는 "○○에 계신가요?"처럼 단정하는 문구를 쓰지 않기로 했다(옆 가게 오탐). 그대로 "근처에 제휴업체가 있어요"로 갈지
- [ ] C(포그라운드 근처 표시)를 먼저 따로 낼지, C·D를 한 빌드로 묶을지
- [ ] `nearby_alert` 기본값: 꺼짐(관리자가 고른 업체만, 권장) / 켜짐(모든 제휴업체)
- [ ] 긴급 끄기 값을 properties(재배포 필요)로 둘지, 관리자 화면에서 바꿀 수 있게 테이블로 둘지
