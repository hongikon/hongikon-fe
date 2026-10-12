# App Store Connect 등록 문안 (한국어, v1.0.0)

App Store Connect에 그대로 붙여 넣는 값이다. 근거와 판단 이유는 `store-submission-kit.md` §1에 있다.
코드 블록 안의 글자만 복사한다. 앱 동작이 바뀌면(기능 추가·삭제, 권한 변경) 이 파일도 함께 고친다. 설명과 실제 동작이 다르면 심사 지침 2.3 위반이다.

## 앱 생성(신규 앱)

| 필드 | 값 |
|---|---|
| 플랫폼 | iOS |
| 이름 | `홍익온` |
| 기본 언어 | 한국어 |
| 번들 ID | `com.hongikon.app` |
| SKU | `hongikon-ios-001` |
| 사용자 액세스 | 전체 액세스 |

## 앱 정보

| 필드 | 값 |
|---|---|
| 이름 (2–30자) | `홍익온` |
| 부제 (≤30자) | `캠퍼스 지도·학과 공지 알림·제휴 할인` |
| 기본 카테고리 | 교육(Education) |
| 보조 카테고리 | 유틸리티(Utilities) |
| 개인정보 처리방침 URL | `https://hongikon.com/privacy/` |

부제 대안: `학과 공지 알림과 캠퍼스 지도`

## 버전 페이지(1.0)

### 프로모션 텍스트 (≤170자)

```
구독한 학과·학교 게시판에 새 공지가 올라오면 알림으로 알려 드려요. 캠퍼스 지도에서 건물·편의시설을 찾고, 학생회 제휴 할인과 운영진이 확인한 캠퍼스 제보도 한곳에서 확인하세요.
```

### 설명 (≤4000자)

맨 아래 "앱 접근권한 안내" 블록은 정보통신망법 시행령 제9조의2의 앱 마켓 고지를 겸한다.

```
※ 홍익온은 홍익대학교 학생들이 만든 비공식 서비스로, 홍익대학교와 공식 관계가 없어요.

홍익온은 홍익대학교 서울캠퍼스 생활에 필요한 정보를 한곳에 모은 앱이에요.

■ 학과·학교 공지 알림
- 학교 공지와 학과 게시판의 새 글을 모아서 보여 드려요.
- 원하는 게시판을 구독하면 새 공지가 올라왔을 때 알림을 보내 드려요. 게시판별·분야별로 켜고 끌 수 있어요.
- 모든 공지에 출처 게시판을 표시하고, '원문 보기'로 학교 홈페이지 원문을 열 수 있어요.

■ 캠퍼스 지도
- 건물과 층별 편의시설(프린터, 라운지 등)을 지도에서 찾을 수 있어요.
- 휴대폰 위치(GPS)는 사용하지 않아요.

■ 제휴 할인
- 학생회·단과대학이 공개한 제휴 업체와 혜택을 지도와 목록으로 볼 수 있어요.
- 혜택 내용과 기간은 업체 사정에 따라 바뀔 수 있어요.

■ 캠퍼스 제보
- 행사, 푸드트럭 같은 캠퍼스 소식을 지도에 제보할 수 있어요(로그인 필요). 사진은 최대 3장까지 붙일 수 있어요.
- 제보는 운영진이 확인한 뒤 지도에 표시돼요. 부적절한 제보는 신고하고, 원하지 않는 작성자의 제보는 숨길 수 있어요.
- 제보에 댓글·답글로 지금 상황을 덧붙일 수 있어요(로그인 필요). 부적절한 댓글도 신고하거나 작성자를 숨길 수 있어요.

■ 로그인 없이 둘러보기
- 지도, 공지, 제휴 정보는 로그인 없이 볼 수 있어요.
- 공지 알림, 제보, 댓글, 신고는 카카오 또는 Apple로 로그인한 뒤에 쓸 수 있어요.
- 설정 > 회원 탈퇴에서 언제든 계정과 데이터를 삭제할 수 있어요.

■ 앱 접근권한 안내(모두 선택)
- 알림: 구독한 게시판의 새 공지, 내 제보 처리 결과·새 댓글과 캠퍼스 새 제보 알림
- 카메라: 제보에 붙일 사진(최대 3장) 촬영(카메라로 찍기 버튼을 누를 때만 요청)
- 사진: 제보에 붙일 사진(최대 3장) 선택(앨범에서 고르기 버튼을 누를 때만 요청)
선택 접근권한은 허용하지 않아도 앱을 쓸 수 있고, 해당 기능만 제한돼요. 휴대폰 설정에서 언제든 바꿀 수 있어요.
위치, 연락처, 마이크 권한은 요청하지 않아요.

■ 문의
- 앱 설정 > 문의하기, 또는 hongikonsupport@gmail.com
- 개인정보 처리방침: https://hongikon.com/privacy/
```

