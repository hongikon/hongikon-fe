import { Pressable, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../../../constants/colors'
import { FONTS } from '../../../../constants/typography'
import type { ReportComment } from '../../../../types'
import CommentItem from './CommentItem'

/** 댓글·답글 줄이 같이 쓰는 동작(CommentItem 에 그대로 넘긴다). */
export interface CommentHandlers {
  onReply: (target: ReportComment) => void
  onDelete: (comment: ReportComment) => void
  onOpenMenu: (comment: ReportComment) => void
  onLike: (comment: ReportComment) => void
}

interface CommentThreadProps {
  item: ReportComment
  handlers: CommentHandlers
  /** 지우는 중인 댓글 id. */
  pendingId: number | null
  isFlagged: (comment: ReportComment) => boolean
  /** 답글을 더 받는 중인 최상위 댓글 id. */
  loadingReplies: number | null
  onLoadMoreReplies: (parent: ReportComment) => void
}

/** 최상위 댓글 하나와 그 아래 들여 쓴 답글들, 남은 답글이 있으면 '답글 N개 더 보기'. */
export default function CommentThread({
  item,
  handlers,
  pendingId,
  isFlagged,
  loadingReplies,
  onLoadMoreReplies,
}: CommentThreadProps) {
  const replies = item.replies ?? []
  const more = Math.max(0, (item.replyCount ?? replies.length) - replies.length)
  return (
    <View>
      <CommentItem
        comment={item}
        pending={pendingId === item.id}
        flagged={isFlagged(item)}
        {...handlers}
      />
      {replies.length > 0 || more > 0 ? (
        <View style={styles.replies}>
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              reply
              pending={pendingId === reply.id}
              flagged={isFlagged(reply)}
              {...handlers}
            />
          ))}
          {more > 0 ? (
            <Pressable
              style={styles.moreReplies}
              onPress={() => onLoadMoreReplies(item)}
              disabled={loadingReplies === item.id}
              accessibilityRole="button"
              hitSlop={6}
            >
              <View style={styles.moreLine} />
              <Text style={styles.moreRepliesText}>
                {loadingReplies === item.id ? '불러오는 중…' : `답글 ${more}개 더 보기`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}


const styles = StyleSheet.create({
  replies: {
    marginLeft: 15,
    paddingLeft: 27,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.divider,
    marginBottom: 8,
  },
  moreReplies: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  moreLine: { width: 18, height: 1, backgroundColor: COLORS.border },
  moreRepliesText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.textSecondary },
})
