import type { Tone } from '../ui/theme'
import type { AdminAskFeedbackItem, AdminAskFeedbackResponse, AskFeedbackReasonCode } from '../types'

/**
 * 물어보기 피드백(AskFeedbackScreen)의 이유 표시·거르기와 '확인함' 반영(순수 함수).
 */

export const ASK_REASON_LABELS: Record<AskFeedbackReasonCode | 'NONE', string> = {
  WRONG: '틀린 정보',
  OUTDATED: '지난 정보',
  OFF_TOPIC: '질문과 다름',
  NOT_ENOUGH: '부족함',
  NONE: '이유 안 고름',
}

export const ASK_REASON_TONES: Record<AskFeedbackReasonCode, Tone> = {
  WRONG: 'danger',
  OUTDATED: 'warning',
  OFF_TOPIC: 'info',
  NOT_ENOUGH: 'neutral',
}

export const ASK_DAY_OPTIONS = [
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
  { value: '90', label: '90일' },
] as const

export type AskDays = (typeof ASK_DAY_OPTIONS)[number]['value']

export type ReasonFilter = AskFeedbackReasonCode | 'NONE' | 'ALL'

/** 이유 칩으로 거른다. 이유를 안 고른 답은 'NONE'. */
export function filterByReason(items: readonly AdminAskFeedbackItem[], reason: ReasonFilter): AdminAskFeedbackItem[] {
  return items.filter((item) => reason === 'ALL' || (item.reason ?? 'NONE') === reason)
}

/** 이유 칩 목록: 전체(받은 건수) + 이유별(서버가 센 건수, 없으면 0). */
export function reasonChipOptions(data: AdminAskFeedbackResponse | null): { value: ReasonFilter; label: string; count?: number }[] {
  return [
    { value: 'ALL', label: '전체', count: data?.items.length },
    ...(['WRONG', 'OUTDATED', 'OFF_TOPIC', 'NOT_ENOUGH', 'NONE'] as const).map((code) => ({
      value: code,
      label: ASK_REASON_LABELS[code],
      count: data?.reasons[code] ?? 0,
    })),
  ]
}

/** '확인함'·'되돌리기' 결과를 받은 목록에 반영한다(다시 불러오지 않는다). */
export function applyReviewed(
  prev: AdminAskFeedbackResponse | null,
  item: Pick<AdminAskFeedbackItem, 'source' | 'id'>,
  reviewed: boolean,
  nowIso: string,
): AdminAskFeedbackResponse | null {
  return prev
    ? {
        ...prev,
        items: prev.items.map((row) =>
          row.source === item.source && row.id === item.id ? { ...row, reviewedAt: reviewed ? nowIso : null } : row,
        ),
      }
    : prev
}
