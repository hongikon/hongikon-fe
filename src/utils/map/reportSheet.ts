import type { ReportCommunityPatch } from '../../components/map/report/ReportActionRow'
import type { ReportListItem } from '../../types'
import { formatClock, formatDaySpan, isSameKstDay, type ReportDayHours, type ReportDaySpan } from '../reportSchedule'

/** 시트에서 바로 바뀌는 값(공감·관심·조회·알림·공식 계정 시간 수정). 지도 목록을 다시 받기 전까지 덮어 둔다. */
export type ReportSheetPatch = ReportCommunityPatch & Partial<Pick<ReportListItem,
  'category' | 'customCategoryLabel' | 'placeLabel' | 'title' | 'content' | 'floor' | 'imageUrl' | 'imageUrls' | 'editedAt'>> & {
  notifyEnabled?: boolean | null
  startsAt?: string
  endsAt?: string
  days?: ReportDayHours[] | null
}

/** 시트에 보여 줄 본문 줄 수. 넘치면 '본문 보기'. */
export const CONTENT_PREVIEW_LINES = 2

/** 미리보기는 줄바꿈·빈 줄을 한 칸으로 접어 두 줄에 글자가 최대한 들어가게 한다(전체 보기는 원문 그대로). */
export function contentPreview(content: string): string {
  return content.trim().replace(/\s*\n+\s*/g, ' ')
}

/** onTextLayout 이 없는 웹에서도 '본문 보기'를 띄우도록: 줄바꿈이 있거나 두 줄쯤(60자)을 넘으면. */
export function contentNeedsMore(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.includes('\n') || trimmed.length > 60
}

/**
 * 날짜별 운영 시간의 한 줄 요약(11-09 — 7줄이 맨 위를 차지했다): 오늘 운영하면 오늘, 아니면(예정·쉬는 날)
 * 가장 가까운 날. 모두 끝났으면 '운영이 끝났어요'.
 */
export function daySpansSummary(daySpans: readonly ReportDaySpan[], clock: number): string {
  const next = daySpans.find((span) => span.endMs > clock)
  return next
    ? isSameKstDay(next.startMs, clock)
      ? `오늘 ${formatClock(next.startMs)}~${formatClock(next.endMs)}`
      : formatDaySpan(next)
    : '운영이 끝났어요'
}

/** 사진 1장일 때 가장 큰 높이, 여러 장일 때 높이. 줄 폭을 넘으면 그만큼 줄인다. */
export const SINGLE_PHOTO_MAX_HEIGHT = 200
export const MULTI_PHOTO_HEIGHT = 120
export const PHOTO_GAP = 6

/**
 * 사진 줄의 공통 높이. 사진마다 원래 비율(가로/세로)로 폭을 정하고, 모두 같은 높이로 줄 폭 안에 들어가게 맞춘다.
 * 줄 폭을 아직 모르면(0) 기본 높이.
 */
export function photoRowHeight(ratios: readonly number[], rowWidth: number): number {
  const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0)
  const available = Math.max(0, rowWidth - PHOTO_GAP * (ratios.length - 1))
  const preferred = ratios.length > 1 ? MULTI_PHOTO_HEIGHT : SINGLE_PHOTO_MAX_HEIGHT
  return rowWidth && totalRatio ? Math.min(preferred, available / totalRatio) : preferred
}
