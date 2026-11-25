import { lazy, Suspense, useMemo } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { CAMPUS_PREVIEW_LOADERS, type CampusPreviewKey } from '../debug/campusPreview'
import { useDevCampusGate } from '../hooks/debug/useDevCampusGate'

export default function DevCampusGate({ campus }: { campus: CampusPreviewKey }) {
  const { name, unlocked, setUnlocked, value, setValue, error, setError, checking, setChecking, submit } = useDevCampusGate({ campus })
  // 화면 코드와 그 학교 데이터를 함께 받는다(다른 학교 데이터는 받지 않는다).
  const Screen = useMemo(
    () =>
      lazy(async () => {
        const [{ default: DevCampusScreen }, { default: data }] = await Promise.all([
          import('./DevCampusScreen'),
          CAMPUS_PREVIEW_LOADERS[campus](),
        ])
        return { default: () => <DevCampusScreen data={data} path={`/dev/${campus}`} /> }
      }),
    [campus],
  )

  if (unlocked) {
    return (
      <Suspense fallback={<Text style={styles.loading}>불러오는 중이에요</Text>}>
        <Screen />
      </Suspense>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{`${name} 시설 미리보기`}</Text>
        <Text style={styles.sub}>개발용 페이지예요. 받은 인증키를 넣어 주세요.</Text>
        <TextInput
          value={value}
          onChangeText={(t) => {
            setValue(t)
            setError(null)
          }}
          onSubmitEditing={submit}
          placeholder="인증키"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="인증키"
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
