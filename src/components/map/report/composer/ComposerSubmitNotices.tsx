import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { FONTS } from '../../../../constants/typography'
import type { ReportSubmitError } from '../../../../hooks/map/report/useReportSubmission'
import RetryableError from '../../../common/RetryableError'
import { composerStyles } from './composerStyles'

interface ComposerSubmitNoticesProps {
  /** 시간 규칙 위반 안내. 없으면 null. */
  scheduleProblem: string | null
  submitError: ReportSubmitError | null
  submitting: boolean
  onRetry: () => void
  /** 사진 업로드가 실패해 "사진 없이 올리기"를 보여줄지(붙인 사진이 있을 때만). */
  showSubmitWithoutPhoto: boolean
  onSubmitWithoutPhoto: () => void
  /** 사진 고르기 등 입력 오류. */
  error: string | null
  /** 거절된 권한. 있으면 오류 안내 옆에 "설정 열기"를 보여준다. */
  blockedPermission: 'camera' | 'library' | null
}

/** 제보 작성창 스크롤 맨 아래의 안내들: 시간 오류·등록 실패(다시 시도)·사진 없이 올리기·사진 오류(설정 열기). */
export default function ComposerSubmitNotices({
  scheduleProblem,
  submitError,
  submitting,
  onRetry,
  showSubmitWithoutPhoto,
  onSubmitWithoutPhoto,
  error,
  blockedPermission,
}: ComposerSubmitNoticesProps) {
  return (
    <>
      {scheduleProblem !== null && (
        <View style={composerStyles.errorBox}>
          <Ionicons name="warning" size={16} color={COLORS.warningIcon} />
          <Text style={composerStyles.errorText}>{scheduleProblem}</Text>
        </View>
      )}

      {submitError !== null && (
        <RetryableError
          style={styles.submitErrorBox}
          message={submitError.message}
          isNetworkError={submitError.network}
          onRetry={submitError.retryable ? onRetry : undefined}
          retrying={submitting}
        />
      )}
      {showSubmitWithoutPhoto && (
        <TouchableOpacity
          style={styles.skipPhotoBtn}
          onPress={onSubmitWithoutPhoto}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="사진 없이 올리기"
        >
          <Text style={styles.skipPhotoText}>사진 없이 올리기</Text>
        </TouchableOpacity>
      )}

      {error !== null && (
        <View style={composerStyles.errorBox}>
          <Ionicons name="warning" size={16} color={COLORS.warningIcon} />
          <Text style={composerStyles.errorText}>{error}</Text>
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
    </>
  )
}

const styles = StyleSheet.create({
  settingsLink: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.primary },
  submitErrorBox: { marginTop: 16 },
  skipPhotoBtn: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 6 },
  skipPhotoText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.primary, textDecorationLine: 'underline' },
})
