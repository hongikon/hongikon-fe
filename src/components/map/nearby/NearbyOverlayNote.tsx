import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { requestSettingsIntent } from '../../../lib/settingsIntents'
import { navigationRef } from '../../../navigation/navigationRef'

interface Props {
  note: string
  /** 테스트 위치를 쓰는 중이면 그 좌표 문구(빨간 점). */
  testLabel: string | null
  /** 근처 알림 등록 전이면 설정으로 가는 버튼을 단다. */
  unregistered: boolean
  bottom: number
}

/** 등록 전 안내의 바로가기: 설정 > 근처 제휴 알림 창으로(제휴 시트의 안내와 같은 길, 11-09). */
function openNearbyAlertSettings() {
  requestSettingsIntent({ type: 'openNearbyAlerts' })
  if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Settings' })
}

/** [근처 알림 영역 보기 안내] 개발 도구. 영역 보기를 켠 동안 지도 아래에 등록 상태와 원 색 뜻을 적는다. */
function NearbyOverlayNote({ note, testLabel, unregistered, bottom }: Props) {
  return (
    <View pointerEvents={unregistered ? 'box-none' : 'none'} style={[styles.note, { bottom }]}>
      <Text style={styles.text}>{testLabel ? `${testLabel} (빨간 점)\n${note}` : note}</Text>
      {unregistered && (
        <TouchableOpacity
          style={styles.button}
          onPress={openNearbyAlertSettings}
          accessibilityRole="button"
          accessibilityLabel="근처 제휴 알림 켜러 가기, 설정의 근처 제휴 알림 창이 열려요"
        >
          <Ionicons name="navigate" size={15} color={COLORS.white} />
          <Text style={styles.buttonText}>근처 제휴 알림 켜러 가기</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default memo(NearbyOverlayNote)

const styles = StyleSheet.create({
  note: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  text: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  // 안내 칸 너비를 꽉 채운 남색 버튼(11-09 — 왼쪽 작은 칩이라 눈에 안 띄었다).
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 6,
    marginTop: 8,
    minHeight: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  buttonText: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.white },
})
