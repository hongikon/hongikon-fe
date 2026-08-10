# 실시간 제보 기능 — API 스펙 제안 (BE 공유용)

**작성일** 2026-08-10
**작성자** 최석훈 (프론트)
**대상** 주세원 (백엔드)
**상태** 제안 — 코드 없음, 리뷰·확정 필요

---

## 1. 무엇을 위한 API인가

로그인한 사용자가 지도의 한 지점(건물 · 층 포함 가능)에 "지금 진행 중인 일"을 제보하면, 다른 사용자가 지도에서 볼 수 있게 한다.

> 예시: "문헌관 4층에서 ○○ 행사 진행 중"

시작·종료 시각이 있는 시간 한정 정보다. `ends_at`이 지나면 지도에서 자동으로 빠져야 한다.

기존 인증(카카오 OAuth → JWT) 위에 얹는 기능이라, 이 문서는 `reports` / `report_flags` 두 리소스만 다룬다.

---

## 2. hongikon-be 저장소 기준으로 확인한 것

이 스펙은 `hongikon-be`의 기존 컨벤션을 그대로 따르려 했다. 확인 못 한 부분은 3장에 질문으로 남겼다.

| 확인한 것 | 근거 |
|---|---|
| 인증은 `Authorization: Bearer <accessToken>` → `JwtAuthenticationFilter`가 `SecurityContextHolder`에 `userId`(Long)를 principal로 심음 | `auth/jwt/JwtAuthenticationFilter.java` |
| 에러 응답은 `{ "message": "..." }` 단일 필드, `ResponseStatusException(status, reason)`으로 던지면 `GlobalExceptionHandler`가 그대로 감쌈 | `common/exception/GlobalExceptionHandler.java`, `ErrorResponse.java` |
| 요청 DTO는 Java `record` + `jakarta.validation`(`@NotBlank` 등) | `auth/dto/TokenExchangeRequest.java` |
| 응답도 envelope 없이 리소스 JSON 그대로 반환 (`{success,data,...}` 래핑 안 함) | `auth/dto/TokenResponse.java` |
| 엔티티는 `BIGINT IDENTITY` PK, Lombok `@Getter @NoArgsConstructor(PROTECTED) @Builder`, `@CreationTimestamp`/`@UpdateTimestamp`, `@Column(name="snake_case")` | `user/User.java`, `user/UserDevice.java` |
| **`reports`/`Building`/`Place` 관련 코드는 저장소에 없음** | `src/main/java/com/hongmap/hongmapbackend/` 전체 탐색 결과 |

마지막 줄이 이 문서가 필요한 이유다 — 없는 것을 만드는 제안이라 컨벤션만 최대한 맞췄다.

---

## 3. 확인 필요 (막히는 지점)

구현 전에 답이 필요하다.

| # | 질문 | 왜 막히는가 |
|---|---|---|
| 1 | **`buildings` 테이블이 이미 있거나 계획돼 있는가?** README에 "`Building.category`와 `Place.category` 네이밍 충돌 확인 필요"라고만 적혀 있어 실체를 모른다 | `reports.building_id`가 `buildings.id`를 참조하는 FK다. 테이블이 없으면 이 컬럼은 당장 NULL 전용이거나, `buildings` 작업이 선행돼야 한다 |
| 2 | **제보 목록 조회(`GET /reports`)를 비로그인(게스트)도 볼 수 있게 할까?** README는 "지도·공지 열람은 비로그인 가능, 구독·북마크·알림은 로그인 필요"라고 돼 있는데 제보는 이 중 어디에 속하는지 명시가 없다 | `SecurityConfig`의 `permitAll()` 목록에 넣을지 여부가 갈림 |
| 3 | **카테고리 목록** — 행사/공연/푸드트럭/부스 등 실제 값 셋. 앱 기존 소식 카테고리(공지·장학·행사·수강·시설·취업·상담)와는 별개 축 | Enum 값을 확정해야 DTO·DB `CHECK`/`Enum` 매핑 가능 |
| 4 | **`ends_at` 상한** — 무제한이면 오래된 제보가 지도를 덮음 | 서버 검증 규칙(`@Future`, 최대 N시간) 결정 필요 |
| 5 | **신고 누적 임계치** — 몇 건에서 자동 `hidden` 처리할지 | `report_flags` 카운트 트리거 로직에 필요 |

