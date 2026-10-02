import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'

/** 연한 바탕 + 진한 글자 쌍(흰 바탕 위에서 글자 대비 4.5:1 이상). */
const PALETTE: readonly { bg: string; fg: string }[] = [
  { bg: '#EEF0FA', fg: '#05014A' },
  { bg: '#E8F6EE', fg: '#15803D' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#FDECEC', fg: '#B91C1C' },
  { bg: '#E0F2FE', fg: '#075985' },
  { bg: '#F3E8FF', fg: '#6B21A8' },
]

function pick(seed: string): { bg: string; fg: string } {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/**
 * 작성자 동그라미: 표시 이름의 첫 글자. 색은 authorKey(없으면 이름)로 정해 같은 사람은 같은 색이다.
 * 이름이 없으면(지운 댓글 자리) 회색 사람 아이콘.
 */
export default function CommentAvatar({
  name,
  seed,
  size = 32,
}: {
  name: string | null
  seed: string | null
  size?: number
}) {
  const style = { width: size, height: size, borderRadius: size / 2 }
  if (!name) {
    return (
      <View style={[styles.base, style, { backgroundColor: COLORS.fill }]} accessibilityElementsHidden>
        <Ionicons name="person" size={size * 0.5} color={COLORS.iconMuted} />
      </View>
    )
  }
  const color = pick(seed || name)
  const initial = Array.from(name.trim())[0] ?? '?'
  return (
    <View style={[styles.base, style, { backgroundColor: color.bg }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={[styles.initial, { color: color.fg, fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: FONTS.semibold },
})
