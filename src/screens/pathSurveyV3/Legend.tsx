import { StyleSheet, Text, View } from 'react-native'
import { shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { Section, ui } from '../pathSurvey/ui'
import { BUILDING_COLORS, NEUTRAL_COLOR, NEUTRAL_EDGE_COLOR, OUTDOOR_COLOR, STAIRS_COLOR } from './mapState'

const GRAY = '#475569'

/** Legend for the v3 rules: color is location, shape is type. */
export default function Legend({ index }: { index: BuildingIndex }) {
  return (
    <Section title="범례" help="색은 위치, 모양은 종류예요.">
      <View style={styles.grid}>
        <View style={styles.item}>
          <View style={[styles.circle, { backgroundColor: GRAY }]} />
          <Text style={ui.hint}>{'기본'}</Text>
        </View>
        <View style={styles.item}>
          <View style={[styles.square, { backgroundColor: GRAY }]} />
          <Text style={ui.hint}>{'출입구'}</Text>
        </View>
        <View style={styles.item}>
          <View style={[styles.diamond, { backgroundColor: GRAY }]} />
          <Text style={ui.hint}>{'엘리베이터'}</Text>
        </View>
        <View style={styles.item}>
          <View style={styles.triangle} />
          <Text style={ui.hint}>{'계단'}</Text>
        </View>
        <View style={styles.item}>
          <View style={[styles.circle, styles.multi]} />
          <Text style={ui.hint}>{'여러 건물에 걸친 점(테두리)'}</Text>
        </View>
      </View>
      <View style={styles.grid}>
        <View style={styles.item}>
          <View style={[styles.line, { backgroundColor: OUTDOOR_COLOR }]} />
          <Text style={ui.hint}>{'외부'}</Text>
        </View>
        <View style={styles.item}>
          <View style={styles.dashed} />
          <Text style={ui.hint}>{'점선: 출입구 간선, 건물 간 통로'}</Text>
        </View>
        <View style={styles.item}>
          <View style={[styles.line, styles.stairs]}>
            <View style={styles.stairsDash} />
          </View>
          <Text style={ui.hint}>{'진한 선 + 흰 점선: 계단 간선'}</Text>
        </View>
      </View>
      <Text style={ui.hint}>{'내부 점과 내부 간선은 건물 색이에요.'}</Text>
      <View style={styles.grid}>
        {index.list.map((b) => (
          <View key={b.code} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: BUILDING_COLORS[b.order % BUILDING_COLORS.length] }]} />
            <Text style={ui.hint}>{shortBuildingName(b)}</Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  circle: { width: 13, height: 13, borderRadius: 7 },
  square: { width: 13, height: 13, borderRadius: 2 },
  diamond: { width: 11, height: 11, transform: [{ rotate: '45deg' }], margin: 1 },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 13,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: GRAY,
  },
  multi: { backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: NEUTRAL_COLOR },
  line: { width: 26, height: 5, borderRadius: 3 },
  dashed: { width: 26, height: 0, borderTopWidth: 4, borderStyle: 'dashed', borderColor: NEUTRAL_EDGE_COLOR },
  stairs: { height: 7, backgroundColor: STAIRS_COLOR, justifyContent: 'center', paddingHorizontal: 3 },
  stairsDash: { height: 0, borderTopWidth: 2, borderColor: '#FFFFFF', borderStyle: 'dashed' },
  swatch: { width: 12, height: 12, borderRadius: 3 },
})
