import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { SHEET_MAX_WIDTH } from '../../../constants/layout'
import { RADIUS } from '../../../constants/spacing'
import { REPORT_CATEGORIES } from '../../../constants/reportCategories'
import { REPORT_CONTENT_MAX_LENGTH, REPORT_CUSTOM_CATEGORY_MAX_LENGTH, REPORT_TITLE_MAX_LENGTH } from '../../../constants/report'
import ScreenHeader from '../../common/ScreenHeader'
import Button from '../../common/Button'
import TextField from '../../common/TextField'
import { chipStyles } from '../chipStyles'
import ReportScheduleEditModal from './ReportScheduleEditModal'
import { REPORT_MAX_IMAGES } from '../../../utils/map/report/reports'
import { formatClock, formatDay } from '../../../utils/map/report/reportSchedule'
import type { Report, ReportListItem } from '../../../types'
import { MAX_FLOOR, MIN_FLOOR, PLACE_MAX_LENGTH, formatEditFloor, stepFloor } from '../../../utils/map/report/reportEdit'
import { useReportEditForm } from '../../../hooks/map/report/useReportEditForm'

interface ReportEditModalProps {
  /** null 이면 닫힘. 열 때마다 이 제보 값으로 새로 채운다. */
  report: ReportListItem | null
  onClose: () => void
  /** 저장 성공 — 서버가 돌려준 제보. */
  onSaved: (report: Report) => void
}

/**
 * 내 제보 고치기(11-09 요청 — 지도 카드 ⋯ > 수정). 카테고리·제목·장소 설명·층·내용·사진·시간을 고친다. 핀 위치는 그대로다
 * (옮기려면 지우고 다시 올린다). 공개된 제보도 고친 내용이 바로 지도에 보이고 시트에 '수정됨'이 붙는다(서버 editedAt).
 * 시간은 공식 계정 시간 수정과 같은 시트(ReportScheduleEditModal)로 고르고, 저장을 누를 때 함께 보낸다.
 */
