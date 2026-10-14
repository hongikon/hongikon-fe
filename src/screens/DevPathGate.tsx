import { lazy, Suspense, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'

const KEY_SHA256 = '6b980606c6e01c1c613834d4b1546aae577730932517e62e6572c78cc0458dd5'
const UNLOCK_KEY = '@hongikon_dev_path_unlocked'

const DevPathAuditScreen = lazy(() => import('./DevPathAuditScreen'))
const DevPathSurveyScreen = lazy(() => import('./DevPathSurveyScreen'))

type DevPathMode = 'audit' | 'survey'

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readUnlocked(): boolean {
  try {
    return window.sessionStorage.getItem(UNLOCK_KEY) === KEY_SHA256
  } catch {
    return false
  }
}

export default function DevPathGate({ mode }: { mode: DevPathMode }) {
  const [unlocked, setUnlocked] = useState(readUnlocked)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    document.title = mode === 'audit' ? '경로망 점검 | 홍익온' : '경로망 현장 조사 | 홍익온'
    return () => {
      meta.remove()
    }
  }, [mode])

  if (unlocked) {
    return (
      <Suspense fallback={<Text style={styles.loading}>불러오는 중이에요</Text>}>
        {mode === 'audit' ? <DevPathAuditScreen /> : <DevPathSurveyScreen />}
      </Suspense>
    )
  }

  const submit = async () => {
    const key = value.trim()
    if (!key || checking) return
    setChecking(true)
    setError(null)
    try {
      if ((await sha256Hex(key)) !== KEY_SHA256) {
        setError('암호키가 맞지 않아요.')
        return
      }
      try {
        window.sessionStorage.setItem(UNLOCK_KEY, KEY_SHA256)
      } catch {
        // 저장소를 사용할 수 없으면 새로고침 때 다시 암호키를 묻는다.
      }
      setUnlocked(true)
    } catch {
      setError('이 브라우저에서는 확인할 수 없어요. https 주소로 열어 주세요.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{mode === 'audit' ? '경로망 점검' : '경로망 현장 조사'}</Text>
        <Text style={styles.sub}>개발용 페이지예요. 암호키를 입력해 주세요.</Text>
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
