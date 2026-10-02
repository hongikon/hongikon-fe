import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { ApiError, getErrorMessage } from '../apis/client'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { fetchUser, suspendUser, unsuspendUser } from './api'
import { formatDateTime } from './format'
import type { AdminUser } from './types'
import { Badge, Button, ConfirmBar, InlineError } from './ui'

/** 정지 사유 최대 길이(서버 제한과 같다). */
const REASON_MAX_LENGTH = 200

/** 서버에 회원 관리 API 가 아직 없을 때(배포 전) 보여 줄 문구. */
function moderationError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
    return '회원을 찾을 수 없거나, 서버에 회원 관리 기능이 아직 배포되지 않았습니다.'
  }
  return getErrorMessage(err, fallback)
}

/**
 * 회원 한 명의 이용 상태와 정지·해제 버튼. 정지는 사유를 받아 한 번 더 확인한다.
 * 정지된 회원은 로그인·조회는 되고 제보·신고·문의·닉네임 변경만 막힌다(백엔드 SuspendedUserInterceptor).
 */
export function UserModerationPanel({ user, onChanged }: { user: AdminUser; onChanged: (user: AdminUser) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suspended = user.status === 'SUSPENDED'
  const isAdmin = user.role === 'ADMIN'

  const run = (task: () => Promise<AdminUser>, fallback: string) => {
    setBusy(true)
    setError(null)
    task()
      .then((updated) => {
        setConfirming(false)
        setReason('')
        onChanged(updated)
      })
      .catch((err: unknown) => setError(moderationError(err, fallback)))
      .finally(() => setBusy(false))
  }

  const trimmed = reason.trim()

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Badge label={suspended ? '이용 정지' : '정상'} tone={suspended ? 'danger' : 'success'} />
        <Text style={styles.meta}>
          #{user.id} · {user.nickname} · {user.socialType}
          {isAdmin ? ' · 관리자' : ''}
        </Text>
      </View>
      {suspended ? (
        <Text style={styles.meta}>
          {formatDateTime(user.suspendedAt)} 정지 · 사유: {user.suspendedReason ?? '(없음)'}
        </Text>
      ) : null}

      {confirming ? (
        <ConfirmBar
          message="이 회원의 이용을 정지할까요? 로그인과 조회는 되지만 제보·신고·문의·닉네임 변경이 막힙니다. 사유는 관리자 기록용입니다."
          confirmLabel="이용 정지"
          danger
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            if (!trimmed) {
              setError('정지 사유를 입력해주세요.')
              return
            }
            run(() => suspendUser(user.id, trimmed), '정지하지 못했습니다. 다시 시도해주세요.')
          }}
        >
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="예: 욕설이 담긴 제보 반복"
            placeholderTextColor={COLORS.textPlaceholder}
            maxLength={REASON_MAX_LENGTH}
            style={styles.input}
            autoFocus
            editable={!busy}
          />
        </ConfirmBar>
      ) : (
        <View style={styles.actions}>
          {suspended ? (
            <Button
              label="정지 해제"
              icon="lock-open-outline"
              onPress={() => run(() => unsuspendUser(user.id), '정지를 풀지 못했습니다. 다시 시도해주세요.')}
              loading={busy}
              small
            />
          ) : !isAdmin ? (
            <Button label="이용 정지" icon="ban-outline" variant="danger" onPress={() => setConfirming(true)} small />
          ) : null}
        </View>
      )}
      {error ? <InlineError message={error} /> : null}
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
      <View style={styles.actionsStart}>
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
      {loading ? <Text style={styles.meta}>불러오는 중…</Text> : null}
      {error ? <InlineError message={error} onRetry={load} /> : null}
      {user ? <UserModerationPanel user={user} onChanged={setUser} /> : null}
      <View style={styles.actionsStart}>
        <Button label="닫기" variant="ghost" onPress={() => setOpen(false)} small />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { gap: 6 },
  box: { gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E4E4E7' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  actionsStart: { flexDirection: 'row', gap: 8, justifyContent: 'flex-start' },
  input: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
})
