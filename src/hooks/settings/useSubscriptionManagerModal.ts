import { useMemo, useState } from 'react'
import { SUBSCRIBABLE_ITEMS, groupSubscribableItems } from '../../constants/news'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useDragToClose } from '../common/useDragToClose'
import type { SubscriptionManagerModalProps } from '../../components/settings/SubscriptionManagerModal'

/** SubscriptionManagerModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useSubscriptionManagerModal({ onClose }: Pick<SubscriptionManagerModalProps, 'onClose'>) {
  const [query, setQuery] = useState('')
  const drag = useDragToClose(onClose)
  // 알림 설정(전체 스위치)이 꺼져 있으면 안내 문구를 바꾼다.
  const { settings } = useSettings()
  const masterOff = !settings.subscriptionAlert
  // 게스트도 소식 탭에 보여 줄 게시판은 고를 수 있다. 알림은 로그인해야 받아 게스트에겐 로그인 안내를 보여 준다.
  const isGuest = useAuth().status !== 'authenticated'

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? SUBSCRIBABLE_ITEMS.filter(
          (item) =>
            item.name.toLowerCase().includes(keyword) ||
            item.group.toLowerCase().includes(keyword)
        )
      : SUBSCRIBABLE_ITEMS
    return groupSubscribableItems(filtered)
  }, [query])
  return { query, setQuery, drag, masterOff, isGuest, groups }
}
