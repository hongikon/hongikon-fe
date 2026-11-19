import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import Button from '../../common/Button'
import { formatLocation, type InfoSuggestLocation, type Kind } from '../../../utils/settings/infoSuggest'
import { infoStyles as styles } from './styles'

/** 빨간 칸 아래 안내 한 줄. */
export function Hint({ text }: { text: string }) {
  return (
    <Text style={styles.hint} accessibilityLiveRegion="polite">
      {text}
    </Text>
  )
}

/** '새로 · 정보가 달라요' 두 칸 고르기. */
export function KindToggle({ kind, labels, onChange }: { kind: Kind; labels: readonly [string, string]; onChange: (kind: Kind) => void }) {
  return (
    <View style={styles.kindRow}>
      {(['new', 'fix'] as const).map((value, index) => {
        const active = kind === value
        return (
          <TouchableOpacity
            key={value}
            style={[styles.kindButton, active && styles.kindButtonActive]}
            onPress={() => onChange(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.kindText, active && styles.kindTextActive]}>{labels[index]}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

/** 지도에서 찍은 위치 한 줄과 "지도에서 위치 찍기" 버튼(찍을 수 있는 화면에서만). */
export function PinPicker({
  location,
  canPick,
  onPick,
}: {
  location: InfoSuggestLocation | null
  canPick: boolean
  onPick: () => void
}) {
  return (
    <>
      {location !== null && (
        <View style={styles.pickedRow}>
          <Ionicons name="location" size={15} color={COLORS.primary} />
          <Text style={styles.pickedText} numberOfLines={1}>
            {formatLocation(location)}
          </Text>
        </View>
      )}
      {canPick && (
        <Button
          variant="outline"
          size="md"
          icon="pin-outline"
          label={location ? '지도에서 다시 찍기' : '지도에서 위치 찍기'}
          onPress={onPick}
          accessibilityLabel={location ? '지도에서 위치 다시 찍기' : '지도에서 위치 찍기'}
          style={styles.pickButton}
        />
      )}
    </>
  )
}
