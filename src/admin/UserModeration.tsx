import { useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { ApiError, getErrorMessage } from '../apis/client'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { confirmAction } from '../utils/dialog'
import { clearOfficialName, fetchUser, grantAdmin, revealLoginName, revokeAdmin, setOfficialName, suspendUser, unsuspendUser } from './api'
import { formatDateTime } from './format'
import type { AdminLoginName, AdminUser } from './types'
import { Badge, Button, ConfirmBar, InlineError, useAdminHost } from './ui'

/** 정지 사유 최대 길이(서버 제한과 같다). */
const REASON_MAX_LENGTH = 200

/** 확인 문구 등에 쓰는 회원 표시. 회원 번호가 있으면 그것, 없으면(서버 배포 전) 예전처럼 #id. */
export function memberLabel(user: Pick<AdminUser, 'id' | 'memberCode'>): string {
  return user.memberCode ? user.memberCode : `#${user.id}`
}

/**
 * 카드 제목에 쓸 이름: 앱 닉네임 → 표시 이름(앱 닉네임이 없으면 가린 이름 "홍**") 순. 로그인 닉네임 원문(nickname)은
 * 쓰지 않는다 — 예전 서버는 nickname 에 원문을 넣어 보냈기 때문(개인정보 최소 처리).
 */
export function memberName(user: Pick<AdminUser, 'appNickname' | 'displayName'>): string {
  return user.appNickname || user.displayName || '이름 없음'
}

/** 서버에 회원 관리 API 가 아직 없을 때(배포 전) 보여 줄 문구. */
function moderationError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
    return '회원을 찾을 수 없거나, 서버에 회원 관리 기능이 아직 배포되지 않았습니다.'
  }
  return getErrorMessage(err, fallback)
}

/**
 * 관리자 지정·해제 오류 문구. 400 은 서버가 쓴 이유(자기 자신 해제, 정지된 회원 지정)를 그대로 보여 준다.
 * 회원은 이미 불러와 있으니 404/405 는 "경로가 없다" — 서버가 아직 배포 전이다. 앱 토큰으로 보낼 때는
 * 없는 경로를 Spring `/error` 가 401 로 돌려주기도 해서, 재발급 뒤에도 401 이면 같은 경우로 본다.
 */
function roleError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 404 || err.status === 405 || (err.status === 401 && err.afterTokenRefresh)) {
      return '서버 업데이트 후 사용할 수 있어요.'
    }
    if (err.status === 400 && err.serverMessage) return err.serverMessage
  }
  return getErrorMessage(err, fallback)
}

/**
 * 회원 한 명의 이용 상태와 정지·해제 버튼. 정지는 사유를 받아 한 번 더 확인한다.
 * 정지된 회원은 로그인·조회는 되고 제보·신고·문의·닉네임 변경만 막힌다(백엔드 SuspendedUserInterceptor).
 */
