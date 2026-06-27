# 홍익대알리미

> 홍익대학교 학생을 위한 공지사항 알림 & 캠퍼스 정보 앱

<br>

## 소개

**홍익대알리미**는 홍익대학교 학생들이 학교 공지사항을 더 쉽게 확인할 수 있도록 만든 React Native 모바일 앱입니다. 학과·대학별 소식을 한눈에 모아보고, 관심 채널을 구독하거나 즐겨찾기로 저장해 중요한 정보를 놓치지 않을 수 있습니다.

<br>

## 주요 기능

### 소식 탭
| 탭 | 설명 |
|---|---|
| 즐겨찾기 | 자주 보는 소식 채널을 한 곳에서 확인 |
| 구독 | 구독 중인 학과·기관의 최신 공지 모아보기 |
| 전체 | 단과대학 → 학과 트리 구조로 원하는 소식 탐색 |

각 소식 카드에는 **카테고리 배지**, **날짜**, **출처 기관**이 표시되며, 상세 본문 화면으로 바로 이동할 수 있습니다.

### 캠퍼스 지도 *(예정)*
- 건물 위치 및 정보 표시
- 즐겨찾는 건물 등록
- 네이버/카카오 지도 연동 및 GPS 현위치 표시 예정

### 설정 탭
- **구독 소식 알림** 토글
- **기본 지도 유형** 선택 (일반 / 위성 / 지형)
- **즐겨찾는 건물** 관리
- 앱 공지사항 및 업데이트 내역 확인
- 이용약관 / 개인정보 처리방침 열람
- 설정 초기화

<br>

## 기술 스택

| 항목 | 내용 |
|---|---|
| 프레임워크 | [Expo](https://expo.dev) v56 + React Native 0.85 |
| 언어 | TypeScript 6 |
| 내비게이션 | React Navigation 7 (Bottom Tabs + Native Stack) |
| 로컬 저장소 | AsyncStorage |
| 아이콘 | @expo/vector-icons (Ionicons) |
| 벡터 그래픽 | react-native-svg |

<br>

## 프로젝트 구조

```
src/
├── constants/
│   ├── colors.ts            # 색상 토큰 및 카테고리 색상
│   ├── news.ts              # 학과 트리 & 소식 데이터
│   └── buildings.ts         # 건물 목록
├── contexts/
│   └── SettingsContext.tsx  # 앱 전역 설정 상태
├── navigation/
│   ├── RootNavigator.tsx    # 스택 네비게이터
│   └── TabNavigator.tsx     # 하단 탭 네비게이터
├── screens/
│   ├── NewsScreen.tsx        # 소식 목록 (탭 + 트리뷰)
│   ├── NewsDetailScreen.tsx  # 소식 상세
│   ├── MapScreen.tsx         # 캠퍼스 지도
│   ├── SettingsScreen.tsx    # 설정
│   └── OnboardingScreen.tsx  # 첫 실행 온보딩
├── components/
│   └── feedback/
│       └── EmptyState.tsx
└── types/
    └── index.ts
```

<br>

## 시작하기

### 요구사항

- Node.js 18+
- pnpm
- iOS Simulator 또는 Android Emulator, 또는 실기기에 [Expo Go](https://expo.dev/go) 설치

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 개발 서버 시작
pnpm dev

# 플랫폼별 실행
pnpm ios      # iOS 시뮬레이터
pnpm android  # Android 에뮬레이터
pnpm web      # 웹 브라우저
```

<br>

## 지원 학과

건축도시대학, 경영대학, 경제학부, 공과대학, 공연예술학부, 디자인예술경영학부, 문과대학, 미술대학, 법과대학, 사범대학, 사회과학대학, 상경대학, 세종학부, 영상애니메이션학부, 조형대학 등 홍익대학교 전 학과를 포함합니다.

<br>

## 개인정보 보호

- 모든 설정 정보(알림, 즐겨찾기 등)는 **기기 내부에만** 저장됩니다.
- 서버로 전송되는 개인 정보가 없습니다.
- 앱 삭제 시 모든 데이터가 자동으로 삭제됩니다.

<br>

## 라이선스

[LICENSE](./LICENSE) 파일을 참고하세요.
