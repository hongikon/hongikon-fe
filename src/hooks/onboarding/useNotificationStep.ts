import { useCallback, useState } from 'react'
import { SUBSCRIBABLE_ITEMS } from '../../constants/news'
import { useSettings } from '../../contexts/SettingsContext'
import { requestNotificationPermission } from '../../lib/notificationPermission'
import type { NotificationStepProps } from '../../components/onboarding/NotificationStep'

/** NotificationStep 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNotificationStep({ onDone }: Pick<NotificationStepProps, 'onDone'>) {
  const { settings } = useSettings()
  const [requesting, setRequesting] = useState(false)

  // 방금 고른 학과가 있으면 예시 알림에 그 이름을 쓴다. 고른 게 없으면 대표 예시.
  const firstDeptId = settings.subscribedDepts[0]
  const deptName = SUBSCRIBABLE_ITEMS.find((item) => item.id === firstDeptId)?.name ?? '컴퓨터공학과'

  const handleAllow = useCallback(async () => {
    setRequesting(true)
    try {
      await requestNotificationPermission()
    } finally {
      setRequesting(false)
      onDone()
    }
  }, [onDone])
  return { requesting, deptName, handleAllow }
}
