import type { CategoryKey } from '../constants/colors'

export type BuildingCategory = '강의' | '식당' | '편의' | '주차'

export interface ExternalLink {
  label: string
  url: string
}

/**
 * 건물 한 곳에 출입구가 여럿이고, 층에 따라 실제로 드나드는 문이 달라질 때 쓴다.
 * `minFloor`~`maxFloor` 범위(포함)에 속한 층을 고르면 이 좌표로 경로를 잇는다.
 * 좌표는 확인된 값만 채운다(추정 금지). 이 배열이 없거나 고른 층이 어느 범위에도
 * 안 걸리면 `Building.lat/lng`(대표 좌표)를 그대로 쓴다.
 */
export interface BuildingEntrance {
  label: string
  lat: number
  lng: number
  minFloor: number
  maxFloor: number
}

export interface Building {
  name: string
  lat: number
  lng: number
  color: string
  category: BuildingCategory
  type: string
  /** 지상 층수. 확인된 값만 채운다. 없으면 층 선택 다이얼을 건너뛴다. */
  floors?: number
  /** 지하 층수. 지하가 없으면 생략한다. */
  basementFloors?: number
  /** 층별로 다른 출입구를 쓰는 건물만 채운다. `BuildingEntrance` 참고. */
  entrances?: BuildingEntrance[]
  /** 확인된 값만 채운다. 미확인 건물은 비워두고 배너에서 숨긴다. */
  hours?: string
  description?: string
  facilities?: string[]
  contact?: string
  link?: ExternalLink
  boundary?: [number, number][]
  /**
   * 본 덩어리에서 떨어져 있는 나머지 영역들. 한 건물이 붙어 있지 않은 여러
   * 블록으로 이뤄진 경우에만 채운다(인문사회관 B동처럼).
   * 화면에는 그리지 않고 `boundary` 와 함께 탭 판정에만 쓰인다.
   */
  extraBoundaries?: [number, number][][]
}

/** 실외 보행로 중간점. 사용자가 실제로 확인한 좌표만 채운다(추정 금지). */
export interface PathWaypoint {
  id: string
  lat: number
  lng: number
}

/**
 * 실외 간선(양방향). 각 값은 `PathWaypoint.id` 이거나 건물 출입구를 가리키는
 * '건물명' 또는 '건물명#출입구라벨'(라벨은 `BuildingEntrance.label` 과 정확히
 * 일치) 문자열이다. 건물 쪽 좌표는 `buildings.ts` 를 그대로 참조하며 여기 다시
 * 적지 않는다 — `src/utils/routing.ts` 가 해석한다.
 */
export type PathEdge = [string, string]

/**
 * 지도에 무엇을 올릴지 고르는 최상단 필터. 한 번에 한 갈래만 본다.
 * 편의시설·제휴 업체·이벤트를 같이 띄우면 마커가 뒤섞여 어느 쪽인지 알 수 없다.
 *
 * '이벤트'의 하위 두 칩(전시/제보)은 `MapFilterChips`가 그린다. '전시'는
 * '행사·전시' 편의시설 데이터를 그대로 쓰고(축을 옮겨 왔을 뿐 데이터는 하나다),
 * '제보'는 기존 제보 토글(`reportsOn`)과 같은 상태를 공유한다.
 */
export type MapLayer = '편의시설' | '제휴업체' | '이벤트'

/**
 * 편의시설 종류. 유니온에 적은 순서가 곧 칩 순서다.
 *
 * 처음에는 '프린터'와 '성적프린터'를 나눴는데 학생이 찾는 방식과 맞지 않아
 * '프린터' 하나로 합쳤다. 뽑는 기기는 종류를 가리지 않고 '프린터', 창구에서
 * 사람을 거쳐 받는 것은 '증명서 발급' 으로 가른다.
 *
 * '행사·전시'는 미술관·박물관처럼 **상설로 열려 있는 공간**이다. 지금 벌어지는
 * 일회성 행사는 제보(`ReportCategory`)가 맡는다. 축이 다르니 섞지 않는다.
 */
export type FacilityKind =
  | '프린터'
  | '증명서 발급'
  | '열람실'
  | '스터디룸'
  | '정수기'
  | '카페'
  | '식당'
  | '편의점'
  | '라운지'
  | '수면실'
  | '학생처'
  | '행사·전시'
  | '흡연구역'
  | '엘리베이터'

/**
 * 캠퍼스 편의시설 한 곳.
 *
 * 좌표를 직접 들고 있지 않고 건물을 가리킨다. 편의시설은 건물 안에 있어
 * 개별 좌표를 따로 확인할 방법이 없는 반면, 건물 좌표는 이미 검증돼 있기
 * 때문이다(`constants/buildings.ts` 참고 — 추정 좌표는 넣지 않는다).
 * 지도 핀은 `buildingName` 으로 찾은 건물의 좌표에 찍힌다.
 */
