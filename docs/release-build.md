# 스토어 출시 빌드·제출 가이드

홍익온 앱(iOS·Android)을 스토어에 올리는 순서와, 빌드 설정이 왜 이렇게 되어 있는지를 정리한다.
웹(Netlify)·백엔드는 [deployment.md](./deployment.md) 를 본다.

| 항목 | 값 |
|---|---|
| 앱 이름(홈 화면) | 홍익온 |
| iOS Bundle ID / Android 패키지 | `com.hongikon.app` (테스트 빌드는 `com.hongikon.app.preview`, 개발은 `.dev`) |
| Apple Team ID | `GB56N8GWDQ` |
| EAS 프로젝트 | `@seokhoonchois-team/hongik-alimi` (`25bf8164-7142-43dc-a175-865a00577f3d`) |
| Expo SDK / RN | 57 / 0.86 |
| Android minSdk / targetSdk / compileSdk | 24 / 36 / 36 (RN 0.86 기본값, `react-native/gradle/libs.versions.toml`) |
| iOS 최소 버전 | 16.4 (Expo 57 Podfile 기본값) |
| iOS 빌드 이미지(EAS) | `auto` → SDK 57 은 `macos-tahoe-26.5-xcode-26.6`(iOS 26.5 SDK). UIScene 생명주기는 켜 둠 — 6장 "iOS UIScene 생명주기" |

## 0. 빌드 프로필 한눈에

| 프로필 | 용도 | 배포 | 채널(OTA) | EAS environment | APP_VARIANT |
|---|---|---|---|---|---|
| `development` | 개발 클라이언트 | internal | `development` | development | development |
| `preview` | 내부 테스트(APK / 애드혹) | internal | `preview` | preview | preview |
| `production` | 스토어 제출(AAB / App Store) | store | `production` | production | production |

`production` 은 `appVersionSource: remote` + `autoIncrement: true` 라 **빌드 번호(iOS buildNumber, Android versionCode)는 EAS 서버가 올린다.**
`app.json` 의 `ios.buildNumber`·`android.versionCode` 는 무시된다(처음 원격 값을 잡을 때만 참고).

---

## 1. 처음 한 번만: 콘솔·자격 증명 준비

### 1-1. EAS 환경 변수 (운영 OTA 안전장치 — 반드시 먼저)

빌드는 `eas.json` 의 `env` 로 값을 받지만, **`eas update` 는 `eas.json` 의 빌드 env 를 읽지 않는다.**
EAS 서버의 환경 변수(`--environment`)와 로컬 `.env` 만 쓴다. 지금 EAS 에는 `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` 만
있어서, 그냥 `eas update` 를 치면

- `EXPO_PUBLIC_API_BASE_URL` 이 로컬 `.env` 값(예: `http://localhost:8080`)으로 운영 앱에 실리고
- `APP_VARIANT` 가 없어 `extra.appVariant` 가 `development` 가 되어 **운영 앱에 개발자 도구가 켜진다**
  (`src/lib/appVariant.ts` 는 `Constants.expoConfig.extra.appVariant` 를 보는데, OTA 를 받으면 이 값이 업데이트의 것으로 바뀐다).

아래를 한 번 실행해 둔다(값은 모두 공개값이라 `plaintext`). `eas env:create` 는 deprecated 라 `eas env:set` 을 쓴다.

```bash
# 운영
eas env:set production --name APP_VARIANT --value production --visibility plaintext --non-interactive
eas env:set production --name EXPO_PUBLIC_API_BASE_URL --value https://api.hongikon.com --visibility plaintext --non-interactive
eas env:set production --name EXPO_PUBLIC_NAVER_MAP_CLIENT_ID --value 5fjib1yauc --visibility plaintext --non-interactive

# 테스트
eas env:set preview --name APP_VARIANT --value preview --visibility plaintext --non-interactive
eas env:set preview --name EXPO_PUBLIC_API_BASE_URL --value https://api.hongikon.com --visibility plaintext --non-interactive
eas env:set preview --name EXPO_PUBLIC_NAVER_MAP_CLIENT_ID --value 5fjib1yauc --visibility plaintext --non-interactive

# 확인
eas env:list production
eas env:list preview
```

