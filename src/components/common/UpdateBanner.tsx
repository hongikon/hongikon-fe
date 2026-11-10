import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, AppState, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Updates from 'expo-updates'
import { FONTS } from '../../constants/typography'
import { COLORS } from '../../constants/colors'
import { notify } from '../../utils/dialog'
import { RADIUS } from '../../constants/spacing'
/** 하단 탭 바(FloatingTabBar: 알약 60 + 아래 여백) 위로 띄운다. 예전에는 탭 바와 같은 높이라 겹쳐 가렸다(11-03). */
const TAB_BAR_PILL_HEIGHT = 60
/** 앱을 켤 때 스플래시를 띄운 채 새 업데이트를 기다리는 최대 시간. 넘기면 지금 버전으로 열고 배너로 알린다. */
const LAUNCH_UPDATE_WAIT_MS = 3000

/**
 * 앱을 처음 켤 때(콜드 스타트) 새 업데이트가 있으면 스플래시 동안 받아서 바로 적용한다.
 * 예전에는 켤 때 뒤에서 받기만 해서, 새 버전을 보려면 앱을 두 번 껐다 켜야 했다(11-10 사용자 요청).
 *
 * 네이티브가 켤 때 하는 확인(EXUpdatesCheckOnLaunch ALWAYS)의 상태를 `useUpdates` 로 본다(요청을 따로 보내지 않음).
 * 확인 결과 업데이트가 없거나, 오류이거나, `LAUNCH_UPDATE_WAIT_MS` 가 지나면 true 를 돌려 앱을 연다.
 * 다시 시작한 뒤(restartCount > 0)에는 기다리지 않는다 — 리로드가 되풀이되지 않게.
 */
export function useApplyUpdateOnLaunch(): boolean {
  const { isUpdateAvailable, isUpdatePending, isChecking, checkError, downloadError, lastCheckForUpdateTimeSinceRestart, restartCount } =
    Updates.useUpdates()
  const enabled = Updates.isEnabled && Platform.OS !== 'web' && restartCount === 0
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const timer = setTimeout(() => setTimedOut(true), LAUNCH_UPDATE_WAIT_MS)
    return () => clearTimeout(timer)
  }, [enabled])

  const noUpdate = !!lastCheckForUpdateTimeSinceRestart && !isChecking && !isUpdateAvailable
  const failed = !!checkError || !!downloadError
  const ready = !enabled || timedOut || noUpdate || failed

  useEffect(() => {
    if (ready || !isUpdatePending) return
    Updates.reloadAsync().catch(() => setTimedOut(true))
  }, [ready, isUpdatePending])

  return ready
}

/**
 * EAS Update(OTA) 새 버전을 내려받아 알려주는 배너. `App.tsx` 에서 한 번만 올린다.
 *
 * 스토어 심사 없이 JS 번들만 갱신하는 방식이라, 네이티브 코드가 바뀌는 배포(새 패키지 추가 등)는
 * 여전히 스토어 빌드로 올려야 한다 — `app.json` 의 `runtimeVersion` 정책이 그 둘을 갈라준다.
 *
 * 개발 빌드/Expo Go/웹은 `expo-updates` 가 동작하지 않아 `Updates.isEnabled` 로 걸러낸다.
 */
export default function UpdateBanner() {
  const insets = useSafeAreaInsets()
  const [reloading, setReloading] = useState(false)
  const { isUpdatePending } = Updates.useUpdates()
  useEffect(() => {
    if (!Updates.isEnabled || Platform.OS === 'web') return

    // 앱을 계속 켜두고 있어도 받을 수 있도록, 포그라운드로 돌아올 때마다 다시 확인한다.
    // 받은 업데이트는 배너의 "지금 적용"을 눌러야 적용된다(갑자기 리로드되면 안 되니까). 시스템 알림창은 띄우지 않는다(11-03 운영진).
    const checkAndDownload = () => {
      Updates.checkForUpdateAsync()
        .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .catch((error) => {
          if (__DEV__) console.warn('[updates] 확인 실패:', error)
        })
    }

    checkAndDownload()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndDownload()
    })
    return () => subscription.remove()
  }, [])

  if (!isUpdatePending) return null

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 4 + TAB_BAR_PILL_HEIGHT + 10 }]}>
      <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={styles.text} numberOfLines={2}>
          새로운 버전이 있어요
        </Text>
        <TouchableOpacity
          style={styles.applyBtn}
          disabled={reloading}
          onPress={() => {
            setReloading(true)
            // 다시 시작에 실패하면 버튼을 되살린다 — 예전엔 스피너가 계속 돌고 버튼이 눌리지 않았다.
            Updates.reloadAsync().catch(() => {
              setReloading(false)
              notify('다시 시작하지 못했어요', '앱을 껐다가 다시 켜 주세요.')
            })
          }}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="지금 업데이트 적용"
          accessibilityState={{ disabled: reloading, busy: reloading }}
        >
          {reloading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.applyText}>지금 적용</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.floating,
    backgroundColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  text: { flex: 1, fontFamily: FONTS.medium, fontSize: 12.5, lineHeight: 17, color: COLORS.white },
  applyBtn: {
    minWidth: 68,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.white },
})
