# 위치 기반 실시간 제보 기능 — 구현 계획

**작성일** 2026-08-08
**상태** 계획 확정, Phase 0 착수 중
**관련 문서** [`schema.sql`](./schema.sql) · [`schema-changes.md`](./schema-changes.md)

---

## 1. 무엇을 만드는가

로그인한 사용자가 지도에서 위치를 지정하고, **그 위치에서 지금 진행 중인 일**을 다른 사용자에게 알린다.

> 예시: "문헌관 4층에서 ○○ 행사 진행 중"

이 한 문장에서 세 가지 설계 제약이 따라온다.

| 제약 | 이유 |
|---|---|
| **층이 정보의 단위다** | "문헌관"이 아니라 "문헌관 4층"이어야 쓸모가 있다 |
| **"진행 중"은 시간 구간이다** | 단순 자동 만료가 아니라 시작·종료 시각이 필요하다. 끝난 제보는 지도에서 내려가야 한다 |
| **로그인이 선행된다** | 앱에 인증이 전혀 없으므로 이것부터 만들어야 한다 |

---

## 2. 확정된 결정

| 항목 | 결정 | 비고 |
|---|---|---|
| 백엔드 | **자체 서버 구축** | `docs/schema.sql`(MySQL) 설계를 그대로 활용 |
| 서버 스택 | **Spring Boot 4.1.0** | Initializr 기본값 |
| JDK | **Temurin 21 (LTS)** | Boot 4.1 지원 목록은 17/21/25/26 |
| DB | **MySQL (Docker 컨테이너)** | 로컬에 MySQL 미설치, Docker 29.1.3 사용 |
| 제보 성격 | **실시간 정보 공유** | 진행 중인 행사·활동 |
| 인증 | **로그인 필수** | 악용·명예훼손 리스크 대응 |

### 개발 환경 조사 결과 (2026-08-08)

| 도구 | 상태 |
|---|---|
| Java | 24.0.2, 22.0.2 설치돼 있었으나 **Boot 4.1 지원 목록 밖** → 21 설치함 |
| JDK 21 | ✅ `/opt/homebrew/opt/openjdk@21` (keg-only, 기존 JDK 유지) |
| Maven / Gradle | 미설치 — Spring 프로젝트의 wrapper로 해결 |
| MySQL | 미설치 — Docker로 대체 |
| Docker | ✅ 29.1.3 |

---

## 3. 현재 앱 구조와의 간극

이 기능은 앱을 **오프라인 읽기 전용에서 온라인 쓰기 가능**으로 바꾼다. 작업량 대부분이 제보 UI가 아니라 이 전환 자체에 들어간다.

| 필요한 것 | 현재 상태 |
|---|---|
| 서버 통신 | **없음** — `src/` 전체에 `fetch` 0건 |
| 인증 | **없음** — 로그인 화면·토큰 저장·세션 관리 전무 |
| 백엔드 | **미구현** — `schema.sql`은 DDL 설계만 있고 서버 코드 없음 |
| 테스트 | **없음** — 프레임워크조차 미설치 |

데이터는 전부 빌드 시점에 박히는 정적 자산이다 (`src/constants/*.ts`, `src/data/news.cs.json`). 저장은 `AsyncStorage` 뿐이라 그 기기 안에서만 유효하다 (`src/contexts/SettingsContext.tsx:77`).

---

## 4. 재사용할 기존 패턴

새로 만들지 말고 아래를 따른다.

| 항목 | 출처 | 재사용 방식 |
|---|---|---|
| 층 선택 | `src/components/map/FloorPickerModal.tsx`, `src/utils/floors.ts` | 제보 작성 시 층 선택에 **그대로 사용**. `buildFloorOptions()`가 지하/지상 선택지를 이미 만들어 준다 |
| 층 표기 | `src/utils/floors.ts` `formatFloor()` | `4 → "4F"`, `-1 → "B1"` |
| 지도 탭 → 좌표 | `src/utils/mapHtml.ts:206` | 클릭 리스너 존재. 단 `:228`에서 15m 내 건물로 스냅하고 **원본 좌표를 버린다** → 제보 모드 분기 필요 |
| 마커 렌더 | `src/utils/mapHtml.ts` 제휴 마커 로직 | 제보 마커에 재사용 |
| 상세 시트 | `src/components/map/PartnerSheet.tsx` | `ReportSheet` 구조 미러링 |
| 입력 모달 | `src/components/map/PartnerSearchModal.tsx` | `ReportComposerModal` 구조 미러링 |
| 외부 데이터 검증 | `src/constants/crawledNews.ts` | 서버 응답 검증에 동일 패턴 — 필수 필드 없으면 버리고, 정의 밖 값은 기본값으로 보정 |
| 전역 상태 + 영속화 | `src/contexts/SettingsContext.tsx` | `AuthContext` 구조 미러링. 단 **토큰은 `AsyncStorage`가 아니라 `expo-secure-store`** |
| DB 규약 | `docs/schema.sql`의 `places`, `bookmarks` | `BIGINT AUTO_INCREMENT` PK, `DATETIME DEFAULT CURRENT_TIMESTAMP`, `utf8mb4_unicode_ci`, `ON DELETE CASCADE`, `ix_`/`uq_` 인덱스 접두사 |

