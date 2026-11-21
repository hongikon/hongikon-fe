import {

  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import SwipeBackModal from '../common/SwipeBackModal'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { ToastViewport } from '../common/Toast'
import ModalHeader, { ModalPanel } from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import TextField from '../common/TextField'
import RetryableError from '../common/RetryableError'
import { useKeywordAlertsModal } from '../../hooks/settings/useKeywordAlertsModal'

export interface KeywordAlertsModalProps {
  visible: boolean
  onClose: () => void
}

/** 서버 `KeywordSubscriptionCreateRequest` 의 @Size(max = 30) 와 같다. */
const MAX_KEYWORD_LENGTH = 30

/**
 * 설정 > 키워드 알림. 제목에 키워드가 들어간 새 소식은 게시판 구독·분야 설정과 관계없이 알려준다
 * (서버 `NewsPushDispatcher`, 대소문자 무시). 서버에만 저장하는 값이라 로그인해야 쓸 수 있다 —
 * 게스트에게는 설정 화면이 이 창을 열지 않는다.
 */
export default function KeywordAlertsModal({ visible, onClose }: KeywordAlertsModalProps) {
  const { keywords, loadError, input, setInput, load, submitting, list, duplicate, full, canAdd, handleAdd, handleDelete, hint } = useKeywordAlertsModal({ visible })

  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* 폴드를 펼친 화면·넓은 웹 창에선 내용을 가운데 읽기 폭으로 모은다. */}
          <ContentColumn>
          <ModalHeader title="키워드 알림" onClose={onClose} />
          <ModalPanel>
          <View style={styles.inputRow}>
            <TextField
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="예: 장학금, 해커톤"
              maxLength={MAX_KEYWORD_LENGTH}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
              accessibilityLabel="알림 받을 키워드"
            />
            <Button
              label="추가"
              size="md"
              fullWidth={false}
              onPress={handleAdd}
              disabled={!canAdd && !submitting}
              loading={submitting}
              accessibilityLabel="키워드 추가"
              style={styles.addBtn}
            />
          </View>
          <Text style={[styles.hint, (duplicate || full) && styles.hintWarn]}>{hint}</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {keywords === null && loadError === null && (
              <ActivityIndicator style={styles.loading} color={COLORS.primary} />
            )}
            {loadError !== null && <RetryableError message={loadError} onRetry={load} style={styles.errorBox} />}
            {keywords !== null && keywords.length === 0 && (
              <EmptyState icon="pricetag-outline" message="등록한 키워드가 없어요" style={styles.empty} />
            )}
            {list.map((item) => (
              <View key={item.id} style={styles.keywordRow}>
                <Ionicons name="pricetag-outline" size={15} color={COLORS.textSecondary} />
                <Text style={styles.keywordText} numberOfLines={1}>
                  {item.keyword}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.keyword} 키워드 지우기`}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.iconMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          </ModalPanel>
          {/* 루트 토스트는 네이티브 Modal 아래에 가려져 이 창 안에 따로 둔다(BoardAlertsModal 과 같다). */}
          <ToastViewport />
          </ContentColumn>
        </SafeAreaView>
      </SafeAreaProvider>
    </SwipeBackModal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  // 웹 <input> 은 기본 최소 너비(약 20글자)가 있어 좁은 화면에서 줄지 않고 '추가' 버튼을 밖으로 밀어냈다(10-08) — 줄어들 수 있게 한다.
  input: { flex: 1, minWidth: 0 },
  addBtn: { minWidth: 64, height: 46, flexShrink: 0 },
  hint: {
    ...TYPE.caption,
    color: COLORS.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  hintWarn: { color: COLORS.danger },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  loading: { marginTop: 24 },
  errorBox: { marginTop: 24 },
  empty: { minHeight: 200 },
  keywordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  keywordText: { ...TYPE.body, flex: 1, color: COLORS.textPrimary },
})
