import { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { clearNearbyLog, logClock, readNearbyLog, type NearbyLogLine } from '../../../lib/nearbyPartners/debugLog'
import Button from '../../common/Button'
import { nearbyStyles as styles } from './styles'

/**
 * 판단 기록(11-10): 위치를 어떻게 받았는지, 가장 가까운 가게까지 몇 m 였는지, 들어옴·나감, 알림을 걸었는지·안 건 이유.
 * "오래 있었는데 안 왔다", "지나가기만 했는데 왔다"를 현장에서 바로 확인하려는 것. 좌표는 남기지 않는다(`debugLog`).
 */
export default function NearbyDecisionLog({ visible }: { visible: boolean }) {
  const [lines, setLines] = useState<NearbyLogLine[]>([])
  const [expanded, setExpanded] = useState(false)
  const reload = useCallback(() => {
    void readNearbyLog().then(setLines)
  }, [])
  useEffect(() => {
    if (visible) reload()
  }, [visible, reload])
  const shown = expanded ? lines : lines.slice(0, 30)
  return (
    <>
      <Text style={styles.settingLabel}>판단 기록(최근 것이 위)</Text>
      <Text style={styles.hint}>
        위치 줄은 30초마다, 들어옴·나감·알림 예약·안 보낸 이유는 생길 때마다 남아요. 좌표는 남기지 않고 이 휴대폰에만 둬요.
      </Text>
      <View style={styles.testButtons}>
        <Button label="새로 보기" variant="outline" size="sm" onPress={reload} />
        <Button label="기록 지우기" variant="ghost" size="sm" onPress={() => void clearNearbyLog().then(reload)} />
      </View>
      {lines.length === 0 ? (
        <Text style={styles.hint}>아직 기록이 없어요. 알림을 켠 채 가게 근처에 가면 쌓여요.</Text>
      ) : (
        <View style={styles.logBox}>
          {shown.map((line, index) => (
            <Text key={`${line.at}-${index}`} style={styles.logLine} selectable>
              {logClock(line.at)}  {line.text}
            </Text>
          ))}
          {lines.length > shown.length && (
            <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" style={styles.logMore}>
              <Text style={styles.logMoreText}>{lines.length - shown.length}줄 더 보기</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
  )
}
