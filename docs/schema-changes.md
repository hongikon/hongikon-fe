# 백엔드 스키마 리뷰 및 변경 내역

**작성일** 2026-07-28
**대상** 초안 ERD (MySQL DDL)
**결과물** [`docs/schema.sql`](./schema.sql) — 아래 변경이 모두 반영된 전체 DDL

리뷰 기준은 **앱 코드**입니다. 스키마가 앱의 실제 타입·동작과 맞는지를 1:1로 대조했습니다.

| 대조한 앱 파일 | 확인한 내용 |
|---|---|
| `src/types/index.ts` | `Building` / `Partner` / `NewsItem` 필드와 optional 여부 |
| `src/constants/colors.ts` | `CategoryKey` 7종 |
| `src/constants/news.ts` | `TREE_DATA` — 공지 출처 트리 구조 |
| `src/contexts/SettingsContext.tsx` | 구독 2축(학과 + 카테고리), 즐겨찾기 식별 방식 |
| `src/constants/partners.ts` | 제휴 업체 65개 (706줄) |
| `scripts/scrape-hongik-news.mjs` | 크롤러의 중복 삽입 가능성 |

---

## ⚠️ 먼저 결정해야 할 2가지

스키마를 확정하기 전에 **사람이 합의해야** 하는 항목입니다. 임의로 정하지 않고 가정을 세워 진행했으며, 두 가정 모두 **틀려도 되돌리는 비용이 거의 0이 되도록** 설계했습니다.

### 결정 1 — 알림 카테고리는 몇 종인가

| | 목록 |
|---|---|
| **앱 (현재 동작 중)** | 공지 · 장학 · 행사 · 수강 · **시설** · **취업** · **상담** — 7종 |
| **초안 ERD** | notice · event · scholarship · lecture · **contest** · **club** — 6종 |

- 앱에만 있음 → `시설`, `취업`, `상담` (초안대로면 **알림 설정 자체가 불가능**)
- ERD에만 있음 → `공모전`, `동아리` (앱에 해당 화면 없음)

> **임시 결정**: 앱의 7종을 채택했습니다. 이미 색상까지 구현되어 동작 중이기 때문입니다.
> **되돌리는 비용**: 컬럼이 아니라 **행**으로 저장하도록 바꿨으므로, 공모전·동아리를 추가하려면 `INSERT` 한 줄이면 됩니다. `ALTER TABLE` 불필요.

### 결정 2 — `subscriptions.keyword`의 정체는 무엇인가

| 해석 | 문제 |
|---|---|
| 카테고리 | `notification_settings.notify_*`와 **완전 중복** |
| 학과 | `user_departments`와 **완전 중복** |
| 자유 검색어 | 중복 아님. 단 매칭 로직·인덱스 설계가 달라짐 |

앱은 `subscribedDepts`(학과) + `subscribedCategories`(카테고리) **2축**입니다 (`SettingsContext.tsx:11-12`). 3축이 아닙니다.

> **임시 결정**: "자유 키워드 알림"으로 해석하고 `keyword_subscriptions`로 **개명**해 의도를 이름에 명시했습니다.
> **되돌리는 비용**: 원래 의도가 카테고리였다면 **이 테이블만 삭제**하면 됩니다. 다른 테이블이 참조하지 않습니다.

---

## 1. 한눈에 보기

### 변경 통계

| 구분 | 수 |
|---|---|
| 신규 테이블 | 4 |
| 테이블 개명 | 1 |
| 컬럼 삭제 | 7 |
| 컬럼 추가 | 12 |
| `UNIQUE` 제약 추가 | 9 |
| 인덱스 추가 | 11 |
| `NOT NULL` 완화 | 1 |
| `ON DELETE` 정책 지정 | 전체 FK |

### 테이블별 변경 매트릭스

| 테이블 | 신규 | 컬럼 | UNIQUE | 인덱스 | FK 정책 | 비고 |
|---|:--:|:--:|:--:|:--:|:--:|---|
| `users` | | ➖ | ✅ | | | `fcm_token` 분리, 소셜 충돌 수정 |
| `user_devices` | 🆕 | | ✅ | ✅ | ✅ | 멀티 디바이스 |
| `departments` | | ➕ | ✅ | | | `kind` 추가 |
| `user_departments` | | | ✅ | | ✅ | |
| `buildings` | | ➕➕➕➕ | ✅ | | | `floors` NULL 허용 |
| `places` | | ➕ | | ✅ | ✅ | `is_overnight` |
| `partners` | 🆕 | | | ✅ | | **초안에 없던 핵심 테이블** |
| `partner_affiliations` | 🆕 | | ✅ | ✅ | ✅ | N:M |
| `news` | | | ✅ | ✅✅✅ | ✅ | 크롤러 중복 방지 |
| `bookmarks` | | | ✅ | ✅ | ✅ | |
| `notification_categories` | 🆕 | | ✅ | | ✅ | `notify_*` 대체 |
| `notification_settings` | | ➖➖ | ✅ | | ✅ | 마스터 스위치만 |
| `keyword_subscriptions` | 📝 | | ✅ | | ✅ | `subscriptions` 개명 |
| `notifications` | | | | ✅ | ✅ | |
| `route_nodes` | | | | ✅ | ✅ | |
| `route_edges` | | | ✅ | ✅ | ✅ | `CHECK` 추가 |

