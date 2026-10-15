import type { Building, Facility } from '../types'
import type { AdminOfficeDetail } from '../constants/adminOffices'

/**
 * `/dev/<학교>` 미리보기 한 곳 분량의 조사 데이터. 홍익대 지도 데이터와 같은 모양(Building/Facility)이라
 * 앱의 건물 시트·시설 시트·행정 부서 화면을 그대로 쓴다(`DevCampusScreen`). 학교별 파일은 생성 스크립트로 만든다.
 */
export interface CampusPreviewExtra {
  id: string
  buildingName: string
  floor?: number
  note: string
}

export interface CampusPreviewData {
  /** 화면 제목에 쓰는 학교 이름(예: '서강대') */
  name: string
  center: { lat: number; lng: number }
  buildings: Building[]
  facilities: Facility[]
  /** 칩 종류에 없는 것. 넓은 화면의 목록에만 보인다. */
  extras: CampusPreviewExtra[]
  /** 행정·지원 시설 id → 담당 업무·연락처 */
  officeDetails: Record<string, AdminOfficeDetail>
}

export type CampusPreviewKey = 'sogang' | 'yonsei' | 'ewha'

/** 키를 맞힌 뒤에만 그 학교 데이터 파일을 받는다. */
export const CAMPUS_PREVIEW_LOADERS: Record<CampusPreviewKey, () => Promise<{ default: CampusPreviewData }>> = {
  sogang: () => import('./sogangData'),
  yonsei: () => import('./yonseiData'),
  ewha: () => import('./ewhaData'),
}

export const CAMPUS_PREVIEW_NAMES: Record<CampusPreviewKey, string> = {
  sogang: '서강대',
  yonsei: '연세대',
  ewha: '이화여대',
}
