-- 홍익대알리미 백엔드 스키마 (리뷰 반영본)
--
-- 원본 ERD의 지적사항을 반영했다. 변경 근거는 각 테이블 위 주석에 [FIX] 로 표시한다.
-- 앱 코드와 대조한 기준 파일:
--   - src/types/index.ts        (Building / Partner / NewsItem)
--   - src/constants/colors.ts   (CategoryKey 7종)
--   - src/constants/news.ts     (TREE_DATA — 공지 출처 트리)
--   - src/contexts/SettingsContext.tsx (구독 2축: 학과 + 카테고리)
--
-- ── 아직 합의되지 않은 2가지 (임시 결정하되 되돌리기 쉽게 설계함) ──────────
--
-- [가정 A] 알림 카테고리는 "앱의 7종"을 정답으로 본다.
--   앱은 공지·장학·행사·수강·시설·취업·상담 7종이 이미 색상까지 구현되어 동작 중이고,
--   원본 ERD의 contest(공모전)/club(동아리)은 앱에 화면이 없다.
--   단, 컬럼이 아니라 "행"으로 저장하므로 나중에 공모전/동아리를 추가해도
--   ALTER TABLE 없이 INSERT 한 줄이면 된다. 즉 이 가정이 틀려도 비용이 없다.
--
-- [가정 B] subscriptions.keyword 는 "자유 키워드 알림"으로 해석한다.
--   (예: '교환학생' 이 제목에 들어간 공지가 뜨면 알림)
--   카테고리 구독은 notification_categories 가, 학과 구독은 user_departments 가
--   이미 담당하므로 keyword 를 그 둘 중 하나로 보면 완전히 중복이다.
--   만약 원래 의도가 카테고리였다면 이 테이블은 통째로 삭제하면 된다.
--
-- 시각 규약: 모든 DATETIME 은 UTC 로 저장하고, 표시 시점에 KST 로 변환한다.

SET NAMES utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- 사용자
-- ─────────────────────────────────────────────────────────────