🆕 신규 · 📝 개명 · ➕ 컬럼 추가 · ➖ 컬럼 삭제

---

## 2. CRITICAL — 반드시 고쳐야 했던 3건

### C-1. 제휴 업체 테이블이 통째로 없었음

앱 최대 데이터 자산인 **제휴 업체 65곳**(`src/constants/partners.ts`, 706줄)을 저장할 곳이 없었습니다.

`places`로 대체 불가입니다. `places.building_id`가 `NOT NULL`인데, 제휴 업체는 **교외 상권**(와우산로 · 독막로 · 연남동)이라 소속 건물이 없습니다.

**추가한 테이블**

```sql
CREATE TABLE partners (
  id, name, category, latitude, longitude,
  benefit,                      -- 제휴 혜택 (63곳 보유, 시트의 핵심)
  address, road_address,
  hours, contact,               -- ⚠️ 수동 입력 전용 (아래 참고)
  map_icon, link_label, link_url
);

CREATE TABLE partner_affiliations (   -- N:M
  partner_id, affiliation       -- 총학생회 / 미술대학 / 공과대학 ...
);
```

**`affiliations`를 별도 테이블로 분리한 이유**: 한 가게가 총학생회와 단과대 **양쪽과 동시에** 계약한 경우가 있습니다 (`src/types/index.ts:78` — `affiliations?: PartnerAffiliation[]`). 컬럼 하나로는 표현이 안 됩니다.

> **`hours` / `contact`에 주의 주석을 남겼습니다.**
> 네이버 지역검색 API 실측 결과, 매칭된 54곳 **전부** `telephone`이 빈 문자열이었고 영업시간 필드는 API에 아예 없습니다. 나중에 "API로 채우면 되지"라는 오해가 없도록 스키마에 명시했습니다.

### C-2. 소셜 로그인 계정이 섞일 수 있었음

```sql
-- 전 ❌
UNIQUE KEY uq_social_id (social_id)

-- 후 ✅
UNIQUE KEY uq_users_social (social_type, social_id)
```

**증상**: 카카오 유저 `12345`와 구글 유저 `12345`는 서로 다른 사람인데 DB가 동일인으로 취급합니다. 먼저 가입한 쪽이 나중 가입자의 가입을 막거나, 조회 로직에 따라 **남의 계정으로 로그인**될 수 있습니다.

### C-3. 알림 카테고리 불일치 + 컬럼 하드코딩

```sql
-- 전 ❌  notification_settings 에 BOOLEAN 컬럼 6개
notify_notice, notify_event, notify_scholarship,
notify_lecture, notify_contest, notify_club

-- 후 ✅  행 기반
CREATE TABLE notification_categories (
  user_id  BIGINT      NOT NULL,
  category VARCHAR(30) NOT NULL,
  enabled  BOOLEAN     NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, category)
);
-- notification_settings 에는 push_enabled 마스터 스위치만 남김
```

문제가 두 겹이었습니다.

1. **집합 불일치** — 앱의 `시설` / `취업` / `상담`은 알림 설정이 불가능했습니다 (위 결정 1 참고)
2. **확장 시 스키마 변경** — 카테고리를 하나 추가할 때마다 `ALTER TABLE`이 필요했습니다

행 기반으로 바꾸면서 두 문제가 동시에 사라졌고, **결정 1이 어느 쪽으로 나든 마이그레이션이 불필요**해졌습니다.

---

## 3. HIGH — 4건

### H-1. 크롤러가 실행할 때마다 전체 중복 삽입

`news.source_url`에 `UNIQUE`가 없었습니다. `scripts/scrape-hongik-news.mjs`는 실행 시마다 같은 목록을 긁으므로, **돌릴 때마다 같은 게시글이 통째로 다시 쌓입니다.**

```sql
UNIQUE KEY uq_news_source_url (source_url)
```

→ 크롤러는 `INSERT ... ON DUPLICATE KEY UPDATE`로 작성하면 몇 번을 돌려도 안전합니다.

