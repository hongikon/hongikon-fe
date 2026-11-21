import { Text, View } from 'react-native'
import { NEARBY_FIELD_TEST } from '../../../lib/nearbyPartners/debug'
import { resetNearbyHistoryForDebug } from '../../../lib/nearbyPartners/background'
import Button from '../../common/Button'
import ToggleSwitch from '../ToggleSwitch'
import NearbyFieldRecorder from '../NearbyFieldRecorder'
import NearbyDecisionLog from './NearbyDecisionLog'
import { nearbyStyles as styles } from './styles'

interface Props {
  visible: boolean
  /** 운영 앱의 관리자 계정에만 보이는 경우(테스트 앱이 아님). */
  adminOnly: boolean
  alreadyOn: boolean
  unlimited: boolean
  working: boolean
  testNote: string | null
  onToggleUnlimited: () => void
  onSendTest: (group: boolean) => Promise<void>
  run: (message: string, job: () => Promise<unknown>) => Promise<void>
}

/** 확인 도구: 테스트 앱 또는 운영 앱의 관리자 계정(11-10). 횟수 제한 풀기 · 시험 알림 · 현장 기록 · 판단 기록. */
export default function NearbyDevTools({ visible, adminOnly, alreadyOn, unlimited, working, testNote, onToggleUnlimited, onSendTest, run }: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>{adminOnly ? '[테스트] 관리자 계정에만 보여요' : '[테스트] 테스트 앱에서만 보여요'}</Text>
      <View style={styles.card}>
        {(NEARBY_FIELD_TEST || adminOnly) && (
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>테스트 모드: 횟수 제한 없이(머무는 동안 5분마다)</Text>
                <Text style={styles.hint}>끄면 운영 앱과 같은 규칙(하루 최대·30분 간격)으로 확인할 수 있어요.</Text>
              </View>
              <ToggleSwitch value={unlimited} onToggle={onToggleUnlimited} locked={working} accessibilityLabel="횟수 제한 없이" />
            </View>
          </>
        )}
        {alreadyOn && (
          <>
            <View style={styles.divider} />
            <Text style={styles.settingLabel}>시험 알림(5초 뒤)</Text>
            <Text style={styles.hint}>
              걷지 않고 알림 모양·버튼·눌렀을 때 이동을 확인해요. 보낸 기록에는 남지 않아요. 홈 화면으로 나가 기다린 뒤 알림을 길게 눌러 보세요.
            </Text>
            <View style={styles.testButtons}>
              <Button label="가게 한 곳" variant="outline" size="sm" onPress={() => void onSendTest(false)} />
              <Button label="여러 곳 묶음" variant="outline" size="sm" onPress={() => void onSendTest(true)} />
              <Button
                label="보낸 기록 지우기"
                variant="ghost"
                size="sm"
                onPress={() => void run('지우는 중이에요', () => resetNearbyHistoryForDebug())}
              />
            </View>
            {testNote && <Text style={styles.hint}>{testNote}</Text>}
          </>
        )}
        {alreadyOn && (
          <>
            <View style={styles.divider} />
            <NearbyFieldRecorder visible={visible} />
          </>
        )}
        <View style={styles.divider} />
        <NearbyDecisionLog visible={visible} />
      </View>
    </>
  )
}
