import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../../../constants/colors'
import { SHEET_MAX_WIDTH } from '../../../constants/layout'
import ScreenHeader from '../../common/ScreenHeader'
import Button from '../../common/Button'
import ReportGuidelines from './ReportGuidelines'
import TextField from '../../common/TextField'
import { REPORT_CONTENT_MAX_LENGTH, REPORT_TITLE_MAX_LENGTH } from '../../../constants/report'
import ReportScheduleFields from '../ReportScheduleFields'
import { ToastViewport } from '../../common/Toast'
import { useAttentionFlash } from '../../../hooks/common/useAttentionFlash'
import { useReportComposerForm } from '../../../hooks/map/report/useReportComposerForm'
import { useReportImages } from '../../../hooks/map/report/useReportImages'
import { useRequiredFieldFlash } from '../../../hooks/map/report/useRequiredFieldFlash'
import { useReportSubmission } from '../../../hooks/map/report/useReportSubmission'
import type { Report } from '../../../types'
import { RADIUS } from '../../../constants/spacing'
import ComposerSuccess from './composer/ComposerSuccess'
import ComposerPlaceSection from './composer/ComposerPlaceSection'
import ComposerCategorySection from './composer/ComposerCategorySection'
import ComposerPhotoSection from './composer/ComposerPhotoSection'
import ComposerSubmitNotices from './composer/ComposerSubmitNotices'
import { composerStyles } from './composer/composerStyles'

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

/**
 * 제보 작성창. 지도를 길게 눌러 좌표가 잡힌 뒤에만 열린다.
 *
 * 층은 지상/지하 · 1~30 다이얼로 고른다. 필수 항목(제목·시간 등)이 비면 '제보 올리기'는 흐리게 보이지만 누를 수 있고,
 * 누르면 빠진 칸을 깜빡이며 안내한다(`checkRequired`).
 *
 * 입력값은 `useReportComposerForm`, 사진은 `useReportImages`, 빠진 칸 안내는 `useRequiredFieldFlash`,
 * 등록 흐름(사진 업로드 → 등록 → 완료 화면)은 `useReportSubmission` 이 맡는다.
 */