### H-2. 중복 방지 제약 전반 누락

| 테이블 | 초안에서 가능했던 일 | 추가한 제약 |
|---|---|---|
| `bookmarks` | 같은 글 무한 북마크 | `(user_id, news_id)` |
| `keyword_subscriptions` | 같은 키워드 중복 구독 | `(user_id, keyword)` |
| `user_departments` | 같은 학과 중복 구독 | `(user_id, department_id)` |
| `departments` | `컴퓨터공학과` 행 여러 개 | `(college, name)` |
| `buildings` | 동명 건물 공존 | `(name)` |
| `user_devices` | 토큰 중복 등록 | `(push_token)` |
| `route_edges` | 같은 간선 중복 | `(from_node_id, to_node_id)` |

> **`buildings(name)`을 UNIQUE로 만든 근거**: 앱이 즐겨찾기를 **건물 이름으로 식별**합니다 — `toggleFavoriteBuilding(name: string)` (`SettingsContext.tsx:73`), `favoriteBuildings: string[]`. 이름이 중복되면 즐겨찾기가 엉뚱한 건물에 걸립니다.

### H-3. `buildings.floors NOT NULL`이 앱 규칙과 충돌

`src/types/index.ts:17-20`:
```ts
/** 지상 층수. 확인된 값만 채운다. 없으면 층 선택 다이얼을 건너뛴다. */
floors?: number
/** 지하 층수. 지하가 없으면 생략한다. */
basementFloors?: number
```

- `floors`는 **의도적 optional**입니다. `NOT NULL`이면 미확인 건물을 표현할 수 없고, `0`을 넣으면 "미확인"과 "지하만 있는 건물"이 구분되지 않습니다
- **`basement_floors` 컬럼이 초안에 아예 없어** 지하층 정보가 통째로 유실됩니다

**추가/변경한 컬럼**

| 컬럼 | 변경 | 근거 |
|---|---|---|
| `floors` | `NOT NULL` → `NULL` | 위 주석 |
| `basement_floors` | 🆕 | `Building.basementFloors` |
| `color` | 🆕 | 앱의 모든 건물이 마커 색 보유 |
| `map_category` | 🆕 (보류 항목 확정) | `FilterChip`이 이미 사용 중 |
| `facilities` | 🆕 `JSON` | `Building.facilities?: string[]` |

> **보류 중이던 `category` 네이밍 충돌 해결**: `buildings.map_category`로 명명했습니다. `places.category`(카페·식당…)와 값 도메인이 완전히 달라(`강의`·`식당`·`편의`·`주차`) 컬럼명만 분리하면 충돌이 없습니다.

### H-4. 푸시 토큰이 유저당 1개뿐

```sql
-- 전 ❌  users.fcm_token VARCHAR(255)
-- 후 ✅  user_devices (user_id, push_token, token_type, platform, is_active)
```

**증상**: 폰 + 태블릿을 쓰면 나중에 로그인한 기기가 이전 토큰을 덮어써 **앞 기기의 알림이 끊깁니다.**

**`token_type`을 둔 이유**: 이 앱은 Expo(`expo ~56.0.12`)입니다. Expo Push를 쓰면 토큰이 `ExponentPushToken[...]` 형식이라 FCM 토큰이 아닙니다. `fcm_token`이라는 이름 자체가 오해를 부릅니다.

> 참고: `expo-notifications`는 **아직 미설치**입니다. 앱의 `subscriptionAlert`는 현재 저장만 되고 아무 동작도 하지 않습니다.

---

## 4. MEDIUM — 6건

### M-1. 구독 모델 3중화 → 2축 정리

| 축 | 담당 테이블 |
|---|---|
| 학과 | `user_departments` |
| 카테고리 | `notification_categories` |
| 키워드 | `keyword_subscriptions` (← 결정 2) |

### M-2. `departments`에 `kind` 추가

앱 `TREE_DATA`에는 학과가 아닌 **행정기관**이 섞여 있습니다 — `학사`, `장학`, `학생상담`, `학생활동`, `교수학습지원`, `대학혁신지원사업`. `교양과`는 하위 학과가 없습니다.

`kind`(`department` / `office`)로 구분해 UI가 나눠 보여줄 수 있게 했습니다.

> 테이블명은 실체상 `news_sources`가 정확하지만, **개명하지 않았습니다.** 동작에 지장이 없는데 백엔드 코드 전반을 건드리게 되기 때문입니다. 권고만 남깁니다.

### M-3. 인덱스 11개 추가

초안에는 조회용 인덱스가 **하나도 없어** 목록 화면이 곧 풀스캔이었습니다.

