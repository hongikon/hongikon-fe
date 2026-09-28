import { Component, type ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * 렌더링 중 처리 안 된 예외가 나면 흰 화면 대신 이 화면을 보여준다.
 * App.tsx 최상단(AuthProvider 등보다 바깥)에서 감싸, 그 안의 어떤 화면이
 * 던지든 잡는다. 원인은 그대로 콘솔에 남기고, "다시 시도"는 트리를
 * 다시 마운트해 일시적 오류(레이스, 잘못된 네비게이션 상태 등)를 복구시킨다.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: { componentStack: string }): void {
    if (__DEV__) console.error('ErrorBoundary가 처리 안 된 예외를 잡았습니다:', error, info.componentStack)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.title}>문제가 발생했어요</Text>
          <Text style={styles.subtitle}>
            화면을 불러오는 중 오류가 생겼습니다. 다시 시도해도 계속되면 앱을 완전히
            종료했다가 다시 열어주세요.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
          >
            <Text style={styles.buttonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  title: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginTop: 4 },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    height: 46,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.white },
})
