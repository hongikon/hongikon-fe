import { StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'

const SIZE = 32

/**
 * 게시판 구독 종 버튼. 앱 전체에서 "구독"은 이 한 모양만 쓴다(10-08 — 학과 목록의 종 버튼으로 통일, 구독 관리의
 * "구독/구독중" 알약을 대신한다). 구독 중이면 남색 원 + 흰 종, 아니면 테두리만 있는 원 + 회색 종.
 */
export default function SubscribeBell({
  name,
  subscribed,
  onToggle,
}: {
  /** 스크린리더가 "○○ 구독"처럼 무엇을 구독하는지 읽게 한다. */
  name: string
  subscribed: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.bell, subscribed && styles.bellOn]}
      onPress={onToggle}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={subscribed ? `${name} 구독 해제` : `${name} 구독`}
    >
      <Ionicons
        name={subscribed ? 'notifications' : 'notifications-outline'}
        size={16}
        color={subscribed ? COLORS.white : COLORS.iconInactive}
      />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  bell: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
})