`eas.json` 의 빌드 프로필에도 같은 값이 남아 있다(빌드 시 `eas.json` 값이 우선한다). EAS 환경 변수로 다 옮겨진 걸
확인한 뒤에는 `eas.json` 의 `build.base.env` 와 프로필별 `env` 를 지워 한 곳에서만 관리해도 된다 — 단 그때도
`scripts/eas-update.mjs` 는 `eas.json` 의 프로필 env 를 읽으므로 `APP_VARIANT` 는 남겨 둔다.

### 1-2. iOS (App Store Connect / Apple Developer)

- [ ] Apple Developer > Identifiers 에 `com.hongikon.app` 이 있는지 확인. 없으면 첫 `eas build` 가 만든다(Sign in with Apple·Push Notifications capability 도 EAS 가 동기화).
- [ ] App Store Connect > 나의 앱 > 신규 앱: 플랫폼 iOS, 이름 `홍익온`, 기본 언어 한국어, 번들 ID `com.hongikon.app`, SKU 자유(예: `hongikon-ios`).
- [ ] 만든 앱의 **Apple ID(숫자, 앱 정보 > 일반 정보)** 를 `eas.json` 의 `submit.production.ios.ascAppId` 에 넣는다. 지금은 `"TODO"` 라 `eas submit -p ios` 가 실패한다.
- [ ] 푸시: `eas credentials -p ios` → production → Push Notifications 키 설정(새 APNs 키 생성 또는 기존 키 재사용). Expo 푸시 서비스가 이 키로 APNs 에 보낸다.
- [ ] (선택) 제출용 App Store Connect API 키: `eas credentials -p ios` → App Store Connect API Key. 설정해 두면 `eas submit` 이 Apple ID 로그인·2FA 를 묻지 않는다.
- [ ] Sign in with Apple: 백엔드의 Apple client id(서비스 ID/번들 ID)가 `com.hongikon.app` 인지 확인(번들 ID 를 바꿨으므로).

### 1-3. Android (Google Play Console / Firebase)

- [ ] Play Console > 앱 만들기: 이름 `홍익온`, 기본 언어 한국어, 앱, 무료.
- [ ] **첫 AAB 는 Play Console 에 손으로 올려야 한다.** Google Play API(=`eas submit`)는 패키지 이름이 한 번이라도 등록된 앱에만 올릴 수 있다. 첫 `eas build -p android --profile production` 의 `.aab` 를 내려받아 테스트 > 내부 테스트 > 새 버전 만들기 로 올린다.
- [ ] Play 앱 서명: 첫 업로드 때 "Google Play 앱 서명" 사용(기본). EAS 가 가진 키는 업로드 키가 된다.
- [ ] 서비스 계정 키: Google Cloud 에서 서비스 계정 + JSON 키 생성 → Play Console > 사용자 및 권한 에서 그 계정에 앱 권한(출시 관리) 부여 → 키를 `./secrets/play-service-account.json` 에 둔다. `secrets/` 는 `.gitignore` 에 있다. EAS 서버에 올려 두려면 `eas credentials -p android` → Google Service Account 도 된다.
- [ ] **Android 푸시(FCM)** — 지금 설정이 없어 Android 에서 `getExpoPushTokenAsync` 가 실패한다.
  1. Firebase 프로젝트에 Android 앱 `com.hongikon.app` 과 `com.hongikon.app.preview` 를 등록하고 `google-services.json` 을 받는다(두 앱이 한 파일에 같이 들어 있다).
  2. EAS 파일 환경 변수로 올린다(파일은 커밋하지 않는다):
     ```bash
     eas env:set production --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --non-interactive
     eas env:set preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --non-interactive
     ```
     `app.config.ts` 가 `process.env.GOOGLE_SERVICES_JSON` 을 `android.googleServicesFile` 로 넘긴다.
  3. Firebase > 프로젝트 설정 > 서비스 계정 에서 FCM v1 용 비공개 키(JSON)를 받아 `eas credentials -p android` → production → Push Notifications: FCM V1 에 올린다.
- [ ] 개인 개발자 계정이 2023-11-13 이후에 만든 것이면, 프로덕션 출시 전에 **비공개 테스트(closed testing)에 테스터 12명 이상이 14일 연속 참여**해야 한다. 일정에 넣는다.

---

## 2. iOS: 운영 빌드 → TestFlight → 심사 제출