5장 DB 스키마의 `building_id`, `category`는 위 답변이 나오기 전까지 **가안**이다.

---

## 4. 엔드포인트

Base path는 기존 `/auth`처럼 접두사 없이 `/reports`로 뒀다.

### 4.1 `POST /reports` — 제보 생성

**인증**: 필수 (Bearer)

**Request**
```json
{
  "buildingId": 12,
  "floor": 4,
  "lat": 37.550123,
  "lng": 126.925456,
  "category": "EVENT",
  "title": "문헌관 4층 소학회 발표회",
  "content": "누구나 참여 가능, 다과 제공",
  "startsAt": "2026-08-10T05:00:00Z",
  "endsAt": "2026-08-10T09:00:00Z"
}
```

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `buildingId` | Long | X | 건물 밖 제보는 생략(NULL) |
| `floor` | Int | X | 층 정보 없으면 생략 |
| `lat`, `lng` | Decimal | O | 위경도 |
| `category` | String(enum) | O | 3번 질문 확정 후 값 목록 확정 |
| `title` | String | O | ≤100자 |
| `content` | String | X | ≤500자 |
| `startsAt`, `endsAt` | ISO-8601 (UTC) | O | `endsAt > startsAt`, `endsAt` 상한은 4번 질문 |

**Response `201`**
```json
{
  "id": 981,
  "buildingId": 12,
  "floor": 4,
  "lat": 37.550123,
  "lng": 126.925456,
  "category": "EVENT",
  "title": "문헌관 4층 소학회 발표회",
  "content": "누구나 참여 가능, 다과 제공",
  "authorNickname": "익명의홍대생",
  "isMine": true,
  "startsAt": "2026-08-10T05:00:00Z",
  "endsAt": "2026-08-10T09:00:00Z",
  "status": "ACTIVE",
  "createdAt": "2026-08-10T04:55:00Z"
}
```

작성자 `userId`는 노출하지 않고 `authorNickname`(표시용)과 `isMine`(요청자 본인 여부, 서버에서 JWT의 userId로 계산)만 내려준다. 원본 계획의 "명예훼손 대응 = 작성자 표시" 요구는 닉네임 노출로 충분히 충족한다.

**에러**
- `400` — 유효성 실패 (`title` 초과, `endsAt <= startsAt` 등) → `{ "message": "..." }`
- `401` — 토큰 없음/무효

---

### 4.2 `GET /reports?live=true` — 살아있는 제보 목록

**인증**: 3번 질문에 따라 결정 (게스트 허용 여지 있음)

**Query**
| 파라미터 | 설명 |
|---|---|
| `live` | `true`면 `status=ACTIVE AND now BETWEEN starts_at AND ends_at`만 반환 |
| `buildingId` | (선택) 특정 건물로 필터 |

**Response `200`**
```json
{
  "reports": [
    {
      "id": 981,
      "buildingId": 12,
      "floor": 4,
      "lat": 37.550123,
      "lng": 126.925456,
      "category": "EVENT",
      "title": "문헌관 4층 소학회 발표회",
      "authorNickname": "익명의홍대생",
      "isMine": false,
      "startsAt": "2026-08-10T05:00:00Z",
      "endsAt": "2026-08-10T09:00:00Z",
      "createdAt": "2026-08-10T04:55:00Z"
    }
  ]
}
```

