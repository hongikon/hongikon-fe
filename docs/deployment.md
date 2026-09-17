# 배포·앱 제공 가이드

배포 백엔드: `http://54.180.195.51` (Swagger: `/swagger-ui/index.html`, 상태: `/status`)

## 환경변수가 들어가는 곳

| 대상 | 설정 위치 | `EXPO_PUBLIC_API_BASE_URL` |
|---|---|---|
| 로컬 개발 (`pnpm dev`) | `.env` (`.env.example` 참고) | `http://54.180.195.51` |
| EAS 빌드 (APK/IPA) | `eas.json` 의 `build.base.env` | `http://54.180.195.51` |
| Netlify 웹 | `netlify.toml` 의 `build.environment` | `/api` → Netlify가 백엔드로 프록시 |

`.env` 는 git·EAS 업로드에서 빠지므로 빌드용 공개값은 `eas.json` 에 둔다. 시크릿에는 `EXPO_PUBLIC_` 접두사를 붙이지 않는다.

## 앱 빌드

```bash
npm i -g eas-cli && eas login
eas build --profile preview --platform android     # 내부 테스트용 APK
eas build --profile production --platform android  # Play 스토어용 AAB
eas build --profile production --platform ios      # App Store용 (Apple 개발자 계정 필요)
eas submit --profile production --platform android|ios
```

`production` 은 `appVersionSource: remote` + `autoIncrement` 라 빌드 번호(versionCode/buildNumber)를 EAS가 올린다. 사용자에게 보이는 `version` 은 `app.json` 에서 직접 올린다.

## 백엔드가 http인 동안의 임시 설정 — 도메인+SSL 적용 후 되돌릴 것

- `app.json` → `ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads: true`
  (ATS 예외는 IP 주소에 도메인 단위로 걸 수 없어 전체 허용. App Store 심사에서 사유를 물을 수 있다)
- `app.json` → `expo-build-properties` 의 `android.usesCleartextTraffic: true`
- `netlify.toml` 의 `/api/*` 프록시 대상, `eas.json`·`.env` 의 주소를 `https://<도메인>` 으로 교체

웹판 카카오 로그인은 콜백이 앱 스킴(`hongikon://`)이라 원래 동작하지 않는다. 로그인 검증은 앱 빌드로 한다.

## 로고·아이콘

원본 SVG는 `assets/brand/` 에 있다. 교체 후 `pnpm icons:generate` 로 `assets/` 의 아이콘·스플래시·파비콘 PNG를 다시 만든다.