```bash
npm i -g eas-cli   # 16 이상
eas login
git switch main && git pull           # 출시할 커밋에서
pnpm install && npx tsc --noEmit

eas build -p ios --profile production
# 빌드 번호는 EAS 가 올린다. 끝나면 바로 제출:
eas submit -p ios --profile production --latest
# 또는 한 번에: eas build -p ios --profile production --auto-submit
```

1. 제출 후 App Store Connect 처리(10~30분) → TestFlight 탭에 빌드가 뜬다. 수출 규정 질문은 `ITSAppUsesNonExemptEncryption=false` 라 나오지 않는다.
2. TestFlight 내부 테스터(App Store Connect 사용자)로 실기기 확인:
   - 카카오 로그인 → `hongikon://` 로 복귀, Apple 로그인, 로그아웃·회원 탈퇴
   - 알림 허용 → 테스트 푸시 수신(운영 APNs. aps-environment 는 App Store 서명 때 production 으로 바뀐다)
   - 제보 작성: 카메라 촬영, 앨범에서 고르기(HEIC → JPEG), 업로드
   - 설정 > 앱 상태 의 '빌드 환경' 이 `운영`, 개발자 도구가 안 보이는지
   - (UIScene) 앱을 완전히 종료한 상태에서 푸시 알림을 눌러 켰을 때 해당 화면으로 가는지, 홈 화면 복귀·재진입 후
     화면 갱신(AppState)이 되는지 — 6장 "iOS UIScene 생명주기" 의 기기 확인 목록
3. 외부 테스터가 필요하면 TestFlight 외부 그룹 → 베타 앱 심사(최초 1회).
4. App Store 탭 > 새 버전에 빌드 선택 → 심사 제출(아래 5장 체크리스트).

## 3. Android: 운영 AAB → 내부 테스트 → 비공개 테스트 → 프로덕션

```bash
eas build -p android --profile production          # .aab (store 배포, versionCode 자동 증가)
# 최초 1회는 .aab 를 Play Console 에 직접 업로드(1-3 참고). 그 다음부터:
eas submit -p android --profile production --latest
```

- `submit.production.android` 는 `track: internal`, `releaseStatus: draft` 다. 제출하면 내부 테스트 트랙에 **초안**으로
  올라가므로 Play Console 에서 출시 노트를 확인하고 직접 "출시 검토 → 출시" 를 누른다.
- 내부 테스트로 확인한 빌드를 Play Console 에서 비공개 테스트(closed) → 프로덕션 으로 **승격**한다(같은 AAB 재사용, 다시 빌드할 필요 없음).
- 다른 트랙에 바로 올리고 싶으면: `eas submit -p android --profile production --latest` 전에 `eas.json` 의 `track` 을
  `alpha`(비공개 테스트) / `production` 으로 바꾸거나, 프로필을 하나 더 만든다.
- 확인할 것(내부 테스트 설치본): 카카오 로그인 복귀, 알림 권한(Android 13+ 에서 POST_NOTIFICATIONS 대화상자), 푸시 수신,
  카메라 촬영, **앨범에서 고르기 — Android 13+ 는 시스템 사진 선택기, 12 이하는 Google Play 서비스의 사진 선택기
  백포트 또는 문서 선택기(ACTION_OPEN_DOCUMENT)가 뜨고 권한 대화상자는 뜨지 않아야 정상.**

## 4. 버전 규칙

| 값 | 어디서 | 언제 올리나 |
|---|---|---|
| `expo.version` (사용자에게 보이는 1.0.0) | `app.json` 직접 | 스토어에 새 버전을 낼 때마다. **네이티브 변경이 있으면 반드시 올린다** |
| iOS buildNumber / Android versionCode | EAS 원격(`autoIncrement`) | 자동. 확인·수정은 `eas build:version:get` / `eas build:version:set` |
| `runtimeVersion` | `policy: appVersion` → `expo.version` 과 같음 | `version` 을 올리면 자동으로 바뀐다 |

`runtimeVersion` 이 `appVersion` 정책이라, **같은 `version` 으로 네이티브만 바꿔 다시 빌드하면 OTA 가 서로 맞지 않는
바이너리에 내려갈 수 있다.** 네이티브를 건드렸으면 `version` 을 올린다(1.0.0 → 1.0.1).

## 5. OTA(EAS Update) 규칙

