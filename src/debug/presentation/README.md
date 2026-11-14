# iPhone 발표 촬영 모드

브랜치 `presentation/iphone-demo`에서만 쓰는 재현용 보조 코드입니다. 기존 React Native 화면, 시트, 검색, 탭, 길찾기 렌더러를 사용합니다.

## 실행

1. `EXPO_PUBLIC_PRESENTATION_DEMO=1 node node_modules/expo/bin/cli start --localhost`로 Metro를 시작합니다.
2. 설치된 iPhone 시뮬레이터 앱을 `xcrun simctl launch booted com.hongikon.app.dev`로 엽니다.
3. 프로젝트 루트에서 [capture.mjs](../../../홍익온_피치덱/capture.mjs)를 Node로 실행합니다. 인자를 생략하면 자동 촬영할 수 있는 장면을 순서대로 저장합니다. 예: `node 홍익온_피치덱/capture.mjs map-printer`.

시뮬레이터 UDID가 다르면 `PRESENTATION_DEVICE` 환경 변수로 지정합니다. 촬영기는 127.0.0.1:8767에서 장면 명령을 제공하고, 이 모드의 앱만 명령을 읽습니다. 앱을 실제로 전환한 뒤 `simctl io screenshot`으로 저장합니다. 웹 렌더링을 휴대폰 모양으로 감싼 이미지가 아닙니다.

네이티브 프로젝트를 다시 빌드할 때 사용한 명령:

```sh
xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Debug \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
  -derivedDataPath /tmp/hongikon-deck-build/DerivedData CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted /tmp/hongikon-deck-build/DerivedData/Build/Products/Debug-iphonesimulator/app.app
```

현재 Xcode에서 Expo CLI가 UDID를 실기기로 오인해 직접 시뮬레이터 대상을 지정했습니다. 생성한 iOS 프로젝트와 빌드 산출물은 저장소에서 제외합니다.

## 데이터와 경계

- `__DEV__`, iOS, `EXPO_PUBLIC_PRESENTATION_DEMO=1`을 모두 만족해야 켜집니다. 일반 개발 및 운영 실행에는 영향을 주지 않습니다.
- 인증은 메모리에 있는 시연 상태입니다. 실제 로그인 토큰을 만들거나 저장하지 않습니다.
- 계정 API, 제보, 질문, 푸시 등록, 피드백 요청은 로컬 응답으로 끝냅니다. 운영 API에는 지도 및 경로의 GET과 상태 GET만 통과시킵니다.
- [notice.json](./notice.json)과 [job-notice.json](./job-notice.json)은 2026-11-14에 공개 API로 받은 공지 스냅샷입니다.
- 물어보기 답변은 그 공개 공지에 근거한 시연 응답입니다. 10월 일정은 지난 안내로 표시합니다. 실제 모델 평가 결과나 실시간 응답으로 소개하지 않습니다.
- 알림은 iOS에 실제로 표시한 로컬 시연 알림입니다. 알림을 눌러 기존 앱의 소식 상세 화면으로 가는 동작을 확인했습니다.
- 근처 알림 원은 테스트 좌표와 실제 업체 좌표로 구성한 시연 영역입니다. 실기기 GPS 감지나 실제 체류 검증 결과가 아닙니다.
- 촬영 모드에서 개발 경고 오버레이를 숨깁니다. 경고와 오류 로그는 Metro에 남습니다. 서명 없는 시뮬레이터의 APNs 키체인 등록 경고는 로컬 알림 표시와 무관합니다.

원문 링크와 알림 탭 장면은 자동 상태 설정 대신 시뮬레이터에서 실제 버튼을 눌러 촬영했습니다. 알림 촬영은 `capture.mjs --hold news-notification`으로 장면을 유지한 뒤 권한을 허용하고 잠금 화면에서 확인합니다. 원문은 `capture.mjs --hold ask-links` 뒤 답변의 원문 링크를 누릅니다. 자동 촬영이 끝나면 8767 서버가 종료되며, `--hold`를 사용한 경우 직접 종료합니다.
