import { useEffect, useRef, useState, type RefObject } from 'react'
import { AccessibilityInfo, type ScrollView, type Text, type TextInput, type View } from 'react-native'
import * as haptics from '../../../lib/haptics'
import type { MissingField, RequiredField } from '../../../utils/map/reportComposer'

/** 빠진 칸으로 스크롤한 뒤 입력칸에 포커스를 줄 때까지(ms). 스크롤 애니메이션과 겹치지 않게 조금 기다린다. */
const FOCUS_AFTER_SCROLL_MS = 320

/**
 * 제보 작성창의 빠진 필수 항목 안내: '제보 올리기'를 빠진 채 누르면 빠진 칸마다 테두리를 깜빡이고 안내를 띄우며,
 * 첫 칸으로 스크롤해 포커스를 준다. 스크롤·포커스에 쓰는 ref 들도 여기서 만든다.
 */
export function useRequiredFieldFlash(missing: readonly MissingField[]) {
  const missingMessage = (field: RequiredField) => missing.find((item) => item.field === field)?.message ?? null

  /**
   * 빠진 채 '제보 올리기'를 누른 항목별 깜빡임 번호(0 = 표시 안 함). 누를 때마다 올려 효과를 다시 틀고,
   * 그 항목이 채워지면 0 으로 돌려 빨간 안내를 바로 지운다.
   */
  const [flash, setFlash] = useState<Partial<Record<RequiredField, number>>>({})
  const flashSeqRef = useRef(0)
  const missingKey = missing.map((item) => item.field).join(',')
  useEffect(() => {
    const stillMissing = new Set(missingKey.split(','))
    setFlash((prev) => {
      const entries = Object.entries(prev) as [RequiredField, number][]
      if (entries.every(([field]) => stillMissing.has(field))) return prev
      return Object.fromEntries(entries.filter(([field]) => stillMissing.has(field)))
    })
  }, [missingKey])
  /** 깜빡인 뒤에도 그 항목이 아직 비어 있으면 안내를 보여 준다. */
  const flaggedMessage = (field: RequiredField) => (flash[field] ? missingMessage(field) : null)

  const scrollRef = useRef<ScrollView>(null)
  const customInputRef = useRef<TextInput>(null)
  const titleInputRef = useRef<TextInput>(null)
  /**
   * 빠진 칸으로 스크롤할 때 쓰는 항목 제목(라벨)과 스크롤 영역, 지금 스크롤 위치.
   * onLayout 의 y 는 웹(react-native-web)에서 위쪽 내용 높이가 바뀌어도(직접 입력 칸이 열림 등) 다시 오지 않아
   * 누른 순간 화면 위치를 재서(measureInWindow) 스크롤 안 위치로 바꾼다.
   */
  const scrollAreaRef = useRef<View>(null)
  const scrollYRef = useRef(0)
  const categoryLabelRef = useRef<Text>(null)
  const titleLabelRef = useRef<Text>(null)
  const scheduleLabelRef = useRef<Text>(null)
  const sectionLabelRefs: Partial<Record<RequiredField, RefObject<Text | null>>> = {
    category: categoryLabelRef,
    title: titleLabelRef,
    schedule: scheduleLabelRef,
  }
  const scrollToSection = (field: RequiredField) => {
    const label = sectionLabelRefs[field]?.current
    const area = scrollAreaRef.current
    if (!label || !area) {
      scrollRef.current?.scrollTo({ y: 0, animated: true })
      return
    }
    area.measureInWindow((_areaX, areaY) => {
      label.measureInWindow((_labelX, labelY) => {
        const y = scrollYRef.current + (labelY - areaY) - 8
        scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true })
      })
    })
  }
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
  }, [])

  /**
   * 필수 항목을 확인한다. 빠졌으면 빠진 칸마다 테두리를 깜빡이고 안내를 띄우며, 첫 칸으로 스크롤해 포커스를 주고
   * (시간은 요약 카드만 깜빡이고 시트는 열지 않는다) 진동·스크린리더로 한 번 알린다.
   */
  const checkRequired = (): boolean => {
    if (missing.length === 0) return true
    flashSeqRef.current += 1
    const seq = flashSeqRef.current
    setFlash(Object.fromEntries(missing.map((item) => [item.field, seq])))
    haptics.warning()
    const first = missing[0]
    AccessibilityInfo.announceForAccessibility(first.message)
    scrollToSection(first.field)
    const input = first.field === 'title' ? titleInputRef : first.field === 'category' ? customInputRef : null
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
    if (input) focusTimerRef.current = setTimeout(() => input.current?.focus(), FOCUS_AFTER_SCROLL_MS)
    return false
  }

  const resetFlash = () => setFlash({})

  return {
    flash,
    missingMessage,
    flaggedMessage,
    checkRequired,
    resetFlash,
    scrollRef,
    scrollAreaRef,
    scrollYRef,
    customInputRef,
    titleInputRef,
    categoryLabelRef,
    titleLabelRef,
    scheduleLabelRef,
  }
}