export default function ReportComposerModal({
  target,
  onClose,
  onCreated,
}: ReportComposerModalProps) {
  const form = useReportComposerForm(target)
  const images = useReportImages()
  const required = useRequiredFieldFlash(form.missing)
  const { flash, flaggedMessage } = required
  const buildingFlash = useAttentionFlash(flash.building, required.missingMessage('building') !== null, COLORS.warningSoft)
  const {
    submitting,
    submitError,
    submitted,
    submittedStartMs,
    handleClose,
    handleSubmit,
    handleSubmitWithoutPhoto,
  } = useReportSubmission({
    target,
    form,
    images,
    checkRequired: required.checkRequired,
    resetFlash: required.resetFlash,
    onClose,
    onCreated,
  })
  const { title, content, missing } = form

  return (
    <Modal transparent visible={target !== null} animationType="slide" onRequestClose={handleClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <View style={styles.backdrop}>
        {/* 시트 바깥(어두운 곳)을 누르면 닫기. 시트를 터치 부품으로 감싸면 그 부품이 터치를 먼저 잡아 안의 스크롤이
            자주 안 먹었다(10-31) — 시트 뒤에 따로 깔아 시트 안 터치에는 끼어들지 않게 한다. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityRole="button" accessibilityLabel="제보 닫기" />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <ScreenHeader title="제보하기" onBack={handleClose} backIcon="close" />

          {submitted ? (
            <ComposerSuccess
              submittedStartMs={submittedStartMs}
              photoSkipped={images.photoSkipped}
              onConfirm={handleClose}
            />
          ) : (
            <>
              <View ref={required.scrollAreaRef} style={styles.scrollArea} collapsable={false}>
                <ScrollView
                  ref={required.scrollRef}
                  style={styles.scrollArea}
                  onScroll={(event) => {
                    required.scrollYRef.current = event.nativeEvent.contentOffset.y
                  }}
                  scrollEventThrottle={32}
                  contentContainerStyle={styles.body}
                  keyboardShouldPersistTaps="handled"
                  // iOS: 키보드가 시트 아래쪽(설명·사진·시간 칸)을 덮어도 스크롤 범위가 그대로라 그 칸들을 키보드 위로
                  // 올릴 수 없었다. 키보드에 가린 만큼 아래 여백을 넣고 포커스된 입력칸이 보이게 스크롤한다.
                  // 시트가 화면 90% 높이라 KeyboardAvoidingView 로 시트를 밀어 올리면 위가 잘려 스크롤뷰에서 맞춘다.
                  automaticallyAdjustKeyboardInsets
                  // 키보드를 띄운 채로도 아래로 끌어 내리면 키보드가 따라 내려간다(가려진 '제보 올리기'로 갈 수 있게).
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                >
                  <ComposerPlaceSection
                    target={target}
                    shownPlace={form.shownPlace}
                    placeEdited={form.placeEdited}
                    onChangePlace={form.handleChangePlace}
                    hasBuilding={form.building !== null}
                    offCampus={form.offCampus}
                    buildingFlash={buildingFlash}
                    basement={form.basement}
                    onChangeBasement={form.setBasement}
                    floorItems={form.floorItems}
                    floorNumber={form.floorNumber}
                    onChangeFloorNumber={form.setFloorNumber}
                    buildingFloorItems={form.buildingFloorItems}
                    buildingFloor={form.buildingFloor}
                    onChangeBuildingFloor={form.setBuildingFloor}
                  />

                  <ComposerCategorySection
                    labelRef={required.categoryLabelRef}
                    customInputRef={required.customInputRef}
                    category={form.category}
                    isCustomActive={form.isCustomActive}
                    trimmedCustomLabel={form.trimmedCustomLabel}
                    customInputOpen={form.customInputOpen}
                    customLabelDraft={form.customLabelDraft}
                    onChangeCustomLabelDraft={form.setCustomLabelDraft}
                    flashKey={flash.category}
                    flaggedMessage={flaggedMessage('category')}
                    onSelectPreset={form.handleSelectPresetCategory}
                    onOpenCustomInput={form.handleOpenCustomInput}
                    onConfirmCustomLabel={form.handleConfirmCustomLabel}
                    onCancelCustomInput={form.handleCancelCustomInput}
                  />

                  <Text ref={required.titleLabelRef} style={composerStyles.sectionLabel}>
                    제목
                  </Text>
                  <TextField
                    ref={required.titleInputRef}
                    flashKey={flash.title}
                    invalid={form.trimmedTitle.length === 0}
                    placeholder="예 : 컴퓨터공학과 간식행사"
                    accessibilityLabel="제목"
                    value={title}
                    onChangeText={form.setTitle}
                    maxLength={REPORT_TITLE_MAX_LENGTH}
                  />
                  <View style={styles.belowField}>
                    {flaggedMessage('title') !== null && (
                      <Text style={[composerStyles.fieldHint, styles.belowFieldHint]}>{flaggedMessage('title')}</Text>
                    )}
                    <Text style={[composerStyles.counter, styles.belowFieldCounter]}>
                      {title.length} / {REPORT_TITLE_MAX_LENGTH}
                    </Text>
                  </View>

                  <Text style={composerStyles.sectionLabel}>설명 (선택)</Text>
                  <TextField
                    areaHeight={100}
                    placeholder="예 : 학생회비 납부한 컴퓨터공학과 학생만 수령 가능"
                    accessibilityLabel="설명"
                    value={content}
                    onChangeText={form.setContent}
                    maxLength={REPORT_CONTENT_MAX_LENGTH}
                    multiline
                  />
                  <Text style={composerStyles.counter}>
                    {content.length} / {REPORT_CONTENT_MAX_LENGTH}
                  </Text>

                  <ComposerPhotoSection
                    images={images.images}
                    submitting={submitting}
                    onPickImage={images.handlePickImage}
                    onRemoveImage={images.handleRemoveImage}
                  />

                  <Text ref={required.scheduleLabelRef} style={composerStyles.sectionLabel}>
                    언제인가요?
                  </Text>
                  <ReportScheduleFields
                    value={form.schedule}
                    onChange={form.setSchedule}
                    now={form.now}
                    disabled={submitting}
                    flashKey={flash.schedule}
                    invalid={form.scheduleProblem !== null}
                  />
                  <ComposerSubmitNotices
                    scheduleProblem={form.scheduleProblem}
                    submitError={submitError}
                    submitting={submitting}
                    onRetry={handleSubmit}
                    showSubmitWithoutPhoto={images.photoUploadFailed && images.images.length > 0}
                    onSubmitWithoutPhoto={handleSubmitWithoutPhoto}
                    error={images.error}
                    blockedPermission={images.blockedPermission}
                  />
                </ScrollView>
              </View>

              <View style={styles.footer}>
                {/* 올리기 전에 볼 수 있게 버튼 바로 위에 접어 둔다(누르면 펼쳐짐). */}
                <ReportGuidelines />
                {/* 필수 항목이 비면 흐리게만 보이고 누를 수 있다 — 누르면 빠진 칸을 알려 준다. */}
                <Button
                  label="제보 올리기"
                  onPress={handleSubmit}
                  dimmed={missing.length > 0}
                  loading={submitting}
                  accessibilityHint={
                    missing.length > 0 ? '아직 채우지 않은 항목이 있어요. 누르면 빠진 곳을 알려 줘요.' : undefined
                  }
                />
              </View>
            </>
          )}
        </SafeAreaView>
      </View>
      {/* Modal 은 루트 위에 따로 떠서 루트 토스트가 가려진다 — 여기 하나 둔다(구서버 "1장만 첨부" 안내). */}
      <ToastViewport />
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
    // 넓은 화면(폴드 펼침·웹)에선 아래에서 올라오는 시트를 가운데 한 폭으로 모은다.
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
  scrollArea: { flex: 1 },
  body: { padding: 16, paddingBottom: 24 },
  belowField: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  belowFieldHint: { flex: 1, marginTop: 4 },
  belowFieldCounter: { marginLeft: 'auto' },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
})
