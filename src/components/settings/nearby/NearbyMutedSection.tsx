import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { unmuteNearbyPartner } from '../../../lib/nearbyPartners/background'
import Button from '../../common/Button'
import { nearbyStyles as styles } from './styles'

interface Props {
  muted: { id: string; name: string }[]
  working: boolean
  run: (message: string, job: () => Promise<unknown>) => Promise<void>
}

/** 켜져 있을 때: 알림 안 받는 가게 목록과 위치 처리 안내. */
export default function NearbyMutedSection({ muted, working, run }: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>알림 안 받는 가게</Text>
      <View style={styles.card}>
        {muted.length === 0 ? (
          <Text style={styles.hint}>없어요. 알림을 길게 누르면 나오는 "이 가게 알림 끄기"로 더할 수 있어요.</Text>
        ) : (
          muted.map((item, index) => (
            <View key={item.id} style={[styles.settingRow, index < muted.length - 1 && styles.rowDivider]}>
              <Text style={[styles.settingLabel, styles.settingText]} numberOfLines={1}>
                {item.name}
              </Text>
              <Button
                label="다시 받기"
                variant="outline"
                size="sm"
                onPress={() => void run('저장하는 중이에요', () => unmuteNearbyPartner(item.id))}
                disabled={working}
              />
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, styles.privacyCard]}>
        <View style={styles.privacyHead}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
          <Text style={styles.settingLabel}>위치는 휴대폰 안에서만 써요</Text>
        </View>
        <Text style={styles.hint}>
          서버로 보내거나 저장하지 않아요. 휴대폰에는 알림을 보낸 가게와 시각만 2일 동안 남아요. 알림을 끈 가게 목록도 이 휴대폰에만 있어요.
        </Text>
      </View>
    </>
  )
}
