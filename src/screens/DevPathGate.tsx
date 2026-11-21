import { lazy, Suspense } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { useDevPathGate } from '../hooks/debug/useDevPathGate'
import { cannotCheckKey, TITLES } from '../utils/debug/devPathGate'
import { type DevPathMode } from '../utils/debug/devPathGate'

const DevPathAuditScreen = lazy(() => import('./DevPathAuditScreen'))
const DevPathSurveyScreen = lazy(() => import('./DevPathSurveyScreen'))
const DevPathSurveyV3Screen = lazy(() => import('./DevPathSurveyV3Screen'))
const DevAskScreen = lazy(() => import('./DevAskScreen'))

export default function DevPathGate({ mode }: { mode: DevPathMode }) {
  const { unlocked, setUnlocked, rawKey, setRawKey, value, setValue, error, setError, checking, setChecking, submit } = useDevPathGate({ mode })

  if (unlocked) {
    return (
      <Suspense fallback={<Text style={styles.loading}>불러오는 중이에요</Text>}>
        {mode === 'audit' ? <DevPathAuditScreen /> : mode === 'survey' ? <DevPathSurveyScreen /> : mode === 'surveyV3' ? <DevPathSurveyV3Screen devKey={rawKey} /> : <DevAskScreen devKey={rawKey} />}
      </Suspense>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{TITLES[mode]}</Text>
        <Text style={styles.sub}>개발용 페이지예요. 암호키를 입력해 주세요.</Text>
        {mode === 'surveyV3' && cannotCheckKey() ? (
          <Text style={styles.error}>{'이 주소(http)에서는 브라우저가 암호키를 확인할 수 없어요. localhost 나 https 주소로 열어 주세요.'}</Text>
        ) : null}
        <TextInput
          value={value}
          onChangeText={(text) => {
            setValue(text)
            setError(null)
          }}
          onSubmitEditing={submit}
          placeholder="암호키"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="암호키"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          onPress={submit}
          disabled={checking || value.trim() === ''}
          style={[styles.button, (checking || value.trim() === '') && styles.buttonDisabled]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{checking ? '확인 중' : '열기'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: COLORS.fill },
  card: { width: '100%', maxWidth: 360, padding: 24, borderRadius: 16, backgroundColor: COLORS.white, gap: 12 },
  title: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textPrimary },
  sub: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, marginTop: -6 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  error: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.danger },
  button: { height: 44, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.white },
  loading: { padding: 20, fontFamily: FONTS.medium, color: COLORS.textSecondary },
})
