import { useState } from 'react'
import { getErrorMessage } from '../../apis/client'
import { confirmAction } from '../../utils/dialog'
import { formatReportSchedule } from '../../utils/reportSchedule'
import { updateReportStatus } from '../api'
import type { AdminReport } from '../types'
import { ACTION_CONFIRM, ACTION_META, type ActionKind } from '../utils/reportReview'

interface Options {
  report: AdminReport
  /** 앱 관리 탭이면 처리 전에 확인 창으로 묻는다. */
  app: boolean
  /** 시작 전 제보. 승인·다시 공개 확인 문구가 달라진다. */
  upcoming: boolean
  onUpdated: (report: AdminReport) => void
}

/**
 * 제보 카드의 처리(승인·반려·숨김·삭제): 펼친 확인 단계, 반려 사유 입력, 진행 중 표시와 오류.
 */
export function useReportActions({ report, app, upcoming, onUpdated }: Options) {
  /** 펼친 확인 단계. 반려는 사유 입력, 삭제는 한 번 더 확인. */
  const [confirming, setConfirming] = useState<'reject' | 'delete' | null>(null)
  const [pending, setPending] = useState<ActionKind | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const runAction = (kind: ActionKind, noteText?: string) => {
    setPending(kind)
    setActionError(null)
    updateReportStatus(report.id, ACTION_META[kind].target, noteText)
      .then((updated) => {
        setConfirming(null)
        setNote('')
        onUpdated(updated)
      })
      .catch((err: unknown) => setActionError(getErrorMessage(err, '처리하지 못했습니다. 다시 시도해주세요.')))
      .finally(() => setPending(null))
  }

  /** 앱에서는 처리 전에 확인 창으로 한 번 묻는다(폰에서 잘못 누르기 쉽다). 웹 콘솔은 기존대로 바로 처리. */
  const confirmThenRun = (kind: ActionKind, noteText?: string) => {
    if (!app) {
      runAction(kind, noteText)
      return
    }
    const meta = ACTION_CONFIRM[kind]
    // 예정 제보는 승인해도 시작 시각이 돼야 지도에 뜬다 — 바로 보인다고 안내하지 않는다.
    const baseMessage =
      upcoming && (kind === 'approve' || kind === 'reopen')
        ? `시작 시각(${formatReportSchedule(report)})이 되면 지도와 목록에 보입니다.`
        : meta.message
    confirmAction({
      title: meta.title,
      message: noteText ? `${baseMessage}\n\n사유: ${noteText}` : baseMessage,
      confirmLabel: ACTION_META[kind].label,
      destructive: meta.destructive,
      onConfirm: () => runAction(kind, noteText),
    })
  }

  const onActionPress = (kind: ActionKind) => {
    setActionError(null)
    if (kind === 'reject' || (kind === 'delete' && !app)) {
      setConfirming(kind)
      return
    }
    confirmThenRun(kind)
  }

  const trimmedNote = note.trim()

  /** 반려 확인: 사유가 비면 막고, 있으면 (앱은 확인 창을 거쳐) 처리한다. */
  const confirmReject = () => {
    if (!trimmedNote) {
      setActionError('반려 사유를 입력해주세요.')
      return
    }
    confirmThenRun('reject', trimmedNote)
  }

  return {
    confirming,
    setConfirming,
    pending,
    busy: pending !== null,
    actionError,
    note,
    setNote,
    runAction,
    onActionPress,
    confirmReject,
  }
}
