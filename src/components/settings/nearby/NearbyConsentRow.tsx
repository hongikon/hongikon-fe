import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { QUIET_END_HOUR } from '../../../lib/nearbyPartners/rules'
import { QUIET_START_LABEL } from '../../../utils/settings/nearby'
import { nearbyStyles as styles } from './styles'

/** 꺼져 있을 때: (필수) 근처 제휴 혜택 알림 수신 동의 체크. */
export default function NearbyConsentRow({ consent, onToggle }: { consent: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.consentRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: consent }}
      accessibilityLabel="근처 제휴 혜택 알림 받기 동의"
    >
      <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={COLORS.primary} />
      <View style={styles.consentBody}>
        <Text style={styles.consentTitle}>(필수) 근처 제휴 혜택 알림을 받을게요</Text>
        <Text style={styles.hint}>
          제휴 가게에 머물 때 그 가게의 학생 혜택을 알려 드려요(제휴 혜택 알림). 광고성 정보예요. 동의하면 동의 여부와 시각만 서버에 남기고,
          수신 거부하면 바로 지워요. 동의하지 않아도 다른 기능은 그대로 쓸 수 있어요. {QUIET_START_LABEL}~아침 {QUIET_END_HOUR}시에는
          따로 켜야 받아요.
        </Text>
      </View>
    </Pressable>
  )
}
