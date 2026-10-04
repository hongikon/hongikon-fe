import { memo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { formatCommentTime } from '../../../utils/comments'
import CommentAvatar from './CommentAvatar'
import type { ReportComment } from '../../../types'

export interface CommentItemHandlers {
  onReply: (target: ReportComment) => void
  onDelete: (comment: ReportComment) => void
  onOpenMenu: (comment: ReportComment) => void
  /** 👍 켜기·끄기. 서버가 likeCount 를 주지 않으면(좋아요 기능 전) 버튼이 없다. */
  onLike?: (comment: ReportComment) => void
}

interface CommentItemProps extends CommentItemHandlers {
  comment: ReportComment
  reply?: boolean
  pending: boolean
  flagged: boolean
}

const PLACEHOLDER_TEXT: Record<'DELETED' | 'HIDDEN', string> = {
  DELETED: '삭제된 댓글이에요',
  HIDDEN: '운영 정책에 따라 숨겨진 댓글이에요',
}

/**
 * 댓글 한 개: 동그라미(첫 글자) · 이름 · 시각, 아래 본문, 그 아래 "답글 달기".
 * 내 댓글은 오른쪽에 "삭제"만, 남의 댓글은 ⋮(숨기기·신고 메뉴). 지운 댓글 자리는 회색 안내만 보인다.
 */
function CommentItem({ comment, reply = false, pending, flagged, onReply, onDelete, onOpenMenu, onLike }: CommentItemProps) {
  const placeholder = comment.placeholder ?? null
  const time = formatCommentTime(comment.createdAt)
  const name = comment.authorDisplayName ?? ''

  return (
    <View style={[styles.row, reply && styles.rowReply]}>
      <CommentAvatar name={placeholder ? null : name} seed={comment.authorKey} size={reply ? 26 : 32} />
      <View style={styles.main}>
        {placeholder ? (
          <Text style={styles.placeholder}>{PLACEHOLDER_TEXT[placeholder]}</Text>
        ) : (
          <>
            <View style={styles.head}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              {comment.isMine ? <Text style={styles.mine}>나</Text> : null}
              {time ? <Text style={styles.time}>{time}</Text> : null}
              {flagged ? <Text style={styles.flagged}>· 신고함</Text> : null}
              <View style={styles.spacer} />
              {pending ? (
                <ActivityIndicator size="small" color={COLORS.textTertiary} />
              ) : comment.isMine ? (
                <TouchableOpacity
                  onPress={() => onDelete(comment)}
                  hitSlop={10}
                  style={styles.textAction}
                  accessibilityRole="button"
                  accessibilityLabel={reply ? '내 답글 삭제' : '내 댓글 삭제'}
                >
                  <Text style={styles.textActionLabel}>삭제</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => onOpenMenu(comment)}
                  hitSlop={10}
                  style={styles.more}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}님 ${reply ? '답글' : '댓글'} 메뉴`}
                >
                  <Ionicons name="ellipsis-vertical" size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.body}>{comment.content}</Text>
            <View style={styles.actions}>
              {typeof comment.likeCount === 'number' ? (
                <Pressable
                  onPress={() => onLike?.(comment)}
                  disabled={!onLike}
                  hitSlop={8}
                  style={({ pressed }) => [styles.like, comment.likedByMe && styles.likeOn, pressed && styles.likePressed]}
                  accessibilityRole={comment.isMine ? 'text' : 'button'}
                  accessibilityState={{ selected: !!comment.likedByMe }}
                  accessibilityLabel={
                    comment.isMine
                      ? `좋아요 ${comment.likeCount}개`
                      : `좋아요 ${comment.likeCount}개, ${comment.likedByMe ? '내가 눌렀어요. 누르면 취소해요' : '눌러서 좋아요'}`
                  }
                >
                  <Ionicons
                    name={comment.likedByMe ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={13}
                    color={comment.likedByMe ? COLORS.fire : COLORS.textSecondary}
                  />
                  {comment.likeCount > 0 ? (
                    <Text style={[styles.likeCount, comment.likedByMe && styles.likeCountOn]}>{comment.likeCount}</Text>
                  ) : null}
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => onReply(comment)}
                hitSlop={8}
                style={styles.replyAction}
                accessibilityRole="button"
                accessibilityLabel={`${name}님에게 답글 달기`}
              >
                <Text style={styles.replyActionLabel}>답글 달기</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

export default memo(CommentItem)

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  rowReply: { paddingVertical: 8 },
  main: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 },
  name: { flexShrink: 1, fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  mine: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  time: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  flagged: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.warningIcon },
  spacer: { flex: 1 },
  textAction: { minHeight: 24, justifyContent: 'center', paddingHorizontal: 2 },
  textActionLabel: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  more: { width: 28, height: 24, alignItems: 'flex-end', justifyContent: 'center' },
  body: { fontFamily: FONTS.regular, fontSize: 14.5, lineHeight: 21, color: COLORS.textPrimary, marginTop: 3 },
  placeholder: { fontFamily: FONTS.regular, fontSize: 13.5, color: COLORS.textTertiary, paddingVertical: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  replyAction: { alignSelf: 'flex-start', minHeight: 24, justifyContent: 'center' },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.fireChipBorder,
  },
  likeOn: { borderColor: COLORS.fire, backgroundColor: COLORS.primarySoft },
  likePressed: { opacity: 0.7 },
  likeCount: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
  likeCountOn: { color: COLORS.fire },
  replyActionLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.textTertiary },
})
