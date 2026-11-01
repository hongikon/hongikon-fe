# 근처 제휴 알림 — App Store·Play 심사 준비 (2026-11-01)

`nearby-partner-alert-release-plan.md`(고도화·출시 순서)의 5-2·5-3 단계를 실제로 하는 문서다. 원칙은 **위치는 최소로**: 위치는 휴대폰 안에서만 판단하고 서버에는 좌표를 보내지 않는다.

## 1. 우리가 갖는 것(최소 수집)

| 어디 | 무엇 | 얼마나 | 왜 |
|---|---|---|---|
| 휴대폰 | 지금 위치(지오펜스 진입·정밀 GPS 거리) | 저장 안 함, 판단 즉시 버림 | 가게 20m 안인지 판단 |
| 휴대폰 | 알림 보낸 가게 id·시각 | 2일 | 같은 가게 하루 1번 |
| 휴대폰 | 지금 머무는 가게 id·들어간/나간 시각 | 나가고 3분 뒤 삭제 | 머문 시간 판단 |
| 휴대폰 | 알림 대상 근처 제휴 가게 목록(지오펜스 등록용) | 끌 때까지(옮기면 바뀜) | 지오펜스 등록 |
| 휴대폰 | 켜기 여부, 소속, 머무는 시간, 밤 설정, 끈 가게 | 끌 때까지 | 사용자 설정 |
| 서버 | 근처 알림 수신 동의 여부·시각 | 동의 철회·탈퇴 시 삭제 | 정보통신망법 제50조 동의 기록 |
| 서버 | (없음) 위치·방문 기록·알림 기록 | — | 보내지 않는다 |

## 2. 빌드

- 버전 **1.1.0**(새 runtime). 1.0.0 사용자는 OTA 를 계속 받는다(`runtimeVersion: appVersion`).
- `production` 프로필에 `NEARBY_ALERTS_BUILD=1`. 현장 테스트(`NEARBY_FIELD_TEST`)는 빠진다 — [테스트] 칸, 횟수 제한 해제, 테스트 위치 없음.
- 브랜치: FE `feature/nearby-partner-alert` → dev 머지 후 dev 에서 빌드. BE 도 같은 순서.
- iOS: `eas build --local -p ios --profile production` → `eas submit`. Android: `-p android` AAB → Play 비공개 트랙.

## 3. 심사 전에 고칠 것(코드)

| # | 내용 | 상태 |
|---|---|---|
| C1 | 개인정보 처리방침: "위치(GPS) 수집 안 함·위치 권한 요청 안 함" → 위치 권한(선택, 앱 사용 중·항상), 기기 안 처리, 기기 2일 보관, 서버 동의 시각, 처리 근거(동의). 적용일 = 공지 + 7일 | 완료 — 적용일 2026-11-09(11-02 까지 공지) |
| C2 | 앱 권한 창·첫 실행 안내: 위치 줄에 "근처 제휴 알림을 켠 경우 항상" 추가, "백그라운드 위치 요청 안 함" 문구 고치기 | 완료(근처 알림 빌드에서만 바뀐 문구) |
| C3 | 운영 빌드 설정(버전 1.1.0, production 에 근처 알림) | 완료. OTA 는 두 runtime: `update:production`(1.1.0), `update:production:1.0.0` |
| C4 | 밤 시간·광고성 정보 처리(§6 결정) | 완료 — 21~8시 기본 안 보냄, "밤에도 받기" = 야간 수신 동의(서버 `partnerAdNightConsentAt`), 동의 문구 보강 |
| C5 | 심사관이 기능을 볼 수 있게: 서버 스위치가 꺼져 있으면 "잠시 멈췄어요"만 보인다 → 심사 기간엔 스위치 켬, 업체는 학교 앞 몇 곳 | |
| C6 | 업데이트 소식(변경 기록) 1.1.0 항목 | 완료(날짜는 출시일로 고침) |

## 4. App Store