### 키워드 (≤100바이트, 쉼표 구분, 공백 없음)

이름·부제에 이미 있는 단어(홍익온, 캠퍼스, 지도, 학과, 공지, 알림, 제휴, 할인)는 넣지 않는다.

권장(97바이트):
```
홍대,홍익대,대학생,강의실,편의시설,장학,학사,구독,제보,게시판,신입생
```

보수안(97바이트, 학교 이름 없음. 제3자 상표 지적(5.2.1)을 피하고 싶을 때):
```
대학생,강의실,건물,편의시설,장학,학사,구독,제보,게시판,학생회,신입생
```

쓰지 말 것: "공식", "카카오", "에브리타임" 같은 다른 앱·회사 이름, "홍익대 공식앱"

### 그 밖의 필드

| 필드 | 값 |
|---|---|
| 지원 URL | `https://hongikon.com/support/` |
| 마케팅 URL(선택) | `https://hongikon.com/` |
| 저작권 | `2026 [계정 소유자 실명]` (사람이 입력. 개인 계정이면 실명이 가장 정확하다) |
| 버전 출시 | 수동 출시 |

이번 버전의 새로운 기능(첫 버전은 선택):
```
홍익온의 첫 버전이에요. 학과·학교 공지 알림, 캠퍼스 지도, 제휴 할인, 캠퍼스 제보를 써 보세요.
```

## 앱 개인정보(App Privacy)

- 데이터를 수집합니까? **예**
- 추적(Tracking)? **아니요** (광고 SDK·IDFA 없음, ATT 프롬프트 불필요)

| 데이터 유형 | 우리 데이터 | 사용자에 연결 | 추적 | 목적 |
|---|---|---|---|---|
| 연락처 정보 › 이름 | 카카오 닉네임, Apple 이름(공유 시), 앱 닉네임 | 예 | 아니요 | 앱 기능 |
| 연락처 정보 › 이메일 주소 | 문의·정보 제보의 답변용 이메일(선택) | 예 | 아니요 | 앱 기능 |
| 사용자 콘텐츠 › 사진 또는 비디오 | 제보 첨부 사진 | 예 | 아니요 | 앱 기능 |
| 사용자 콘텐츠 › 고객 지원 | 문의 내용 | 예 | 아니요 | 앱 기능 |
| 사용자 콘텐츠 › 기타 사용자 콘텐츠 | 제보(지도에서 고른 좌표 포함), 제보 댓글, 신고 사유, 정보 제보, 알림 키워드 | 예 | 아니요 | 앱 기능 |
| 식별자 › 사용자 ID | 카카오 회원번호, Apple 사용자 식별자, 내부 회원번호 | 예 | 아니요 | 앱 기능 |
| 식별자 › 기기 ID | Expo 푸시 토큰 | 예 | 아니요 | 앱 기능 |
| 진단 › 충돌 데이터 | expo-updates 오류 보고 | **아니요** | 아니요 | 앱 기능 |
| 기타 데이터 › 기타 데이터 유형 | 구독 게시판, 게시판·분야별 알림 설정, 제보 알림 설정 | 예 | 아니요 | 앱 기능 |

신고하지 않는 것: 위치(기기 위치를 쓰지 않음. 제보 좌표는 사용자가 지도에서 고른 장소라 기타 사용자 콘텐츠로 분류), IP·접속 로그(보안 목적), 북마크(기기에만 저장).

## 연령 등급 설문 → 13+

| 질문 | 답 |
|---|---|
| 자녀 보호 기능 | 아니요 |
| 연령 확인(Age Assurance) | 아니요 (로그인 전 "만 14세 이상" 체크는 본인 확인일 뿐 연령 확인 수단이 아님) |
| 무제한 웹 접근 | 아니요 |
| 사용자 생성 콘텐츠 | 예 |
| 메시지 및 채팅 | 예(보수) |
| 소셜 미디어 | 아니요 |
| 광고 | 아니요 |
| 비속어·저속한 유머 / 공포 | 없음 |
| 알코올, 담배 또는 약물 사용·언급 | 드물게(Infrequent) — 제휴 주류 할인 |
| 의료·성적 내용·폭력·확률 기반 활동 | 없음 |

