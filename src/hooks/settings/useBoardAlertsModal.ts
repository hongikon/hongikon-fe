import { useMemo, useState } from 'react'
import { SUBSCRIBABLE_ITEMS, groupSubscribableItems } from '../../constants/news'
import { useSettings } from '../../contexts/SettingsContext'
import { useFeedbackToggles } from './useFeedbackToggles'
import * as haptics from '../../lib/haptics'
import { useToast } from '../../components/common/Toast'
import type { BoardAlertsModalProps } from '../../components/settings/BoardAlertsModal'

/** BoardAlertsModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useBoardAlertsModal() {
  const { settings, isDeptAlertOn, toggleDeptAlert } = useSettings()
  // 한 줄씩 바꿀 때는 진동·토스트가 붙은 버전(설정 화면 목록과 같은 피드백).
  const { toggleDeptAlert: toggleDeptAlertWithFeedback } = useFeedbackToggles()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const { subscribedDepts } = settings
  const masterOff = !settings.subscriptionAlert

  const subscribedItems = useMemo(() => {
    const subscribed = new Set(subscribedDepts)
    return SUBSCRIBABLE_ITEMS.filter((item) => subscribed.has(item.id))
  }, [subscribedDepts])

  /** 구독한 게시판을 TREE_DATA 순서(단과대별)로 묶는다. 검색어가 있으면 게시판·그룹 이름으로 거른다. */
  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? subscribedItems.filter(
          (item) => item.name.toLowerCase().includes(keyword) || item.group.toLowerCase().includes(keyword),
        )
      : subscribedItems
    return groupSubscribableItems(filtered)
  }, [subscribedItems, query])

  const onCount = subscribedItems.filter((item) => isDeptAlertOn(item.id)).length

  /** 값이 다른 게시판만 바꾼다. 토스트는 한 번만 띄운다. */
  const setAll = (ids: readonly string[], on: boolean, label: string) => {
    const targets = ids.filter((id) => isDeptAlertOn(id) !== on)
    if (targets.length === 0) return
    for (const id of targets) toggleDeptAlert(id)
    haptics.tapLight()
    toast.show(
      on
        ? { message: `${label} 알림을 모두 켰어요` }
        : { message: `${label} 알림을 모두 껐어요`, tone: 'info' },
    )
  }

  const visibleIds = groups.flatMap((group) => group.items.map((item) => item.id))
  const searching = query.trim().length > 0
  const scopeLabel = searching ? '검색된 게시판' : '구독한 게시판'
  return {
    isDeptAlertOn,
    toggleDeptAlertWithFeedback,
    query,
    setQuery,
    masterOff,
    subscribedItems,
    groups,
    onCount,
    setAll,
    visibleIds,
    scopeLabel,
  }
}