- 권한 문구(Info.plist): `app.config.ts` 근처 빌드 문구 — 기기 안에서만 쓴다는 내용 포함. UIBackgroundModes `location`.
- **App Privacy**: 위치는 "수집하지 않음" 유지(기기 밖으로 안 나감). 새로 늘어나는 수집 항목 없음(동의 시각은 계정 정보에 딸린 기록).
- **심사 메모**(App Review Information > Notes): 기능 설명, 켜는 길(설정 > 알림 > 근처 제휴 알림), 왜 "항상"이 필요한지(앱을 닫아도 가게에 머물 때 알림), 서버로 위치를 보내지 않음, 심사관 위치(미국)에는 제휴 가게가 없어 실제 알림은 시연 영상으로 보여 줌. 데모 계정. 시연 영상 링크.
- 가이드라인: 2.5.4(백그라운드 위치는 목적이 분명해야), 5.1.1(목적 문구), 5.1.5(위치 서비스), 4.5.4(홍보성 푸시는 동의·끄기 필요 — 동의 체크와 끄기 있음).

## 5. Google Play

- 권한: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`.
- **위치 권한 신고서**(앱 콘텐츠 > 민감한 앱 권한 > 위치): 백그라운드 위치를 쓰는 핵심 기능 설명, 시연 영상(30초 안팎: 사전 고지 화면 → 시스템 권한 창 → 가게 근처 알림).
- **포그라운드 서비스 신고**(location 유형): 가게 근처에서만 정밀 거리를 재는 동안, 상단 알림 "근처 제휴 가게 확인 중", 영상.
- **사전 고지**(Prominent disclosure): 권한 창 전에 "앱을 닫아 둬도 위치를 쓴다·무엇에 쓰는지"를 보여야 한다 — `AlwaysAllowOverlay` 가 맞다. "켜지 않을게요"를 같은 무게로 둔다(유도 금지).
- **데이터 보안**: 위치는 기기 안에서만 처리 → "수집 안 함"(Google 정의상 기기 밖으로 안 나가면 수집 아님). 기존 항목 그대로.
- 거절되면: Android 만 "내 주변 제휴 보기"(앱 사용 중 위치)까지로 낸다.

## 6. 정한 것(11-01)

1. 밤 9시~아침 8시는 기본으로 보내지 않고, 사용자가 켜면 야간 수신 동의로 기록한다. "(광고)" 표기는 10-29 결정대로 없음 — KISA 답에 따라 바꾼다.
2. Android 도 백그라운드 위치까지 신청한다. 거절되면 "내 주변 제휴 보기"까지로 다시 낸다.

## 7. 사람이 할 것

| 항목 | 언제 |
|---|---|
| 위치정보법: **비신고 대상으로 판단(11-01)** — 위치정보지원센터 안내 그림의 "앱 자체에서 위치정보가 활용되고 삭제되어 없어지는 경우"(lbsc.kr 위치기반서비스 사업신고, CONTENT_0000081). 위치는 기기 안 판단 후 버리고 서버로 보내지 않음. 서면 답이 필요하면 LBS@kcup.or.kr | 완료(근거 기록) |
| 광고성 정보 해당 여부: KISA 불법스팸대응센터(118, spam.kisa.or.kr) 문의 — 답을 이 문서에 기록 | 제출 전 |
| 처리방침 변경 공지(앱 공지사항) → 7일 뒤 적용 | 빌드 전에 공지 |
| 시연 영상 2개(iOS·Android, 실제 가게 앞) | 빌드 후 |
| Play 신고서·App Store 메모 붙여 넣기, 제출 | 빌드 후 |
| BE 운영 SQL(`nearby_alert`)·배포, 스위치 켜기 | 제출 직전 |

## 8. 붙여 넣을 문구

### 8-1. App Store Connect > App Review Information > Notes (영문)

```
Nearby partner alerts (new in 1.1.0, optional, off by default)

What it does: Students can opt in at Settings > 알림 (Notifications) > 근처 제휴 (Nearby partners) > 근처 제휴 알림.
When they stay for a few minutes inside a partner shop near Hongik University (Seoul) that offers a student discount,
the app shows one local notification with that shop's student benefit.

