import { useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { DIALOG_MAX_WIDTH } from '../../constants/layout'
import Button from '../common/Button'

// 처리방침 3항(탈퇴 시 삭제)과 같은 내용만 적는다. 정지·신고 이력이 있으면 1년 분리 보관(아래 note) — 백엔드 WithdrawRetention.
const DELETED_ITEMS = [
  '회원 정보와 앱 닉네임',
  '올린 제보와 사진, 댓글·답글',
  '공감·관심·좋아요 기록',
  '구독 게시판과 알림 설정',
] as const

interface WithdrawConfirmDialogProps {
  visible: boolean
  onCancel: () => void
  /** '예, 탈퇴할게요'. 끝날 때까지 버튼이 로딩으로 바뀌고 창을 닫을 수 없다. */
  onConfirm: () => Promise<void>
}

/**
 * 회원 탈퇴 확인 창. 시스템 Alert 는 버튼 색을 바꿀 수 없어 직접 그린다.
 * 탈퇴를 말리는 쪽으로 기운다 — '아니요'는 메인 컬러로 크게 위에, '예'는 회색으로 아래에 둔다.
 * 경고 제목·문구는 빨간색이다.
 */
export default function WithdrawConfirmDialog({ visible, onCancel, onConfirm }: WithdrawConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    if (!busy) onCancel()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={30} color={COLORS.danger} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            정말 탈퇴하시겠어요?
          </Text>
          <Text style={styles.warning}>탈퇴하면 아래 정보가 바로 삭제되고, 되돌릴 수 없어요.</Text>
          <View style={styles.list}>
            {DELETED_ITEMS.map((item) => (
              <View key={item} style={styles.listRow}>
                <Ionicons name="close-circle" size={15} color={COLORS.danger} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>
            카카오·Apple 계정과의 연결도 함께 해제돼요. 이용 정지·신고 이력이 있으면 부정 이용을 막기 위해 일부 기록을 1년 동안 따로 보관해요.
          </Text>

          <View style={styles.actions}>
            <Button label="아니요, 계속 쓸게요" onPress={handleCancel} size="lg" disabled={busy} />
            <Button label="예, 탈퇴할게요" variant="muted" onPress={() => void handleConfirm()} size="md" loading={busy} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.scrim,
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.danger, marginBottom: 6 },
  warning: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  list: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
    marginBottom: 10,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger },
  note: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 18 },
  actions: { alignSelf: 'stretch', gap: 8 },
})
