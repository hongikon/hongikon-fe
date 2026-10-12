import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMapData } from '../../lib/mapData'
import { SETTINGS_STORAGE_KEY } from '../../lib/accountData'
import { restoreSettings, type StoredSettings } from '../../utils/settingsStorage'
import { prefetchNewsFirstPage } from '../../hooks/useNewsFeed'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import LaunchView from './LaunchView'

/**
 * 지도 데이터가 이 시간 안에 준비되면(기기 저장본이 있는 두 번째 실행부터) 로딩 화면 없이 바로 걷는다 — 안내·막대는 이 시간이
 * 지나야 나타나므로 보이지 않고, 사용자에게는 스플래시 로고에서 곧장 앱으로 넘어간 것으로 보인다.
 * 처음 실행처럼 서버에서 받아야 하면 그때 안내·막대가 나타나 받을 때까지(최소 MIN, 최대 MAX) 찬다.
 */
const CACHE_HIT_WITHIN_MS = 200
const MIN_VISIBLE_MS = 400
/** 이보다 오래 기다리지 않는다. 지도 데이터가 늦으면 지도 화면이 자기 로딩·다시 시도를 보여 준다. */
const MAX_VISIBLE_MS = 2500

/** 기기에 저장된 구독 게시판으로 소식 첫 페이지를 미리 받는다. 소식 탭을 열면 바로 보이게. 시작 화면은 이걸 기다리지 않는다. */
function warmNews(): void {
  AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
    .then((raw) => {
      if (!raw) return
      const { subscribedDepts } = restoreSettings(JSON.parse(raw) as StoredSettings).settings
      if (subscribedDepts.length > 0) return prefetchNewsFirstPage(subscribedDepts)
    })
    .catch(() => {})
}

/**
 * 앱을 처음 켤 때 화면 전체를 덮는 시작 화면. 이 동안 첫 화면(지도)에 필요한 지도 데이터와, 소식 첫 페이지를 함께 불러온다.
 * - 막대: 그려진 시점 30% → 기다리는 동안 85%까지 천천히 → 지도 데이터가 준비되면 100% 후 사라짐.
 * - 두 번째 실행부터는 지도 데이터가 저장본으로 곧바로 준비돼 안내·막대 없이 바로 걷힌다. 처음 실행은 서버에서 받을 때까지(최소 0.4초, 최대 2.5초).
 * - 덮기만 할 뿐 밑의 앱(로그인 복원·온보딩·설정)은 함께 시작된다. 콜드 스타트 한 번만 뜬다(App 루트에 한 번 마운트).
 */
export default function LaunchOverlay() {
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

  if (gone) return null
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="auto">
      <LaunchView progress={progress} bottomOpacity={bottomOpacity} />
    </Animated.View>
  )
}
