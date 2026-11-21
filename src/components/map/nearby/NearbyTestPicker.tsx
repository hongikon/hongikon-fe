import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import MapCrosshair from '../picker/MapCrosshair'

interface Props {
  bottom: number
  onConfirm: () => void
  onUseRealLocation: () => void
  onCancel: () => void
}

/**
 * [근처 알림 테스트 위치 고르기] 개발 도구. 지도 가운데 굵은 십자 + 아래 카드(여기로 정하기 · 실제 위치로 · 취소).
 * 근처 알림만 이 자리를 내 위치로 보고, 실제 GPS 는 쓰지 않는다.
 */
function NearbyTestPicker({ bottom, onConfirm, onUseRealLocation, onCancel }: Props) {
  return (
    <>
      <MapCrosshair lineStyle={styles.cross} />
      <View style={[styles.bar, { bottom }]}>
        <Text style={styles.text}>
          지도를 움직여 십자를 테스트할 자리에 맞추세요. 근처 알림만 이 자리를 내 위치로 보고, 실제 GPS 는 쓰지 않아요.
        </Text>
        <View style={styles.buttons}>
          <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={onConfirm} accessibilityRole="button">
            <Text style={styles.buttonPrimaryText}>여기로 정하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={onUseRealLocation} accessibilityRole="button">
            <Text style={styles.buttonText}>실제 위치로</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={onCancel} accessibilityRole="button">
            <Text style={styles.buttonText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  )
}

export default memo(NearbyTestPicker)

const styles = StyleSheet.create({
  cross: { width: 2, height: 36, opacity: 0.9 },
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    padding: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  text: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  buttons: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.fill,
  },
  buttonPrimary: { backgroundColor: COLORS.primary },
  buttonText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  buttonPrimaryText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.white },
})
