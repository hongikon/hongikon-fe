import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'

/*
 * 반경별 예시 그림(11-01). 홍대 앞 골목을 단순화한 거리 — 폭 6m·깊이 12m 가게가 8m 길 양쪽에 늘어서고,
 * 가게 10곳마다 6m 골목, 줄 사이 3m 뒷길. 가운데 진한 가게가 알림 대상이고, 원에 걸리는 가게를 옅게 칠한다.
 * 실제 판정은 GPS 오차를 반경에 더해 주므로(rules.preciselyInside, 최대 15m) 점선으로 그만큼 바깥도 그린다.
 */
const SHOP_W = 6
const SHOP_D = 12
const STREET = 8
const BACK_ALLEY = 3
const ROW_PERIOD = SHOP_D * 2 + STREET + BACK_ALLEY
const SHOPS_PER_BLOCK = 10
const CROSS_STREET = 6
const BLOCK_PERIOD = SHOPS_PER_BLOCK * SHOP_W + CROSS_STREET
/** 대상 가게가 블록 가운데쯤 오도록 블록 시작점을 옮긴다. */
const BLOCK_ORIGIN = -SHOP_W / 2 - 5 * SHOP_W
/** 대상 가게 가운데(업체 좌표). */
const CENTER = { x: 0, y: -SHOP_D / 2 }
const GPS_ALLOWANCE_METERS = 15

interface Shop {
  x: number
  y: number
}

function shopsAround(half: number): Shop[] {
  const shops: Shop[] = []
  const minX = CENTER.x - half
  const maxX = CENTER.x + half
  const minY = CENTER.y - half
  const maxY = CENTER.y + half
  const firstRow = Math.floor((minY - SHOP_D - STREET - SHOP_D) / ROW_PERIOD)
  const lastRow = Math.ceil(maxY / ROW_PERIOD)
  const firstBlock = Math.floor((minX - BLOCK_ORIGIN) / BLOCK_PERIOD) - 1
  const lastBlock = Math.ceil((maxX - BLOCK_ORIGIN) / BLOCK_PERIOD)
  for (let row = firstRow; row <= lastRow; row++) {
    const base = row * ROW_PERIOD
    for (const y of [base - SHOP_D, base + STREET]) {
      if (y + SHOP_D < minY || y > maxY) continue
      for (let block = firstBlock; block <= lastBlock; block++) {
        const start = BLOCK_ORIGIN + block * BLOCK_PERIOD
        for (let i = 0; i < SHOPS_PER_BLOCK; i++) {
          const x = start + i * SHOP_W
          if (x + SHOP_W < minX || x > maxX) continue
          shops.push({ x, y })
        }
      }
    }
  }
  return shops
}

/** 가게 네모에서 업체 좌표까지 가장 가까운 거리. */
function distanceToShop(shop: Shop): number {
  const dx = Math.max(shop.x - CENTER.x, 0, CENTER.x - (shop.x + SHOP_W))
  const dy = Math.max(shop.y - CENTER.y, 0, CENTER.y - (shop.y + SHOP_D))
  return Math.hypot(dx, dy)
}

function rectPath(shops: Shop[]): string {
  return shops.map((s) => `M${s.x} ${s.y}h${SHOP_W}v${SHOP_D}h${-SHOP_W}z`).join('')
}

function isTarget(shop: Shop): boolean {
  return shop.x === -SHOP_W / 2 && shop.y === -SHOP_D
}

function RadiusExample({ meters }: { meters: number }) {
  const drawing = useMemo(() => {
    const half = Math.max(meters + GPS_ALLOWANCE_METERS, meters * 1.4) + 4
    const shops = shopsAround(half)
    const others = shops.filter((s) => !isTarget(s))
    const caught = others.filter((s) => distanceToShop(s) <= meters)
    return {
      viewBox: `${CENTER.x - half} ${CENTER.y - half} ${half * 2} ${half * 2}`,
      all: rectPath(others),
      caught: rectPath(caught),
      caughtCount: caught.length,
      // 넓은 그림에선 가게 한 칸이 점보다 작아져, 대상 위치를 그림 크기에 맞춘 점으로도 찍는다.
      pinRadius: half * 0.045,
      // 작은 그림에서 가게 경계선이 너무 촘촘하면 선만 보여 넓을 땐 뺀다.
      outlines: half <= 80,
    }
  }, [meters])

  return (
    <>
      <View style={styles.canvas}>
        <Svg width="100%" height="100%" viewBox={drawing.viewBox}>
          <Rect x={CENTER.x - 1000} y={CENTER.y - 1000} width={2000} height={2000} fill={COLORS.white} />
          <Path
            d={drawing.all}
            fill="#E5E7EB"
            stroke={drawing.outlines ? COLORS.white : 'none'}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <Path
            d={drawing.caught}
            fill="#C7CCE6"
            stroke={drawing.outlines ? COLORS.white : 'none'}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <Rect x={-SHOP_W / 2} y={-SHOP_D} width={SHOP_W} height={SHOP_D} fill={COLORS.primary} />
          <Circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={meters + GPS_ALLOWANCE_METERS}
            fill="none"
            stroke={COLORS.primary}
            strokeOpacity={0.6}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          <Circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={meters}
            fill={COLORS.primary}
            fillOpacity={0.12}
            stroke={COLORS.primary}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {drawing.pinRadius > SHOP_W / 2 && (
            <Circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={drawing.pinRadius}
              fill={COLORS.primary}
              stroke={COLORS.white}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </Svg>
      </View>
      <Text style={styles.caption}>{drawing.caughtCount > 0 ? `주변 가게 ${drawing.caughtCount}곳까지` : '그 가게 안·문 앞만'}</Text>
    </>
  )
}

/**
 * 알림 반경 고르기 아래 그림 — 반경마다 주변 가게가 얼마나 걸리는지 비교해 보고 눌러서 고른다.
 * 실선 원이 반경, 점선 원이 GPS 오차를 더해 줄 수 있는 가장 바깥(반경 + 15m).
 */
export default function NearbyRadiusExamples({
  options,
  selected,
  disabled,
  onSelect,
}: {
  options: readonly number[]
  selected: number
  disabled?: boolean
  onSelect: (meters: number) => void
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {options.map((meters) => {
          const on = meters === selected
          return (
            <Pressable
              key={meters}
              onPress={() => onSelect(meters)}
              disabled={disabled || on}
              style={[styles.tile, on && styles.tileOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`알림 반경 ${meters}미터 예시 그림`}
            >
              <Text style={[styles.label, on && styles.labelOn]}>{meters}m</Text>
              <RadiusExample meters={meters} />
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.legend}>
        진한 칸이 알림 대상 가게, 옅게 칠한 칸이 반경에 걸리는 가게예요(폭 6m 가게가 8m 길 양쪽에 있다고 보고 그렸어요). 점선은 GPS 오차를 더해 줄
        수 있는 가장 바깥(반경 + {GPS_ALLOWANCE_METERS}m)이에요. 그림은 축척이 서로 달라요.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '31.5%',
    padding: 6,
    gap: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tileOn: { borderColor: COLORS.primary, borderWidth: 2, padding: 5 },
  canvas: { width: '100%', aspectRatio: 1, borderRadius: 6, overflow: 'hidden' },
  label: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  labelOn: { color: COLORS.primary },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  legend: { fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textTertiary },
})