Why "Always" location: the alert must work while the app is closed. We use region monitoring (geofences, 100 m) to wake
the app near a partner shop, then briefly use precise location only while inside that region to check the 20 m distance.
Location stays on the device. It is never sent to our server or stored; we only store the time the user consented
to receive these alerts. Users can turn the feature or night-time alerts off at any time in the same screen.

Before the system prompt we show an explanation screen with an equal-weight "켜지 않을게요" (Don't turn on) button.
Users who allow only "While Using" can still use "내 주변 제휴 보기" (nearby partners) in map search.

How to review: sign in with the demo account below, open Settings > 알림 > 근처 제휴 알림, check the consent box,
and follow the prompts. Partner shops are only in Seoul, so a real alert cannot be triggered from Cupertino;
a demo video of a real alert is here: <VIDEO_URL>.

Demo account: (기존 심사용 데모 로그인 안내 그대로)
```

### 8-2. App Privacy

- 위치(Precise/Coarse): **수집하지 않음** 그대로. 기기 밖으로 보내지 않는다.
- 새 항목 없음. 수신 동의 시각은 기존 "사용자 ID"에 딸린 앱 기능 기록이다(추적·광고 목적 아님).

### 8-3. Play Console > 앱 콘텐츠 > 위치 권한(백그라운드) 신고 (영문)

```
Core feature: Nearby partner alerts. When the user turns this on, the app notifies them while they are inside a
partner shop near Hongik University that offers a student discount, including when the app is closed.
Background location is needed because the alert must fire when the user walks into the shop without opening the app.
The app registers geofences (100 m) around nearby partner shops and, only while inside one, uses precise location
briefly (foreground service with a visible notification) to confirm the user is within 20 m.
Location is processed only on the device and is never sent to our servers, shared, or stored.
The feature is off by default; the user enables it in Settings > Notifications > Nearby partner alerts after a
prominent disclosure screen, and can disable it at any time.
```

- 영상(30초 안팎, YouTube 일부 공개): 설정 → 근처 제휴 알림 → 동의 체크 → 사전 고지 화면("항상 허용" 안내) → 시스템 권한 창(항상 허용) → 가게 앞 알림 → 탭하면 가게 시트.

### 8-4. Play Console > 포그라운드 서비스 신고(location)

```
Type: Location. Used only while the user is inside a 100 m region around a partner shop (after they enabled
Nearby partner alerts) to measure whether they are within 20 m. A persistent notification "근처 제휴 가게 확인 중"
is shown during this time. The service stops when the user leaves the region or after at most 2 hours.
```

### 8-5. 데이터 보안(Data safety)

- 위치: **수집 안 함**(기기에서만 처리 — Google 정의상 기기 밖으로 전송하지 않으면 수집이 아니다). 그 밖의 항목은 기존과 같다.

### 8-6. 처리방침 변경 공지(앱 공지사항, 11-02 까지)

```
[개인정보 처리방침 변경 안내] 2026년 11월 9일부터 적용
새 기능 "근처 제휴 알림"(선택)을 위해 개인정보 처리방침을 바꿉니다.
- 위치 접근권한(항상, 선택): 근처 제휴 알림을 직접 켠 경우에만 요청해요.
- 위치는 휴대폰 안에서만 쓰고 운영팀 서버로 보내거나 저장하지 않아요.
- 서버에는 알림 수신 동의 여부와 시각(밤 9시~아침 8시 수신 동의 포함)만 남고, 알림을 끄면 바로 지워요.
- 휴대폰에는 위치(좌표)를 남기지 않아요. 근처 제휴 가게 목록, 지금 머무는 가게와 들어간·나간 시각(나오고 몇 분 뒤 지움), 알림을 보낸 가게와 시각(2일 뒤 지움)만 휴대폰에 남아요.
자세한 내용은 설정 > 약관 및 정책 > 개인정보 처리방침에서 볼 수 있어요.
```