export function UserModerationPanel({ user, onChanged }: { user: AdminUser; onChanged: (user: AdminUser) => void }) {
  const app = useAdminHost() === 'app'
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  /** 공식 계정 지정 입력 중(학생회 등 — 문의 탭의 '공식 계정 신청'을 확인한 뒤). */
  const [officialEditing, setOfficialEditing] = useState(false)
  const [officialDraft, setOfficialDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suspended = user.status === 'SUSPENDED'
  const isAdmin = user.role === 'ADMIN'

  const run = (task: () => Promise<AdminUser>, fallback: string, toMessage = moderationError) => {
    setBusy(true)
    setError(null)
    task()
      .then((updated) => {
        setConfirming(false)
        setReason('')
        setOfficialEditing(false)
        setOfficialDraft('')
        onChanged(updated)
      })
      .catch((err: unknown) => setError(toMessage(err, fallback)))
      .finally(() => setBusy(false))
  }

  const confirmGrant = () =>
    confirmAction({
      title: '관리자로 지정',
      message: `${memberName(user)}(${memberLabel(user)}) 님을 관리자로 지정할까요? 제보 검토·회원 정지 등 관리 기능을 모두 쓸 수 있게 됩니다.`,
      confirmLabel: '지정',
      onConfirm: () => run(() => grantAdmin(user.id), '관리자로 지정하지 못했습니다. 다시 시도해주세요.', roleError),
    })

  const confirmRevoke = () =>
    confirmAction({
      title: '관리자 해제',
      message: `${memberName(user)}(${memberLabel(user)}) 님의 관리자 권한을 해제할까요? 다음 요청부터 관리 기능을 쓸 수 없습니다.`,
      confirmLabel: '해제',
      destructive: true,
      onConfirm: () => run(() => revokeAdmin(user.id), '관리자 권한을 해제하지 못했습니다. 다시 시도해주세요.', roleError),
    })

  const confirmClearOfficial = () =>
    confirmAction({
      title: '공식 계정 해제',
      message: `'${user.officialName ?? ''}' 공식 이름과 배지를 뗄까요? 이 계정은 원래 이름(앱 닉네임)으로 돌아갑니다.`,
      confirmLabel: '해제',
      destructive: true,
      onConfirm: () => run(() => clearOfficialName(user.id), '공식 계정을 해제하지 못했습니다. 다시 시도해주세요.', officialError),
    })

  const trimmed = reason.trim()
  // appNickname 키가 null 로 왔을 때만 "앱 닉네임 없음" — 키가 아예 없으면(예전 서버) 유무를 알 수 없어 표시하지 않는다.
  const noAppNickname = 'appNickname' in user && !user.appNickname

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
        <Text style={styles.meta}>
          {user.memberCode ? `id ${user.id}` : `#${user.id}`} · {user.socialType}
        </Text>
      </View>
      <LoginNameReveal userId={user.id} />
      {suspended ? (
        <Text style={styles.meta}>
          {formatDateTime(user.suspendedAt)} 정지 · 사유: {user.suspendedReason ?? '(없음)'}
        </Text>
      ) : null}
      {/* 정지·위반 삭제 이력이 있던 계정으로 다시 가입한 회원. 판단은 관리자가 한다(자동 정지 없음). */}
      {user.priorHistory ? (
        <View style={styles.prior}>
          <Text style={styles.priorTitle}>재가입 회원 · 이전 이용 제한 이력</Text>
          <Text style={styles.priorText}>
            {formatDateTime(user.priorHistory.withdrawnAt)} 탈퇴
            {user.priorHistory.wasSuspendedAtWithdrawal ? ' (탈퇴 당시 정지 중)' : ''}
          </Text>
          {user.priorHistory.suspendedAt ? (
            <Text style={styles.priorText}>
              {formatDateTime(user.priorHistory.suspendedAt)} 정지 · 사유: {user.priorHistory.suspendedReason ?? '(없음)'}
            </Text>
          ) : null}
          {user.priorHistory.violationReportCount > 0 ? (
            <Text style={styles.priorText}>위반으로 삭제된 제보 {user.priorHistory.violationReportCount}건</Text>
          ) : null}
          <Text style={styles.priorNote}>기록 보관 기한 {formatDateTime(user.priorHistory.retainUntil)}</Text>
        </View>
      ) : null}

      {officialEditing ? (
        <ConfirmBar
          message="이 계정에 붙일 공식 이름(2~30자)을 적어 주세요. 앱 닉네임 대신 이 이름과 공식 배지가 제보·댓글에 보입니다. 단체를 확인한 뒤에만 지정하세요."
          confirmLabel="지정"
          busy={busy}
          onCancel={() => setOfficialEditing(false)}
          onConfirm={() => {
            const name = officialDraft.trim()
            if (name.length < 2) {
              setError('공식 이름을 2자 이상 입력해주세요.')
              return
            }
            run(() => setOfficialName(user.id, name), '공식 계정으로 지정하지 못했습니다. 다시 시도해주세요.', officialError)
          }}
        >
          <TextInput
            value={officialDraft}
            onChangeText={setOfficialDraft}
            placeholder="예: 경영대학 학생회"
            placeholderTextColor={COLORS.textPlaceholder}
            maxLength={30}
            style={[styles.input, app && styles.inputApp]}
            autoFocus
            accessibilityLabel="공식 이름"
            editable={!busy}
          />
        </ConfirmBar>
      ) : confirming ? (
        <ConfirmBar
          message="이 회원의 이용을 정지할까요? 로그인과 조회는 되지만 제보·신고·문의·닉네임 변경이 막힙니다. 사유는 회원에게 알림으로 전달되고(약관 제10조), 회원은 14일 안에 이의를 제기할 수 있습니다."
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
            style={[styles.input, app && styles.inputApp]}
            autoFocus
            accessibilityLabel="정지 사유"
            editable={!busy}
          />
        </ConfirmBar>
      ) : (
        <View style={styles.actions}>
          {/* 정지된 회원은 관리자로 지정할 수 없다(서버도 400). 먼저 정지를 풀어야 한다. */}
          {isAdmin ? (
            <Button
              label="관리자 해제"
              icon="shield-outline"
              variant="ghost"
              onPress={confirmRevoke}
              disabled={busy}
              small
            />
          ) : !suspended ? (
            <Button
              label="관리자로 지정"
              icon="shield-checkmark-outline"
              onPress={confirmGrant}
              disabled={busy}
              small
            />
          ) : null}
          {user.officialName ? (
            <Button label="공식 해제" icon="shield-outline" variant="ghost" onPress={confirmClearOfficial} disabled={busy} small />
          ) : !suspended && 'officialName' in user ? (
            <Button
              label="공식 계정 지정"
              icon="ribbon-outline"
              variant="ghost"
              onPress={() => {
                setError(null)
                setOfficialDraft('')
                setOfficialEditing(true)
              }}
              disabled={busy}
              small
            />
          ) : null}
          {suspended ? (
            <Button
              label="정지 해제"
              icon="lock-open-outline"
              onPress={() => run(() => unsuspendUser(user.id), '정지를 풀지 못했습니다. 다시 시도해주세요.')}
              loading={busy}
              small
            />
          ) : !isAdmin ? (
            <Button label="이용 정지" icon="ban-outline" variant="danger" onPress={() => setConfirming(true)} disabled={busy} small />
          ) : null}
        </View>
      )}
      {error ? <InlineError message={error} /> : null}
    </View>
  )
}

