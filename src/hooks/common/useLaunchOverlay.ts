import { useEffect, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { useMapData } from '../../lib/mapData'
import { useReduceMotion } from './useReduceMotion'
import { warmNews, CACHE_HIT_WITHIN_MS, MIN_VISIBLE_MS, MAX_VISIBLE_MS } from '../../utils/common/launchOverlay'

/** LaunchOverlay 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useLaunchOverlay() {
  const { status } = useMapData()
  const reduceMotion = useReduceMotion()
  const progress = useRef(new Animated.Value(0.3)).current
  const opacity = useRef(new Animated.Value(1)).current
  const bottomOpacity = useRef(new Animated.Value(0)).current
  const startedAt = useRef(Date.now()).current
  const readyAt = useRef<number | null>(null)
  const [now, setNow] = useState(0)
  const [gone, setGone] = useState(false)
  const finishing = useRef(false)

  useEffect(() => {
    warmNews()
    const creep = Animated.timing(progress, {
      toValue: 0.85,
      duration: reduceMotion ? 0 : 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    creep.start()
    const reveal = Animated.timing(bottomOpacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : 200,
      delay: CACHE_HIT_WITHIN_MS,
      useNativeDriver: true,
    })
    reveal.start()
    // 최소·최대 시간 판단을 다시 하도록 깨운다.
    const timers = [MIN_VISIBLE_MS, MAX_VISIBLE_MS].map((ms) => setTimeout(() => setNow(ms), ms))
    return () => {
      creep.stop()
      reveal.stop()
      timers.forEach(clearTimeout)
    }
  }, [progress, bottomOpacity, reduceMotion])

  const ready = status !== 'loading'
  if (ready && readyAt.current === null) readyAt.current = Date.now()

  useEffect(() => {
    if (finishing.current) return
    const elapsed = Date.now() - startedAt
    const fromCache = readyAt.current !== null && readyAt.current - startedAt <= CACHE_HIT_WITHIN_MS
    const done = (ready && (fromCache || elapsed >= MIN_VISIBLE_MS)) || elapsed >= MAX_VISIBLE_MS
    if (!done) return
    finishing.current = true
    progress.stopAnimation()
    if (fromCache) {
      // 저장본: 막대를 채우지 않고 로고 화면만 살짝 걷는다(스플래시와 같은 로고라 바로 앱이 나타난 것처럼 보인다).
      bottomOpacity.stopAnimation()
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 160, useNativeDriver: true }).start(() => setGone(true))
      if (__DEV__) console.log(`[launch] cache after ${elapsed}ms`)
      return
    }
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 220, delay: 60, useNativeDriver: true }),
    ]).start(() => setGone(true))
    if (__DEV__) console.log(`[launch] ${ready ? (fromCache ? 'cache' : 'network') : 'timeout'} after ${elapsed}ms`)
  }, [ready, now, progress, opacity, bottomOpacity, reduceMotion, startedAt])
  return { progress, opacity, bottomOpacity, gone }
}
