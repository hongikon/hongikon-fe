import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MenuRow, menuStyles } from './ModerationMenu'

interface ReportOwnerMenuProps {
  visible: boolean
  onClose: () => void
  /** 이 제보 알림(새 댓글·답글, 🔥 10·50·100개) 켜짐 여부. */
  notifyEnabled: boolean
  /** 설정의 "내 제보 결과 알림"이 꺼져 있으면 이 제보 알림을 켜도 오지 않는다 — 안내만 붙인다. */
  globalOff: boolean
  onToggleNotify: () => void
}

/** 내 제보의 ⋯ 메뉴. 지금은 "이 제보 알림 끄기/켜기" 하나(남의 제보 ⋯ 와 같은 아래 시트 모양). */
export default function ReportOwnerMenu({ visible, onClose, notifyEnabled, globalOff, onToggleNotify }: ReportOwnerMenuProps) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={menuStyles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="메뉴 닫기">
        <Pressable style={[menuStyles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => {}}>
          <View accessibilityRole="menu">
            <MenuRow
              icon={notifyEnabled ? 'notifications-off-outline' : 'notifications-outline'}
              label={notifyEnabled ? '이 제보 알림 끄기' : '이 제보 알림 켜기'}
              hint={
                globalOff
                  ? '설정 > 알림의 "내 제보 결과 알림"이 꺼져 있어 지금은 알림이 오지 않아요'
                  : notifyEnabled
                    ? '이 제보의 새 댓글·답글과 🔥 소식을 더 받지 않아요'
                    : '이 제보에 새 댓글이 달리거나 🔥 가 10·50·100개를 넘으면 알려 드려요'
              }
              onPress={() => {
                onClose()
                onToggleNotify()
              }}
            />
          </View>
          <TouchableOpacity style={menuStyles.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={menuStyles.cancelText}>취소</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
