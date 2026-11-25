import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import * as Updates from 'expo-updates'
import { FONTS } from '../../constants/typography'
import { COLORS } from '../../constants/colors'
import { notify } from '../../utils/common/dialog'
import { RADIUS } from '../../constants/spacing'
import { useUpdateBanner } from '../../hooks/common/useUpdateBanner'

/** 하단 탭 바(FloatingTabBar: 알약 60 + 아래 여백) 위로 띄운다. 예전에는 탭 바와 같은 높이라 겹쳐 가렸다(11-03). */
const TAB_BAR_PILL_HEIGHT = 60

/**
 * EAS Update(OTA) 새 버전을 내려받아 알려주는 배너. `App.tsx` 에서 한 번만 올린다.
 *
 * 스토어 심사 없이 JS 번들만 갱신하는 방식이라, 네이티브 코드가 바뀌는 배포(새 패키지 추가 등)는
 * 여전히 스토어 빌드로 올려야 한다 — `app.json` 의 `runtimeVersion` 정책이 그 둘을 갈라준다.
 *
 * 개발 빌드/Expo Go/웹은 `expo-updates` 가 동작하지 않아 `Updates.isEnabled` 로 걸러낸다.
 */
export default function UpdateBanner() {
  const { insets, reloading, setReloading, isUpdatePending } = useUpdateBanner()

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
