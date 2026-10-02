import { useCallback, useEffect, useRef } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import type { CategoryKey } from '../constants/colors'
import { SUBSCRIBABLE_ITEMS } from '../constants/news'
import { useToast } from '../components/common/Toast'
import * as haptics from '../lib/haptics'

/** 게시판 id → 이름. 트리 맨 위 기관은 이름 자체가 id 라 못 찾으면 id 를 그대로 쓴다. */
const NAME_BY_ID = new Map(SUBSCRIBABLE_ITEMS.map((item) => [item.id, item.name]))
const boardName = (id: string) => NAME_BY_ID.get(id) ?? id

/**
 * 설정 토글(북마크·구독·게시판 알림·분야 알림·제보 알림)에 손끝 진동과 토스트를 붙인 버전.
 * 여러 화면이 같은 문구를 쓰도록 한곳에 모았다.
 *
 * 돌려주는 함수는 렌더마다 바뀌지 않는다(최신 설정은 ref 로 읽음) — 소식 카드(memo)에 그대로 넘겨도
 * 북마크 하나 누를 때 목록 전체가 다시 그려지지 않는다.
 */
export function useFeedbackToggles() {
  const {
    settings,
    toggleBookmark,
    toggleSubscribedDept,
    toggleDeptAlert,
    toggleAlertCategory,
    toggleReportStatusAlert,
    toggleNewReportAlert,
  } = useSettings()
  const toast = useToast()
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const toggleBookmarkWithFeedback = useCallback(
    (id: string) => {
      const adding = !settingsRef.current.bookmarkedNews.includes(id)
      toggleBookmark(id)
      haptics.tapLight()
      toast.show(
        adding
          ? { message: '북마크에 저장했어요' }
          : {
              message: '북마크에서 뺐어요',
              tone: 'info',
              // 실수로 누르기 쉬운 작은 아이콘이라 바로 되돌릴 수 있게 한다.
              action: { label: '되돌리기', onPress: () => toggleBookmark(id) },
            },
      )
    },
    [toggleBookmark, toast],
  )

  const toggleSubscriptionWithFeedback = useCallback(
    (id: string) => {
      const adding = !settingsRef.current.subscribedDepts.includes(id)
      toggleSubscribedDept(id)
      haptics.tapLight()
      toast.show(
        adding
          ? { message: `${boardName(id)} 구독을 시작했어요` }
          : { message: `${boardName(id)} 구독을 해제했어요`, tone: 'info' },
      )
    },
    [toggleSubscribedDept, toast],
  )

  const toggleDeptAlertWithFeedback = useCallback(
    (id: string) => {
      const current = settingsRef.current
      if (!current.subscribedDepts.includes(id)) return
      const turningOn = current.mutedDepts.includes(id)
      toggleDeptAlert(id)
      toast.show(
        turningOn
          ? { message: `${boardName(id)} 알림을 켰어요` }
          : { message: `${boardName(id)} 알림을 껐어요`, tone: 'info' },
      )
    },
    [toggleDeptAlert, toast],
  )

  const toggleAlertCategoryWithFeedback = useCallback(
    (cat: CategoryKey) => {
      const turningOn = !settingsRef.current.alertCategories.includes(cat)
      toggleAlertCategory(cat)
      haptics.selection()
      toast.show(
        turningOn
          ? { message: `'${cat}' 소식을 알려드릴게요` }
          : { message: `'${cat}' 소식은 알리지 않을게요`, tone: 'info' },
      )
    },
    [toggleAlertCategory, toast],
  )

  const toggleReportStatusAlertWithFeedback = useCallback(() => {
    const turningOn = !settingsRef.current.reportStatusAlert
    toggleReportStatusAlert()
    toast.show(
      turningOn
        ? { message: '내 제보가 승인·반려되면 알려드릴게요' }
        : { message: '내 제보 결과 알림을 껐어요', tone: 'info' },
    )
  }, [toggleReportStatusAlert, toast])

  const toggleNewReportAlertWithFeedback = useCallback(() => {
    const turningOn = !settingsRef.current.newReportAlert
    toggleNewReportAlert()
    toast.show(
      turningOn
        ? { message: '캠퍼스 새 제보를 알려드릴게요' }
        : { message: '캠퍼스 새 제보 알림을 껐어요', tone: 'info' },
    )
  }, [toggleNewReportAlert, toast])

  return {
    toggleBookmark: toggleBookmarkWithFeedback,
    toggleSubscribedDept: toggleSubscriptionWithFeedback,
    toggleDeptAlert: toggleDeptAlertWithFeedback,
    toggleAlertCategory: toggleAlertCategoryWithFeedback,
    toggleReportStatusAlert: toggleReportStatusAlertWithFeedback,
    toggleNewReportAlert: toggleNewReportAlertWithFeedback,
  }
}
