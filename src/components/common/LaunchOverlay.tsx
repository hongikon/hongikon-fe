import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'
import { useMapData } from '../../lib/mapData'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import LaunchView from './LaunchView'

/** 로고를 보여 주는 최소 시간. 저장본이 있어 곧바로 준비돼도 화면이 깜빡 지나가지 않게. */
const MIN_VISIBLE_MS = 700
/** 이보다 오래 기다리지 않는다. 지도 데이터가 늦으면 지도 화면이 자기 로딩·다시 시도를 보여 준다. */
const MAX_VISIBLE_MS = 3500

/**
 * 앱을 처음 켤 때 화면 전체를 덮는 시작 화면. 아래 진행 막대는 지도 데이터(첫 탭이 바로 쓰는 건물·편의시설·제휴)가
 * 준비되는 만큼 찬다: 폰트 준비(여기가 그려진 시점) 30% → 기다리는 동안 85%까지 천천히 → 준비되면 100% 후 사라짐.
 * 밑에서는 로그인 복원·온보딩·설정이 함께 진행된다(덮기만 할 뿐 막지 않는다). 콜드 스타트 한 번만 뜬다(App 루트에 한 번 마운트).
 */
export default function LaunchOverlay() {
  const { status } = useMapData()
  const reduceMotion = useReduceMotion()
  const progress = useRef(new Animated.Value(0.3)).current
  const opacity = useRef(new Animated.Value(1)).current
  const startedAt = useRef(Date.now()).current
  const [minElapsed, setMinElapsed] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [gone, setGone] = useState(false)
  const finishing = useRef(false)

  useEffect(() => {
    const creep = Animated.timing(progress, {
      toValue: 0.85,
      duration: reduceMotion ? 0 : 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    creep.start()
    const minTimer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS)
    const maxTimer = setTimeout(() => setTimedOut(true), MAX_VISIBLE_MS)
    return () => {
      creep.stop()
      clearTimeout(minTimer)
      clearTimeout(maxTimer)
    }
  }, [progress, reduceMotion])

  const ready = status !== 'loading'
  useEffect(() => {
    if (finishing.current || !((ready && minElapsed) || timedOut)) return
    finishing.current = true
    progress.stopAnimation()
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 240, delay: 80, useNativeDriver: true }),
    ]).start(() => setGone(true))
    if (__DEV__) console.log(`[launch] ${ready ? 'ready' : 'timeout'} after ${Date.now() - startedAt}ms`)
  }, [ready, minElapsed, timedOut, progress, opacity, reduceMotion, startedAt])

  if (gone) return null
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="auto">
      <LaunchView progress={progress} />
    </Animated.View>
  )
}