목록에서는 `content`(본문)를 빼고 카드 렌더링에 필요한 필드만 내려주는 것을 제안한다. 상세는 필요하면 `GET /reports/{id}`를 추가하거나, 프론트가 목록 응답을 그대로 캐싱해 쓰는 방식 둘 다 가능 — BE 선호대로.

---

### 4.3 `DELETE /reports/{id}` — 제보 삭제 (본인만)

**인증**: 필수

**Response**: `204`

**에러**
- `403` — 본인 제보가 아님 → `{ "message": "본인이 작성한 제보만 삭제할 수 있습니다." }`
- `404` — 존재하지 않음

---

### 4.4 `POST /reports/{id}/flags` — 신고

**인증**: 필수

**Request**
```json
{ "reason": "FALSE_INFO" }
```

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `reason` | String(enum) | O | 예: `FALSE_INFO`, `SPAM`, `INAPPROPRIATE`, `ETC` — 이것도 확정 필요 |

**Response**: `201`, 본문 없음 또는 `{ "flagCount": 3 }` (5번 질문의 임계치 UI 표시에 쓸 수 있음)

**에러**
- `409` — 이미 신고한 제보 (schema의 `uq_flag (report_id, user_id)` 유니크 제약과 일치) → `{ "message": "이미 신고한 제보입니다." }`
- `404` — 존재하지 않는 제보

---

## 5. DB 스키마 (가안)

`docs/schema.sql`의 기존 규약(BIGINT IDENTITY PK, `utf8mb4_unicode_ci`, `DATETIME` UTC 저장, `ON DELETE CASCADE`, `ix_`/`uq_` 인덱스 접두사)을 그대로 따랐다. `users` 테이블은 저장소의 `User.java` 엔티티와 일치시켰다.

```sql
CREATE TABLE reports (
  id          BIGINT        NOT NULL AUTO_INCREMENT,
  user_id     BIGINT        NOT NULL,
  building_id BIGINT        NULL COMMENT '건물 밖 제보는 NULL. buildings 테이블 확정 전까지 가안(3.1 질문)',
  floor       INT           NULL COMMENT '층 미지정 가능',
  lat         DECIMAL(10,7) NOT NULL,
  lng         DECIMAL(10,7) NOT NULL,
  category    VARCHAR(30)   NOT NULL COMMENT '값 목록 미확정(3.3 질문)',
  title       VARCHAR(100)  NOT NULL,
  content     VARCHAR(500)  NULL,
  starts_at   DATETIME      NOT NULL COMMENT 'UTC 저장, 표시 시 KST 변환',
  ends_at     DATETIME      NOT NULL COMMENT '이 시각 이후 지도에서 내려감. 상한 미확정(3.4 질문)',
  status      VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE / HIDDEN / DELETED',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  reason     VARCHAR(30) NOT NULL COMMENT '값 목록 미확정(4.4절)',
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_flag (report_id, user_id),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`spring.jpa.hibernate.ddl-auto=validate`로 설정돼 있어(`application.properties`), 이 DDL은 엔티티 코드가 아니라 별도 마이그레이션(Flyway/직접 실행 등 기존 방식)으로 적용된다고 가정했다. 기존 `users`/`user_devices`가 어떻게 적용됐는지 방식을 그대로 따르면 된다.

---

## 6. 이 문서에 없는 것

- Java 엔티티/컨트롤러 구현 — DB·API 계약만 제안, 구현은 BE 재량
- `GET /reports/{id}` 단건 조회 — 4.2절 참고, 필요 여부 판단 요청
- 프론트 쪽 화면·상태 흐름 — `docs/report-feature-plan.md` Phase 3~6 참고

---

## 7. 다음 단계

1. 3장 질문 답변 (특히 1, 2번 — 나머지는 구현 중 조정 가능)
2. 확정되면 이 문서의 "가안"·"미확정" 표시를 지우고 실제 값으로 갱신
3. BE가 엔드포인트 붙이면 프론트는 `docs/report-feature-plan.md` Phase 3(위치·층 지정)부터 착수
