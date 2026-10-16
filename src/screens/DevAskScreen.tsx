import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'
import AskChat from '../components/ask/AskChat'

/**
 * 개발용 `/dev/ask` — '물어보기' 챗봇 미리보기. 완성될 때까지 운영 앱(지도)에는 넣지 않고 여기서만 연다(10-15 요청).
 * 앱 내비게이션 바깥에서 그려지므로 안전 영역 값을 직접 준다.
 */
/** @param devKey /dev 게이트에 입력한 암호키 — 물어보기가 서버 LLM 분류(/ask/route)에 보낸다. */
export default function DevAskScreen({ devKey }: { devKey?: string }) {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <AskChat serverKey={devKey} />
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
})
