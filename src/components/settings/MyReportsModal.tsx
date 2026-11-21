import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import SwipeBackModal from '../common/SwipeBackModal'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { SPACING } from '../../constants/spacing'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import RetryableError from '../common/RetryableError'
import { ToastViewport, useToast } from '../common/Toast'
import { useMyReports } from '../../hooks/settings/useMyReports'
import MyReportCard from './myReports/MyReportCard'
import ListSkeleton from './myReports/ListSkeleton'
import { BODY_14, myReportsStyles as shared } from './myReports/styles'

interface MyReportsModalProps {
  visible: boolean
  onClose: () => void
  /** 반려 알림으로 들어왔을 때 강조할 제보 */
  highlightReportId?: number | null
  /** 지도에 표시 중인 제보를 눌렀을 때 — 창을 닫고 지도에서 그 제보를 띄운다 */
  onShowOnMap: (reportId: number) => void
  /** 빈 화면의 "지도로 가서 제보하기" */
  onStartReport: () => void
  /** 목록이 바뀌었을 때(새로 불러옴·삭제) — 설정 줄의 승인 대기 배지를 맞춘다 */
  onChanged?: () => void
}

/**
 * 설정 > 계정 > 내 제보 내역. 내가 올린 제보와 검토 결과(승인 대기·지도 표시·반려 사유·숨김·종료·삭제됨)를
 * 최신순으로 보여 준다. 당겨서 새로고침, 끝까지 내리면 다음 페이지. 서버에 API 가 없으면(배포 전) "준비 중" 안내.
 * 목록 상태는 hooks/settings/useMyReports, 카드는 myReports/MyReportCard.
 */
export default function MyReportsModal({
  visible,
  onClose,
  highlightReportId = null,
  onShowOnMap,
  onStartReport,
  onChanged,
}: MyReportsModalProps) {
  const toast = useToast()
  const { items, state, refreshing, loadingMore, deletingIds, load, handleEndReached, handleDelete } = useMyReports({
    visible,
    toast,
    onChanged,
  })

  const renderBody = () => {
    if (state.kind === 'loading') return <ListSkeleton />
    if (state.kind === 'missing') {
      return (
        <EmptyState
          icon="construct-outline"
          message="내 제보 내역은 곧 볼 수 있어요"
          description="서버 업데이트 후에 열려요. 검토 결과는 알림으로 먼저 알려 드려요."
          style={styles.empty}
        />
      )
    }
    if (state.kind === 'error') {
      return (
        <RetryableError
          message={state.message}
          isNetworkError={state.network}
          onRetry={state.retryable ? () => void load(0, 'initial') : undefined}
          style={styles.error}
        />
      )
    }
    return (
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MyReportCard
            report={item}
            highlighted={item.id === highlightReportId}
            deleting={deletingIds.has(item.id)}
            onShowOnMap={onShowOnMap}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={items.length === 0 ? styles.listEmpty : shared.list}
        ItemSeparatorComponent={Separator}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(0, 'refresh')} tintColor={COLORS.textTertiary} />
        }
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={styles.intro}>운영진 검토 결과는 알림으로도 알려 드려요. 반려된 제보는 사유를 확인할 수 있어요.</Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="megaphone-outline"
            message="아직 올린 제보가 없어요"
            description="캠퍼스에서 벌어지는 행사·공연·부스를 지도에 알려 주세요"
            action={
              <Button label="지도로 가서 제보하기" size="md" fullWidth={false} icon="map-outline" onPress={onStartReport} />
            }
          />
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={COLORS.primary} /> : null
        }
      />
    )
  }

  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ContentColumn>
            <ModalHeader title="내 제보 내역" onClose={onClose} />
            <View style={styles.body}>{renderBody()}</View>
          {/* 루트 토스트는 네이티브 Modal 아래에 가려져 이 창 안에 따로 둔다(BoardAlertsModal 과 같다). */}
          <ToastViewport />
          </ContentColumn>
        </SafeAreaView>
      </SafeAreaProvider>
    </SwipeBackModal>
  )
}

function Separator() {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, backgroundColor: COLORS.background },
  listEmpty: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  // 카드 안 글자(28)와 같은 들여쓰기(10-08).
  intro: { ...TYPE.caption, ...BODY_14, color: COLORS.textSecondary, marginBottom: SPACING.md, paddingHorizontal: SPACING.lg },
  empty: { marginTop: SPACING.xl },
  error: { margin: SPACING.lg },
  separator: { height: SPACING.sm },
  footerSpinner: { marginVertical: SPACING.lg },
})
