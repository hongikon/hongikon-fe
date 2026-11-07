import { StyleSheet, Text, View } from 'react-native'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { CheckIssue } from '../../utils/pathSurveyV3/check'
import { commonLevels } from '../../utils/pathSurveyV3/expand'
import { setEdgeKind, setEdgePairs, type StoreV3 } from '../../utils/pathSurveyV3/store'
import type { EdgeKind, SurveyEdgeV3, SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { Btn, Section, ui } from '../pathSurvey/ui'
import { MemoBox, Segmented } from './controls'
import { PairEditor } from './LevelPicker'

const KINDS: { key: EdgeKind; label: string }[] = [
  { key: 'normal', label: '일반' },
  { key: 'stairs', label: '계단' },
]

/** Quick change sheet for one edge. Floor pairs only show up when this edge needs them or already has them. */
export default function EdgeSheet({
  edge,
  a,
  b,
  index,
  issues,
  onChange,
  onMemo,
  onDelete,
  onClose,
}: {
  edge: SurveyEdgeV3
  a: SurveyNodeV3 | undefined
  b: SurveyNodeV3 | undefined
  index: BuildingIndex
  issues: readonly CheckIssue[]
  onChange: (fn: (s: StoreV3) => StoreV3) => void
  onMemo: (text: string, first: boolean) => void
  onDelete: () => void
  onClose: () => void
}) {
  const bothIndoor = a?.scope === 'indoor' && b?.scope === 'indoor'
  const needsPairs =
    !!edge.pairs?.length ||
    (bothIndoor && commonLevels(a, b).length === 0 && !((a.levels?.length ?? 0) === 1 && (b.levels?.length ?? 0) === 1) && !!a.levels?.length && !!b.levels?.length)
  return (
    <Section title={`간선 ${edge.id} (${edge.a}, ${edge.b})`}>
      {issues.map((issue, i) => (
        <Text key={`${issue.code}:${i}`} style={issue.severity === 'error' ? ui.error : ui.warn}>
          {issue.message}
        </Text>
      ))}
      <Segmented value={edge.kind} options={KINDS} onChange={(kind) => onChange((s) => setEdgeKind(s, edge.id, kind))} />
      {needsPairs && a && b ? (
        <View style={styles.block}>
          <Text style={ui.sectionHelp}>{`층 짝: 왼쪽은 ${a.id}, 오른쪽은 ${b.id} 의 층이에요.`}</Text>
          <PairEditor index={index} left={a.levels ?? []} right={b.levels ?? []} pairs={edge.pairs ?? []} onChange={(pairs) => onChange((s) => setEdgePairs(s, edge.id, pairs))} />
        </View>
      ) : null}
      <MemoBox value={edge.memo} onEdit={onMemo} />
      <View style={styles.actions}>
        <Btn label="닫기" onPress={onClose} />
        <Btn label="이 간선 지우기" kind="danger" onPress={onDelete} />
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
})
