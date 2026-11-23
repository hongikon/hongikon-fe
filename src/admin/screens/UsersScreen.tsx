import { StyleSheet, TextInput, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { Button, Card, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'
import { UserModerationPanel } from '../UserModeration'
import { RADIUS } from '../../constants/spacing'
import { useUsersScreen } from '../hooks/users/useUsersScreen'

/**
 * 회원 조회와 이용 정지(약관 제10조, App Store 가이드라인 1.2).
 * 검색어가 비면 정지된 회원 목록. 회원 번호(10자리, 대소문자 무시), 숫자면 회원 id, 그 밖에는 앱 닉네임 일부로 찾는다.
 * 로그인(카카오/Apple) 닉네임으로는 찾지 않는다 — 실명일 수 있어 운영진도 앱에 보이는 이름·회원 번호로만 회원을 가리킨다.
 */
/** initialQuery: 관리자 알림(재가입 회원)으로 들어오면 그 회원 id 로 바로 검색한다. */
export default function UsersScreen({ initialQuery = '' }: { initialQuery?: string } = {}) {
  const { app, input, setInput, query, users, loading, error, setReloadKey, submit, replace } = useUsersScreen({ initialQuery })

  return (
    <View>
      <ScreenHeader
        title="회원"
        subtitle="회원 번호(10자리), 회원 id 또는 앱 닉네임으로 찾습니다. 검색어가 없으면 이용 정지된 회원을 보여줍니다. 회원 번호는 앱 설정 > 계정과 제보·신고·문의 화면에서 확인할 수 있습니다."
      />
      <View style={styles.search}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
          placeholder="회원 번호(10자리), id 또는 앱 닉네임"
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
    flex: 1, minWidth: 0,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputApp: { minHeight: 44, fontSize: 16 },
  error: { marginBottom: 12 },
  list: { gap: 12 },
})
