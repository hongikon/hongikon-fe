import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FONTS } from '../../constants/typography'

interface RetryableErrorProps {
  /** 사용자에게 보여줄 문구. client 가 만든 한국어 문구만 넘긴다(서버 원문 금지). */
  message: string
  /** 없으면 버튼을 숨긴다(다시 눌러도 결과가 같은 실패). */
  onRetry?: () => void
  /** 다시 시도 중이면 버튼 자리에 스피너를 보여주고 연타를 막는다. */
  retrying?: boolean
  /** 연결 불량이면 구름-끊김 아이콘으로 서버 오류와 구분해 보여준다. */
  isNetworkError?: boolean
  /**
   * box: 화면·섹션 안에 끼우는 기본형
   * chip: 지도 위처럼 좁은 곳에 띄우는 작은 형태
   */
  variant?: 'box' | 'chip'
  retryLabel?: string
  /** 있으면 닫기(X) 버튼을 붙인다. 지도처럼 안내가 화면을 가리는 곳에서 쓴다. */
  onDismiss?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * 요청이 (자동 재시도까지) 끝내 실패했을 때 쓰는 공통 안내.
 * 조용히 실패하거나 빈 화면으로 남으면 사용자는 앱이 멈춘 줄 안다 — 무엇이 안 됐는지와
 * 직접 다시 해볼 수 있는 버튼을 같이 준다.
 */
export default function RetryableError({
  message,
  onRetry,
  retrying = false,
  isNetworkError = false,
  variant = 'box',
  retryLabel = '다시 시도',
  onDismiss,
  style,
}: RetryableErrorProps) {
  const isChip = variant === 'chip'
  const iconName = isNetworkError ? 'cloud-offline-outline' : 'warning-outline'

  return (
    <View
      style={[isChip ? styles.chip : styles.box, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={iconName} size={isChip ? 14 : 16} color={TEXT_COLOR} />
      <Text style={[styles.message, isChip && styles.messageChip]} numberOfLines={isChip ? 2 : undefined}>
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          style={[styles.button, isChip && styles.buttonChip]}
          onPress={onRetry}
          disabled={retrying}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          accessibilityState={{ disabled: retrying, busy: retrying }}
        >
          {retrying ? (
            <ActivityIndicator size="small" color={TEXT_COLOR} />
          ) : (
            <Text style={[styles.buttonText, isChip && styles.buttonTextChip]}>{retryLabel}</Text>
          )}
        </TouchableOpacity>
      )}
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="안내 닫기"
        >
          <Ionicons name="close" size={15} color={TEXT_COLOR} />
        </TouchableOpacity>
      )}
    </View>
  )
}

/** 기존 지도·제보 오류 안내(`#FEF3C7`/`#92400E`)와 같은 톤을 쓴다. */
const BG_COLOR = '#FEF3C7'
const TEXT_COLOR = '#92400E'

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: BG_COLOR,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 11,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: BG_COLOR,
  },
  message: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18, color: TEXT_COLOR },
  messageChip: { fontSize: 12, lineHeight: 16 },
  button: {
    minWidth: 72,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TEXT_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonChip: { minWidth: 64, height: 26 },
  buttonText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: TEXT_COLOR },
  buttonTextChip: { fontSize: 12 },
})
