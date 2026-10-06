import { Platform, Share } from 'react-native'
import type { Building, ReportListItem } from '../types'
import { formatFloor } from './floors'
import { haversineMeters } from './geo'
import { formatServerSchedule } from './reportSchedule'

/** 공유 링크. 웹판(hongikon.com)의 `/r/{id}` 가 지도를 열고 그 제보 시트를 띄운다(App.tsx `sharedReportIdFromPath`). */
export const SHARE_ORIGIN = 'https://hongikon.com'

export function reportShareUrl(reportId: number): string {
  return `${SHARE_ORIGIN}/r/${reportId}`
}

/**
 * 제보 좌표에서 가장 가까운 건물 이름(150m 안). 목록 응답엔 건물 이름이 없어 지도 데이터의 건물(`buildings`)로 찾는다.
 * 지도 데이터를 아직 못 받았으면(빈 배열) null.
 */
export function nearestBuildingName(lat: number, lng: number, buildings: readonly Building[]): string | null {
  let best: { name: string; d: number } | null = null
  for (const b of buildings) {
    const d = haversineMeters(lat, lng, b.lat, b.lng)
    if (!best || d < best.d) best = { name: b.name, d }
  }
  return best && best.d <= 150 ? best.name : null
}

export function reportPlaceText(
  report: Pick<ReportListItem, 'lat' | 'lng' | 'floor' | 'placeLabel'>,
  buildings: readonly Building[],
): string {
  // 작성자가 적은(또는 앱이 채운) 장소 설명이 있으면 그대로 쓴다.
  if (report.placeLabel && report.placeLabel.trim()) return report.placeLabel.trim()
  const building = nearestBuildingName(report.lat, report.lng, buildings)
  const floor = typeof report.floor === 'number' ? formatFloor(report.floor) : null
  if (building) return floor ? `${building} ${floor}` : building
  return '홍익대학교 서울캠퍼스'
}

/** 공유 문구: 제목, 시간(KST), 장소, 링크. */
export function reportShareMessage(report: ReportListItem, buildings: readonly Building[]): string {
  return [
    `[홍익온] ${report.title}`,
    `일시: ${formatServerSchedule(report.startsAt, report.endsAt)}`,
    `장소: ${reportPlaceText(report, buildings)}`,
    reportShareUrl(report.id),
  ].join('\n')
}

/**
 * OS 공유 창을 연다. 웹은 `navigator.share` 가 있으면 그걸(react-native-web Share), 없으면(데스크톱 크롬 등) 클립보드에 복사한다.
 * 결과: 'shared' | 'copied' | 'dismissed' | 'failed'.
 */
export async function shareReport(
  report: ReportListItem,
  buildings: readonly Building[],
): Promise<'shared' | 'copied' | 'dismissed' | 'failed'> {
  const message = reportShareMessage(report, buildings)
  const url = reportShareUrl(report.id)
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: unknown }) : undefined
    if (nav && typeof nav.share === 'function') {
      try {
        await (nav.share as (data: { title?: string; text?: string; url?: string }) => Promise<void>)({
          title: report.title,
          // 링크는 url 로 따로 준다 — 문구 끝에도 있으면 메신저에 두 번 붙는다.
          text: message.replace(`\n${url}`, ''),
          url,
        })
        return 'shared'
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return 'dismissed'
      }
    }
    try {
      await navigator.clipboard.writeText(message)
      return 'copied'
    } catch {
      return 'failed'
    }
  }
  try {
    // iOS 는 message + url 을 따로 주면 링크 미리보기가 붙는다. 안드로이드는 message 만 쓴다(링크 포함).
    const result = await Share.share(
      Platform.OS === 'ios' ? { message: message.replace(`\n${url}`, ''), url, title: report.title } : { message, title: report.title },
      { dialogTitle: '제보 공유하기', subject: report.title },
    )
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared'
  } catch {
    return 'failed'
  }
}
