import { lazy, Suspense, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'

/**
 * `/dev/sogang` 앞의 인증키 입력(10-14 요청). 키 원문은 저장소에 두지 않고 SHA-256 값만 둔다 — 키는 운영자가 따로 전한다.
 * 키를 맞히기 전에는 서강대 데이터·화면 코드(`DevSogangScreen`)를 내려받지 않는다.
 * 다만 정적 웹이라 진짜 잠금은 아니다(번들 파일 주소를 알면 받을 수 있다). 학교가 공개한 정보를 링크 없이 숨겨 두는 정도의 용도.
 * 키를 바꾸려면 새 키의 SHA-256(`printf '%s' 새키 | shasum -a 256`)으로 아래 값을 바꾼다.
 */
const KEY_SHA256 = '6b980606c6e01c1c613834d4b1546aae577730932517e62e6572c78cc0458dd5'
const UNLOCK_KEY = '@hongikon_dev_sogang_unlocked'

const DevSogangScreen = lazy(() => import('./DevSogangScreen'))

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function readUnlocked(): boolean {
  try {
    return window.sessionStorage.getItem(UNLOCK_KEY) === KEY_SHA256
  } catch {
    return false
  }
}

export default function DevSogangGate() {
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
    return () => {
      meta.remove()
    }
  }, [])

  if (unlocked) {
    return (
      <Suspense fallback={<Text style={styles.loading}>불러오는 중이에요</Text>}>
        <DevSogangScreen />
      </Suspense>
    )
  }

  const submit = async () => {
    const key = value.trim()
    if (!key || checking) return
    setChecking(true)
    try {
      if ((await sha256Hex(key)) !== KEY_SHA256) {
        setError('인증키가 맞지 않아요.')
        return
      }
      try {
        // 이 탭을 닫기 전까지만 기억한다.
        window.sessionStorage.setItem(UNLOCK_KEY, KEY_SHA256)
      } catch {
        // 저장소를 못 쓰면 새로고침 때 다시 묻는다.
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
        <Text style={styles.title}>서강대 시설 미리보기</Text>
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
