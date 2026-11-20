import { StyleSheet, Text, View } from 'react-native'
import type { GraphVersionSummary } from '../../apis/routeGraph'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import type { BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { offerText, type ServerOffer } from '../../utils/pathSurveyV3/serverSave'
import type { WorkContext } from '../../utils/pathSurveyV3/transfer'
import { Btn } from '../pathSurvey/ui'
import ContextBar from './ContextBar'
import { ChainToggle } from './controls'
import type { MapMode } from './mapState'
import SaveBar from './SaveBar'
import { MODES } from './screenModel'

type SaveBarProps = Parameters<typeof SaveBar>[0]

interface Props {
  saveBar: SaveBarProps
  offer: ServerOffer<GraphVersionSummary> | null
  serverSaving: boolean
  onAcceptOffer: () => void
  onCloseOffer: () => void
  mode: MapMode
  onMode: (mode: MapMode) => void
  chain: boolean
  onToggleChain: () => void
  index: BuildingIndex
  context: WorkContext
  used: ReadonlyMap<string, number[]>
  closeSignal: string | null
  onContext: (next: WorkContext) => void
}

/** Top bar of the v3 survey: save line, server offer, map modes, chain toggle, new point context. */
export default function SurveyTopBar({ saveBar, offer, serverSaving, onAcceptOffer, onCloseOffer, mode, onMode, chain, onToggleChain, index, context, used, closeSignal, onContext }: Props) {
  return (
    <View style={styles.topBar}>
      <SaveBar {...saveBar} />
      {offer ? (
        <View style={styles.offer}>
          <Text style={styles.offerText}>{offerText(offer)}</Text>
          <View style={styles.offerRow}>
            <Btn label={offer.kind === 'baseline' ? '서버에 저장' : '서버에서 불러오기'} kind="primary" onPress={onAcceptOffer} disabled={serverSaving} />
            <Btn label="닫기" onPress={onCloseOffer} />
          </View>
        </View>
      ) : null}
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Btn key={m.key} label={m.label} kind={mode === m.key ? 'active' : 'default'} onPress={() => onMode(m.key)} style={{ flex: 1 }} />
        ))}
      </View>
      <ChainToggle visible={mode === 'add'} on={chain} onToggle={onToggleChain} />
      <ContextBar index={index} context={context} used={used} closeSignal={closeSignal} onChange={onContext} />
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  modeRow: { flexDirection: 'row', gap: 6 },
  offer: { padding: 8, gap: 6, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  offerText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#1E3A8A' },
  offerRow: { flexDirection: 'row', gap: 6 },
})
