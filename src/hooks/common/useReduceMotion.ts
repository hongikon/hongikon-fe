import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** 기기 설정의 "동작 줄이기"가 켜져 있는지. 켜져 있으면 흔들기·깜빡임 같은 움직임을 뺀다. 웹은 prefers-reduced-motion 을 따른다. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => {
      alive = false
      sub?.remove()
    }
  }, [])
  return reduce
}