export interface Facility {
  id: string
  kind: FacilityKind
  /** `BUILDINGS` 의 `name` 과 정확히 일치해야 한다. 못 찾으면 지도에서 빠진다. */
  buildingName: string
  /** 확인된 경우에만 채운다. 표기는 `formatFloor` 규칙을 따른다. */
  floor?: number
  /** '2층 복사실 옆' 처럼 건물 안에서의 위치를 덧붙일 때만 쓴다. */
  note?: string
}

/**
 * 제휴를 맺은 주체. 필터 1단(위쪽 칩 줄)에 해당한다.
 * 유니온에 적은 순서가 곧 칩 순서다.
 */
export type PartnerAffiliation =
  | '총학생회'
  | '미술대학'
  | '공과대학'
  | '문과대학'
  | '경영대학'
  | '건축도시대학'
  | '법과대학'
  | '사범대학'
  | '경제학부'
  | '캠퍼스자율전공(서울)'
  | '공연예술학부'
  | '디자인·예술경영학부'

/** 제휴 업체 업종. 필터 2단(아래쪽 칩 줄)에 해당한다. */
export type PartnerCategory =
  | '카페'
  | '주점'
  | '음식'
  | '의료/미용'
  | '문화'
  | '기타'
  | '교육'

/**
 * 지도 마커 배지 아이콘을 카테고리 기본값 대신 개별 지정하는 키.
 * 한 카테고리에 이질적 업종이 섞일 때 쓴다. 예를 들어 '의료/미용'의
 * 기본 아이콘은 가위(미용)이지만, 건강검진센터는 '병원'으로 덮어쓴다.
 */
export type PartnerMapIcon = '병원'

/**
 * 소속별로 혜택이 다를 때 쓰는 예외 항목. 같은 가게라도 제휴를 맺은 주체마다
 * 조건이 달라지는 경우가 있다(예: 서브웨이 상수점은 총학생회가 '학기 중' 조건,
 * 경제학부는 '사이드 메뉴 단독 구매 시 제외' 조건).
 */
export interface PartnerAffiliationBenefit {
  affiliation: PartnerAffiliation
  benefit: string
}

/**
 * 제휴 업체 한 지점. 지점이 여러 곳인 브랜드(옵틱라이프·로얄짐 등)는
 * 지점마다 별도 항목으로 둔다. 지도에 찍히는 단위가 지점이기 때문이다.
 */
export interface Partner {
  id: string
  name: string
  category: PartnerCategory
  /**
   * 이 업체와 제휴를 맺은 주체들. 한 가게가 총학생회와 단과대 양쪽과
   * 계약한 경우가 있어 배열로 둔다.
   * 아직 확인되지 않은 업체는 비워두고, 1단 필터에서 걸러지지 않게 한다.
   */
  affiliations?: PartnerAffiliation[]
  /**
   * 지도 마커 아이콘을 카테고리 기본값 대신 덮어쓴다. 값이 없으면 카테고리
   * 아이콘을 쓴다. '의료/미용' 중 건강검진센터를 '병원'으로 구분할 때 쓴다.
   */
  mapIcon?: PartnerMapIcon
  /** 좌표는 사용자가 확인해 제공한 값만 넣는다. 추정하지 않는다. */
  lat: number
  lng: number
  /** 제휴 혜택. 아직 확정되지 않은 업체는 비워두고 시트에서 줄을 숨긴다. */
  benefit?: string
  /**
   * 소속별로 혜택이 다른 **예외만** 적는다. 여기 없는 소속은 위 benefit 을 따른다.
   * 대부분의 업체는 모든 제휴처에 같은 혜택을 주므로 비워둔다.
   * 충돌 사례와 판단 근거는 `docs/partner-data-conflicts.md` 에 정리한다.
   */
  affiliationBenefits?: PartnerAffiliationBenefit[]
  address?: string
  hours?: string
  contact?: string
  link?: ExternalLink
}

export interface TreeNode {
  name: string
  children: TreeChild[]
}

export interface TreeChild {
  id: string
  name: string
  /**
   * 전공이 나뉜 학부처럼 한 단계 더 들어가는 경우에만 채운다.
   * 이 값이 있으면 노드 자신은 구독 단위가 아니라 펼치기용 묶음이다.
   */
  children?: TreeChild[]
}

export interface NewsAttachment {
  name: string
  url: string
}

