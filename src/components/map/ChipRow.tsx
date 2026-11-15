import { useEffect, useState, type ReactNode } from 'react'
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { chipStyles } from './chipStyles'

interface ChipRowProps {
  children: ReactNode
  /** 줄 바깥 모양(useChipRowScrollStyle 등). */
  style?: StyleProp<ViewStyle>
  /** 칩 사이 간격·좌우 여백. */
  contentContainerStyle?: StyleProp<ViewStyle>
  /** 바뀌면(칩을 고르면) 펼친 판을 접는다. */
  selection?: string | null
}

/**
 * 마우스로 쓰는 데스크톱 웹인지(주 포인터가 정밀하고 hover 가 된다). 휴대폰·태블릿 브라우저는 손가락으로 칩 줄을 밀 수 있어 아니다.
 * 앱(iOS·Android)은 false.
 */
function isDesktopPointer(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/**
 * 지도 위 필터 칩 한 줄. 앱과 휴대폰 브라우저는 손가락으로 가로로 민다.
 *
 * 데스크톱 웹은 마우스 휠·트랙패드가 없으면 가로로 넘길 수 없어(11-16 사용자 — 칩이 화면 밖에 남는다), 칩이 넘칠 때만 줄 끝에
 * '⋯ 더보기' 버튼을 두고 누르면 모든 칩을 여러 줄로 펼친다(카카오·네이버 지도 웹처럼). 칩을 고르거나 다시 누르면 접는다.
 */
export default function ChipRow({ children, style, contentContainerStyle, selection }: ChipRowProps) {
  const [expanded, setExpanded] = useState(false)
  /** 접힌 줄에서 칩을 줄바꿈으로 늘어놓았을 때의 높이. 한 줄(칩 높이)보다 크면 넘친다. */
  const [wrappedHeight, setWrappedHeight] = useState(0)

  useEffect(() => {
    setExpanded(false)
  }, [selection])

  // 화면 동안 바뀌지 않는 값이라 처음 한 번만 잰다.
  const [desktop] = useState(isDesktopPointer)

  if (!desktop) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={contentContainerStyle}>
        {children}
      </ScrollView>
    )
  }

  const overflowing = wrappedHeight > CHIP_HEIGHT + 1
  const moreButton = (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => setExpanded((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={expanded ? '칩 접기' : '칩 모두 보기'}
      accessibilityState={{ expanded }}
      style={[chipStyles.chip, styles.more]}
    >
      <Ionicons name={expanded ? 'chevron-up' : 'ellipsis-horizontal'} size={16} color={COLORS.primary} />
    </TouchableOpacity>
  )

  // 칩을 줄바꿈으로 늘어놓는다. 접히면 첫 줄만 보이고(11-16 사용자 — 가로로 밀던 줄은 끝 칩이 반쯤 잘려 보였다) 나머지는 ⋯ 로
  // 펼친다. 펼쳐도 버튼은 첫 줄 오른쪽 같은 자리에 두어 그 자리를 다시 누르면 접힌다(11-16 사용자). 넘치지 않으면 줄은 칩 너비만큼이라
  // 칩 오른쪽 빈 자리를 눌러도 지도가 눌린다.
  return (
    <View style={[style, overflowing && styles.fullWidth, styles.row]}>
      <View style={[styles.clip, !expanded && styles.oneLine, overflowing && styles.clipShrink]}>
        <View
          style={[contentContainerStyle, styles.wrap, overflowing && styles.noRightPad]}
          onLayout={(e) => setWrappedHeight(e.nativeEvent.layout.height)}
        >
          {children}
        </View>
      </View>
      {overflowing && <View style={styles.moreSlot}>{moreButton}</View>}
    </View>
  )
}

const CHIP_HEIGHT = 32

const styles = StyleSheet.create({
  // 웹은 줄을 화면 폭까지 두어 넘침을 재고 버튼 자리를 오른쪽 끝에 둔다.
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  clip: { overflow: 'hidden', flexShrink: 1, minWidth: 0 },
  oneLine: { height: CHIP_HEIGHT },
  clipShrink: { flex: 1 },
  noRightPad: { paddingRight: 0 },
  moreSlot: { paddingLeft: 4, paddingRight: 16 },
  // 테두리는 다른 칩과 같게(chipStyles.chip) — 남색 테두리만 따로 튀어 보였다(11-16 사용자).
  more: { paddingHorizontal: 9 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 7 },
})