export default function ReportEditModal({ report, onClose, onSaved }: ReportEditModalProps) {
  const {
    category,
    setCategory,
    customLabel,
    setCustomLabel,
    title,
    setTitle,
    placeLabel,
    setPlaceLabel,
    floor,
    setFloor,
    content,
    setContent,
    photos,
    setPhotos,
    schedule,
    setSchedule,
    scheduleOpen,
    setScheduleOpen,
    saving,
    error,
    inBuilding,
    isEtc,
    problem,
    startMs,
    endMs,
    pickPhotos,
    save,
  } = useReportEditForm(report, onSaved)

  if (!report) return null

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="수정 닫기" />
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={styles.handle} />
            <ScreenHeader title="제보 수정" onBack={onClose} backIcon="close" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.note}>고친 내용은 바로 지도에 보이고 '수정됨'으로 표시돼요. 핀 위치를 옮기려면 지우고 다시 올려 주세요.</Text>

              <Text style={styles.label}>카테고리</Text>
              <View style={styles.chipWrap}>
                {REPORT_CATEGORIES.map((meta) => {
                  const active = category === meta.key
                  return (
                    <TouchableOpacity
                      key={meta.key}
                      style={[chipStyles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                      onPress={() => setCategory(meta.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons name={meta.icon} size={13} color={active ? COLORS.white : meta.color} />
                      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>{meta.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {isEtc && (
                <TextField
                  style={styles.gapTop}
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  maxLength={REPORT_CUSTOM_CATEGORY_MAX_LENGTH}
                  placeholder="카테고리 이름(선택) 예: 붕어빵"
                  accessibilityLabel="카테고리 이름"
                />
              )}

              <Text style={styles.label}>제목</Text>
              <TextField value={title} onChangeText={setTitle} maxLength={REPORT_TITLE_MAX_LENGTH} accessibilityLabel="제목" />

              <Text style={styles.label}>장소{inBuilding ? '' : ' (필수)'}</Text>
              <TextField
                value={placeLabel}
                onChangeText={setPlaceLabel}
                maxLength={PLACE_MAX_LENGTH}
                placeholder={inBuilding ? '예: 1층 로비' : '예: 홍대입구역 9번 출구 앞'}
                accessibilityLabel="장소 설명"
              />

              {inBuilding && (
                <>
                  <Text style={styles.label}>층</Text>
                  <View style={styles.floorRow}>
                    <StepButton icon="remove" label="한 층 아래" disabled={floor <= MIN_FLOOR} onPress={() => setFloor((f) => stepFloor(f, -1))} />
                    <Text style={styles.floorText} accessibilityLiveRegion="polite">
                      {formatEditFloor(floor)}
                    </Text>
                    <StepButton icon="add" label="한 층 위" disabled={floor >= MAX_FLOOR} onPress={() => setFloor((f) => stepFloor(f, 1))} />
                  </View>
                </>
              )}

              <Text style={styles.label}>시간</Text>
              <TouchableOpacity
                style={styles.timeRow}
                onPress={() => setScheduleOpen(true)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="시간 바꾸기"
              >
                <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.timeText} numberOfLines={2}>
                  {Number.isFinite(startMs) && Number.isFinite(endMs)
                    ? `${formatDay(startMs)} ${formatClock(startMs)} ~ ${formatDay(endMs)} ${formatClock(endMs)}${schedule.days && schedule.days.length >= 2 ? ` · ${schedule.days.length}일 운영` : ''}`
                    : '시간 정보 없음'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>

              <Text style={styles.label}>내용</Text>
              <TextField
                value={content}
                onChangeText={setContent}
                maxLength={REPORT_CONTENT_MAX_LENGTH}
                multiline
                placeholder="자세한 내용(선택)"
                accessibilityLabel="내용"
              />

              <Text style={styles.label}>
                사진 <Text style={styles.count}>{photos.length}/{REPORT_MAX_IMAGES}</Text>
              </Text>
              {photos.length > 0 && (
                <View style={styles.thumbRow}>
                  {photos.map((photo) => {
                    const key = photo.kind === 'existing' ? `e${photo.index}` : photo.picked.uri
                    return (
                      <View key={key} style={styles.thumbWrap}>
                        <Image source={{ uri: photo.kind === 'existing' ? photo.url : photo.picked.uri }} style={styles.thumb} />
                        <TouchableOpacity
                          style={styles.thumbRemove}
                          onPress={() => setPhotos((prev) => prev.filter((item) => item !== photo))}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel="사진 빼기"
                        >
                          <Ionicons name="close" size={14} color={COLORS.white} />
                        </TouchableOpacity>
                      </View>
                    )
                  })}
                </View>
              )}
              {photos.length < REPORT_MAX_IMAGES && (
                <TouchableOpacity style={styles.photoBtn} onPress={() => void pickPhotos()} disabled={saving} accessibilityRole="button">
                  <Ionicons name="images-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.photoBtnText}>앨범에서 사진 추가</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <View style={styles.footer}>
              {error || problem ? <Text style={styles.error}>{error ?? problem}</Text> : null}
              <Button label="저장" onPress={() => void save()} loading={saving} disabled={!!problem} />
            </View>
          </SafeAreaView>
        </View>
        <ReportScheduleEditModal
          visible={scheduleOpen}
          startsAt={schedule.startsAt}
          endsAt={schedule.endsAt}
          days={schedule.days}
          saving={false}
          onClose={() => setScheduleOpen(false)}
          onSave={(next) => {
            // 서버에는 '저장'을 누를 때 함께 보낸다. 시작을 고치지 않았으면 받은 문자열 그대로다(이미 시작한 제보도 받는다).
            setSchedule({ startsAt: next.startsAt, endsAt: next.endsAt, days: next.days ?? null })
            setScheduleOpen(false)
          }}
        />
      </SafeAreaProvider>
    </Modal>
  )
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove'
  label: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.stepButton, disabled && styles.stepDisabled]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={COLORS.textPrimary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    height: '90%',
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
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
  scroll: { flex: 1 },
  body: { padding: 16, paddingBottom: 24 },
  note: { fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18, color: COLORS.textTertiary },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary, marginTop: 18, marginBottom: 8 },
  count: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  gapTop: { marginTop: 8 },
  floorRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  floorText: { minWidth: 44, textAlign: 'center', fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.textPrimary },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
  },
  timeText: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textPrimary },
  thumbRow: { flexDirection: 'row', gap: 10, paddingTop: 6, paddingRight: 6, marginBottom: 10 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 88, height: 88, borderRadius: RADIUS.md, backgroundColor: COLORS.fill },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtn: {
    height: 46,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.chipBorder,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, gap: 8 },
  error: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.danger },
})