채널은 빌드 프로필과 1:1 이다: `production` 빌드는 `production` 채널만, `preview` 빌드는 `preview` 채널만 받는다.
`preview` 에 올린 업데이트는 운영 앱에 절대 가지 않는다.

### 올리는 법

```bash
# 권장: eas.json 의 프로필 env(APP_VARIANT, EXPO_PUBLIC_*)를 그대로 넣고 실행하는 래퍼
pnpm run update:preview -m "무엇을 고쳤는지"       # 먼저 테스트 채널로
pnpm run update:production -m "무엇을 고쳤는지"    # 테스트 빌드에서 확인 후 운영으로

# 래퍼가 실제로 실행하는 명령(1-1 의 EAS 환경 변수를 만들어 둔 경우 이것만 써도 된다)
eas update --channel production --environment production -m "무엇을 고쳤는지"
```

- 단계적 배포: `... --rollout-percentage 10` 후 `eas update:edit` 로 비율을 올린다.
- 되돌리기: `eas update:republish --group <이전 업데이트 그룹 ID>` 또는 `eas update:rollback`.
- OTA 를 올리기 전 확인: `git status` 가 깨끗한지(올리는 건 지금 작업 트리), `npx tsc --noEmit`.
- **사용자가 알아챌 변화가 있는 스토어 출시·OTA 마다 `src/constants/changelog.ts` 맨 위에 한 항목을 더한다**
  (설정 > 일반 > 업데이트 내역에 그대로 보인다). 해요체로 짧게, 관리자·보안·내부 작업은 빼고, 서버 배포를 기다리는
  기능은 실제로 쓸 수 있게 된 뒤에 적는다. 스토어 버전은 `kind: 'app'`, OTA 는 `kind: 'ota'`.

### OTA 로 되는 것 / 새 네이티브 빌드가 필요한 것

| OTA 로 충분 (JS·에셋) | 새 빌드 + `version` 올림 필요 (네이티브) |
|---|---|
| 화면·문구·스타일, JS 로직, API 호출 방식 | 네이티브 모듈 추가·삭제·업그레이드(`expo-*`, `react-native-*` 의 네이티브 코드 포함 패키지) |
| 이미지·폰트 등 번들 에셋 | Expo SDK / RN 업그레이드 |
| `EXPO_PUBLIC_*` 값(번들에 박히므로 OTA 로 바뀜) | `app.json`/`app.config.ts` 의 네이티브 설정: 권한·`infoPlist`·`privacyManifests`·`blockedPermissions`·플러그인 옵션·아이콘·스플래시·`scheme`·번들 ID·앱 이름 |
| | 푸시 설정(`google-services.json`, APNs entitlement), Sign in with Apple 같은 capability |

`app.json` 의 `extra` 와 `name` 같은 값은 OTA 매니페스트에도 실려 바뀌지만, 위 표의 네이티브 설정은 바이너리에만 들어가서
OTA 로는 반영되지 않는다.

---

## 6. 스토어 정책 관련 설정(왜 이렇게 되어 있나)

### iOS 개인정보 매니페스트 (`app.json` > `ios.privacyManifests`)

prebuild 가 앱 타깃에 `PrivacyInfo.xcprivacy` 를 만들고, `pod install` 때 RN 의 privacy manifest aggregation
(`apple.privacyManifestAggregationEnabled` 기본 켜짐)이 각 pod 의 매니페스트를 여기에 합친다. Expo 문서는 정적 링크
pod 의 매니페스트를 Apple 이 제대로 읽지 못하는 경우가 있으니 앱 수준에 직접 적으라고 해서, 실제로 링크되는 pod 의
선언을 모두 앱 수준에 옮겨 적었다.

| API 범주 | 사유 코드 | 쓰는 곳 (SDK 57 기준 node_modules 확인) |
|---|---|---|
| UserDefaults | CA92.1 | React-Core, expo-constants, expo-notifications, expo-updates·expo-eas-client(자체 매니페스트 없음) |
| FileTimestamp | C617.1, 0A2A.1, 3B52.1 | React-Core·cxxreact·RCT-Folly·glog·boost, expo-application, async-storage(C617.1) / expo-file-system(0A2A.1, 3B52.1) |
| SystemBootTime | 35F9.1 | React-timing, boost |
| DiskSpace | E174.1, 85F4.1 | expo-file-system |

