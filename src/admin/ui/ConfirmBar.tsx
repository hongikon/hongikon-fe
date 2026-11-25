import { useRef, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { RADIUS } from '../../constants/spacing'
import { FONTS } from '../../constants/typography'
import { Button } from './Button'
import { useAdminHost } from './host'
import { ADMIN_COLORS } from './theme'
import { useRevealAboveKeyboard } from '../hooks/common/useRevealAboveKeyboard'

/**
 * 되돌릴 수 없는 작업 전의 확인 막대. window.confirm 대신 카드 안에 펼친다
 * (브라우저 대화상자는 자동화·스크린 리더에서 다루기 어렵고 화면 흐름을 끊는다).
 */
export function ConfirmBar({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  danger,
  confirmDisabled,
  children,
}: {
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  danger?: boolean
  /** 확인 버튼을 막는다(예: 지울 업체 이름을 정확히 입력하기 전). */
  confirmDisabled?: boolean
  children?: ReactNode
}) {
  const app = useAdminHost() === 'app'
  const boxRef = useRef<View>(null)
  // 사유 입력칸(children)이 있을 때만 — 키보드가 확인 버튼을 가리지 않게 막대 전체를 키보드 위로 올린다.
  useRevealAboveKeyboard(boxRef, app && children != null)
  return (
    <View ref={boxRef} style={[styles.confirm, danger && styles.confirmDanger, app && styles.confirmApp]}>
      <Text style={styles.confirmText}>{message}</Text>
      {children}
      <View style={styles.confirmActions}>
        <Button label="취소" onPress={onCancel} disabled={busy} small style={app ? styles.confirmButtonApp : undefined} />
        <Button
          label={confirmLabel}
          onPress={onConfirm}
          loading={busy}
          disabled={confirmDisabled}
          variant={danger ? 'danger' : 'primary'}
          small
          style={app ? styles.confirmButtonApp : undefined}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  confirm: {
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: ADMIN_COLORS.infoBg,
  },
  confirmDanger: { backgroundColor: ADMIN_COLORS.dangerBg },
  // 앱 버튼의 '위험' 색(옅은 빨강 바탕)이 빨간 막대 위에서 묻히지 않게 회색 바탕 + 테두리로 바꾼다.
  confirmApp: { backgroundColor: ADMIN_COLORS.neutralBg, borderWidth: 1, borderColor: COLORS.border },
  confirmText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary, lineHeight: 19 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  confirmButtonApp: { flex: 1, alignSelf: 'auto' },
})