**참고할 선례가 없는 것**: 서버 통신, 인증, 폼 유효성 검사, 테스트. 이들은 새로 만들어야 한다.

---

## 5. 스키마 추가안

기존 규약을 그대로 따랐다. `places`가 `(building_id, floor)`로 층을 다루는 방식을 미러링했다.

```sql
CREATE TABLE reports (
  id          BIGINT        NOT NULL AUTO_INCREMENT,
  user_id     BIGINT        NOT NULL,
  building_id BIGINT        NULL COMMENT '건물 밖 제보는 NULL',
  floor       INT           NULL COMMENT '층 미지정 가능. 표기는 formatFloor 규칙',
  lat         DECIMAL(10,7) NOT NULL,
  lng         DECIMAL(10,7) NOT NULL,
  category    VARCHAR(30)   NOT NULL,
  title       VARCHAR(100)  NOT NULL,
  content     VARCHAR(500)  NULL,
  starts_at   DATETIME      NOT NULL COMMENT 'UTC 저장, 표시 시 KST 변환',
  ends_at     DATETIME      NOT NULL COMMENT '이 시각 이후 지도에서 내려감',
  status      VARCHAR(20)   NOT NULL DEFAULT 'active' COMMENT 'active / hidden / deleted',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_reports_live (status, ends_at, starts_at),
  KEY ix_reports_bld (building_id, floor),
  KEY ix_reports_user (user_id, created_at DESC),
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE report_flags (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  report_id  BIGINT      NOT NULL,
  user_id    BIGINT      NOT NULL,
  reason     VARCHAR(30) NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flag (report_id, user_id),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`schema.sql`의 시각 규약(모든 `DATETIME`은 UTC 저장, 표시 시 KST 변환)을 그대로 따른다.

---

## 6. 단계별 구현

| Phase | 내용 | 예상 |
|---|---|---|
| **0. 기반** | Spring Boot 프로젝트 생성, Docker MySQL, `schema.sql` 적용, 앱에 `src/lib/api.ts` HTTP 클라이언트 신설, Jest + `jest-expo` 도입 | 3~5일 |
| **1. 인증** | 소셜 로그인(카카오/구글), 로그인 화면, `expo-secure-store` 토큰 저장, `AuthContext` | 4~6일 |
| **2. 제보 API** | `POST /reports`, `GET /reports?live=true`, `POST /reports/:id/flags`, `DELETE /reports/:id`(본인만). 서버 측 검증·rate limit | 3~4일 |
| **3. 위치·층 지정** | `mapHtml.ts` 클릭 핸들러에 제보 모드 분기(원본 좌표 유지 + 근처 건물 후보), `FloorPickerModal` 재사용 | 2~3일 |
| **4. 작성 UI** | `ReportComposerModal.tsx` — 카테고리·제목·내용·진행 시간 입력 | 3~4일 |
| **5. 표시** | 제보 마커, `ReportSheet.tsx`, "○분 전 등록 · ○시까지" 신선도 표기, 종료 제보 자동 제외 | 3~4일 |
| **6. 신고·모더레이션** | 신고 버튼, 임계치 도달 시 자동 `hidden`, 운영자 확인 수단 | 2~3일 |

**총 3~5주.** 순수 개발 시간이며, 모더레이션 정책 수립과 개인정보 처리방침 갱신은 별도다.

Phase 0에서 테스트 프레임워크를 먼저 깐다. 이후 단계를 TDD로 진행하기 위해서다.

---

## 7. 리스크

| 리스크 | 심각도 | 대응 |
|---|---|---|
| **허위 제보** — "행사 중"이 사실인지 검증 불가 | **높음** | 작성자 표시, 신고 기능, 종료 시각 강제로 오래 남지 않게 |
| **명예훼손·비방** — 캠퍼스 지도 특성상 특정 개인 지목 위험 | **높음** | 로그인 필수 + Phase 6 필수 |
| **개인정보** — 위치·계정 정보 수집 시작 | 높음 | 개인정보 처리방침 갱신 필수 (설정 탭에 화면 이미 있음) |
| 인증이 일정의 최대 변수 | 중간 | 카카오/애플 심사·키 발급에 실기간 소요. Phase 1을 먼저 착수 |
| 온라인 의존으로 앱 성격 변화 | 중간 | 네트워크 실패 시 소식·지도·제휴 기능은 그대로 동작하도록 격리 |
| 운영 주체 부재 | 중간 | 신고 검토를 누가 할지 정해야 함 |
| 테스트 인프라 부재 | 중간 | Phase 0에서 도입 |

---

## 8. 미정 항목

임의로 정하지 않았다. 확정 후 이 문서를 갱신한다.

- **제보 카테고리 목록** — 행사/공연/푸드트럭/부스 등 실제로 쓸 항목. 앱의 기존 `CategoryKey` 7종(공지·장학·행사·수강·시설·취업·상담)과는 **별개 축**이다.
- **제보 최대 지속 시간** — `ends_at`의 상한. 무제한이면 지도가 오래된 제보로 덮인다.
- **신고 임계치** — 몇 건이 쌓이면 자동으로 숨길 것인가.
- **서버 배포처** — 어디에 띄울 것인가.