export interface NewsItem {
  id: string
  category: CategoryKey
  title: string
  preview: string
  source: string
  sourceId: string
  /** 'YYYY.MM.DD' 형식. */
  date: string
  /** 원문 게시글 URL. 스크래퍼가 채운다. 없으면 상세 화면이 홈페이지로 폴백한다. */
  link?: string
  /** 아래 3개는 스크래퍼를 --detail 로 돌렸을 때만 채워진다. */
  views?: number
  /** 본문이 이미지 한 장뿐인 공지가 흔해서 이미지 URL 을 따로 들고 있는다. */
  images?: string[]
  attachments?: NewsAttachment[]
}

/**
 * `hongikon-be`의 `ReportService.CATEGORIES`와 값이 일치한다(2026-08-21 확인, `../../hongikon-be`).
 */
export type ReportCategory = 'EVENT' | 'PERFORMANCE' | 'FOOD_TRUCK' | 'BOOTH' | 'ETC'

/**
 * 제보 상태.
 *
 * `PENDING`(운영자 검토 대기)·`REJECTED`(반려)는 `docs/report-api-spec.md` §8.1의
 * 제안일 뿐, 실제 백엔드(`ReportService`)는 구현하지 않았다 — 생성 즉시 `ACTIVE`로
 * 저장하고(로컬 목업과 동일), 삭제도 상태 전환이 아니라 실제 DELETE라 `DELETED`도
 * 쓰이지 않는다. 지금 실제로 나오는 값은 `ACTIVE`·`HIDDEN`(신고 누적 3회) 둘뿐이다.
 * 두 값은 검토 기능이 생기면 다시 쓸 수 있어 유니온에는 남겨 둔다.
 */
export type ReportStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'HIDDEN' | 'DELETED'

/**
 * 신고 사유. `hongikon-be`의 `ReportService.FLAG_REASONS`와 값이 일치한다.
 */
export type ReportFlagReason = 'FALSE_INFO' | 'SPAM' | 'INAPPROPRIATE' | 'ETC'

/**
 * 지도의 한 지점에 남긴 실시간 제보. `POST /reports`·`GET /reports` 응답 형태를 따른다.
 * `startsAt` / `endsAt` / `createdAt`은 서버가 UTC로 내려주는 ISO-8601 문자열이다.
 */
export interface Report {
  id: number
  /** 건물 밖 제보는 null. */
  buildingId: number | null
  /** 층 미지정 제보는 null. */
  floor: number | null
  lat: number
  lng: number
  category: ReportCategory
  /**
   * `category` 가 `ETC` 일 때, '무슨 일인가요?' 칩에서 직접 입력한 라벨.
   * 서버 스펙에 없는 임시(로컬 전용) 필드다 — 백엔드가 카테고리를 직접
   * 입력받게 되면 이 필드는 걷어내고 서버 값을 그대로 쓰면 된다.
   */
  customCategoryLabel?: string
  title: string
  content: string | null
  authorNickname: string
  /**
   * 첨부 사진 URL. 실제 백엔드(`Report` 엔티티)에는 이 컬럼도, 업로드 API도
   * 없다(2026-08-21 확인) — `docs/report-api-spec.md` §8.2 제안이 아직 구현 전이다.
   * 지금은 로컬 목업(`uploadReportImage`)에서만 값이 채워진다.
   */
  imageUrl?: string
  /** 요청자 본인 작성 여부. 서버가 JWT의 userId로 계산해 내려준다. */
  isMine: boolean
  startsAt: string
  endsAt: string
  status: ReportStatus
  createdAt: string
}

/**
 * `GET /reports` 목록 항목(`ReportSummaryResponse`). `content`뿐 아니라 `status`도
 * 내려오지 않는다 — 목록 조회는 서버가 이미 살아있는(ACTIVE, live) 제보만 쿼리해
 * 돌려주므로 상태를 따로 알려줄 필요가 없다. 상태를 보려면 상세(`Report`)가 필요하다.
 */
export type ReportListItem = Omit<Report, 'content' | 'status'>

/** `POST /reports` 요청 바디. */
export interface CreateReportInput {
  buildingId?: number
  floor?: number
  lat: number
  lng: number
  category: ReportCategory
  /** `category` 가 `ETC` 일 때, 직접 입력한 라벨. `Report.customCategoryLabel` 참고. */
  customCategoryLabel?: string
  title: string
  content?: string
  /** `uploadReportImage` 가 돌려준 URL. 실제 백엔드는 이 필드를 받지 않는다(`Report.imageUrl` 참고). */
  imageUrl?: string
  startsAt: string
  endsAt: string
}

/** `POST /reports/{id}/flags` 요청 바디. */
export interface CreateReportFlagInput {
  reason: ReportFlagReason
}

/** `POST /reports/{id}/flags` 응답(`ReportFlagResponse`). `flagCount`는 항상 내려온다. */
export interface ReportFlagResult {
  flagCount: number
}
