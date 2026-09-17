import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { FONTS } from '../../constants/typography'
import { checkConnectivity, useConnectivity } from '../../lib/connectivity'

/** 다시 연결됐다는 안내를 잠깐만 보여주는 시간. 계속 떠 있으면 화면만 가린다. */
const RECOVERED_NOTICE_MS = 2_000

/**
 * 모든 화면 위에 뜨는 연결 상태 배너. `App.tsx` 에서 내비게이션 위에 한 번만 올린다.
 *
 * 요청이 자동 재시도까지 실패하면(`src/lib/connectivity.ts`) 나타나고, 뒤에서 점점 간격을
 * 늘려 자동으로 재확인한다. "다시 시도"는 그 기다림을 건너뛰고 바로 확인하며, 연결되면
 * 실패했던 화면들이 `useReconnect` 로 알아서 다시 불러온다.
 *
 * 닫기를 누르면 이번 끊김 동안은 숨기고, 한 번 복구된 뒤 다시 끊기면 또 보여준다.
 */
export default function NetworkStatusBanner() {
  const { status, checking } = useConnectivity()
  const insets = useSafeAreaInsets()
  const [dismissed, setDismissed] = useState(false)
  const [showRecovered, setShowRecovered] = useState(false)
  const prevStatusRef = useRef(status)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (status !== 'online') return

    setDismissed(false)
    // 배너를 보고 있던 사용자에게만 복구를 알린다.
    if (prev === 'online') return
    setShowRecovered(true)
    const timer = setTimeout(() => setShowRecovered(false), RECOVERED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [status])

  const disconnected = status !== 'online'
  if (!showRecovered && (!disconnected || dismissed)) return null

  const recovered = !disconnected
  const message = recovered
    ? '다시 연결됐어요'
    : status === 'offline'
      ? '인터넷에 연결되어 있지 않아요'
      : '서버와 연결이 불안정해요. 자동으로 다시 연결하는 중이에요'

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View
        style={[styles.banner, recovered && styles.bannerRecovered]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Ionicons
          name={recovered ? 'checkmark-circle' : 'cloud-offline-outline'}
          size={16}
          color={recovered ? RECOVERED_TEXT : OFFLINE_TEXT}
        />
        <Text style={[styles.text, recovered && styles.textRecovered]} numberOfLines={2}>
          {message}
        </Text>

        {!recovered && (
          <>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void checkConnectivity()}
              disabled={checking}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
              accessibilityState={{ disabled: checking, busy: checking }}
            >
              {checking ? (
                <ActivityIndicator size="small" color={OFFLINE_TEXT} />
              ) : (
                <Text style={styles.retryText}>다시 시도</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="연결 안내 닫기"
            >
              <Ionicons name="close" size={16} color={OFFLINE_TEXT} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

const OFFLINE_TEXT = '#FFFFFF'
const RECOVERED_TEXT = '#065F46'

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
    backgroundColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  bannerRecovered: { backgroundColor: '#D1FAE5' },
  text: { flex: 1, fontFamily: FONTS.medium, fontSize: 12.5, lineHeight: 17, color: OFFLINE_TEXT },
  textRecovered: { color: RECOVERED_TEXT },
  retryBtn: {
    minWidth: 68,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontFamily: FONTS.semibold, fontSize: 12, color: OFFLINE_TEXT },
})
