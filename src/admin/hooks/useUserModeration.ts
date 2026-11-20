import { useState } from 'react'
import { confirmAction } from '../../utils/dialog'
import { clearOfficialName, grantAdmin, revokeAdmin, suspendUser, unsuspendUser } from '../api'
import type { AdminUser } from '../types'
import { moderationError, officialError, roleError } from '../utils/moderationErrors'
import { memberLabel, memberName } from '../utils/userModeration'

/**
 * 회원 카드의 처리 상태: 이용 정지(사유 입력 → 확인)·해제, 관리자 지정·해제, 공식 계정 지정·해제.
 * 관리자·공식 계정 변경은 확인 창으로 한 번 더 묻는다. 서버가 권한을 다시 확인하므로 여기서는 버튼만 고른다.
 */
export function useUserModeration(user: AdminUser, onChanged: (user: AdminUser) => void) {
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  /** 공식 계정 지정 입력 중(학생회 등 — 공식 계정 신청을 보낸 회원만). */
  const [officialEditing, setOfficialEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = (task: () => Promise<AdminUser>, fallback: string, toMessage = moderationError) => {
    setBusy(true)
    setError(null)
    task()
      .then((updated) => {
        setConfirming(false)
        setReason('')
        onChanged(updated)
      })
      .catch((err: unknown) => setError(toMessage(err, fallback)))
      .finally(() => setBusy(false))
  }

  const confirmGrant = () =>
    confirmAction({
      title: '관리자로 지정',
      message: `${memberName(user)}(${memberLabel(user)}) 님을 관리자로 지정할까요? 제보 검토·회원 정지 등 관리 기능을 모두 쓸 수 있게 됩니다.`,
      confirmLabel: '지정',
      onConfirm: () => run(() => grantAdmin(user.id), '관리자로 지정하지 못했습니다. 다시 시도해주세요.', roleError),
    })

  const confirmRevoke = () =>
    confirmAction({
      title: '관리자 해제',
      message: `${memberName(user)}(${memberLabel(user)}) 님의 관리자 권한을 해제할까요? 다음 요청부터 관리 기능을 쓸 수 없습니다.`,
      confirmLabel: '해제',
      destructive: true,
      onConfirm: () => run(() => revokeAdmin(user.id), '관리자 권한을 해제하지 못했습니다. 다시 시도해주세요.', roleError),
    })

  const confirmClearOfficial = () =>
    confirmAction({
      title: '공식 계정 해제',
      message: `'${user.officialName ?? ''}' 공식 이름과 배지를 뗄까요? 이 계정은 원래 이름(앱 닉네임)으로 돌아갑니다.`,
      confirmLabel: '해제',
      destructive: true,
      onConfirm: () => run(() => clearOfficialName(user.id), '공식 계정을 해제하지 못했습니다. 다시 시도해주세요.', officialError),
    })

  /** 정지 확인: 사유가 비면 막는다. */
  const confirmSuspend = () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError('정지 사유를 입력해주세요.')
      return
    }
    run(() => suspendUser(user.id, trimmed), '정지하지 못했습니다. 다시 시도해주세요.')
  }

  const unsuspend = () => run(() => unsuspendUser(user.id), '정지를 풀지 못했습니다. 다시 시도해주세요.')

  const startOfficial = () => {
    setError(null)
    setOfficialEditing(true)
  }

  /** 공식 이름을 붙였다. */
  const officialDone = (updated: AdminUser) => {
    setOfficialEditing(false)
    onChanged(updated)
  }

  return {
    confirming,
    setConfirming,
    reason,
    setReason,
    officialEditing,
    setOfficialEditing,
    busy,
    error,
    confirmGrant,
    confirmRevoke,
    confirmClearOfficial,
    confirmSuspend,
    unsuspend,
    startOfficial,
    officialDone,
  }
}