```sql
ix_news_published          (published_at DESC)
ix_news_dept_published     (department_id, published_at DESC)
ix_news_category_published (category, published_at DESC)
ix_notif_user_unread       (user_id, is_read, created_at DESC)   -- 안읽음 뱃지
ix_places_bld_floor        (building_id, floor)
ix_bookmark_user           (user_id, created_at DESC)
ix_partner_category / ix_affiliation / ix_device_user
ix_node_building / ix_edge_from
```

### M-4. `places.is_overnight` 추가

주점이 `18:00~02:00`이면 `close_time < open_time`이 되어 `BETWEEN` 조회가 **조용히 빈 결과**를 반환합니다. 플래그로 명시해 쿼리에서 분기하도록 했습니다.

> **남은 한계**: 요일별로 다른 영업시간은 이 구조로 표현할 수 없습니다. 필요해지면 `place_hours(place_id, day_of_week, open, close)`로 분리해야 합니다.

### M-5. `ON DELETE` 정책 전면 지정

MySQL 기본값은 `RESTRICT`라, 초안대로면 **회원 탈퇴가 FK에 막혀 실패**합니다.

| 관계 | 정책 | 이유 |
|---|---|---|
| `users` → bookmarks / subs / notifications / devices | `CASCADE` | 탈퇴 처리 |
| `news` → bookmarks | `CASCADE` | |
| `news` → notifications | `SET NULL` | 기사가 지워져도 알림 이력 보존 |
| `departments` / `buildings` → news | `SET NULL` | 출처가 지워져도 기사는 유지 |
| `buildings` → places / route_nodes | `CASCADE` | |
| `partners` → partner_affiliations | `CASCADE` | |

### M-6. `is_primary` 다중 true 문제 (미해결)

`user_departments.is_primary`가 여러 개 `true`가 되는 것을 **DB로는 막지 못합니다** (MySQL에는 부분 유니크 인덱스가 없습니다).

→ 애플리케이션에서 "새 primary 지정 시 기존 것 해제"를 **같은 트랜잭션 안에서** 처리해야 합니다. 스키마 주석에 명시했습니다.

---

## 5. LOW — 4건

| 항목 | 조치 |
|---|---|
| 문자셋 | 전 테이블 `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`. `utf8mb3`면 이모지 INSERT가 실패합니다 |
| 타임스탬프 | `DEFAULT CURRENT_TIMESTAMP` / `ON UPDATE CURRENT_TIMESTAMP` 추가 |
| 타임존 | 파일 상단에 **UTC 저장, 표시 시 KST 변환** 규약 명시 |
| 자기 간선 | `route_edges`에 `CHECK (from_node_id <> to_node_id)` (MySQL 8.0.16+에서 강제) |

---

## 6. 적용 체크리스트

- [ ] **결정 1** 확정 — 알림 카테고리 7종 vs 6종
- [ ] **결정 2** 확정 — `keyword` 의 정체 (자유 키워드 / 카테고리)
- [ ] `buildings.cx` / `cy` / `anchor_x` / `anchor_y` **의미 확인** — 현재 `TODO` 주석만 있고 임의 해석하지 않았습니다
- [ ] `route_edges` **방향성 정책 통일** — 무향(양방향 2행) vs 단방향+`UNION`
- [ ] **경로 기능 우선순위 재검토** — 앱 `src/constants/route.ts`는 8줄(상수 2개)뿐으로 실질 미구현입니다. 캠퍼스 전체 노드/엣지 구축은 큰 작업이라 지금 필요한지 판단이 먼저입니다
- [ ] `docs/schema.sql` **문법 실행 검증** — 작성 시점에 로컬에 mysql 클라이언트가 없고 Docker가 미실행이라 **실제 적용 테스트를 하지 못했습니다.** 테이블 생성 순서·FK 타입·NULL 정합성은 수동 대조했습니다
- [ ] 기존 DB가 이미 배포된 경우 → `CREATE` 전문이 아닌 **`ALTER` 마이그레이션 스크립트**가 별도로 필요합니다

---

## 부록 — 신규 테이블 4종 요약

| 테이블 | 목적 | 대응하는 앱 코드 |
|---|---|---|
| `partners` | 제휴 업체 65곳 | `src/constants/partners.ts` |
| `partner_affiliations` | 업체 ↔ 제휴 주체 N:M | `Partner.affiliations` |
| `user_devices` | 멀티 디바이스 푸시 토큰 | (미구현 — `expo-notifications` 필요) |
| `notification_categories` | 카테고리별 알림 on/off | `SettingsContext.subscribedCategories` |

전체 DDL은 [`docs/schema.sql`](./schema.sql)을 참고하세요.
