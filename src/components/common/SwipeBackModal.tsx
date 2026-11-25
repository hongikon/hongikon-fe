import { type ReactNode } from 'react'
import { Animated, Modal, Platform, StyleSheet, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { useSwipeBackModal } from '../../hooks/common/useSwipeBackModal'

/** 왼쪽 가장자리에서 이만큼 안에서 시작한 끌기만 "뒤로"로 본다(본문의 가로 스크롤·칩과 겹치지 않게). */
const EDGE_WIDTH = 20
/** 가장자리 띠가 시작하는 높이. 상태 표시줄 + 머리 카드(뒤로 버튼) 아래. */
const EDGE_TOP = 140

/**
 * 화면처럼 쓰는 창(11-01 설정 창들, 이어서 제보 본문·제휴 업체 검색·길찾기). 일반 화면처럼 오른쪽에서 밀려 들어오고, 왼쪽 가장자리에서 오른쪽으로 밀면 닫힌다
 * (전엔 아래에서 올라오는 창이라 뒤로 버튼으로만 닫혔다). 뒤로 버튼·Android 뒤로 가기는 `onRequestClose` 그대로.
 * 닫힐 때는 오른쪽으로 빠져나간 뒤 내용을 내린다.
 */
export default function SwipeBackModal({
  visible,
  onRequestClose,
  onShow,
  edgeDisabled = false,
  children,
}: {
  visible: boolean
  onRequestClose: () => void
  onShow?: () => void
  /** 창 안에 덮어 그린 것(사진 크게 보기 등)이 있을 때 가장자리 밀기를 잠시 끈다. */
  edgeDisabled?: boolean
  children: ReactNode
}) {
  const { x, mounted, pan } = useSwipeBackModal({ visible, onRequestClose })

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onRequestClose} onShow={onShow}>
      <Animated.View style={[styles.page, { transform: [{ translateX: x }] }]}>
        {children}
        {/* 전엔 창 전체에 끌기를 달아, 본문이 스크롤되는 창(앱 권한 등)에선 스크롤이 먼저 가져가 밀어 닫기가 안 됐다(11-01). */}
        {Platform.OS !== 'web' && !edgeDisabled && <View style={styles.edge} {...pan.panHandlers} />}
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  page: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.background,
    // 밀어 낼 때 아래 설정 화면과 경계가 보이게 왼쪽에 옅은 그림자.
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  // 머리줄(뒤로 버튼)은 덮지 않게 그 아래부터.
  edge: { position: 'absolute', left: 0, top: EDGE_TOP, bottom: 0, width: EDGE_WIDTH },
})
