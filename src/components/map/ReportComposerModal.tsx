import { useEffect, useMemo, useState } from 'react'
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
  Platform,
  Linking,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
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
import { getServerBuildingId } from '../../apis/buildings'
import { ApiError, isNetworkError, isRetryableError } from '../../apis/client'
import { BUILDINGS } from '../../constants/buildings'
import { buildFloorOptions, formatFloor, type FloorOption } from '../../utils/floors'
import RetryableError from '../common/RetryableError'
import { promptLogin } from '../../utils/reports'
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

/** 층수가 확인되지 않은 건물에서 고를 수 있게 하는 기본 층 목록(B1~6F). */
const FALLBACK_FLOOR_OPTIONS: FloorOption[] = [-1, 1, 2, 3, 4, 5, 6].map((value) => ({
  label: formatFloor(value),
  value,
}))

/**
 * 등록 실패를 사용자가 다음에 뭘 해야 하는지 알 수 있는 문구로 바꾼다.
 * (서버 원문은 개발용이라 그대로 보여주지 않는다.)
 */
function reportSubmitErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return '인터넷 연결이 불안정해 제보를 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
  if (error instanceof ApiError) {
    if (error.status === 400) return '제보 내용이 올바르지 않아요. 위치(건물·층)와 제목을 다시 확인해 주세요.'
    if (error.status === 401) return '로그인이 만료됐어요. 다시 로그인한 뒤 제보해 주세요.'
    if (error.status === 403) return '이 계정으로는 제보를 올릴 수 없어요.'
    if (error.status === 429) return '제보를 너무 자주 올렸어요. 잠시 후 다시 시도해 주세요.'
    if (error.status >= 500) return '서버에 일시적인 문제가 있어 제보를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'
  }
  if (error instanceof Error && error.message) return error.message
  return '제보를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'
}

function formatCoord(value: number): string {
  return value.toFixed(5)
}

/**
 * 제보 작성창. 지도를 길게 눌러 좌표가 잡힌 뒤에만 열린다.
 *
 * 층 선택은 아직 넣지 않았다. 제보 위치는 건물 이름만 잡혀 `Building` 객체가
 * 없는데, 층을 받으려면 길찾기처럼 `FloorChips` 에 건물을 넘겨 붙이면 된다.
 */
