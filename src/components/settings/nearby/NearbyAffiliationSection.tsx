import { Pressable, Text, View } from 'react-native'
import { PARTNER_AFFILIATIONS } from '../../../constants/partnerAffiliations'
import { NEARBY_FIELD_TEST } from '../../../lib/nearbyPartners/debug'
import type { PartnerAffiliation } from '../../../types'
import { nearbyStyles as styles } from './styles'

interface Props {
  affiliations: PartnerAffiliation[]
  working: boolean
  onToggle: (item: PartnerAffiliation) => void
}

/** 내 소속 고르기(여러 개). 총학생회 제휴는 늘 받는다. */
export default function NearbyAffiliationSection({ affiliations, working, onToggle }: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>내 소속(선택, 여러 개 가능)</Text>
      <Text style={styles.hint}>
        {NEARBY_FIELD_TEST
          ? '테스트 앱은 소속과 상관없이 모든 제휴를 알려 드려요(다른 소속 제휴는 알림에 소속이 붙어요).'
          : '고른 소속들과 총학생회 제휴 업체만 알려 드려요. 고르지 않으면 총학생회 제휴만.'}
      </Text>
      <View style={styles.chips}>
        {PARTNER_AFFILIATIONS.filter((item) => item !== '총학생회').map((item) => {
          const selected = affiliations.includes(item)
          return (
            <Pressable
              key={item}
              onPress={() => onToggle(item)}
              disabled={working}
              style={[styles.chip, selected && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`소속 ${item}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{item}</Text>
            </Pressable>
          )
        })}
      </View>
    </>
  )
}
