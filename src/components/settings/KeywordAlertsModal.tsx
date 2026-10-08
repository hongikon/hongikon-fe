import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { TYPE } from '../../constants/typography'
import { useAuth } from '../../contexts/AuthContext'
import {
  createKeywordSubscription,
  deleteKeywordSubscription,
  getKeywordSubscriptions,
  type KeywordSubscription,
} from '../../apis/notifications'
import { ApiError, getErrorMessage } from '../../apis/client'
import { ToastViewport, useToast } from '../common/Toast'
import * as haptics from '../../lib/haptics'
import ModalHeader, { ModalPanel } from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import TextField from '../common/TextField'

interface KeywordAlertsModalProps {
  visible: boolean
  onClose: () => void
}

/** 서버 `KeywordSubscriptionCreateRequest` 의 @Size(max = 30) 와 같다. */
const MAX_KEYWORD_LENGTH = 30
/** 서버에는 개수 상한이 없지만, 소식마다 제목과 대조하는 값이라 앱에서 이만큼으로 묶는다. */
const MAX_KEYWORDS = 20

/**
 * 설정 > 키워드 알림. 제목에 키워드가 들어간 새 소식은 게시판 구독·분야 설정과 관계없이 알려준다
 * (서버 `NewsPushDispatcher`, 대소문자 무시). 서버에만 저장하는 값이라 로그인해야 쓸 수 있다 —
 * 게스트에게는 설정 화면이 이 창을 열지 않는다.
 */
export default function KeywordAlertsModal({ visible, onClose }: KeywordAlertsModalProps) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [keywords, setKeywords] = useState<KeywordSubscription[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const loadSeqRef = useRef(0)

  const load = useCallback(() => {
    if (!accessToken) return
    const seq = ++loadSeqRef.current
    setLoadError(null)
    getKeywordSubscriptions(accessToken)
      .then((list) => {
        if (seq === loadSeqRef.current) setKeywords(list)
      })
      .catch((error) => {
        if (seq === loadSeqRef.current) setLoadError(getErrorMessage(error, '키워드를 불러오지 못했어요.'))
      })
  }, [accessToken])

  useEffect(() => {
    if (visible) load()
  }, [visible, load])

  const trimmed = input.trim()
  const list = keywords ?? []
  const duplicate = list.some((k) => k.keyword.toLowerCase() === trimmed.toLowerCase())
  const full = list.length >= MAX_KEYWORDS
  const canAdd = Boolean(accessToken) && keywords !== null && trimmed.length > 0 && !duplicate && !full && !submitting

  const handleAdd = async () => {
    if (!canAdd || !accessToken) return
    setSubmitting(true)
    try {
      const created = await createKeywordSubscription(trimmed, accessToken)
      setKeywords((prev) => [...(prev ?? []), created])
      setInput('')
      haptics.tapLight()
      toast.show({ message: `'${created.keyword}' 소식을 알려드릴게요` })
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 409
          ? '이미 등록한 키워드예요'
          : getErrorMessage(error, '키워드를 추가하지 못했어요.')
      toast.show({ message, tone: 'info' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item: KeywordSubscription) => {
    if (!accessToken) return
    // 화면에서 먼저 빼고, 실패하면 되돌린다.
    setKeywords((prev) => (prev ?? []).filter((k) => k.id !== item.id))
    haptics.tapLight()
    try {
      await deleteKeywordSubscription(item.id, accessToken)
      toast.show({ message: `'${item.keyword}' 키워드를 지웠어요`, tone: 'info' })
    } catch (error) {
      // 이미 지워진 구독(404)이면 지운 것으로 본다.
      if (error instanceof ApiError && error.status === 404) return
      setKeywords((prev) => (prev ? [...prev, item].sort((a, b) => a.id - b.id) : prev))
      toast.show({ message: getErrorMessage(error, '키워드를 지우지 못했어요.'), tone: 'info' })
    }
  }

  const hint = duplicate
    ? '이미 등록한 키워드예요'
    : full
      ? `키워드는 ${MAX_KEYWORDS}개까지 등록할 수 있어요`
      : '제목에 이 단어가 들어간 새 소식을 게시판 구독과 관계없이 알려드려요'

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {keywords === null && loadError === null && (
              <ActivityIndicator style={styles.loading} color={COLORS.primary} />
            )}
            {loadError !== null && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{loadError}</Text>
                <Button label="다시 시도" variant="secondary" size="sm" fullWidth={false} onPress={load} />
              </View>
            )}
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
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  input: { flex: 1 },
  addBtn: { minWidth: 64, height: 46 },
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
  errorBox: { alignItems: 'center', gap: 8, marginTop: 24 },
  errorText: { ...TYPE.callout, color: COLORS.textSecondary },
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
