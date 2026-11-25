import { StyleSheet, View } from 'react-native'
import { FlaggedCommentCard } from '../components/comments/FlaggedCommentCard'
import { useFlaggedComments } from '../hooks/comments/useFlaggedComments'
import type { AdminOverview } from '../types'
import { Button, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'
import { withFocusedFirst } from '../utils/common/focus'

/**
 * 신고 댓글 — 마지막 검토 뒤 신고가 들어온 댓글을 최근 신고 순으로 모아 본다(`GET /admin/comments?filter=flagged`).
 * 제보 카드 안 댓글 패널(`ReportCommentsPanel`)은 제보마다 펼쳐야 해서, 여러 제보에 흩어진 신고를 놓치기 쉽다.
 * 숨김·삭제는 사유를 적을 수 있고, 서버가 그 사유와 14일 이의 제기 안내를 작성자에게 알린다(이용약관 제10조).
 * 처리한 카드는 "방금 처리함"으로 남겨 두어 실수했을 때 바로 되돌릴 수 있게 한다.
 */
export default function FlaggedCommentsScreen({
  onChanged,
  overview,
  focusCommentId = null,
}: {
  onChanged: () => void
  overview: AdminOverview | null
  /** 관리자 알림(ADMIN_COMMENT_FLAGGED)으로 연 댓글. 목록에 있으면 맨 위로 올려 강조한다. */
  focusCommentId?: number | null
}) {
  const { items, total, loading, error, missing, handled, reload, handleDone } = useFlaggedComments(onChanged)

  const pendingCount = overview?.comments?.flaggedPending ?? total
  const header = (
    <ScreenHeader
      title="신고 댓글"
      subtitle={`마지막 검토 뒤 신고가 들어온 댓글을 최근 신고 순으로 보여 줍니다(최대 200건). 검토 대기 ${pendingCount}건.`}
      right={<Button label="새로고침" icon="refresh" onPress={reload} loading={loading && !!items} small />}
    />
  )

  if (missing) {
    return (
      <View>
        {header}
        <InlineError message="서버 업데이트가 필요합니다. 신고된 댓글 목록은 새 서버에서 볼 수 있어요. 지금은 제보 검토의 제보 카드 안 댓글에서 처리해 주세요." />
      </View>
    )
  }

  return (
    <View>
      {header}
      {error ? <InlineError message={error} onRetry={reload} style={styles.listError} /> : null}
      {!items ? (
        loading ? <Loading /> : null
      ) : items.length === 0 ? (
        <EmptyState message="검토할 신고 댓글이 없습니다." />
      ) : (
        <View style={styles.list}>
          {withFocusedFirst(items, focusCommentId).map((item) => (
            <FlaggedCommentCard
              key={item.id}
              item={item}
              handled={handled[item.id] ?? null}
              highlighted={item.id === focusCommentId}
              onDone={handleDone}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  listError: { marginBottom: 12 },
  list: { gap: 12 },
})
