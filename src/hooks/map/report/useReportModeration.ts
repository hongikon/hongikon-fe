import { useState } from 'react'
import { ApiError, getErrorMessage, isNetworkError, isRetryableError } from '../../../apis/client'
import { flagReport } from '../../../apis/reports'
import { useToast } from '../../../components/common/Toast'
import { useAuth } from '../../../contexts/AuthContext'
import * as haptics from '../../../lib/haptics'
import { hideAuthor } from '../../../lib/hiddenAuthors'
import type { ReportFlagReason, ReportListItem } from '../../../types'
import { confirmAction } from '../../../utils/dialog'
import { promptLogin } from '../../../utils/reports'

interface Options {
  report: ReportListItem
  /** 시트에 보이는 작성자 이름(숨기기 확인 문구에 쓴다). */
  authorName: string
  onClose: () => void
}

/**
 * 남의 제보 ⋮ 메뉴: 이 사용자 숨기기 · 신고하기(사유). 신고는 POST 라 자동으로 다시 보내지 않고,
 * 연결 문제일 때만 "다시 시도" 안내(`error`)를 준다.
 */
export function useReportModeration({ report, authorName, onClose }: Options) {
  const { accessToken, logout } = useAuth()
  const toast = useToast()
  const [flagging, setFlagging] = useState(false)
  const [flagged, setFlagged] = useState(false)
  // ⋮ 메뉴(이 사용자 숨기기 · 신고하기 → 사유). 남의 제보에만 있다.
  const [menuOpen, setMenuOpen] = useState(false)
  const [lastReason, setLastReason] = useState<ReportFlagReason>('ETC')
  const [error, setError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)

  /** ⋮ 메뉴의 "신고하기". 제보 신고는 로그인이 필요하다(`POST /reports/{id}/flags` — 게스트는 401). */
  const beforeFlag = () => {
    if (!accessToken) {
      promptLogin('제보를 신고하려면 로그인해 주세요.', logout)
      return false
    }
    setError(null)
    return true
  }

  const handleHideAuthor = () => {
    const key = report.authorKey
    if (!key) return
    confirmAction({
      title: '이 사용자의 제보 숨기기',
      message: `${authorName}님이 올린 제보와 댓글이 이 기기에서 더 이상 보이지 않아요. 설정 > 일반 > 숨긴 사용자에서 다시 볼 수 있어요.`,
      confirmLabel: '숨기기',
      destructive: true,
      onConfirm: () => {
        hideAuthor(key, authorName)
        haptics.success()
        toast.show({ message: '이 사용자의 제보를 숨겼어요' })
        onClose()
      },
    })
  }

  const handleFlag = async (reason: ReportFlagReason = lastReason) => {
    if (!accessToken) {
      promptLogin('제보를 신고하려면 로그인해 주세요.', logout)
      return
    }

    setLastReason(reason)
    setFlagging(true)
    setError(null)
    try {
      try {
        await flagReport(report.id, { reason }, accessToken)
      } catch (caught) {
        // PRIVACY 는 서버에 나중에 들어온 사유다. 구버전 서버가 모르는 사유로 400 을 주면 '기타'로 다시 보낸다.
        if (reason === 'PRIVACY' && caught instanceof ApiError && caught.status === 400) {
          await flagReport(report.id, { reason: 'ETC' }, accessToken)
        } else {
          throw caught
        }
      }
      setFlagged(true)
      haptics.success()
      toast.show({ message: '신고가 접수됐어요. 확인 후 조치할게요' })
    } catch (caught) {
      // 이미 신고한 제보면 서버가 409 를 준다 — 실패가 아니라 "신고함" 상태로 보여준다.
      if (caught instanceof ApiError && caught.status === 409) {
        setFlagged(true)
        toast.show({ message: '이미 신고한 제보예요', tone: 'info' })
        return
      }
      // 신고는 POST 라 자동으로 다시 보내지 않는다(중복 신고 방지). 연결 문제일 때만
      // "다시 시도" 버튼을 줘서 사용자가 직접 다시 보내게 한다.
      setError({
        message: getErrorMessage(caught, '신고를 접수하지 못했어요.'),
        network: isNetworkError(caught),
        retryable: isRetryableError(caught),
      })
    } finally {
      setFlagging(false)
    }
  }

  return { flagging, flagged, menuOpen, setMenuOpen, error, beforeFlag, handleHideAuthor, handleFlag }
}
