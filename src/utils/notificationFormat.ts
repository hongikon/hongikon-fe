import { NEWS_BY_ID } from '../constants/news'
import { BUILDINGS } from '../constants/buildings'
import { reportCategoryMeta } from '../constants/reportCategories'
import { haversineMeters } from './geo'
import type { PushNotificationData } from '../types'

export interface FormattedNotification {
  title: string
  body: string
}

/** 이 반경(m) 안에 건물이 없으면 좌표가 건물 밖(캠퍼스 공터 등)이라고 본다. */
const NEARBY_BUILDING_RADIUS_METERS = 80

/**
 * 좌표에서 가장 가까운 건물 이름을 찾는다. 서버 `buildingId`는 앱의 건물 데이터
 * (이름 키, `buildings.ts`)와 매핑할 방법이 없어(`ReportComposerModal`의
 * "buildingId 는 보내지 않는다" 참고) 좌표 기반으로 위치명을 만든다.
 */
function nearestBuildingName(lat: number, lng: number): string | null {
  let best: { name: string; distance: number } | null = null

  for (const building of BUILDINGS) {
    const distance = haversineMeters(lat, lng, building.lat, building.lng)
    if (distance <= NEARBY_BUILDING_RADIUS_METERS && (best === null || distance < best.distance)) {
      best = { name: building.name, distance }
    }
  }

  return best?.name ?? null
}

function formatReportLocation(data: Extract<PushNotificationData, { type: 'REPORT' }>): string {
  const buildingName = nearestBuildingName(data.lat, data.lng)
  if (buildingName === null) return '캠퍼스'
  return data.floor === null ? buildingName : `${buildingName} ${data.floor}층`
}

/**
 * 알림 `data` payload로부터 실제 표시용 제목/본문을 만든다.
 *
 * - NEWS: 제목에 소식을 올린 학과·기관, 본문에 소식 제목 — "학과 + 내용".
 * - REPORT: 제목에 제보 위치(건물+층), 본문에 제보 제목 — "위치 + 내용".
 *
 * `newsId`가 로컬 `NEWS_DATA`에 없으면(오래된 스냅샷 등) null을 돌려준다 —
 * 호출자는 이 경우 알림을 조용히 무시하면 된다.
 */
export function formatPushNotification(data: PushNotificationData): FormattedNotification | null {
  if (data.type === 'NEWS') {
    const item = NEWS_BY_ID.get(data.newsId)
    if (!item) return null
    return { title: `[${item.source}]`, body: item.title }
  }

  const meta = reportCategoryMeta(data.category)
  const label = data.customCategoryLabel || meta.label
  return { title: `[${formatReportLocation(data)}] ${label}`, body: data.title }
}