## 콘텐츠 권한

- 제3자 콘텐츠 포함: **예** (학교 공지, 학생회 제휴 정보, 네이버 지도)
- 권리 보유: 학교·학생회 확인을 받은 뒤에 **예**로 답한다(`store-submission-kit.md` §1-8).

## 앱 심사 정보

- 연락처: 이름, 이메일 `hongikonsupport@gmail.com`, 전화 `+82 10-XXXX-XXXX` (사람이 입력)
- 로그인 필요: 켬. 사용자 이름 `hongikon.review`, 비밀번호는 운영 서버 `.env` 의 `DEMO_LOGIN_PASSWORD`(저장소에 적지 않는다).
  앱에서는 시작 화면 로고를 5번 눌러 여는 심사용 로그인(`POST /auth/demo`, 서버 `DEMO_LOGIN_ENABLED=true` 일 때만). 심사가 끝나면 끄고 비밀번호를 바꾼다.
- 화면 녹화(실기기, 10-11): Google Drive 링크를 메모 맨 위에 둔다. 영상만으로는 데모 계정을 대신할 수 없다(베타 심사 반려 사유).
- 메모(영어, ≤4000바이트):

```
HongikOn (홍익온) is a free, unofficial campus companion app for Hongik University (Seoul, Korea), built by a student team. It is not affiliated with or endorsed by the university; this is stated on the welcome screen, at the bottom of Settings, and in the description. No paid content, subscriptions or in-app purchases.

Screen recording (physical iPhone, from launch: onboarding, browse mode, sign-in and consent, map, notices, posting a report, report/block, comments, account deletion):
https://drive.google.com/file/d/1KJpv7AklMJPMwFaNdKuX1KaY-gX0Q6U6/view?usp=share_link

During TestFlight beta review we were asked for a demo account. This build includes a dedicated review sign-in that does not depend on a third-party (Kakao) account. Credentials are in the Sign-In Information fields above.

1) Signing in with the review account
- On the welcome screen, tap the "HONGIK ON" logo 5 times quickly. A "심사용 로그인" (Review sign-in) dialog opens.
- Enter the User Name and Password above and tap "로그인".
- On the first sign-in, check "모두 확인하고 동의해요" and tap "동의하고 시작하기" (Terms, Privacy Policy, age 14+).
- The review account has sample content: department subscriptions, bookmarked notices and approved campus reports.
- Sign in with Apple is also available on the welcome screen and in Settings > 로그인하기.

2) Without an account
- Tap "둘러보기" (Browse). The map, facilities, partner discounts and notices work fully as a guest.

3) Main features
- Map tab: search finds partner stores and campus facilities (e.g. "프린터", "행정실", "총학생회"); selecting a facility moves to its building and highlights the floor. The bottom sheet snaps to three sizes.
- News tab: subscribe to boards (bell icon) and bookmark notices. Under 대학 > 국제협력본부 there are two new boards (국제교류실 공지, 글로벌역량 지원사업); pinned notices from the original board appear in a collapsible group above the list.
- Settings tab: notifications, keyword alerts, nickname, my reports, update history, account deletion.

4) User-generated content (campus reports) and moderation
- Map tab > megaphone button > pick a location > title/content > up to 3 photos > "제보 올리기". Camera/photo access is requested only when you tap the camera or album button.
- Reports are PRE-MODERATED and shown only after an admin approves them. Approved sample reports are already on the map near the campus center. During review an admin approves test reports within about 30 minutes.
- Every report and comment has "신고" (flag with reasons) and "이 사용자 숨기기" (block the author) in the "⋮" menu. Content flagged by 3+ users is hidden automatically until an admin reviews it. Admins can remove content and suspend users.

5) Account deletion
- Settings > 일반 > 회원 탈퇴 > "예, 탈퇴할게요". The account and its reports, photos, comments, subscriptions and push tokens are deleted immediately.

6) Other notes
- The app does not use device location; report locations are picked manually on the map.
- Notices are collected from public Hongik University boards; each shows its source and links to the original ("원문 보기").
- Contact: hongikonsupport@gmail.com, https://hongikon.com/support/
```

제출 전 확인: 메모의 기능(신고 사유, 숨기기, 자동 숨김 3회, 관리자 정지, Apple 토큰 폐기, 제보 댓글과 댓글 신고·자동 숨김)이 운영 서버에 배포돼 있어야 한다. 없는 기능이 있으면 해당 문장을 지운다.
