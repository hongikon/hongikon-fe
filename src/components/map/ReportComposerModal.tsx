import { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { REPORT_CATEGORIES } from '../../constants/reportCategories'
import {
  REPORT_CONTENT_MAX_LENGTH,
  REPORT_CUSTOM_CATEGORY_MAX_LENGTH,
  REPORT_DEFAULT_DURATION_HOURS,
  REPORT_DURATION_OPTIONS_HOURS,
  REPORT_TITLE_MAX_LENGTH,
} from '../../constants/report'
import { useAuth } from '../../contexts/AuthContext'
import { createReport, uploadReportImage } from '../../apis/reports'
import { chipStyles } from './chipStyles'
import type { Report, ReportCategory } from '../../types'

/** 길게 누른 지점. 좌표는 건물로 스냅하지 않은 원본이다. */
export interface ReportTarget {
  lat: number
  lng: number
  /** 근처 건물 이름. 스냅이 아니라 참고용이라 없을 수 있다. */
  buildingName: string | null
}

interface ReportComposerModalProps {
  target: ReportTarget | null
  onClose: () => void
  onCreated: (report: Report) => void
}

function formatCoord(value: number): string {
  return value.toFixed(5)
}

/**
 * 제보 작성창. 지도를 길게 눌러 좌표가 잡힌 뒤에만 열린다.
 *
 * 층 선택은 아직 넣지 않았다. `BUILDINGS` 에 층수 데이터가 한 건도 없어
 * `hasFloorData()` 가 항상 false 라, 층 다이얼을 붙여도 뜨지 않는다.
 * 층수 데이터가 채워지면 `FloorPickerModal` 을 그대로 끼우면 된다.
 */
export default function ReportComposerModal({
  target,
  onClose,
  onCreated,
}: ReportComposerModalProps) {
  const { accessToken } = useAuth()
  const [category, setCategory] = useState<ReportCategory>('EVENT')
  // '+' 로 확정한 카테고리 라벨. 체크(확정) 전까지는 반영되지 않는다.
  const [customLabel, setCustomLabel] = useState('')
  // 입력 칸이 열려 있는 동안의 작업본. 확정해야 customLabel 로 옮겨간다 —
  // 취소를 누르면 이미 확정해 둔 라벨을 건드리지 않고 이 작업본만 버린다.
  const [customLabelDraft, setCustomLabelDraft] = useState('')
  const [customInputOpen, setCustomInputOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [durationHours, setDurationHours] = useState(REPORT_DEFAULT_DURATION_HOURS)
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 등록 성공. 바로 닫지 않고 "검토 후 반영" 안내를 먼저 보여준다.
  // 올린 제보가 지도에 안 보이는 것을 실패로 오해하지 않게 하려는 것이다.
  const [submitted, setSubmitted] = useState(false)

  const trimmedTitle = title.trim()
  const trimmedCustomLabel = customLabel.trim()
  const canSubmit = trimmedTitle.length > 0 && !submitting

  const reset = () => {
    setCategory('EVENT')
    setCustomLabel('')
    setCustomLabelDraft('')
    setCustomInputOpen(false)
    setTitle('')
    setContent('')
    setDurationHours(REPORT_DEFAULT_DURATION_HOURS)
    setImageUri(null)
    setError(null)
    setSubmitting(false)
    setSubmitted(false)
  }

  /** '+' 칩을 누르면 입력 칸을 연다. 이미 직접 입력을 확정해 뒀으면 그 값부터 고쳐 쓰게 한다. */
  const handleOpenCustomInput = () => {
    setCustomLabelDraft(customLabel)
    setCustomInputOpen(true)
  }

  const handleConfirmCustomLabel = () => {
    const trimmedDraft = customLabelDraft.trim()
    if (!trimmedDraft) return
    setCustomLabel(trimmedDraft)
    setCategory('ETC')
    setCustomInputOpen(false)
  }

  const handleCancelCustomInput = () => {
    setCustomInputOpen(false)
  }

  const handleSelectPresetCategory = (key: ReportCategory) => {
    setCategory(key)
    // 프리셋 '기타'와 직접 입력이 둘 다 category: 'ETC' 라, 직접 입력 라벨이
    // 남아 있으면 프리셋 '기타'를 골라도 직접 입력 칩이 계속 활성으로 보인다.
    setCustomLabel('')
    setCustomInputOpen(false)
  }

  const isCustomActive = category === 'ETC' && trimmedCustomLabel.length > 0

  const handleClose = () => {
    reset()
    onClose()
  }

  /** 사진 한 장만 붙인다. 여러 장은 검토 부담만 키우고 지도 배너에서 보여줄 자리도 없다. */
  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError('사진 접근 권한이 없어 첨부할 수 없습니다. 설정에서 허용해주세요.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    })
    if (result.canceled || result.assets.length === 0) return

    setError(null)
    setImageUri(result.assets[0].uri)
  }

  const handleSubmit = async () => {
    if (!target || !canSubmit) return

    setSubmitting(true)
    setError(null)

    // 시작은 지금, 종료는 고른 시간 뒤. 서버에는 UTC ISO-8601 로 보낸다.
    const startsAt = new Date()
    const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000)

    try {
      // 로그인 없이도 화면 확인용으로 올려 볼 수 있게, 토큰이 없으면 빈 값을 대신 쓴다.
      // 로컬 목업 스토어는 이 값을 실제로 쓰지 않는다.
      const token = accessToken ?? ''

      // 사진을 먼저 올려 URL을 받는다. 여기서 실패하면 제보는 만들지 않고
      // 작성 중이던 내용은 그대로 남는다.
      const imageUrl = imageUri === null ? undefined : await uploadReportImage(imageUri, token)

      const report = await createReport(
        {
          imageUrl,
          // buildingId 는 보내지 않는다. 앱의 건물 데이터는 이름으로만 식별되고
          // 서버 buildings 테이블의 숫자 id 를 알 방법이 없다(스펙 §4.1 선택 필드).
          lat: target.lat,
          lng: target.lng,
          category,
          customCategoryLabel: isCustomActive ? trimmedCustomLabel : undefined,
          title: trimmedTitle,
          content: content.trim() || undefined,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
        token,
      )
      onCreated(report)
      setSubmitted(true)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : '제보를 등록하지 못했습니다. 잠시 후 다시 시도해주세요.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal transparent visible={target !== null} animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <SafeAreaView style={styles.sheet} edges={['bottom']}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handleClose}
                  accessibilityRole="button"
                  accessibilityLabel="닫기"
                >
                  <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>제보하기</Text>
                <View style={{ width: 22 }} />
              </View>

              {submitted ? (
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
                  <Text style={styles.successTitle}>제보가 등록됐어요</Text>
                  <Text style={styles.successText}>
                    바로 지도에 올라갑니다.
                  </Text>
                  <TouchableOpacity
                    style={[styles.submitBtn, styles.successBtn]}
                    onPress={handleClose}
                    accessibilityRole="button"
                    accessibilityLabel="확인"
                  >
                    <Text style={styles.submitText}>확인</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <ScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.body}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.locationRow}>
                      <Ionicons name="location" size={15} color={COLORS.primary} />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {target?.buildingName
                          ? `${target.buildingName} 근처`
                          : target
                            ? `${formatCoord(target.lat)}, ${formatCoord(target.lng)}`
                            : ''}
                      </Text>
                    </View>

                    <Text style={styles.sectionLabel}>무슨 일인가요?</Text>
                    <View style={styles.chipWrap}>
                      {REPORT_CATEGORIES.map((meta) => {
                        const isActive = category === meta.key && !isCustomActive
                        return (
                          <TouchableOpacity
                            key={meta.key}
                            activeOpacity={0.75}
                            onPress={() => handleSelectPresetCategory(meta.key)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isActive }}
                            accessibilityLabel={meta.label}
                            style={[
                              chipStyles.chip,
                              isActive && { backgroundColor: meta.color, borderColor: meta.color },
                            ]}
                          >
                            <Ionicons
                              name={meta.icon}
                              size={13}
                              color={isActive ? COLORS.white : meta.color}
                            />
                            <Text style={[chipStyles.label, isActive && chipStyles.labelActive]}>
                              {meta.label}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}

                      {!customInputOpen && (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={handleOpenCustomInput}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isCustomActive }}
                          accessibilityLabel={
                            isCustomActive ? `${trimmedCustomLabel}, 직접 입력한 카테고리` : '카테고리 직접 입력'
                          }
                          style={[
                            chipStyles.chip,
                            isCustomActive
                              ? styles.customChipActive
                              : styles.customChipAdd,
                          ]}
                        >
                          <Ionicons
                            name={isCustomActive ? 'pencil' : 'add'}
                            size={13}
                            color={isCustomActive ? COLORS.white : COLORS.primary}
                          />
                          <Text
                            style={[
                              chipStyles.label,
                              isCustomActive ? chipStyles.labelActive : styles.customChipAddText,
                            ]}
                          >
                            {isCustomActive ? trimmedCustomLabel : '직접 입력'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {customInputOpen && (
                      <View style={styles.customInputRow}>
                        <TextInput
                          style={styles.customInput}
                          placeholder="예: 분실물, 설문조사"
                          placeholderTextColor="#bbb"
                          value={customLabelDraft}
                          onChangeText={setCustomLabelDraft}
                          maxLength={REPORT_CUSTOM_CATEGORY_MAX_LENGTH}
                          autoFocus
                          onSubmitEditing={handleConfirmCustomLabel}
                          returnKeyType="done"
                        />
                        <TouchableOpacity
                          onPress={handleConfirmCustomLabel}
                          disabled={!customLabelDraft.trim()}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="직접 입력한 카테고리 적용"
                          accessibilityState={{ disabled: !customLabelDraft.trim() }}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={26}
                            color={customLabelDraft.trim() ? COLORS.primary : '#ddd'}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleCancelCustomInput}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="직접 입력 취소"
                        >
                          <Ionicons name="close-circle" size={26} color="#ccc" />
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={styles.sectionLabel}>제목</Text>
                    <TextInput
                      style={styles.titleInput}
                      placeholder="예 : 컴퓨터공학과 간식행사"
                      placeholderTextColor="#bbb"
                      value={title}
                      onChangeText={setTitle}
                      maxLength={REPORT_TITLE_MAX_LENGTH}
                    />
                    <Text style={styles.counter}>
                      {title.length} / {REPORT_TITLE_MAX_LENGTH}
                    </Text>

                    <Text style={styles.sectionLabel}>설명 (선택)</Text>
                    <TextInput
                      style={styles.contentInput}
                      placeholder="예 : 학생회비 납부한 컴퓨터공학과 학생만 수령 가능"
                      placeholderTextColor="#bbb"
                      value={content}
                      onChangeText={setContent}
                      maxLength={REPORT_CONTENT_MAX_LENGTH}
                      multiline
                      textAlignVertical="top"
                    />
                    <Text style={styles.counter}>
                      {content.length} / {REPORT_CONTENT_MAX_LENGTH}
                    </Text>

                    <Text style={styles.sectionLabel}>사진 (선택)</Text>
                    {imageUri === null ? (
                      <TouchableOpacity
                        style={styles.photoBtn}
                        onPress={handlePickImage}
                        accessibilityRole="button"
                        accessibilityLabel="사진 첨부하기"
                      >
                        <Ionicons name="camera-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.photoBtnText}>사진 첨부하기</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.photoPreviewWrap}>
                        <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                        <TouchableOpacity
                          style={styles.photoRemove}
                          onPress={() => setImageUri(null)}
                          accessibilityRole="button"
                          accessibilityLabel="첨부한 사진 빼기"
                        >
                          <Ionicons name="close" size={16} color={COLORS.white} />
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={styles.sectionLabel}>얼마나 진행되나요?</Text>
                    <View style={styles.chipWrap}>
                      {REPORT_DURATION_OPTIONS_HOURS.map((hours) => {
                        const isActive = durationHours === hours
                        return (
                          <TouchableOpacity
                            key={hours}
                            activeOpacity={0.75}
                            onPress={() => setDurationHours(hours)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isActive }}
                            accessibilityLabel={`${hours}시간 동안`}
                            style={[chipStyles.chip, isActive && styles.durationChipActive]}
                          >
                            <Text style={[chipStyles.label, isActive && chipStyles.labelActive]}>
                              {hours}시간
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                    <Text style={styles.hint}>
                      지금부터 {durationHours}시간 뒤에 지도에서 자동으로 내려갑니다.
                    </Text>

                    {error !== null && (
                      <View style={styles.errorBox}>
                        <Ionicons name="warning" size={15} color="#B45309" />
                        <Text style={styles.errorText}>{error}</Text>
                      </View>
                    )}
                  </ScrollView>

                  <View style={styles.footer}>
                    <TouchableOpacity
                      style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                      onPress={handleSubmit}
                      disabled={!canSubmit}
                      accessibilityRole="button"
                      accessibilityLabel="제보 올리기"
                      accessibilityState={{ disabled: !canSubmit }}
                    >
                      {submitting ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <Text style={styles.submitText}>제보 올리기</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </SafeAreaView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    height: '90%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 2,
  },
  scrollArea: { flex: 1 },
  header: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.textPrimary },
  body: { padding: 16, paddingBottom: 24 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F5F7FA',
  },
  locationText: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textPrimary },
  sectionLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 18,
    marginBottom: 8,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  durationChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  customChipAdd: { borderStyle: 'dashed', borderColor: COLORS.primary },
  customChipAddText: { color: COLORS.primary },
  customChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  customInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  titleInput: {
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  contentInput: {
    height: 100,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    borderRadius: 10,
    padding: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  counter: {
    alignSelf: 'flex-end',
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: '#6B7280', marginTop: 8 },
  photoBtn: {
    height: 46,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.chipBorder,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary },
  photoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoPreview: { width: 120, height: 120, borderRadius: 10, backgroundColor: '#EEE' },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: COLORS.textPrimary },
  successText: {
    fontFamily: FONTS.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
  },
  successBtn: { alignSelf: 'stretch', marginTop: 12 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },
  errorText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, color: '#92400E' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.white },
})
