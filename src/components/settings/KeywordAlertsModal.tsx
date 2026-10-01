import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { useAuth } from '../../contexts/AuthContext'
import {
  createKeywordSubscription,
  deleteKeywordSubscription,
  getKeywordSubscriptions,
  type KeywordSubscription,
} from '../../apis/notifications'
import { ApiError, getErrorMessage } from '../../apis/client'
import { useToast } from '../common/Toast'
import * as haptics from '../../lib/haptics'
import ModalHeader from './ModalHeader'

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
          <ModalHeader title="키워드 알림" onClose={onClose} />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="예: 장학금, 해커톤"
              placeholderTextColor={COLORS.textTertiary}
              maxLength={MAX_KEYWORD_LENGTH}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
              accessibilityLabel="알림 받을 키워드"
            />
            <TouchableOpacity
              style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!canAdd}
              accessibilityRole="button"
              accessibilityLabel="키워드 추가"
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.addBtnText}>추가</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, (duplicate || full) && styles.hintWarn]}>{hint}</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {keywords === null && loadError === null && (
              <ActivityIndicator style={styles.loading} color={COLORS.primary} />
            )}
            {loadError !== null && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{loadError}</Text>
                <TouchableOpacity onPress={load} accessibilityRole="button">
                  <Text style={styles.retryText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            )}
            {keywords !== null && keywords.length === 0 && (
              <Text style={styles.empty}>등록한 키워드가 없어요</Text>
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
                  <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  input: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  addBtn: {
    height: 42,
    minWidth: 56,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.white },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
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
  errorText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  retryText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary },
  empty: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: 24,
  },
  keywordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f4f4f4',
  },
  keywordText: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary },
})
