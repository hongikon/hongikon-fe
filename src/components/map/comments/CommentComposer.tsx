import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { useAuth } from '../../../contexts/AuthContext'
import * as haptics from '../../../lib/haptics'
import { getErrorMessage } from '../../../apis/client'
import { COMMENT_MAX_LENGTH, commentWriteErrorMessage, createReportComment } from '../../../apis/comments'
import { commentLength } from '../../../utils/comments'
import { promptLogin } from '../../../utils/reports'
import type { ReportComment } from '../../../types'

/** 답글 모드: 어느 최상위 댓글에, 누구에게 답하는지(칩에 이름을 보인다). */
export interface ReplyTarget {
  parentId: number
  name: string
}

interface CommentComposerProps {
  reportId: number
  onPosted: (comment: ReportComment) => void
  /** 전체 댓글 창은 열자마자 입력하게 할 수 있다. */
  autoFocus?: boolean
  replyTo?: ReplyTarget | null
  onCancelReply?: () => void
  /** 바뀌면 입력칸에 초점을 준다("답글 달기"를 눌렀을 때). */
  focusKey?: number
}

/** 이만큼 넘게 쓰면 남은 글자 수를 보여 준다. */
const COUNTER_FROM = 150

/**
 * 댓글 입력줄. 로그인하면 입력칸과 보내기 버튼, 게스트면 "로그인하고 댓글 달기"(누르면 로그인 안내).
 * 보내기는 POST 라 자동으로 다시 보내지 않는다 — 실패하면 쓴 글을 그대로 두고 안내만 한다.
 */
export default function CommentComposer({
  reportId,
  onPosted,
  autoFocus = false,
  replyTo = null,
  onCancelReply,
  focusKey = 0,
}: CommentComposerProps) {
  const { accessToken, logout } = useAuth()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (focusKey > 0) inputRef.current?.focus()
  }, [focusKey])

  if (!accessToken) {
    return (
      <Pressable
        style={({ pressed }) => [styles.guest, pressed && styles.pressed]}
        onPress={() => promptLogin('댓글을 달려면 로그인해 주세요.', logout)}
        accessibilityRole="button"
        accessibilityLabel="로그인하고 댓글 달기"
      >
        <Ionicons name="chatbubble-outline" size={15} color={COLORS.textTertiary} />
        <Text style={styles.guestText}>로그인하고 댓글 달기</Text>
      </Pressable>
    )
  }

  const length = commentLength(text)
  const tooLong = length > COMMENT_MAX_LENGTH
  const canSend = length > 0 && !tooLong && !sending

  const send = async () => {
    if (!canSend || !accessToken) return
    setSending(true)
    setError(null)
    try {
      const created = await createReportComment(reportId, text.trim(), accessToken, replyTo?.parentId)
      haptics.success()
      setText('')
      Keyboard.dismiss()
      onPosted(created)
    } catch (caught) {
      setError(commentWriteErrorMessage(caught) ?? getErrorMessage(caught, '댓글을 남기지 못했어요. 잠시 뒤 다시 시도해 주세요.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <View>
      {replyTo ? (
        <View style={styles.replyChip} accessibilityLiveRegion="polite">
          <Ionicons name="return-down-forward" size={14} color={COLORS.primary} />
          <Text style={styles.replyChipText} numberOfLines={1}>
            {replyTo.name}님에게 답글
          </Text>
          <TouchableOpacity
            onPress={onCancelReply}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="답글 쓰기 취소"
          >
            <Ionicons name="close" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={[styles.bar, tooLong && styles.barInvalid]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={(next) => {
            setText(next)
            if (error) setError(null)
          }}
          placeholder={replyTo ? '답글을 남겨 주세요' : '댓글을 남겨 주세요'}
          placeholderTextColor={COLORS.textPlaceholder}
          multiline
          // 웹 textarea 는 기본 2줄이라 한 줄로 시작한다(길어지면 maxHeight 까지 늘어남).
          numberOfLines={Platform.OS === 'web' ? 1 : undefined}
          // 서버 한도보다 조금 넉넉히 받아(앞뒤 공백) 넘치면 안내한다.
          maxLength={COMMENT_MAX_LENGTH + 20}
          autoFocus={autoFocus}
          editable={!sending}
          accessibilityLabel="댓글 입력"
        />
        <TouchableOpacity
          style={[styles.send, !canSend && styles.sendDisabled]}
          onPress={() => void send()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="댓글 보내기"
          accessibilityState={{ disabled: !canSend, busy: sending }}
        >
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="arrow-up" size={18} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : length >= COUNTER_FROM ? (
        <Text style={[styles.counter, tooLong && styles.counterOver]}>
          {length}/{COMMENT_MAX_LENGTH}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginBottom: 6,
    paddingLeft: 10,
    paddingRight: 8,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
  },
  replyChipText: { flexShrink: 1, fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.primary },
  guest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLORS.fill,
  },
  pressed: { opacity: 0.7 },
  guestText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: COLORS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  barInvalid: { borderColor: COLORS.danger },
  input: {
    flex: 1,
    minHeight: 32,
    maxHeight: 96,
    paddingTop: 7,
    paddingBottom: 7,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  sendDisabled: { opacity: 0.35 },
  error: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.danger, marginTop: 6, marginLeft: 4 },
  counter: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textTertiary, marginTop: 4, textAlign: 'right' },
  counterOver: { color: COLORS.danger },
})
