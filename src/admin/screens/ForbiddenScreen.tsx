import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { ADMIN_COLORS, Button, Card } from '../ui'

/**
 * 로그인은 됐지만 ADMIN 이 아닌 계정(403). 권한은 서버가 요청마다 DB(users.role)에서 확인하므로,
 * 팀원이 역할을 바꿔 주면 다시 로그인할 필요 없이 새로고침만 해도 된다.
 */
export default function ForbiddenScreen({ onLogout }: { onLogout: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)

  const handleLogout = () => {
    setBusy(true)
    onLogout().finally(() => setBusy(false))
  }

  return (
    <View style={styles.page}>
      <Card style={styles.card}>
        <View style={styles.titleRow}>
          <Ionicons name="lock-closed-outline" size={24} color={COLORS.danger} />
          <Text style={styles.title}>관리자 권한이 없는 계정입니다</Text>
        </View>
        <Text style={styles.body}>
          로그인은 되었지만 이 계정에는 관리자 권한이 없습니다. 관리자 권한은 DB 에서 직접 부여합니다 — 권한이 있는 팀원에게
          내 계정의 users.role 을 ADMIN 으로 바꿔 달라고 요청하세요.
        </Text>
        <Text selectable style={styles.code}>
          {"UPDATE users SET role = 'ADMIN' WHERE id = <내 사용자 ID>;"}
        </Text>
        <Text style={styles.body}>권한이 반영되면 이 페이지를 새로고침하면 됩니다. 다른 카카오 계정으로 들어가려면 로그아웃하세요.</Text>
        <View style={styles.actions}>
          <Button label="새로고침" icon="refresh" onPress={() => window.location.reload()} disabled={busy} />
          <Button label="로그아웃" icon="log-out-outline" variant="primary" onPress={handleLogout} loading={busy} />
        </View>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: ADMIN_COLORS.pageBg },
  card: { width: '100%', maxWidth: 520, gap: 14, padding: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flexShrink: 1, fontFamily: FONTS.bold, fontSize: 20, color: COLORS.textPrimary },
  body: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textPrimary },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: COLORS.textPrimary,
    backgroundColor: ADMIN_COLORS.neutralBg,
    padding: 12,
    borderRadius: 8,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
})
