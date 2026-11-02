import { StyleSheet, Text, View } from 'react-native'
import { NODE_KIND_INFO, PALETTE, STAIRS_COLOR, type SurveyNodeKind } from '../../utils/pathSurveyStore'
import { Section, ui } from './ui'

/** 지도 범례. 간선 종류(일반은 모듈 색, 계단은 모든 모듈에서 같은 색)와 지점 성질 색. */
export default function Legend({ color }: { color?: string }) {
  return (
    <Section title="범례">
      <View style={styles.grid}>
        <View style={styles.item}>
          <View style={[styles.line, { backgroundColor: color ?? PALETTE[0] }]} />
          <Text style={ui.hint}>일반 간선 (모듈 색)</Text>
        </View>
        <View style={styles.item}>
          <View style={[styles.line, styles.stairs]}>
            <View style={styles.stairsDash} />
          </View>
          <Text style={ui.hint}>계단 간선 (모든 모듈 같은 색)</Text>
        </View>
        {(Object.keys(NODE_KIND_INFO) as SurveyNodeKind[]).map((kind) => (
          <View key={kind} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: NODE_KIND_INFO[kind].color }]} />
            <Text style={ui.hint}>{`${NODE_KIND_INFO[kind].label} 지점`}</Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  line: { width: 26, height: 5, borderRadius: 3 },
  stairs: { height: 7, backgroundColor: STAIRS_COLOR, justifyContent: 'center', paddingHorizontal: 3 },
  stairsDash: { height: 0, borderTopWidth: 2, borderColor: '#FFFFFF', borderStyle: 'dashed' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' },
})
