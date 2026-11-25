import { useCallback } from 'react'
import {

  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../../../constants/colors'
import { FONTS } from '../../../../constants/typography'
import { ToastViewport } from '../../../common/Toast'
import { reportImageUrls } from '../../../../utils/map/report/reports'
import { moreCommentsLabel } from '../../../../utils/map/report/commentThreads'
import ImageViewerModal from '../../../common/ImageViewerModal'
import ModalHeader, { ModalPanel } from '../../../settings/ModalHeader'
import ContentColumn from '../../../common/ContentColumn'
import RetryableError from '../../../common/RetryableError'
import CommentComposer from './CommentComposer'
import CommentThread from './CommentThread'
import { CommentsSkeleton, KeyboardFrame, Separator } from './CommentsModalParts'
import ModerationMenu from '../ModerationMenu'
import ReportPostBody from '../ReportPostBody'
import type { ReportCommunityPatch } from '../ReportActionRow'
import type { ReportComment, ReportListItem } from '../../../../types'
import EmptyState from '../../../common/EmptyState'
import { RADIUS } from '../../../../constants/spacing'
import SwipeBackModal from '../../../common/SwipeBackModal'
import { useReportCommentsModal } from '../../../../hooks/map/report/comments/useReportCommentsModal'

export interface ReportCommentsModalProps {
  visible: boolean
  report: ReportListItem
  /** 장소 문구(시트와 같은 값 — 작성자가 고친 장소 설명, 없으면 가까운 건물). */
  placeText: string
  /** 공감·관심·조회 수 변화를 지도 시트 사본에도 반영한다(시트와 같은 applyPatch). */
  onPatch: (patch: ReportCommunityPatch) => void
  onClose: () => void
  /** 시트의 "댓글 달기"로 열면 바로 입력하게 한다. */
  focusInput?: boolean
}

/**
 * 제보 본문 창 — 게시글처럼 본문 전체(ReportPostBody) 아래로 댓글이 바로 이어지고, 맨 아래 입력줄에서 바로 쓴다
 * (10-09 요청 — 댓글을 달러 가는 게 곧 본문을 보러 가는 것이라 두 창을 하나로 합쳤다). 댓글은 작성된 순서(오래된 순) 고정.
 * 최상위 댓글 아래 답글을 들여 써서 보여 준다(한 단계).
 * 처음엔 10개만 보이고, 더 있으면 목록 끝 '이전 댓글 보기' 버튼으로 10개씩 더 받는다. 당겨서 새로고침, 아래 고정 입력줄(키보드가 가리지 않게 KeyboardAvoidingView).
 * 쓰고 나면 맨 아래로 내린다. 답글은 "답글 달기" → 입력줄 위 "○○님에게 답글" 칩.
 * 목록 상태와 받기·쓰기·지우기 반영은 `useReportCommentThread` 가 맡는다.
 */
export default function ReportCommentsModal({
  visible,
  report,
  placeText,
  onPatch,
  onClose,
  focusInput = false,
}: ReportCommentsModalProps) {
  const { viewerIndex, setViewerIndex, closeViewer, items, shown, count, state, refreshing, loadingMore, loadingReplies, replyTo, setReplyTo, focusKey, menuFor, setMenuFor, hasNext, topTotal, listRef, load, loadRest, handlePosted, handleReply, loadMoreReplies, actions } = useReportCommentsModal({ visible, report, focusInput })

  const renderItem = useCallback(
    ({ item }: { item: ReportComment }) => {
      const handlers = { onReply: handleReply, onDelete: actions.remove, onOpenMenu: setMenuFor, onLike: actions.like }
      return (
        <CommentThread
          item={item}
          handlers={handlers}
          pendingId={actions.pendingId}
          isFlagged={actions.isFlagged}
          loadingReplies={loadingReplies}
          onLoadMoreReplies={(parent) => void loadMoreReplies(parent)}
        />
      )
    },
    [actions.pendingId, actions.isFlagged, actions.remove, actions.like, handleReply, loadMoreReplies, loadingReplies],
  )

  return (
    // Android 뒤로 가기: 사진을 크게 보고 있으면 사진만 닫는다.
    // 왼쪽 가장자리에서 밀면 닫힌다(지도 시트로 돌아감). 사진을 크게 보는 동안은 가장자리 밀기를 끈다.
    <SwipeBackModal
      visible={visible}
      onRequestClose={viewerIndex !== null ? closeViewer : onClose}
      edgeDisabled={viewerIndex !== null}
    >
      <SafeAreaProvider>
        <KeyboardFrame>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ContentColumn style={styles.column}>
            <ModalHeader title="제보 본문" onClose={onClose} />
            {/* 머리 카드 아래 흰 판 — 입력줄도 판 안 맨 아래에 붙어 키보드 위로 같이 올라간다. */}
            <ModalPanel>
            <View style={styles.body}>
                <FlatList
                  ref={listRef}
                  data={shown}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderItem}
                  ItemSeparatorComponent={Separator}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(0, 'refresh')} />}
                  ListHeaderComponent={
                    <>
                      <ReportPostBody report={report} placeText={placeText} onPatch={onPatch} onPressPhoto={setViewerIndex} />
                      <View style={styles.commentsHeading}>
                        <Text style={styles.commentsHeadingText}>
                          댓글{state.kind === 'ready' ? <Text style={styles.commentsHeadingCount}> {count}</Text> : null}
                        </Text>
                      </View>
                    </>
                  }
                  ListEmptyComponent={
                    state.kind === 'loading' ? (
                      <CommentsSkeleton />
                    ) : state.kind === 'error' ? (
                      <RetryableError
                        message={state.message}
                        isNetworkError={state.network}
                        onRetry={() => void load(0, 'initial')}
                        style={styles.error}
                      />
                    ) : (
                    // 다른 빈 화면과 같은 EmptyState(10-08).
                    <EmptyState
                      style={styles.empty}
                      icon={count > 0 ? 'eye-off-outline' : 'chatbubbles-outline'}
                      message={
                        count > 0
                          ? hasNext
                            ? '불러온 댓글은 모두 숨긴 사용자의 댓글이에요'
                            : '숨긴 사용자의 댓글만 있어요'
                          : '첫 댓글을 남겨 보세요'
                      }
                      description={count > 0 ? undefined : '줄이 긴지, 아직 남았는지 지금 상황을 알려 주면 다른 학생들에게 도움이 돼요.'}
                    />
                    )
                  }
                  ListFooterComponent={
                    loadingMore ? (
                      <ActivityIndicator style={styles.footer} color={COLORS.primary} />
                    ) : hasNext ? (
                      // 첫 페이지가 모두 숨긴 사용자의 댓글이라 보이는 게 없어도 버튼은 둔다(빈 안내 아래에 같이 뜬다) —
                      // 예전엔 보이는 댓글이 없으면 버튼을 숨겨 나머지 댓글을 볼 길이 없었다.
                      <Pressable
                        onPress={() => void loadRest()}
                        style={({ pressed }) => [styles.moreButton, pressed && styles.moreButtonPressed]}
                        accessibilityRole="button"
                        hitSlop={6}
                      >
                        <Text style={styles.moreText}>{moreCommentsLabel(topTotal, items.length)}</Text>
                      </Pressable>
                    ) : null
                  }
                />
              <View style={styles.composer}>
                <CommentComposer
                  reportId={report.id}
                  onPosted={handlePosted}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                  focusKey={focusKey}
                />
                <Text style={styles.notice}>댓글은 바로 공개돼요. 욕설·광고·개인정보는 신고되면 숨겨져요.</Text>
              </View>
            </View>
            </ModalPanel>
          </ContentColumn>
        </SafeAreaView>
        </KeyboardFrame>
        <ModerationMenu
          visible={menuFor !== null}
          onClose={() => setMenuFor(null)}
          target="댓글"
          canHide={!!menuFor?.authorKey}
          onHide={() => menuFor && actions.hide(menuFor)}
          flagged={menuFor ? actions.isFlagged(menuFor) : false}
          beforeFlag={actions.canFlag}
          onFlag={(reason) => menuFor && actions.flag(menuFor, reason)}
        />
        <ToastViewport />
        {/* 사진 크게 보기는 이 창 위에 덮어 그린다(창 안에 창을 띄우면 iOS 에서 닫을 때 이 창까지 닫혔다, 10-31). */}
        <ImageViewerModal inline urls={reportImageUrls(report)} startIndex={viewerIndex} onClose={closeViewer} />
      </SafeAreaProvider>
    </SwipeBackModal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  moreButton: {
    alignSelf: 'center',
    marginVertical: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  moreButtonPressed: { opacity: 0.7 },
  moreText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary },
  column: { flex: 1 },
  body: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 16 },
  // 본문과 댓글 사이 — 굵은 구분선 대신 위 여백 + 얇은 선, "댓글 N" 을 본문 제목처럼 또렷하게.
  commentsHeading: {
    marginTop: 16,
    paddingTop: 16,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  commentsHeadingText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textPrimary },
  commentsHeadingCount: { color: COLORS.primary },
  empty: { paddingVertical: 32 },
  error: { marginTop: 12 },
  footer: { marginVertical: 12 },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  notice: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textTertiary, marginTop: 6, marginLeft: 6 },
})
