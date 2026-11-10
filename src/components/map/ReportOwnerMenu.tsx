import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MenuRow, menuStyles } from './ModerationMenu'

interface ReportOwnerMenuProps {
  visible: boolean
  onClose: () => void
  /** 이 제보 알림(새 댓글·답글, 🔥 10·50·100개) 켜짐 여부. */
  notifyEnabled: boolean
  /** 설정의 "내 제보 결과 알림"이 꺼져 있으면 이 제보 알림을 켜도 오지 않는다 — 안내만 붙인다. */
  globalOff: boolean
  /** 없으면(서버가 notifyEnabled 를 안 줌) 알림 줄을 그리지 않는다. */
  onToggleNotify?: () => void
  /** 공식 계정이 올린 제보만 — '시간 수정'(PUT /reports/{id}/schedule). 수정(onEdit)이 있으면 쓰지 않는다. */
  onEditSchedule?: () => void
  /** 내 제보 고치기(내용·장소·사진·시간, PUT /reports/{id} — 11-09). */
  onEdit?: () => void
  /** 내 제보 지우기. 메뉴 안에서 한 번 더 묻고 부른다. */
  onDelete?: () => void
  /** 지우는 중(확인 줄의 버튼을 막고 돌림표를 보인다). */
  deleting?: boolean
}

/**
 * 내 제보의 ⋯ 메뉴(남의 제보 ⋯ 와 같은 아래 시트 모양): "수정"·"삭제"(11-09), "이 제보 알림 끄기/켜기".
 * 삭제는 되돌릴 수 없어 같은 시트 안에서 한 번 더 묻는다.
 */
export default function ReportOwnerMenu({
  visible,
  onClose,
  notifyEnabled,
  globalOff,
  onToggleNotify,
  onEditSchedule,
  onEdit,
  onDelete,
  deleting = false,
}: ReportOwnerMenuProps) {
  const insets = useSafeAreaInsets()
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    if (!visible) setConfirmDelete(false)
  }, [visible])
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={menuStyles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="메뉴 닫기">
        <Pressable style={[menuStyles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => {}}>
          {confirmDelete && onDelete ? (
            <View>
              <Text style={menuStyles.title} accessibilityRole="header">
                이 제보를 지울까요?
              </Text>
              <Text style={menuStyles.rowHint}>지도와 내 제보에서 바로 사라지고 되돌릴 수 없어요. 댓글과 사진도 함께 지워져요.</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity
                  style={[menuStyles.cancel, { flex: 1, marginTop: 0 }]}
                  onPress={() => setConfirmDelete(false)}
                  disabled={deleting}
                  accessibilityRole="button"
                >
                  <Text style={menuStyles.cancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[menuStyles.cancel, { flex: 1, marginTop: 0, backgroundColor: COLORS.dangerSoft }]}
                  onPress={onDelete}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel="제보 삭제"
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={COLORS.danger} />
                  ) : (
                    <Text style={[menuStyles.cancelText, { color: COLORS.danger }]}>삭제</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
          <>
          <View accessibilityRole="menu">
            {onEdit && (
              <MenuRow
                icon="create-outline"
                label="수정"
                hint="내용·장소·사진·시간을 고쳐요. 고친 내용은 바로 지도에 보여요"
                onPress={() => {
                  onClose()
                  onEdit()
                }}
              />
            )}
            {!onEdit && onEditSchedule && (
              <MenuRow
                icon="time-outline"
                label="시간 수정"
                hint="행사가 늦게 시작하거나 길어지면 시작·종료 시각을 고쳐요"
                onPress={() => {
                  onClose()
                  onEditSchedule()
                }}
              />
            )}
            {onToggleNotify && (
            <MenuRow
              icon={notifyEnabled ? 'notifications-off-outline' : 'notifications-outline'}
              label={notifyEnabled ? '이 제보 알림 끄기' : '이 제보 알림 켜기'}
              hint={
                globalOff
                  ? '설정 > 알림의 "내 제보 결과 알림"이 꺼져 있어 지금은 알림이 오지 않아요'
                  : notifyEnabled
                    ? '이 제보의 새 댓글·답글과 공감 소식을 더 받지 않아요'
                    : '이 제보에 새 댓글이 달리거나 공감이 10·50·100개를 넘으면 알려 드려요'
              }
              onPress={() => {
                onClose()
                onToggleNotify()
              }}
            />
            )}
            {onDelete && (
              <MenuRow
                icon="trash-outline"
                label="삭제"
                hint="지도와 내 제보에서 지워요"
                danger
                onPress={() => setConfirmDelete(true)}
              />
            )}
          </View>
          <TouchableOpacity style={menuStyles.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={menuStyles.cancelText}>취소</Text>
          </TouchableOpacity>
          </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
