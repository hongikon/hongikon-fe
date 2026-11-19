import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import NearbyAlertSettings from '../../NearbyAlertSettings'
import { COLORS } from '../../../../constants/colors'
import { RADIUS, SPACING } from '../../../../constants/spacing'
import { settingsStyles as s } from '../styles'

interface Props {
  /** 지도에서 '근처 제휴 알림 켜러 가기'로 왔을 때 잠깐 남색으로 감싼다(useNearbySettingHighlight). */
  highlight: boolean
  onLayout: (e: LayoutChangeEvent) => void
  openSignal: number
  onModalClose: () => void
}

/** 근처 제휴 칸. 근처 알림 빌드 + 로그인일 때만 그린다(부모가 거른다). 공지와 제보 사이(11-01). */
export default function NearbyAlertBlock({ highlight, onLayout, openSignal, onModalClose }: Props) {
  return (
    <View style={[s.subBlock, highlight && styles.subBlockHighlight]} onLayout={onLayout}>
      <Text style={[s.subHeader, highlight && styles.subHeaderHighlight]}>
        {highlight ? '근처 제휴 · 여기서 켜고 꺼요' : '근처 제휴'}
      </Text>
      <NearbyAlertSettings openSignal={openSignal} onModalClose={onModalClose} />
    </View>
  )
}

const styles = StyleSheet.create({
  // 지도에서 근처 알림을 켜러 왔을 때 잠깐 강조(11-09).
  // 칸 전체를 남색 테두리로 감싼다(11-09 — 왼쪽 막대만으로는 어느 칸인지 덜 보였다). 테두리만큼 안쪽 여백을 줄여
  // 내용이 옆으로 밀리지 않게 하고, 둥근 모서리가 보이게 양옆을 조금 띄운다.
  subBlockHighlight: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.xs,
    overflow: 'hidden',
  },
  subHeaderHighlight: { color: COLORS.primary },
})