수집 데이터(`NSPrivacyCollectedDataTypes`, 모두 사용자에 연결됨·추적 안 함·목적 앱 기능)는 개인정보 처리방침
(`src/constants/legalText.ts`)과 맞췄다: UserID(카카오 회원번호·Apple 식별자), Name(닉네임·Apple 이름),
EmailAddress(문의 답변 이메일, 선택), PhotosorVideos(제보 사진), OtherUserContent(제보·신고·문의 내용과 지도에서
고른 위치), CustomerSupport(문의), DeviceID(푸시 토큰). `NSPrivacyTracking: false`, 추적 도메인 없음.
기기 위치(GPS)는 수집하지 않으므로 위치 항목은 넣지 않았다(제보 위치는 사용자가 지도에서 고른 콘텐츠).
**App Store Connect 의 "앱 개인정보 보호" 답변도 같은 항목으로 맞춘다.**

pod 를 추가·업그레이드하면 다시 확인한다:

```bash
find -L node_modules -name PrivacyInfo.xcprivacy -path "*/<패키지>/*"
```

### Android 권한 (`app.json` > `android.blockedPermissions`)

최종 운영 권한(라이브러리 매니페스트 합본 기준):

| 권한 | 출처 | 비고 |
|---|---|---|
| INTERNET, ACCESS_NETWORK_STATE | RN, expo-updates, FCM | |
| CAMERA | expo-image-picker | 제보 사진 촬영, 누를 때만 요청 |
| POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED | expo-notifications | Android 13+ 알림 권한 |
| VIBRATE | expo-haptics | |
| WAKE_LOCK, c2dm RECEIVE | Firebase Messaging(FCM 설정 후) | |

막아 둔 권한(`tools:node="remove"`): `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`,
`READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`, `READ_MEDIA_VISUAL_USER_SELECTED`, `ACCESS_MEDIA_LOCATION`,
`SYSTEM_ALERT_WINDOW`(Expo 템플릿 main 매니페스트에 들어 있어 운영에도 실리던 것 — 개발 오버레이용이라 막음).

- Google Play 사진·동영상 권한 정책: 사진을 가끔 고르는 앱은 `READ_MEDIA_IMAGES/VIDEO` 를 선언하면 안 되고 시스템
  사진 선택기를 써야 한다. expo-image-picker 57 의 앨범은 `PickVisualMedia`(Android 13+ 시스템 Photo Picker,
  12 이하는 Play 서비스 백포트 — 매니페스트의 `ModuleDependencies` 서비스가 설치를 요청 — 없으면 문서 선택기)라
  권한 없이 동작한다. 그래서 `ReportComposerModal` 은 Android 에서 사진 권한을 묻지 않고 바로 선택기를 연다.
  Play Console 의 "사진 및 동영상 권한" 신고서는 해당 권한이 없으므로 나오지 않아야 한다.
- 알려진 제약: Android 9 이하(API 28↓)에서는 expo-image-picker 가 카메라 촬영에 `WRITE_EXTERNAL_STORAGE` 를 함께
  요구해 **카메라 촬영이 거절로 끝난다**(앨범 선택은 된다). 지원하려면 `WRITE_EXTERNAL_STORAGE` 를 `maxSdkVersion=28`
  로만 다시 허용하는 설정 플러그인이 필요하다.
- targetSdk 36(Android 16): Play 의 2026-08-31 이후 신규 앱·업데이트 요구 수준(API 36)을 충족한다.

합본 매니페스트 확인(빌드 후):

```bash
bundletool dump manifest --bundle app.aab | grep uses-permission
```

### iOS Info.plist

`APP_VARIANT=production npx expo config --type introspect` 로 확인:
`CFBundleDisplayName=홍익온`, `ITSAppUsesNonExemptEncryption=false`, `TARGETED_DEVICE_FAMILY=1`(iPhone 전용,
`supportsTablet: false`), 세로 고정, 카메라·사진 문구만(마이크·Face ID 없음), `LSApplicationQueriesSchemes` 없음
(`Linking.canOpenURL` 을 쓰지 않음), Associated Domains 없음. iPhone 전용이라 `UIRequiresFullScreen` 은 의미가 없어 두지 않는다.

### iOS UIScene 생명주기 (`app.json` > `expo-build-properties` > `ios.enableSceneSupport`)

