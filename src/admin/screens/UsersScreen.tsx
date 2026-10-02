import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { getErrorMessage, isCancelledError } from '../../apis/client'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { searchUsers } from '../api'
import type { AdminUser } from '../types'
import { Button, Card, EmptyState, InlineError, Loading, ScreenHeader, useAdminHost } from '../ui'
import { UserModerationPanel } from '../UserModeration'

/**
 * 회원 조회와 이용 정지(약관 제10조, App Store 가이드라인 1.2).
 * 검색어가 비면 정지된 회원 목록. 회원 번호(10자리, 대소문자 무시), 숫자면 회원 id, 그 밖에는 로그인 닉네임 일부로 찾는다.
 */
export default function UsersScreen() {
  const app = useAdminHost() === 'app'
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    searchUsers(query, controller.signal)
      .then(setUsers)
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(getErrorMessage(err, '회원을 불러오지 못했습니다. 서버에 회원 관리 기능이 배포됐는지 확인해주세요.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [query, reloadKey])

  const submit = () => {
    setUsers(null)
    if (input.trim() === query) setReloadKey((key) => key + 1)
    else setQuery(input.trim())
  }

  const replace = (updated: AdminUser) =>
    setUsers((prev) => (prev ? prev.map((user) => (user.id === updated.id ? updated : user)) : prev))

  return (
    <View>
      <ScreenHeader
        title="회원"
        subtitle="회원 번호(10자리), 회원 id 또는 로그인 닉네임으로 찾습니다. 검색어가 없으면 이용 정지된 회원을 보여줍니다. 회원 번호는 앱 설정 > 계정에서 확인할 수 있습니다."
      />
      <View style={styles.search}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
          placeholder="회원 번호(10자리), id 또는 닉네임"
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={COLORS.textPlaceholder}
          style={[styles.input, app && styles.inputApp]}
          returnKeyType="search"
          accessibilityLabel="회원 검색"
        />
        <Button label="검색" icon="search" onPress={submit} variant="primary" small />
      </View>

      {error ? <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} style={styles.error} /> : null}
      {!users ? (
        loading ? <Loading /> : null
      ) : users.length === 0 ? (
        <EmptyState message={query ? '찾는 회원이 없습니다.' : '이용 정지된 회원이 없습니다.'} />
      ) : (
        <View style={styles.list}>
          {users.map((user) => (
            <Card key={user.id}>
              <UserModerationPanel user={user} onChanged={replace} />
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  input: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputApp: { minHeight: 44, fontSize: 16 },
  error: { marginBottom: 12 },
  list: { gap: 12 },
})
