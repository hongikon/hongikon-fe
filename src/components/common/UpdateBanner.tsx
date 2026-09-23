import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, AppState, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Updates from 'expo-updates'
import { FONTS } from '../../constants/typography'
import { COLORS } from '../../constants/colors'

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
    // 실제 반영은 사용자가 배너의 "지금 적용"을 눌러야 일어난다(화면이 갑자기 리로드되면 안 되니까).
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
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 8 }]}>
      <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={styles.text} numberOfLines={2}>
          새로운 버전이 있어요
        </Text>
        <TouchableOpacity
          style={styles.applyBtn}
          disabled={reloading}
          onPress={() => {
            setReloading(true)
            void Updates.reloadAsync()
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
    borderRadius: 12,
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
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.white },
})
