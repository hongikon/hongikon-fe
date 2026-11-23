import { forwardRef } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'
import { useNaverMapViewWeb } from '../../hooks/map/useNaverMapViewWeb'

export interface NaverMapViewHandle {
  injectJavaScript: (js: string) => void
}

export interface Props {
  html: string
  onMessage: (event: { nativeEvent: { data: string } }) => void
  /** 지도 스크립트를 처음 실행한 뒤 한 번 부른다(그 전에 보낸 마커·이동 명령을 다시 보내게). */
  onReady?: () => void
}

const NaverMapView = forwardRef<NaverMapViewHandle, Props>(({ html, onMessage, onReady }, ref) => {
  const { status, retry } = useNaverMapViewWeb({ html, onMessage, onReady }, ref)

  return (
    <View style={styles.container}>
      <div
        id="map"
        style={{ width: '100%', height: '100%' } as React.CSSProperties}
      />
      {status === 'failed' && (
        <View style={styles.overlay}>
          <Text style={styles.title}>지도를 불러오지 못했어요</Text>
          <Text style={styles.body}>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => retry(true)}
            accessibilityRole="button"
            accessibilityLabel="지도 다시 불러오기"
          >
            <Text style={styles.buttonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 32,
  },
  title: { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  body: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  buttonText: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.white },
})

export default NaverMapView
