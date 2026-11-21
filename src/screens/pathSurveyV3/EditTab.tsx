import { StyleSheet, Text, View } from 'react-native'
import { FONTS } from '../../constants/typography'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { SurveyNodeV3 } from '../../utils/pathSurveyV3/types'
import { Btn, ui } from '../pathSurvey/ui'
import { Chip } from './controls'
import { UNDO_LIMIT } from './editHistory'
import FilterBar from './FilterBar'
import Legend from './Legend'
import type { LabelMode, MapFilter, MapMode } from './mapState'
import { LABEL_MODES, MODES } from './screenModel'

interface Props {
  mode: MapMode
  pending: string | null
  nodes: SurveyNodeV3[]
  index: BuildingIndex
  filter: MapFilter
  onFilter: (next: MapFilter) => void
  onlyFilter: boolean
  onToggleOnlyFilter: () => void
  showChanges: boolean
  onToggleShowChanges: () => void
  changeCounts: Parameters<typeof FilterBar>[0]['changeCounts']
  labelMode: LabelMode
  onLabelMode: (mode: LabelMode) => void
  sampleCount: number
  onAddSample: () => void
  onRemoveSample: () => void
}

/** The edit tab: mode help, floor filter, label mode, legend, development sample points. */
export default function EditTab(props: Props) {
  const { mode, pending, nodes, index, filter, onFilter, onlyFilter, onToggleOnlyFilter, showChanges, onToggleShowChanges, changeCounts, labelMode, onLabelMode, sampleCount, onAddSample, onRemoveSample } = props
  const activeMode = MODES.find((m) => m.key === mode)!
  return (
    <>
      <Text style={ui.hint}>{activeMode.help}</Text>
      {mode === 'link' && pending ? <Text style={styles.pending}>{`${pending} 에서 시작, 이을 점을 누르세요`}</Text> : null}
      <FilterBar
        nodes={nodes}
        index={index}
        filter={filter}
        onChange={onFilter}
        onlyFilter={onlyFilter}
        onToggleOnlyFilter={onToggleOnlyFilter}
        showChanges={showChanges}
        onToggleShowChanges={onToggleShowChanges}
        changeCounts={changeCounts}
      />
      <View style={styles.labelRow}>
        <Text style={ui.sectionHelp}>{'라벨 보기'}</Text>
        {LABEL_MODES.map((m) => (
          <Chip key={m.key} label={m.label} on={labelMode === m.key} onPress={() => onLabelMode(m.key)} />
        ))}
      </View>
      <Text style={ui.sectionHelp}>{`되돌리기와 다시(되돌리기 취소)는 ${UNDO_LIMIT}단계까지이고, 새로고침하면 기록이 사라져요. 되돌린 뒤 새로 고치면 다시 기록은 지워져요.`}</Text>
      <Legend index={index} />
      {__DEV__ ? <Btn label="표시 확인용 예시 넣기(개발 전용)" onPress={onAddSample} /> : null}
      {sampleCount ? <Btn label={`예시 점 제거 (${sampleCount}개)`} kind="danger" onPress={onRemoveSample} /> : null}
    </>
  )
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pending: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#EA580C' },
})
