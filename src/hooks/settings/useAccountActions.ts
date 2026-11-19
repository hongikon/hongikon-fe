import { useState } from 'react'
import { confirmAction, notify } from '../../utils/dialog'

interface Options {
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  resetSettings: () => void
  /** 탈퇴가 끝나면 떠 있던 창(고객 지원)을 닫는다. */
  closeModal: () => void
}

/**
 * 로그아웃·로그인하러 가기·회원 탈퇴·설정 초기화. 탈퇴 확인 창(WithdrawConfirmDialog)이 떠 있는지도 여기서 쥔다.
 */
export function useAccountActions({ logout, deleteAccount, resetSettings, closeModal }: Options) {
  const handleLogout = () => {
    confirmAction({
      title: '로그아웃',
      message: '로그아웃할까요?',
      confirmLabel: '로그아웃',
      destructive: true,
      onConfirm: () => {
        void logout()
      },
    })
  }

  // 게스트는 로그인된 게 없으니 확인 없이 바로 웰컴 화면으로 보낸다.
  // logout() 이 토큰·게스트 플래그를 함께 지워 signedOut 상태로 돌려놓는다.
  const handleGoToLogin = () => {
    logout()
  }

  // 탈퇴 확인은 WithdrawConfirmDialog(빨간 경고, '아니요'가 메인 컬러). 설정 맨 아래 링크와 고객 지원 › 계정 삭제 안내가 같이 쓴다.
  const [withdrawVisible, setWithdrawVisible] = useState(false)
  const handleDeleteAccount = () => setWithdrawVisible(true)

  const withdraw = async () => {
    try {
      await deleteAccount()
      setWithdrawVisible(false)
      closeModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : '탈퇴 처리 중 오류가 생겼어요.'
      notify('탈퇴 실패', message)
    }
  }

  const handleReset = () => {
    confirmAction({
      title: '설정 초기화',
      message: '모든 설정이 기본값으로 되돌아가요. 계속할까요?',
      confirmLabel: '초기화',
      destructive: true,
      onConfirm: () => {
        void resetSettings()
      },
    })
  }

  return { handleLogout, handleGoToLogin, withdrawVisible, setWithdrawVisible, handleDeleteAccount, withdraw, handleReset }
}
