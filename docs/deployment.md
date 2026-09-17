# 배포·앱 제공 가이드

| 구성 | 주소 | 호스팅 |
|---|---|---|
| 백엔드 API | `https://api.hongikon.com` (Swagger: `/swagger-ui/index.html`, 상태: `/status`) | EC2 + Nginx + Let's Encrypt (`hongikon-be/deploy/`) |
| 웹판 | `https://hongikon.com` | Netlify |
| 앱 | iOS/Android 스토어 | EAS Build/Submit |

## 1. 도메인 DNS (도메인 구매처 관리 화면)

| 호스트 | 타입 | 값 | 용도 |
|---|---|---|---|
| `api` | A | `54.180.195.51` (EC2 Elastic IP) | 백엔드 |
| `@` (루트) | A | `75.2.60.5` (Netlify 로드밸런서) | 웹판 |
| `www` | CNAME | `<Netlify 사이트명>.netlify.app` | 웹판 |

반영 확인: `dig +short api.hongikon.com` 이 EC2 IP를 돌려줄 때까지 기다린다(보통 수 분~수 시간).

## 2. 백엔드 HTTPS (EC2)

```bash
cd ~/hongikon-be && git pull
sudo EMAIL=<인증서 알림 받을 이메일> bash deploy/setup-https.sh
```

스크립트가 DNS 반영·백엔드 기동을 먼저 확인하고, Nginx 설정 설치 → 인증서 발급 → http→https 리다이렉트 → `https://api.hongikon.com/status` 확인까지 한다. 인증서 갱신은 certbot 타이머가 자동으로 한다.

이어서:
- 카카오 개발자 콘솔 → Redirect URI에 `https://api.hongikon.com/login/oauth2/code/kakao` 추가
- 확인되면 Nginx의 IP 직접 접속용 기본 사이트(`/etc/nginx/sites-enabled/default`)를 지운다

## 3. 웹판 (Netlify)

Site configuration → Domain management → `hongikon.com` 추가(Primary), `www` 는 자동 리다이렉트. HTTPS 인증서는 Netlify가 자동 발급한다.
`netlify.toml` 이 `/api/*` 를 `https://api.hongikon.com` 으로 프록시하므로 백엔드 CORS 설정은 필요 없다. Netlify 대시보드에 `EXPO_PUBLIC_API_BASE_URL` 이 남아 있으면 지운다(`netlify.toml` 값 `/api` 를 써야 한다).

## 4. 앱 빌드·제출

**반드시 2단계(`https://api.hongikon.com/status` 응답)가 끝난 뒤에 빌드한다.** 앱은 https만 허용하므로 그 전에 만든 빌드는 서버에 붙지 못한다.

```bash
npm i -g eas-cli && eas login
eas build --profile preview --platform android     # 내부 테스트용 APK
eas build --profile production --platform android  # Play 스토어용 AAB
eas build --profile production --platform ios      # App Store용 (Apple 개발자 계정 필요)
eas submit --profile production --platform android|ios
```

`production` 은 `appVersionSource: remote` + `autoIncrement` 라 빌드 번호를 EAS가 올린다. 사용자에게 보이는 `version` 은 `app.json` 에서 직접 올린다.

## 환경변수가 들어가는 곳

| 대상 | 설정 위치 | `EXPO_PUBLIC_API_BASE_URL` |
|---|---|---|
| 로컬 개발 | `.env` (`.env.example` 참고) | `https://api.hongikon.com` |
| EAS 빌드 | `eas.json` 의 `build.base.env` | `https://api.hongikon.com` |
| Netlify 웹 | `netlify.toml` | `/api` (프록시) |

`.env` 는 git·EAS 업로드에서 빠지므로 빌드용 공개값은 `eas.json` 에 둔다. 시크릿에는 `EXPO_PUBLIC_` 접두사를 붙이지 않는다.

## 전송 보안

- iOS: `NSAllowsArbitraryLoads: false` (Expo 기본 템플릿은 `true` 라 명시적으로 막았다). `NSAllowsLocalNetworking` 은 로컬 백엔드 개발용으로 남긴다.
- Android: 릴리스 빌드는 기본적으로 평문 http를 막는다. 로컬 http 백엔드로 개발할 땐 개발 빌드(디버그)로 붙는다.

## 로고·아이콘

원본 SVG는 `assets/brand/` 에 있다. 교체 후 `pnpm icons:generate` 로 `assets/` 의 아이콘·스플래시·파비콘 PNG를 다시 만든다.