**왜:** iOS 27 SDK(Xcode 27)로 빌드한 앱은 UIScene 생명주기를 쓰지 않으면 iOS 27 에서 **실행 즉시 종료된다**(경고가 아니라
`EXC_BREAKPOINT` — "Application failed to launch: UIScene life cycle is required for apps built with this SDK").
Expo SDK 57 의 prebuild 템플릿은 옛 방식(AppDelegate 가 창을 만듦)이라 그대로 두면 Xcode 27 빌드가 뜨지 않는다.
SDK 58 부터는 템플릿이 기본으로 scene 을 쓴다.

**지금 설정:** `expo-build-properties` 의 `ios.enableSceneSupport: true`(expo 57.0.23 이상 필요 — 플러그인이 버전을 검사해
낮으면 prebuild 를 실패시킨다). prebuild 결과:

- `Info.plist` 에 `UIApplicationSceneManifest`(단일 scene, `UISceneDelegateClassName = EXExpoAppSceneDelegate`,
  `UISceneConfigurationName = Default Configuration`) 추가
- `AppDelegate.swift` 가 `ExpoReactNativeFactoryProvider` 를 채택하고, 창 생성·`startReactNative` 를 지운다.
  창은 Expo 의 `ExpoAppSceneDelegate` 가 `scene(_:willConnectTo:)` 에서 만들고 RN 을 띄운다.
- 별도 `SceneDelegate.swift` 는 생기지 않는다(SDK 58 템플릿과 다른 점). 로컬에서 손으로 고친 `ios/` 와 결과가 같다.

확인: `APP_VARIANT=production npx expo prebuild --platform ios --no-install`(임시 복사본에서) 후
`plutil -extract UIApplicationSceneManifest json -o - ios/app/Info.plist`.

**EAS 빌드 이미지:** `eas.json` 에 `ios.image` 가 없으니 `auto` 다. SDK 57 은 `macos-tahoe-26.5-xcode-26.6`(Xcode 26.6,
iPhoneOS 26.5 SDK)로 빌드되어 이 문제와 무관하다. 2026-10-02 의 테스트 빌드 `6b8b5bd5-4f5c-48be-a265-693edad7d5cb`
(`com.hongikon.app.preview`)도 로그상 이 이미지였다 — 이미 깔린 테스트 앱은 iOS 27 기기에서도 옛 SDK 호환 모드로 뜬다.
Xcode 27 이미지(`macos-tahoe-26.6-xcode-27.0` = `sdk-58`, `…-xcode-27.1`)를 쓰게 되는 경우: `ios.image` 를 `latest`·Xcode 27
이미지로 바꿀 때, SDK 58 로 올릴 때, Apple 이 App Store 제출에 iOS 27 SDK 를 요구할 때(예년처럼 다음 해 봄). 그때를 위해
지금 켜 두었다. iOS 26 SDK 빌드에서도 scene 생명주기는 iOS 13+ 에서 정상 동작한다.

**코드 영향(확인한 것, 수정 불필요):**

- 카카오 로그인 복귀(`hongikon://`): `WebBrowser.openAuthSessionAsync` 가 ASWebAuthenticationSession 에서 직접 결과 URL 을
  받는다(AppDelegate 의 openURL 을 거치지 않음). 앵커는 `UIApplication.shared.keyWindow` — scene 이 만든 창이 key 가 된다.
- 다른 `hongikon://` 링크: scene 의 `openURLContexts` → Expo 가 AppDelegate·`RCTLinkingManager` 로 넘기고(중복 이벤트 방지 포함),
  콜드 스타트 URL 은 launchOptions 로 다시 만들어 `Linking.getInitialURL()` 이 그대로 받는다. 앱은 지금 `getInitialURL`/`url`
  이벤트를 쓰지 않는다.
- 알림(`getLastNotificationResponseAsync`, 응답 리스너): expo-notifications 는 `UNUserNotificationCenter` delegate 를 앱 실행
  초기(AppDelegate 구독자)에 걸어서 scene 과 무관하다. 콜드 스타트 탭도 기존과 같은 경로.
- Apple 로그인: expo-apple-authentication 의 앵커도 `keyWindow` 라 위와 같다.
- `AppState`(포그라운드 복귀 갱신): RN 은 `UIApplicationDidBecomeActiveNotification` 같은 앱 단위 알림을 듣는데, UIKit 은
  scene 생명주기에서도 이 알림을 보낸다. Expo 는 scene 이벤트를 AppDelegate 구독자에게도 다시 넘긴다.