-- [FIX] UNIQUE(social_id) → UNIQUE(social_type, social_id)
--       provider 가 다르면 같은 social_id 라도 다른 사람이다.
--       기존 정의로는 카카오 12345 와 구글 12345 가 충돌해 계정이 섞인다.
-- [FIX] fcm_token 제거 → user_devices 로 분리 (아래)
CREATE TABLE users (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  social_id   VARCHAR(100) NOT NULL,
  social_type VARCHAR(20)  NOT NULL COMMENT 'kakao / google / apple',
  email       VARCHAR(100) NULL,
  nickname    VARCHAR(50)  NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_social (social_type, social_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [FIX] 신규. users.fcm_token 은 기기 1대만 저장 가능해서, 폰+태블릿을 쓰면
--       나중에 로그인한 기기가 앞 토큰을 덮어써 이전 기기 알림이 끊긴다.
-- [주의] 이 앱은 Expo(expo ~56)다. Expo Push 를 쓰면 토큰이 'ExponentPushToken[..]'
--       형식이라 FCM 토큰이 아니다. 그래서 컬럼명을 push_token 으로 두고
--       token_type 을 함께 저장한다.
CREATE TABLE user_devices (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  push_token  VARCHAR(255) NOT NULL,
  token_type  VARCHAR(20)  NOT NULL COMMENT 'expo / fcm / apns',
  platform    VARCHAR(20)  NULL COMMENT 'ios / android / web',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_device_token (push_token),
  KEY ix_device_user (user_id, is_active),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 공지 출처 (학과 + 행정기관)
-- ─────────────────────────────────────────────────────────────

-- [FIX] UNIQUE(college, name) 추가 — 없으면 '컴퓨터공학과' 행이 중복 생성된다.
-- [NOTE] 테이블명이 departments 지만 실제 내용은 "공지 출처"에 가깝다.
--        앱 TREE_DATA 의 '학사' '장학' '학생상담' '학생활동' '교수학습지원'
--        '대학혁신지원사업' 은 학과가 아니라 행정기관이고, '교양과' 는 하위 학과가 없다.
--        이름 변경(news_sources)을 권하지만 동작에는 지장이 없어 그대로 두었다.
--        대신 kind 로 둘을 구분해 UI 가 학과/기관을 나눠 보여줄 수 있게 했다.
CREATE TABLE departments (
  id      BIGINT       NOT NULL AUTO_INCREMENT,
  name    VARCHAR(100) NOT NULL,
  college VARCHAR(100) NOT NULL COMMENT '앱 TREE_DATA 의 상위 그룹명',
  kind    VARCHAR(20)  NOT NULL DEFAULT 'department' COMMENT 'department / office',
  PRIMARY KEY (id),
  UNIQUE KEY uq_dept (college, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [FIX] UNIQUE(user_id, department_id) 추가 — 같은 학과 중복 구독 방지
-- [FIX] ON DELETE CASCADE — 없으면 회원 탈퇴가 FK 때문에 실패한다
CREATE TABLE user_departments (
  id            BIGINT  NOT NULL AUTO_INCREMENT,
  user_id       BIGINT  NOT NULL,
  department_id BIGINT  NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_dept (user_id, department_id),
  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- [주의] is_primary 가 여러 개 true 인 것을 DB 로는 막지 못한다(MySQL 은 부분 유니크
--        인덱스가 없다). 애플리케이션에서 "새 primary 지정 시 기존 것 해제"를
--        같은 트랜잭션 안에서 처리해야 한다.

-- ─────────────────────────────────────────────────────────────
-- 건물 / 교내 시설
-- ─────────────────────────────────────────────────────────────

-- [FIX] floors NOT NULL → NULL 허용.
--       src/types/index.ts:18 주석대로 floors 는 "확인된 값만 채운다. 없으면
--       층 선택 다이얼을 건너뛴다". NOT NULL 이면 미확인 건물을 표현할 수 없고,
--       0 을 넣으면 '미확인' 과 '지하만 있는 건물' 이 구분되지 않는다.
-- [FIX] basement_floors 추가 — 원본에 없어 지하층 정보가 통째로 유실됐다.
-- [FIX] color 추가 — 앱의 모든 건물이 마커 색을 가진다(constants/buildings.ts).
-- [FIX] facilities 추가 — Building.facilities?: string[]
-- [FIX] category 컬럼 확정: map_category 로 명명해 places.category 와 충돌을 피한다.
--       값 도메인이 서로 완전히 다르므로(건물: 강의/식당/편의/주차,
--       시설: 카페/식당/…) 컬럼만 분리하면 문제없다. 앱 FilterChip 이 이미 쓰고 있다.
CREATE TABLE buildings (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  name            VARCHAR(100)  NOT NULL,
  latitude        DECIMAL(10,7) NOT NULL,
  longitude       DECIMAL(10,7) NOT NULL,
  color           VARCHAR(9)    NULL COMMENT '마커 색 HEX (#RRGGBB)',
  map_category    VARCHAR(20)   NULL COMMENT '강의 / 식당 / 편의 / 주차 — 지도 필터',
  type            VARCHAR(50)   NULL COMMENT '예: 강의·행정 복합동',
  floors          INT           NULL COMMENT '지상 층수. 미확인이면 NULL',
  basement_floors INT           NULL COMMENT '지하 층수. 없으면 NULL',
  hours           VARCHAR(100)  NULL,
  description     TEXT          NULL,
  contact         VARCHAR(50)   NULL,
  facilities      JSON          NULL COMMENT '문자열 배열',
  link_label      VARCHAR(50)   NULL,
  link_url        VARCHAR(500)  NULL,
  boundary        JSON          NULL COMMENT '[[lat,lng], ...] 폴리곤',
  cx              DECIMAL(6,2)  NULL COMMENT 'TODO: 의미 확인 필요 (라벨 오프셋?)',
  cy              DECIMAL(6,2)  NULL COMMENT 'TODO: 의미 확인 필요',
  anchor_x        DECIMAL(6,2)  NULL COMMENT 'TODO: 의미 확인 필요',
  anchor_y        DECIMAL(6,2)  NULL COMMENT 'TODO: 의미 확인 필요',
  PRIMARY KEY (id),
  UNIQUE KEY uq_building_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [FIX] is_overnight 추가 — 자정을 넘기는 영업(18:00~02:00)은 close < open 이 되어
--       BETWEEN 조회가 조용히 빈 결과를 준다. 플래그로 명시해 쿼리에서 분기한다.
-- [FIX] (building_id, floor) 인덱스 — 층별 시설 조회가 주 사용 패턴이다.
-- [한계] 요일별로 다른 영업시간은 이 구조로 표현할 수 없다. 필요해지면
--        place_hours(place_id, day_of_week, open, close) 로 분리해야 한다.
CREATE TABLE places (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  building_id  BIGINT       NOT NULL,
  category     VARCHAR(30)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  floor        INT          NOT NULL,
  open_time    TIME         NULL,
  close_time   TIME         NULL,
  is_overnight BOOLEAN      NOT NULL DEFAULT false COMMENT 'close_time 이 익일이면 true',
  extra_info   VARCHAR(255) NULL,
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  PRIMARY KEY (id),
  KEY ix_places_bld_floor (building_id, floor),
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 제휴 업체  [FIX] 신규 — 원본 ERD 에 통째로 빠져 있었다
-- ─────────────────────────────────────────────────────────────

-- src/constants/partners.ts (706줄, 65개 업체) 가 대응된다.
-- places 로 대체할 수 없다: places.building_id 는 NOT NULL 인데 제휴 업체는
-- 교외 상권(와우산로/독막로/연남동)이라 소속 건물이 없다.
CREATE TABLE partners (
  id           BIGINT        NOT NULL AUTO_INCREMENT,
  name         VARCHAR(100)  NOT NULL,
  category     VARCHAR(30)   NOT NULL COMMENT '카페/주점/음식/의료·미용/문화/교육/기타 — 2단 필터',
  latitude     DECIMAL(10,7) NOT NULL,
  longitude    DECIMAL(10,7) NOT NULL,
  benefit      VARCHAR(255)  NULL COMMENT '제휴 혜택. 미확정이면 NULL 이고 시트에서 줄이 숨겨진다',
  address      VARCHAR(255)  NULL,
  road_address VARCHAR(255)  NULL COMMENT '네이버 지역검색으로 채움',
  hours        VARCHAR(100)  NULL COMMENT '지역검색 API 로는 못 얻는다. 수동 입력 전용',
  contact      VARCHAR(50)   NULL COMMENT '지역검색 telephone 은 전부 빈 값이었다. 수동 입력 전용',
  map_icon     VARCHAR(20)   NULL COMMENT '카테고리 기본 아이콘 덮어쓰기 (예: 병원)',
  link_label   VARCHAR(50)   NULL,
  link_url     VARCHAR(500)  NULL,
  PRIMARY KEY (id),
  KEY ix_partner_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 한 가게가 총학생회와 단과대 양쪽과 계약한 경우가 있어 N:M 이다
-- (src/types/index.ts:78 affiliations?: PartnerAffiliation[]).
CREATE TABLE partner_affiliations (
  partner_id  BIGINT      NOT NULL,
  affiliation VARCHAR(50) NOT NULL COMMENT '총학생회 / 미술대학 / 공과대학 ... — 1단 필터',
  PRIMARY KEY (partner_id, affiliation),
  KEY ix_affiliation (affiliation),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 뉴스 / 공지
-- ─────────────────────────────────────────────────────────────

-- [FIX] UNIQUE(source_url) 추가. 이게 없으면 scripts/scrape-hongik-news.mjs 를
--       돌릴 때마다 같은 게시글이 통째로 다시 쌓인다.
--       크롤러는 INSERT ... ON DUPLICATE KEY UPDATE 로 쓴다.
-- [FIX] 조회용 인덱스 추가 — 목록 화면이 곧 풀스캔이었다.
CREATE TABLE news (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  title         VARCHAR(300) NOT NULL,
  content       TEXT         NULL,
  category      VARCHAR(30)  NOT NULL COMMENT '앱 CategoryKey 7종과 동일 집합',
  source_url    VARCHAR(500) NOT NULL,
  department_id BIGINT       NULL,
  building_id   BIGINT       NULL,
  published_at  DATETIME     NOT NULL,
  crawled_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_news_source_url (source_url),
  KEY ix_news_published (published_at DESC),
  KEY ix_news_dept_published (department_id, published_at DESC),
  KEY ix_news_category_published (category, published_at DESC),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (building_id)   REFERENCES buildings(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [FIX] UNIQUE(user_id, news_id) — 같은 글을 여러 번 북마크할 수 있었다
-- [FIX] ON DELETE CASCADE — 탈퇴/기사삭제가 FK 에 막히지 않도록
CREATE TABLE bookmarks (
  id         BIGINT   NOT NULL AUTO_INCREMENT,
  user_id    BIGINT   NOT NULL,
  news_id    BIGINT   NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookmark (user_id, news_id),
  KEY ix_bookmark_user (user_id, created_at DESC),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (news_id) REFERENCES news(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 알림
-- ─────────────────────────────────────────────────────────────

-- [FIX] notify_* 불리언 6개 컬럼 → 행 기반으로 전환.
--       (1) 원본의 6종(notice/event/scholarship/lecture/contest/club)은 앱의 7종
--           (공지·장학·행사·수강·시설·취업·상담)과 맞지 않았다.
--           앱에만 있던 시설/취업/상담은 알림 설정 자체가 불가능했다.
--       (2) 카테고리를 추가할 때마다 ALTER TABLE 이 필요했다.
--       행으로 두면 [가정 A] 가 틀려도 INSERT 한 줄로 끝난다.
CREATE TABLE notification_categories (
  user_id  BIGINT      NOT NULL,
  category VARCHAR(30) NOT NULL COMMENT '공지/장학/행사/수강/시설/취업/상담',
  enabled  BOOLEAN     NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, category),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [FIX] 카테고리별 플래그를 위 테이블로 옮기고, 여기엔 마스터 스위치만 남겼다.
CREATE TABLE notification_settings (
  id           BIGINT   NOT NULL AUTO_INCREMENT,
  user_id      BIGINT   NOT NULL,
  push_enabled BOOLEAN  NOT NULL DEFAULT true,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notif_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [가정 B] 자유 키워드 알림. 카테고리 구독은 notification_categories 가,
--          학과 구독은 user_departments 가 담당하므로 keyword 를 그 둘로 해석하면
--          완전 중복이다. 원래 의도가 카테고리였다면 이 테이블은 삭제하면 된다.
-- [FIX] UNIQUE(user_id, keyword) 추가
CREATE TABLE keyword_subscriptions (
  id      BIGINT      NOT NULL AUTO_INCREMENT,
  user_id BIGINT      NOT NULL,
  keyword VARCHAR(30) NOT NULL COMMENT '제목에 이 단어가 포함되면 알림',
  PRIMARY KEY (id),
  UNIQUE KEY uq_keyword_sub (user_id, keyword),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [FIX] (user_id, is_read, created_at) 인덱스 — 안읽은알림 뱃지 카운트가 주 쿼리다
-- [FIX] news_id 는 ON DELETE SET NULL — 기사가 지워져도 알림 이력은 남긴다
CREATE TABLE notifications (
  id         BIGINT       NOT NULL AUTO_INCREMENT,
  user_id    BIGINT       NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT         NOT NULL,
  news_id    BIGINT       NULL,
  is_read    BOOLEAN      NOT NULL DEFAULT false,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_notif_user_unread (user_id, is_read, created_at DESC),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (news_id) REFERENCES news(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 경로 탐색
--
-- [우선순위 재검토 권장] 앱의 src/constants/route.ts 는 8줄(상수 2개)뿐이고
-- 경로 기능은 사실상 미구현이다. 캠퍼스 전체 노드/엣지를 채우는 건 큰 작업이라,
-- 지금 단계에 필요한지 먼저 판단하는 편이 좋다.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE route_nodes (
  id          BIGINT        NOT NULL AUTO_INCREMENT,
  latitude    DECIMAL(10,7) NOT NULL,
  longitude   DECIMAL(10,7) NOT NULL,
  floor       INT           NOT NULL DEFAULT 0,
  node_type   VARCHAR(30)   NOT NULL,
  building_id BIGINT        NULL,
  PRIMARY KEY (id),
  KEY ix_node_building (building_id, floor),
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [FIX] UNIQUE(from,to) — 같은 간선 중복 방지
-- [FIX] CHECK(from <> to) — 자기 자신으로의 간선 방지 (MySQL 8.0.16+ 에서 강제됨)
-- [FIX] from_node_id 인덱스 — 경로탐색은 "이 노드에서 나가는 간선"을 반복 조회한다.
--       없으면 탐색 한 번에 풀스캔이 노드 수만큼 반복된다.
-- [정책 필요] 무향 그래프라면 (a→b), (b→a) 두 행을 넣어야 한다.
--             단방향만 넣고 양방향으로 쓰려면 쿼리에서 UNION 해야 한다. 하나로 통일할 것.
CREATE TABLE route_edges (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  from_node_id    BIGINT       NOT NULL,
  to_node_id      BIGINT       NOT NULL,
  distance_m      DECIMAL(6,2) NOT NULL,
  has_roof        BOOLEAN      NOT NULL DEFAULT false,
  is_barrier_free BOOLEAN      NOT NULL DEFAULT true,
  edge_type       VARCHAR(30)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_edge (from_node_id, to_node_id),
  KEY ix_edge_from (from_node_id),
  CONSTRAINT ck_edge_not_self CHECK (from_node_id <> to_node_id),
  FOREIGN KEY (from_node_id) REFERENCES route_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (to_node_id)   REFERENCES route_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
