import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import { useFocusEffect, useIsFocused } from '@react-navigation/native'
import { useAdminOverview } from '../../AdminAccess'
import { consumeAdminIntent, subscribeAdminIntent, type AdminIntent } from '../../../lib/adminIntents'
import { getMockMode } from '../../api'
import type { AdminSection } from '../../types'
import { type AdminScrollHandle } from '../../ui'
import { useTabBarInset } from '../../../hooks/common/useTabBarInset'
import { readSavedSection, saveSection } from '../../utils/shell/adminTabScreen'

/** AdminTabScreen 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useAdminTabScreen() {
  const tabInset = useTabBarInset()
  const overview = useAdminOverview()
  const { refresh } = overview
  const [section, setSection] = useState<AdminSection>(readSavedSection)
  // 웹: 새로고침해도 보던 섹션으로 다시 연다(`/manage` 주소는 섹션까지 담지 않는다).
  useEffect(() => saveSection(section), [section])
  const scrollRef = useRef<ScrollView>(null)
  /**
   * 관리자 알림을 눌러 들어왔을 때 연 섹션의 필터·강조할 항목. key 가 바뀌면 그 섹션 화면을 새로 그려 필터를 다시 적용한다.
   * 사용자가 섹션을 직접 바꾸면 지운다.
   */
  const [focus, setFocus] = useState<{ intent: AdminIntent; key: number } | null>(null)

  /** 관리자 알림(`adminIntents`)으로 넘어온 요청이 있으면 그 섹션을 연다. */
  const applyIntent = useCallback(() => {
    const intent = consumeAdminIntent()
    if (!intent || intent.section === 'open') return
    setFocus({ intent, key: Date.now() })
    setSection(intent.section)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [])
  const scrollYRef = useRef(0)
  const scrollHandle = useMemo<AdminScrollHandle>(
    () => ({
      scrollBy: (dy) => scrollRef.current?.scrollTo({ y: Math.max(0, scrollYRef.current + dy), animated: true }),
    }),
    [],
  )

  // 탭에 들어올 때마다 다시 묻는다 — 권한이 회수됐으면 403 으로 탭이 닫히고, 배지 수도 맞춘다.
  useFocusEffect(
    useCallback(() => {
      refresh()
      applyIntent()
    }, [refresh, applyIntent]),
  )

  // 관리 탭을 보고 있는 중에 관리자 알림을 누른 경우(포커스가 바뀌지 않는다).
  const isFocused = useIsFocused()
  const isFocusedRef = useRef(isFocused)
  isFocusedRef.current = isFocused
  useEffect(
    () =>
      subscribeAdminIntent(() => {
        if (isFocusedRef.current) applyIntent()
      }),
    [applyIntent],
  )

  const navigate = useCallback((next: AdminSection) => {
    setFocus(null)
    setSection(next)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [])

  const data = overview.data
  const badgeFor = (item: AdminSection): number => {
    if (!data) return 0
    if (item === 'reports') return data.reports.pending
    if (item === 'feedback') return data.feedback.open
    if (item === 'comments') return data.comments?.flaggedPending ?? 0
    return 0
  }

  const reportFocus = focus?.intent.section === 'reports' ? focus.intent : null
  const feedbackFocus = focus?.intent.section === 'feedback' ? focus.intent : null
  const usersFocus = focus?.intent.section === 'users' ? focus.intent : null
  const commentsFocus = focus?.intent.section === 'comments' ? focus.intent : null


  const mock = getMockMode()
  return {
    tabInset,
    overview,
    refresh,
    section,
    scrollRef,
    focus,
    scrollYRef,
    scrollHandle,
    navigate,
    data,
    badgeFor,
    reportFocus,
    feedbackFocus,
    usersFocus,
    commentsFocus,
    mock,
  }
}
