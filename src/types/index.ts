import type { CategoryKey } from '../constants/colors'

export type BuildingCategory = '강의' | '식당' | '편의' | '주차'

export interface ExternalLink {
  label: string
  url: string
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

/**
 * 지도에 무엇을 올릴지 고르는 최상단 필터. 한 번에 한 갈래만 본다.
 * 편의시설과 제휴 업체를 같이 띄우면 마커가 뒤섞여 어느 쪽인지 알 수 없다.
 */
export type MapLayer = '편의시설' | '제휴업체'

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
  | '정수기'
  | '카페'
  | '식당'
  | '학생처'
  | '행사·전시'

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
 * `docs/report-api-spec.md` §3.3 기준 값 목록 미확정. 백엔드 확정 전까지의 가안이다.
 * 확정되면 이 유니온과 실제 API 값을 함께 갱신한다.
 */
export type ReportCategory = 'EVENT' | 'PERFORMANCE' | 'FOOD_TRUCK' | 'BOOTH' | 'ETC'

/**
 * 제보 상태.
 *
 * 올린 즉시 지도에 뜨지 않는다. `PENDING` 으로 들어가 운영자 검토를 거친 뒤
 * `ACTIVE` 가 되어야 다른 사용자에게 보인다. 허위 제보·비방 위험이 큰 기능이라
 * (`docs/report-feature-plan.md` §7) 사후 신고보다 사전 검토를 앞세운다.
 *
 * `HIDDEN` 은 신고 누적으로 내려간 것, `REJECTED` 는 검토에서 반려된 것이다.
 * 둘 다 지도에 뜨지 않지만 작성자에게 보이는 문구가 달라 구분한다.
 */
export type ReportStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'HIDDEN' | 'DELETED'

/**
 * 신고 사유. `docs/report-api-spec.md` §4.4 기준 값 목록 미확정 — 가안이다.
 */
export type ReportFlagReason = 'FALSE_INFO' | 'SPAM' | 'INAPPROPRIATE' | 'ETC'

/**
 * 지도의 한 지점에 남긴 실시간 제보. `docs/report-api-spec.md` §4.1 응답 형태를 따른다.
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
  title: string
  content: string | null
  authorNickname: string
  /**
   * 첨부 사진 URL. 선택 항목이라 없을 수 있다.
   * 업로드는 제보 생성과 분리돼 있다 — `uploadReportImage` 로 먼저 올려
   * 받은 URL을 제보에 담는다.
   */
  imageUrl?: string
  /** 요청자 본인 작성 여부. 서버가 JWT의 userId로 계산해 내려준다. */
  isMine: boolean
  startsAt: string
  endsAt: string
  status: ReportStatus
  createdAt: string
}

/** `GET /reports` 목록 항목. §4.2에 따라 본문(content)은 빠진다. */
export type ReportListItem = Omit<Report, 'content'>

/** `POST /reports` 요청 바디. §4.1 참고. */
export interface CreateReportInput {
  buildingId?: number
  floor?: number
  lat: number
  lng: number
  category: ReportCategory
  title: string
  content?: string
  /** `uploadReportImage` 가 돌려준 URL. 사진을 안 붙였으면 생략한다. */
  imageUrl?: string
  startsAt: string
  endsAt: string
}

/** `POST /reports/{id}/flags` 요청 바디. §4.4 참고. */
export interface CreateReportFlagInput {
  reason: ReportFlagReason
}

/**
 * `POST /reports/{id}/flags` 응답. §4.4는 "본문 없음 또는 { flagCount }"라 명시해
 * flagCount를 선택 필드로 둔다.
 */
export interface ReportFlagResult {
  flagCount?: number
}
