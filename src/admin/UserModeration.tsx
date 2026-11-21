import { useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { fetchUser } from './api'
import { LoginNameReveal } from './components/users/LoginNameReveal'
import { moderationStyles } from './components/users/moderationStyles'
import { OfficialNameForm } from './components/users/OfficialNameForm'
import { PriorHistoryNote } from './components/users/PriorHistoryNote'
import { formatDateTime } from './format'
import { useUserModeration } from './hooks/useUserModeration'
import type { AdminUser } from './types'
import { Badge, Button, ConfirmBar, InlineError, useAdminHost } from './ui'
import { moderationError } from './utils/moderationErrors'
import { canAssignOfficial, hasNoAppNickname, memberName } from './utils/userModeration'
import { RADIUS } from '../constants/spacing'

export { OfficialNameForm } from './components/users/OfficialNameForm'
export { memberLabel, memberName } from './utils/userModeration'

/** 정지 사유 최대 길이(서버 제한과 같다). */
const REASON_MAX_LENGTH = 200

/**
 * 회원 한 명의 이용 상태와 정지·해제 버튼. 정지는 사유를 받아 한 번 더 확인한다.
 * 정지된 회원은 로그인·조회는 되고 제보·신고·문의·닉네임 변경만 막힌다(백엔드 SuspendedUserInterceptor).
 */
export function UserModerationPanel({ user, onChanged }: { user: AdminUser; onChanged: (user: AdminUser) => void }) {
  const app = useAdminHost() === 'app'
  const m = useUserModeration(user, onChanged)
  const { busy } = m
  const suspended = user.status === 'SUSPENDED'
  const isAdmin = user.role === 'ADMIN'
  const noAppNickname = hasNoAppNickname(user)

  return (
    <View style={styles.panel}>
      {/* 제목: 앱에 보이는 이름 + 회원 번호. 로그인 닉네임 원문은 아래 "로그인 닉네임 보기"로만. */}
      <View style={styles.titleRow}>
        <Text style={styles.name} selectable numberOfLines={1}>
          {memberName(user)}
        </Text>
        {noAppNickname ? <Text style={styles.hint}>앱 닉네임 없음</Text> : null}
        {user.memberCode ? (
          <Text style={styles.code} selectable accessibilityLabel={`회원 번호 ${user.memberCode}`}>
            {user.memberCode}
          </Text>
        ) : null}
      </View>
      <View style={styles.row}>
        <Badge label={suspended ? '이용 정지' : '정상'} tone={suspended ? 'danger' : 'success'} />
        {isAdmin ? <Badge label="관리자" tone="info" /> : null}
        {user.officialName ? <Badge label={`공식 · ${user.officialName}`} tone="info" /> : null}
        <Text style={moderationStyles.meta}>
          {user.memberCode ? `id ${user.id}` : `#${user.id}`} · {user.socialType}
        </Text>
      </View>
      <LoginNameReveal userId={user.id} />
      {suspended ? (
        <Text style={moderationStyles.meta}>
          {formatDateTime(user.suspendedAt)} 정지 · 사유: {user.suspendedReason ?? '(없음)'}
        </Text>
      ) : null}
      {user.priorHistory ? <PriorHistoryNote history={user.priorHistory} /> : null}

      {m.officialEditing ? (
        <OfficialNameForm userId={user.id} onCancel={() => m.setOfficialEditing(false)} onDone={m.officialDone} />
      ) : m.confirming ? (
        <ConfirmBar
          message="이 회원의 이용을 정지할까요? 로그인과 조회는 되지만 제보·신고·문의·닉네임 변경이 막힙니다. 사유는 회원에게 알림으로 전달되고(약관 제10조), 회원은 14일 안에 이의를 제기할 수 있습니다."
          confirmLabel="이용 정지"
          danger
          busy={busy}
          onCancel={() => m.setConfirming(false)}
          onConfirm={m.confirmSuspend}
        >
          <TextInput
            value={m.reason}
            onChangeText={m.setReason}
            placeholder="예: 욕설이 담긴 제보 반복"
            placeholderTextColor={COLORS.textPlaceholder}
            maxLength={REASON_MAX_LENGTH}
            style={[moderationStyles.input, app && moderationStyles.inputApp]}
            autoFocus
            accessibilityLabel="정지 사유"
            editable={!busy}
          />
        </ConfirmBar>
      ) : (
        <View style={styles.actions}>
          {/* 정지된 회원은 관리자로 지정할 수 없다(서버도 400). 먼저 정지를 풀어야 한다. */}
          {isAdmin ? (
            <Button label="관리자 해제" icon="shield-outline" variant="ghost" onPress={m.confirmRevoke} disabled={busy} small />
          ) : !suspended ? (
            <Button label="관리자로 지정" icon="shield-checkmark-outline" onPress={m.confirmGrant} disabled={busy} small />
          ) : null}
          {user.officialName ? (
            <Button label="공식 해제" icon="shield-outline" variant="ghost" onPress={m.confirmClearOfficial} disabled={busy} small />
          ) : canAssignOfficial(user) ? (
            <Button label="공식 계정 지정" icon="ribbon-outline" variant="ghost" onPress={m.startOfficial} disabled={busy} small />
          ) : null}
          {suspended ? (
            <Button label="정지 해제" icon="lock-open-outline" onPress={m.unsuspend} loading={busy} small />
          ) : !isAdmin ? (
            <Button label="이용 정지" icon="ban-outline" variant="danger" onPress={() => m.setConfirming(true)} disabled={busy} small />
          ) : null}
        </View>
      )}
      {m.error ? <InlineError message={m.error} /> : null}
    </View>
  )
}

/** 제보 카드 안의 "작성자 관리". 누르면 그때 회원 정보를 불러온다. */
export function ReportAuthorModeration({ authorId }: { authorId: number }) {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchUser(authorId)
      .then(setUser)
      .catch((err: unknown) => setError(moderationError(err, '작성자 정보를 불러오지 못했습니다.')))
      .finally(() => setLoading(false))
  }

  if (!open) {
    return (
      <View style={moderationStyles.actionsStart}>
        <Button
          label="작성자 관리"
          icon="person-circle-outline"
          variant="ghost"
          onPress={() => {
            setOpen(true)
            if (!user) load()
          }}
          small
        />
      </View>
    )
  }

  return (
    <View style={styles.box}>
      {loading ? <Text style={moderationStyles.meta}>불러오는 중…</Text> : null}
      {error ? <InlineError message={error} onRetry={load} /> : null}
      {user ? <UserModerationPanel user={user} onChanged={setUser} /> : null}
      <View style={moderationStyles.actionsStart}>
        <Button label="닫기" variant="ghost" onPress={() => setOpen(false)} small />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { gap: 6 },
  box: { gap: 6, padding: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#E4E4E7' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  name: { fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.textPrimary, flexShrink: 1 },
  hint: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }),
    fontSize: 13,
    letterSpacing: 0.5,
    color: COLORS.textPrimary,
  },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
})
