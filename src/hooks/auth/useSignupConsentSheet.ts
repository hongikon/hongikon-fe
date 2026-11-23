import { useEffect, useRef, useState } from 'react'
import { BackHandler } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type CheckKey } from '../../utils/auth/signupConsentSheet'
import type { SignupConsentSheetProps } from '../../components/auth/SignupConsentSheet'

/** SignupConsentSheet 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useSignupConsentSheet({ visible, onClose, onDismiss }: Pick<SignupConsentSheetProps, 'visible' | 'onClose' | 'onDismiss'>) {
  const insets = useSafeAreaInsets()
  const [checked, setChecked] = useState<Record<CheckKey, boolean>>({ terms: false, privacy: false, age: false })
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null)

  // 열 때마다 처음부터 체크하게 한다(다른 사람이 쓰던 기기에서 체크가 남아 있지 않게).
  useEffect(() => {
    if (visible) setChecked({ terms: false, privacy: false, age: false })
  }, [visible])

  // 닫히면(보이다가 안 보이게 되면) 바로 onDismiss — 네이티브 창이 아니라 내려가는 애니메이션을 기다릴 것이 없다.
  const wasVisibleRef = useRef(visible)
  useEffect(() => {
    if (wasVisibleRef.current && !visible) onDismiss?.()
    wasVisibleRef.current = visible
  }, [visible, onDismiss])

  // Android 뒤로 가기 = 닫기(예전 Modal 의 onRequestClose).
  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [visible, onClose])

  const allChecked = checked.terms && checked.privacy && checked.age
  const toggle = (key: CheckKey) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  const toggleAll = () => {
    const next = !allChecked
    setChecked({ terms: next, privacy: next, age: next })
  }
  return { insets, checked, legal, setLegal, allChecked, toggle, toggleAll }
}
