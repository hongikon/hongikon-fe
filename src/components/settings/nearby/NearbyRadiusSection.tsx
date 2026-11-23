import { Pressable, Text, View } from 'react-native'
import { ALERT_RADIUS_METERS, ALERT_RADIUS_OPTIONS } from '../../../lib/nearbyPartners/rules'
import NearbyRadiusMap from '../NearbyRadiusMap'
import { nearbyStyles as styles } from './styles'

interface Props {
  radius: number
  working: boolean
  onChoose: (meters: number) => void
}

/**
 * 알림 반경(11-11 운영진: 테스트 기능이 아니라 모두에게 — 범위를 그림으로 보고 직접 고른다). 고른 값은 이 휴대폰에만
 * 두고 바로 판단에 쓴다(`chooseRadius` → `setPartnerRadius`).
 */
export default function NearbyRadiusSection({ radius, working, onChoose }: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>알림 반경</Text>
      <View style={styles.card}>
        <View style={[styles.chips, styles.radiusChips]}>
          {ALERT_RADIUS_OPTIONS.map((meters) => {
            const selected = radius === meters
            return (
              <Pressable
                key={meters}
                onPress={() => onChoose(meters)}
                disabled={working}
                style={[styles.chip, selected && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`알림 반경 ${meters}미터${meters === ALERT_RADIUS_METERS ? ', 권장' : ''}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>{meters}m</Text>
                {meters === ALERT_RADIUS_METERS && (
                  <View style={styles.recommendWrap} pointerEvents="none">
                    <Text style={styles.recommend}>권장</Text>
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
        <NearbyRadiusMap meters={radius} />
        <Text style={styles.hint}>
          {`고른 반경 안에 머물면 알림이 와요. 넓게 고르면 가게 앞을 지나거나 옆 가게에 있을 때도 올 수 있고, 좁게 고르면 가게 안에서 늦게 오거나 오지 않을 수 있어요. 권장은 ${ALERT_RADIUS_METERS}m예요.`}
        </Text>
      </View>
    </>
  )
}