/** 공식 계정 지정·해제 오류 문구. 409 는 같은 공식 이름이 이미 있음, 404/405 는 이 기능 전 서버. */
function officialError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return '같은 공식 이름을 쓰는 계정이 이미 있습니다. 다른 이름을 입력해주세요.'
    if (err.status === 400) return '공식 이름은 2~30자로 입력해주세요.'
    if (err.status === 404 || err.status === 405) return '서버가 아직 공식 계정 기능을 지원하지 않습니다. 서버 업데이트 후 다시 시도해주세요.'
  }
  return fallback
}

/**
 * 열람 오류 문구. 이 기능 전 서버는 경로가 없어 404/405(앱 토큰이면 재발급 뒤 401) — 그때는 업데이트 안내.
 * 서버가 이유를 적어 보낸 404(없는 회원 등)는 그 문구를 그대로 보여 준다.
 */
function revealError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404 && err.serverMessage) return err.serverMessage
    if (err.status === 404 || err.status === 405 || (err.status === 401 && err.afterTokenRefresh)) {
      return '서버 업데이트 후 사용할 수 있어요.'
    }
  }
  return getErrorMessage(err, '로그인 닉네임을 불러오지 못했습니다. 다시 시도해주세요.')
}

const SOCIAL_LABEL: Record<string, string> = { KAKAO: '카카오', APPLE: 'Apple', GOOGLE: 'Google' }

/**
 * "로그인 닉네임 보기" — 누를 때만 서버에서 원문을 받아 이 자리에 보여 준다. 실명일 수 있는 값이라 미리 불러오거나
 * 자동으로 다시 시도하지 않고, "숨기기"를 누르거나 카드가 사라지면 값도 메모리에서 지운다(다시 보려면 다시 누른다).
 */
function LoginNameReveal({ userId }: { userId: number }) {
  const [value, setValue] = useState<AdminLoginName | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reveal = () => {
    setLoading(true)
    setError(null)
    revealLoginName(userId)
      .then(setValue)
      .catch((err: unknown) => setError(revealError(err)))
      .finally(() => setLoading(false))
  }

  if (value) {
    return (
      <View style={styles.reveal}>
        <Text style={styles.revealText} selectable>
          로그인 닉네임: <Text style={styles.revealValue}>{value.loginNickname}</Text>
          {' '}({SOCIAL_LABEL[value.socialType] ?? value.socialType})
        </Text>
        <View style={styles.actionsStart}>
          <Button label="숨기기" icon="eye-off-outline" variant="ghost" onPress={() => setValue(null)} small />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.revealRow}>
      <Button label="로그인 닉네임 보기" icon="eye-outline" variant="ghost" onPress={reveal} loading={loading} small />
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
  prior: { gap: 2, padding: 10, borderRadius: 8, backgroundColor: COLORS.warningSoft },
  priorTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.warning },
  priorText: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.warning },
  priorNote: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary, marginTop: 2 },
  box: { gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E4E4E7' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  name: { fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.textPrimary, flexShrink: 1 },
  hint: { fontFamily: FONTS.regular, fontSize: 11.5, color: COLORS.textTertiary },
  reveal: { gap: 2, padding: 8, borderRadius: 8, backgroundColor: COLORS.background },
  revealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  revealText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  revealValue: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }),
    fontSize: 13,
    letterSpacing: 0.5,
    color: COLORS.textPrimary,
  },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  actionsStart: { flexDirection: 'row', gap: 8, justifyContent: 'flex-start' },
  inputApp: { minHeight: 44, fontSize: 16 },
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
