import { useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import type { Building } from '../../types'
import { formatFloor } from '../../utils/floors'
import { isHexColor, PALETTE, type SurveyModule, type SurveyPlace } from '../../utils/pathSurveyStore'
import { Btn, Section, TOUCH, ui } from './ui'

/** '2' → 2, '-1'·'B1'·'b1' → -1. 0층이나 숫자가 아니면 null. */
export function parseFloor(text: string): number | null {
  const t = text.trim()
  const b = /^[Bb](\d+)[Ff]?$/.exec(t)
  if (b) return Number(b[1]) ? -Number(b[1]) : null
  const m = /^(-?\d+)[Ff]?$/.exec(t)
  if (!m) return null
  const n = Number(m[1])
  return n === 0 ? null : n
}

/**
 * 모듈 속성: 색(기본 12색 + 직접 추가한 색), 장소(이 층위가 지나는 건물/층, 여러 개), 메모.
 * 장소의 건물/층이 서로 달라도 같은 층위로 본다 — 층 번호가 맞는지는 따지지 않는다.
 */
export default function ModuleProps({
  module,
  customColors,
  buildings,
  onChange,
  onAddColor,
  onNotice,
}: {
  module: SurveyModule
  customColors: readonly string[]
  buildings: readonly Building[]
  onChange: (fn: (m: SurveyModule) => SurveyModule, record?: boolean) => void
  onAddColor: (color: string) => void
  onNotice: (text: string) => void
}) {
  const [colorText, setColorText] = useState('#')
  const [name, setName] = useState('')
  const [buildingId, setBuildingId] = useState<number | undefined>(undefined)
  const [floorText, setFloorText] = useState('')
  const [label, setLabel] = useState('')

  const suggestions = useMemo(() => {
    const q = name.trim()
    if (!q || buildings.some((b) => b.name === q)) return []
    return buildings.filter((b) => b.name.includes(q)).slice(0, 6)
  }, [name, buildings])

  const addColor = () => {
    const c = colorText.trim()
    if (!isHexColor(c)) return onNotice('색은 #RRGGBB 모양으로 적어 주세요 (예: #1E3A8A)')
    onAddColor(c)
    onChange((m) => ({ ...m, color: c.toUpperCase() }))
    setColorText('#')
  }

  const addPlace = () => {
    const buildingName = name.trim()
    const floor = parseFloor(floorText)
    if (!buildingName) return onNotice('건물을 고르거나 이름을 적어 주세요')
    if (floor === null) return onNotice('층은 1, 2, ... 또는 지하 B1(-1), B2(-2) 로 적어 주세요')
    const known = buildings.find((b) => b.name === buildingName)
    const place: SurveyPlace = { buildingName, floor }
    const id = buildingId ?? known?.id
    if (id !== undefined && known?.name === buildingName) place.buildingId = id
    if (label.trim()) place.label = label.trim()
    onChange((m) => ({ ...m, places: [...m.places, place] }))
    setName('')
    setBuildingId(undefined)
    setFloorText('')
    setLabel('')
  }

  const removePlace = (index: number) => {
    if (module.status === 'done' && module.places.length <= 1) {
      return onNotice('완료한 모듈은 장소가 1개 이상 있어야 해요. 먼저 "다시 편집"을 누르거나 다른 장소를 추가하세요.')
    }
    onChange((m) => ({ ...m, places: m.places.filter((_, i) => i !== index) }))
  }

  const colors = [...PALETTE, ...customColors]

  return (
    <View style={{ gap: 14 }}>
      <Section title="색" help="지점은 이 색을 어둡게 한 원 + 흰 테두리, 간선은 이 색 선이에요. 작성 중 모듈의 간선은 점선이에요.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {colors.map((c) => {
            const on = module.color.toUpperCase() === c.toUpperCase()
            return (
              <Pressable
                key={c}
                onPress={() => onChange((m) => ({ ...m, color: c }))}
                accessibilityRole="button"
                accessibilityLabel={`색 ${c}`}
                accessibilityState={{ selected: on }}
                style={{
                  width: TOUCH,
                  height: TOUCH,
                  borderRadius: 8,
                  backgroundColor: c,
                  borderWidth: on ? 4 : 0,
                  borderColor: '#111827',
                }}
              />
            )
          })}
        </View>
        <View style={ui.btnRow}>
          <TextInput value={colorText} onChangeText={setColorText} placeholder="#RRGGBB" autoCapitalize="characters" style={[ui.input, { flex: 1, minWidth: 120 }]} />
          <Btn label="직접 색 추가" onPress={addColor} style={{ flexGrow: 0 }} />
        </View>
      </Section>

      <Section title={`장소 ${module.places.length}`} help="이 층위가 지나는 건물/층을 원하는 만큼 적어요. 건물·층이 달라도 같은 층위로 봐요. 모듈을 마치려면 1개 이상 필요해요.">
        {module.places.map((p, i) => (
          <View key={`${p.buildingName}-${p.floor}-${i}`} style={ui.listRow}>
            <Text style={ui.rowText} numberOfLines={2}>
              {`${p.buildingName} ${formatFloor(p.floor)}${p.label ? ` · ${p.label}` : ''}${p.buildingId === undefined ? ' (직접 입력)' : ''}`}
            </Text>
            <Btn label="삭제" kind="danger" onPress={() => removePlace(i)} style={{ flexGrow: 0 }} />
          </View>
        ))}
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t)
            setBuildingId(undefined)
          }}
          placeholder="건물 (목록에서 고르거나 직접 입력)"
          style={ui.input}
        />
        {suggestions.map((b) => (
          <Pressable
            key={b.id ?? b.name}
            onPress={() => {
              setName(b.name)
              setBuildingId(b.id)
            }}
            style={ui.listRow}
            accessibilityRole="button"
          >
            <Text style={ui.rowText}>{b.name}</Text>
          </Pressable>
        ))}
        <View style={ui.btnRow}>
          <TextInput value={floorText} onChangeText={setFloorText} placeholder="층 (2, B1)" style={[ui.input, { width: 110 }]} />
          <TextInput value={label} onChangeText={setLabel} placeholder="설명 (선택)" style={[ui.input, { flex: 1, minWidth: 120 }]} />
        </View>
        <Btn label="장소 추가" onPress={addPlace} />
      </Section>

      <Section title="모듈 메모">
        <TextInput
          key={`memo-${module.id}`}
          defaultValue={module.memo}
          onChangeText={(text) => onChange((m) => ({ ...m, memo: text }), false)}
          placeholder="이 모듈 전체에 대한 메모"
          multiline
          style={ui.memoInput}
        />
      </Section>
    </View>
  )
}