export default function ReportComposerModal({
  target,
  onClose,
  onCreated,
}: ReportComposerModalProps) {
  const { accessToken, logout } = useAuth()
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
  /** 거절된 권한. 있으면 오류 안내 옆에 "설정 열기"를 보여준다. */
  const [blockedPermission, setBlockedPermission] = useState<'camera' | 'library' | null>(null)
  /**
   * 등록 요청이 연결 문제 등으로 실패했을 때의 안내. 입력 검증 오류(`error`)와 나눈 이유는
   * "다시 시도" 버튼이 여기에만 붙어야 해서다. 제보 등록은 POST 라 자동으로 다시 보내지
   * 않고(중복 등록 방지), 사용자가 버튼을 눌렀을 때만 작성 내용 그대로 다시 보낸다.
   */
  const [submitError, setSubmitError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)
  // 등록 성공. 바로 닫지 않고 "검토 후 반영" 안내를 먼저 보여준다.
  // 올린 제보가 지도에 안 보이는 것을 실패로 오해하지 않게 하려는 것이다.
  const [submitted, setSubmitted] = useState(false)

  // 서버는 제보를 건물·층 단위로 받는다(둘 다 필수). 핀 근처 건물이 없으면 올릴 수 없다.
  const building = useMemo(
    () => (target?.buildingName ? BUILDINGS.find((b) => b.name === target.buildingName) ?? null : null),
    [target?.buildingName],
  )
  const floorOptions = useMemo(() => {
    const options = building ? buildFloorOptions(building) : []
    return options.length > 0 ? options : FALLBACK_FLOOR_OPTIONS
  }, [building])
  const [floor, setFloor] = useState(1)
  // 다른 건물로 바뀌면 그 건물에 있는 층으로 맞춘다(기본 1층).
  useEffect(() => {
    if (!floorOptions.some((option) => option.value === floor)) {
      setFloor(floorOptions.some((option) => option.value === 1) ? 1 : floorOptions[0].value)
    }
  }, [floorOptions, floor])

  const trimmedTitle = title.trim()
  const trimmedCustomLabel = customLabel.trim()
  const canSubmit = trimmedTitle.length > 0 && building !== null && !submitting

  const reset = () => {
    setCategory('EVENT')
    setCustomLabel('')
    setCustomLabelDraft('')
    setCustomInputOpen(false)
    setTitle('')
    setContent('')
    setDurationHours(REPORT_DEFAULT_DURATION_HOURS)
    setFloor(1)
    setImageUri(null)
    setError(null)
    setBlockedPermission(null)
    setSubmitError(null)
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

  /**
   * 사진 한 장만 붙인다. 여러 장은 검토 부담만 키우고 지도 배너에서 보여줄 자리도 없다.
   * 권한은 버튼을 누른 그때만 묻는다(카메라·앨범 각각). 거절된 뒤엔 휴대폰 설정으로 보내는 버튼을 보여준다.
   */
  const handlePickImage = async (source: 'camera' | 'library') => {
    setError(null)
    setBlockedPermission(null)
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setBlockedPermission(source)
        setError(
          source === 'camera'
            ? '카메라 권한이 꺼져 있어 사진을 찍을 수 없어요.'
            : '사진 접근 권한이 꺼져 있어 사진을 고를 수 없어요.',
        )
        return
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options)
      if (result.canceled || result.assets.length === 0) return
      setImageUri(result.assets[0].uri)
    } catch {
      // 시뮬레이터처럼 카메라가 없는 기기 등
      setError(source === 'camera' ? '이 기기에서는 카메라를 쓸 수 없어요. 앨범에서 골라 주세요.' : '사진을 불러오지 못했어요.')
    }
  }

  const handleSubmit = async () => {
    if (!target || !canSubmit || !building) return

    // 제보 등록은 로그인이 필요하다(`POST /reports` — 게스트는 401).
    if (!accessToken) {
      promptLogin('제보를 등록하려면 로그인해주세요.', logout)
      return
    }

    setSubmitting(true)
    setError(null)
    setSubmitError(null)

    // 시작은 지금, 종료는 고른 시간 뒤. 서버에는 UTC ISO-8601 로 보낸다.
    const startsAt = new Date()
    const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000)

    try {
      // 사진을 먼저 올려 URL을 받는다. 여기서 실패하면 제보는 만들지 않고
      // 작성 중이던 내용은 그대로 남는다.
      const imageUrl =
        imageUri === null ? undefined : await uploadReportImage(imageUri, accessToken)

      // 앱 건물 이름 → 서버 건물 id. 서버는 buildingId·floor 를 필수로 받는다(없으면 400).
      const buildingId = await getServerBuildingId(building.name)
      if (buildingId === null) {
        throw new Error('이 건물은 아직 제보를 받을 수 없어요. 가까운 다른 건물로 위치를 옮겨 주세요.')
      }

      const report = await createReport(
        {
          imageUrl,
          buildingId,
          floor,
          lat: target.lat,
          lng: target.lng,
          category,
          customCategoryLabel: isCustomActive ? trimmedCustomLabel : undefined,
          title: trimmedTitle,
          content: content.trim() || undefined,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
        accessToken,
      )
      onCreated(report)
      setSubmitted(true)
    } catch (caught) {
      setSubmitError({
        message: reportSubmitErrorMessage(caught),
        network: isNetworkError(caught),
        retryable: isRetryableError(caught),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal transparent visible={target !== null} animationType="slide" onRequestClose={handleClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
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
                  <Text style={styles.successTitle}>제보가 접수됐어요</Text>
                  <Text style={styles.successText}>
                    운영진이 확인한 뒤 지도에 올라가요.{'\n'}잘못된 정보나 광고는 올라가지 않을 수 있어요.
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

                    {building === null ? (
                      <View style={styles.errorBox}>
                        <Ionicons name="information-circle" size={15} color="#B45309" />
                        <Text style={styles.errorText}>
                          제보는 건물·층 단위로 올라가요. 창을 닫고 지도에서 핀을 건물 가까이로 옮겨 주세요.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.sectionLabel}>몇 층인가요?</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floorRow}>
                          {floorOptions.map((option) => {
                            const isActive = floor === option.value
                            return (
                              <TouchableOpacity
                                key={option.value}
                                activeOpacity={0.75}
                                onPress={() => setFloor(option.value)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={`${option.label}`}
                                style={[chipStyles.chip, isActive && styles.durationChipActive]}
                              >
                                <Text style={[chipStyles.label, isActive && chipStyles.labelActive]}>
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </ScrollView>
                      </>
                    )}

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
                      <View style={styles.photoBtnRow}>
                        {Platform.OS !== 'web' && (
                          <TouchableOpacity
                            style={[styles.photoBtn, styles.photoBtnHalf]}
                            onPress={() => handlePickImage('camera')}
                            accessibilityRole="button"
                            accessibilityLabel="카메라로 찍기"
                          >
                            <Ionicons name="camera-outline" size={18} color={COLORS.primary} />
                            <Text style={styles.photoBtnText}>카메라로 찍기</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.photoBtn, styles.photoBtnHalf]}
                          onPress={() => handlePickImage('library')}
                          accessibilityRole="button"
                          accessibilityLabel="앨범에서 고르기"
                        >
                          <Ionicons name="images-outline" size={18} color={COLORS.primary} />
                          <Text style={styles.photoBtnText}>앨범에서 고르기</Text>
                        </TouchableOpacity>
                      </View>
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

                    {submitError !== null && (
                      <RetryableError
                        style={styles.submitErrorBox}
                        message={submitError.message}
                        isNetworkError={submitError.network}
                        onRetry={submitError.retryable ? handleSubmit : undefined}
                        retrying={submitting}
                      />
                    )}

                    {error !== null && (
                      <View style={styles.errorBox}>
                        <Ionicons name="warning" size={15} color="#B45309" />
                        <Text style={styles.errorText}>{error}</Text>
                        {blockedPermission !== null && (
                          <TouchableOpacity
                            onPress={() => Linking.openSettings().catch(() => {})}
                            accessibilityRole="button"
                            accessibilityLabel="휴대폰 설정 열기"
                          >
                            <Text style={styles.settingsLink}>설정 열기</Text>
                          </TouchableOpacity>
                        )}
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
      </SafeAreaProvider>
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
  floorRow: { flexDirection: 'row', gap: 7, paddingRight: 4 },
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
  photoBtnRow: { flexDirection: 'row', gap: 8 },
  photoBtnHalf: { flex: 1 },
  settingsLink: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.primary },
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
  submitErrorBox: { marginTop: 16 },
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
