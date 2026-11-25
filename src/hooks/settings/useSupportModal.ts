import { useState } from 'react'
import { Linking } from 'react-native'
import { notify } from '../../utils/common/dialog'
import { SUPPORT_EMAIL } from '../../utils/settings/supportModal'
import type { SupportModalProps } from '../../components/settings/SupportModal'

/** SupportModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useSupportModal() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  // 이 창 위에 떠야 해서(iOS 는 모달 위에 다른 모달을 띄우려면 그 안에 있어야 한다) 탈퇴 확인 창을 여기 둔다.
  const [withdrawVisible, setWithdrawVisible] = useState(false)

  const openEmail = () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[홍익온] 문의')}`
    // 메일 앱이 없는 기기(시뮬레이터, 메일 계정 없는 폰)에서는 주소를 보여 준다.
    Linking.openURL(url).catch(() => notify('이메일로 문의하기', `${SUPPORT_EMAIL} 로 보내 주세요.`))
  }
  return { openIndex, setOpenIndex, withdrawVisible, setWithdrawVisible, openEmail }
}
