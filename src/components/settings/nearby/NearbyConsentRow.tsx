import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
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
        <Text style={styles.consentTitle}>(필수) 근처 제휴 알림을 받을게요</Text>
        <Text style={styles.hint}>
          제휴 가게의 학생 혜택 알림(광고성 정보)을 받는 데 동의해요. 동의하지 않아도 다른 기능은 쓸 수 있어요.
        </Text>
      </View>
    </Pressable>
  )
}