- expo-updates: 창을 key window 또는 `AppDelegate.window` 에서 찾는데, scene delegate 가 두 곳 모두 채운다.

**OTA:** `expo-build-properties` 는 설정 플러그인뿐(네이티브 모듈 없음)이라 JS 와 네이티브의 접점은 바뀌지 않는다. 출시 전이라
`version`(=runtimeVersion) 1.0.0 그대로 두었다. 이미 스토어에 나간 뒤라면 4장 규칙대로 `version` 을 올린다.

**새 빌드에서 기기로 확인할 것(iOS 26·27 각각):** 콜드 스타트 실행, 앱 종료 상태에서 푸시 탭 → 해당 화면 이동, 실행 중
푸시 탭, 카카오 로그인 → `hongikon://` 복귀, Apple 로그인 시트 표시, 제보 사진(카메라·앨범) 시트, 백그라운드 → 복귀 시 갱신,
OTA 업데이트 적용 후 재시작.

출처: [Expo 이슈 #46664](https://github.com/expo/expo/issues/46664),
[build-properties `ios.enableSceneSupport`](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/),
[EAS 빌드 이미지](https://docs.expo.dev/build-reference/infrastructure/),
[Apple TN3187](https://developer.apple.com/documentation/technotes/tn3187-migrating-to-the-uikit-scene-based-life-cycle),
`node_modules/expo/ios/AppDelegates/ExpoAppSceneDelegate.swift`.

---

## 7. 콘솔 체크리스트(심사 제출 전)

### App Store Connect
- [ ] 앱 개인정보 보호(영양 성분표): 6장 수집 데이터와 같게. 추적 없음.
- [ ] 개인정보 처리방침 URL, 지원 URL(문의 이메일 hongikonsupport@gmail.com 이 보이는 페이지)
- [ ] 연령 등급 설문, 카테고리(예: 교육 / 참고), 가격 무료
- [ ] 스크린샷: 6.9" iPhone 필수(iPhone 전용이라 iPad 불필요)
- [ ] 심사 정보: 로그인 없이 "둘러보기" 로 쓸 수 있음을 적고, 로그인 기능 확인용으로 Apple 로그인 사용 가능함을 안내. 제보는 운영진 승인 후 노출된다는 점, 신고 기능 위치를 적는다(UGC 가이드라인 1.2).
- [ ] 계정 삭제: 설정 > 회원 탈퇴 위치를 심사 메모에 적는다(가이드라인 5.1.1(v)).
- [ ] 수출 규정: `ITSAppUsesNonExemptEncryption=false` 로 자동 처리.

### Google Play Console
- [ ] 데이터 보안(Data safety): 수집 — 개인 정보(이름, 이메일 주소, 사용자 ID), 사진, 앱 활동(기타 사용자 생성 콘텐츠), 기기 또는 기타 ID(푸시 토큰). 공유 없음(수탁자는 공유 아님), 전송 중 암호화, 삭제 요청 가능(앱 내 탈퇴).
- [ ] 앱 액세스 권한: 로그인 없이 둘러보기 가능 / 로그인 기능 심사용 카카오 테스트 계정 또는 안내
- [ ] 광고 없음, 콘텐츠 등급 설문, 타깃 연령(18세 이상 권장 — 대학생 대상), 뉴스 앱 여부(아니오)
- [ ] 개인정보처리방침 URL
- [ ] 계정 삭제 URL(웹에서 탈퇴 요청할 수 있는 주소 — Play 는 앱 밖 경로도 요구)
- [ ] 스토어 등록정보: 아이콘 512, 그래픽 이미지 1024×500, 휴대전화 스크린샷 2장 이상
- [ ] 비공개 테스트 12명·14일(해당 계정이면)

### EAS / Expo
- [ ] 1-1 의 EAS 환경 변수 생성 확인(`eas env:list production`)
- [ ] iOS 푸시 키, Android FCM V1 키(`eas credentials`)
- [ ] `eas.json` 의 `ascAppId` 채움, `secrets/play-service-account.json` 배치
- [ ] iOS 를 Xcode 27 이미지로 빌드하게 됐다면 `app.json` 에 `ios.enableSceneSupport: true` 가 그대로인지, 첫 빌드를 iOS 27 기기에서 띄워 봤는지(6장)
