import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { floorChipLabel, floorOptions, searchBuildings, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import { fillTiesUpward, filterFloors, floorsOutsideBuilding, groupLevels, parseFloorInput, removeBuildingLevels, toggleFloor } from '../../utils/pathSurveyV3/levels'
import { sameLevel, type LevelPair, type LevelRef } from '../../utils/pathSurveyV3/types'
import { Btn, Row, ui } from '../pathSurvey/ui'
import { Chip, levelName } from './controls'
import { buildingColor } from './mapState'

/** Building and floor pickers shared by the context bar and the sheets. Typing here never touches the store. */

export function BuildingSearch({
  index,
  onPick,
  exclude = [],
  selected,
}: {
  index: BuildingIndex
  onPick: (code: string) => void
  exclude?: readonly string[]
  selected?: string | null
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchBuildings(index, query).filter((b) => !exclude.includes(b.code)), [index, query, exclude])
  return (
    <View style={styles.block}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="건물 찾기 (K, M, D2, 조형관)"
        autoCapitalize="none"
        autoCorrect={false}
        style={ui.input}
        accessibilityLabel="건물 찾기"
      />
      <View style={styles.wrap}>
        {results.map((b) => (
          <Chip
            key={b.code}
            label={query.trim() ? b.name : shortBuildingName(b)}
            on={selected === b.code}
            color={buildingColor(index, b.code)}
            onPress={() => {
              setQuery('')
              onPick(b.code)
            }}
          />
        ))}
        {results.length === 0 ? <Text style={ui.hint}>{'찾는 건물이 없어요.'}</Text> : null}
      </View>
    </View>
  )
}

export function FloorPicker({
  index,
  building,
  selected,
  used = [],
  single = false,
  onToggle,
  onSetMany,
}: {
  index: BuildingIndex
  building: string
  selected: readonly number[]
  used?: readonly number[]
  single?: boolean
  onToggle: (floor: number) => void
  /** Check or uncheck everything shown at once. Not offered when only one floor is allowed. */
  onSetMany?: (floors: number[], on: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [more, setMore] = useState(false)
  const options = useMemo(() => floorOptions(index.byCode.get(building), used), [index, building, used])
  const all = useMemo(() => [...new Set([...options.main, ...(more ? options.more : []), ...selected])].sort((x, y) => x - y), [options, more, selected])
  const input = useMemo(() => parseFloorInput(query, { includeL: options.main.includes(0) || selected.includes(0) }), [query, options, selected])
  // One typed floor also searches, including behind "more". A range or a list leaves the chips as they are.
  const shown = query.trim() && !input.isList ? filterFloors([...new Set([...all, ...options.more])].sort((x, y) => x - y), query) : all
  const typed = !input.isList && input.floors.length === 1 ? input.floors[0] : null
  const tooMany = single && input.floors.length > 1
  const outside = floorsOutsideBuilding(index.byCode.get(building), selected)

  /** Typed floors are added to what is already selected. */
  const addTyped = () => {
    if (input.floors.length === 0 || tooMany) return
    if (single) {
      if (!selected.includes(input.floors[0])) onToggle(input.floors[0])
    } else if (onSetMany) onSetMany(input.floors, true)
    else input.floors.filter((floor) => !selected.includes(floor)).forEach(onToggle)
    setQuery('')
  }

  return (
    <View style={styles.block}>
      <View style={styles.wrap}>
        {shown.map((floor) => (
          <Chip key={floor} label={floorChipLabel(floor)} on={selected.includes(floor)} color={buildingColor(index, building)} onPress={() => onToggle(floor)} />
        ))}
        {typed !== null && !shown.includes(typed) ? <Chip label={`${floorChipLabel(typed)}층 추가`} onPress={() => onToggle(typed)} /> : null}
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={addTyped}
        placeholder="층 찾기 (2, B1, 1.5, L)"
        autoCapitalize="characters"
        autoCorrect={false}
        style={ui.input}
        accessibilityLabel="층 찾기"
      />
      {input.negative.length ? <Text style={ui.warn}>{`지하는 B 표기만 써요. ${input.negative[0]} 대신 B${input.negative[0].replace(/^-+/, '')} 로 적어 주세요.`}</Text> : null}
      {input.bad.length ? <Text style={ui.warn}>{`읽지 못한 입력: ${input.bad.join(', ')}. 층은 0.5 단위 숫자나 L, B1, 범위는 1-15, B3-5 처럼 적어 주세요.`}</Text> : null}
      {tooMany ? <Text style={ui.warn}>{'이 점은 층을 하나만 고를 수 있어요.'}</Text> : null}
      {input.isList && input.floors.length && !tooMany ? (
        <>
          <Text style={ui.hint}>{`추가할 층: ${input.floors.map(floorChipLabel).join(', ')}`}</Text>
          <Btn label={`${input.floors.length}개 층 추가`} kind="primary" onPress={addTyped} />
        </>
      ) : null}
      {outside.length ? <Text style={ui.warn}>{`건물 층 범위를 벗어난 층 ${outside.length}개 (${outside.map(floorChipLabel).join(', ')})`}</Text> : null}
      <Row>
        {options.more.length ? <Btn label={more ? '층 접기' : '층 더 보기'} onPress={() => setMore((v) => !v)} /> : null}
        {!single && onSetMany ? <Btn label="보이는 층 모두 선택" onPress={() => onSetMany(shown, true)} /> : null}
        {!single && onSetMany && selected.length ? <Btn label="선택 해제" onPress={() => onSetMany([...selected], false)} /> : null}
      </Row>
    </View>
  )
}

/**
 * Levels of one point: floors are chosen per building, because a point on a link between buildings has
 * different floors on each side. single is for entrances, which have exactly one building and floor.
 */
export function LevelEditor({
  index,
  levels,
  used,
  single = false,
  initialBuildings = [],
  onChange,
}: {
  index: BuildingIndex
  levels: readonly LevelRef[]
  used: ReadonlyMap<string, number[]>
  single?: boolean
  initialBuildings?: readonly string[]
  onChange: (levels: LevelRef[]) => void
}) {
  const [extra, setExtra] = useState<string[]>(() => (single ? initialBuildings.slice(0, 1) : [...initialBuildings]))
  const groups = groupLevels(levels)
  const codes = [...groups.map((g) => g.building), ...extra.filter((code) => !groups.some((g) => g.building === code))]
  const shownCodes = single ? codes.slice(-1) : codes

  const setMany = (building: string, floors: number[], on: boolean) => {
    const rest = levels.filter((l) => l.building !== building || !floors.includes(l.floor))
    onChange(on ? [...rest, ...floors.map((floor) => ({ building, floor }))] : rest)
  }

  return (
    <View style={styles.block}>
      {shownCodes.map((code) => (
        <View key={code} style={styles.group}>
          <View style={styles.groupHead}>
            <View style={[styles.swatch, { backgroundColor: buildingColor(index, code) }]} />
            <Text style={ui.rowText}>{index.byCode.get(code)?.name ?? code}</Text>
            <Pressable
              onPress={() => {
                setExtra((list) => list.filter((c) => c !== code))
                onChange(removeBuildingLevels(levels, code))
              }}
              style={styles.remove}
              accessibilityRole="button"
            >
              <Text style={ui.hint}>{single ? '건물 바꾸기' : '이 건물 빼기'}</Text>
            </Pressable>
          </View>
          <FloorPicker
            index={index}
            building={code}
            selected={levels.filter((l) => l.building === code).map((l) => l.floor)}
            used={used.get(code) ?? []}
            single={single}
            onToggle={(floor) => onChange(toggleFloor(levels, code, floor, single))}
            onSetMany={(floors, on) => setMany(code, floors, on)}
          />
        </View>
      ))}
      {single && shownCodes.length ? null : (
        <View style={styles.block}>
          <Text style={ui.sectionHelp}>{shownCodes.length ? '다른 건물 더하기(건물 간 통로 등)' : '건물 고르기'}</Text>
          <BuildingSearch index={index} exclude={shownCodes} onPick={(code) => setExtra((list) => [...new Set([...list, code])])} />
        </View>
      )}
    </View>
  )
}

/**
 * Pairs of levels: ties (same height in two buildings) and edge pairs (which floor connects to which).
 * Pressing one chip on each side adds a pair.
 */
export function PairEditor({
  index,
  left,
  right,
  pairs,
  differentBuilding = false,
  allowFill = false,
  onChange,
}: {
  index: BuildingIndex
  left: readonly LevelRef[]
  right: readonly LevelRef[]
  pairs: readonly LevelPair[]
  differentBuilding?: boolean
  allowFill?: boolean
  onChange: (pairs: LevelPair[]) => void
}) {
  const [first, setFirst] = useState<LevelRef | null>(null)
  const rightOptions = first ? right.filter((l) => (differentBuilding ? l.building !== first.building : !sameLevel(l, first))) : []
  return (
    <View style={styles.block}>
      {pairs.map(([x, y], i) => (
        <View key={`${x.building}:${x.floor}=${y.building}:${y.floor}`} style={ui.listRow}>
          <Text style={ui.rowText}>{`${levelName(index, x)} = ${levelName(index, y)}`}</Text>
          <Btn label="지우기" onPress={() => onChange(pairs.filter((_, k) => k !== i))} style={{ flexGrow: 0 }} />
        </View>
      ))}
      <Text style={ui.sectionHelp}>{first ? `${levelName(index, first)} 와 이어질 층을 고르세요` : '먼저 한쪽 층을 고르세요'}</Text>
      <View style={styles.wrap}>
        {(first ? rightOptions : left).map((level) => (
          <Chip
            key={`${level.building}:${level.floor}`}
            label={levelName(index, level)}
            onPress={() => {
              if (!first) return setFirst(level)
              if (!pairs.some(([x, y]) => sameLevel(x, first) && sameLevel(y, level))) onChange([...pairs, [first, level]])
              setFirst(null)
            }}
          />
        ))}
      </View>
      <Row>
        {first ? <Btn label="다시 고르기" onPress={() => setFirst(null)} /> : null}
        {allowFill && pairs.length ? (
          <Btn label="마지막 짝부터 위층까지 채우기" onPress={() => onChange(fillTiesUpward(left, pairs, pairs[pairs.length - 1]))} />
        ) : null}
      </Row>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  group: { gap: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8FAFC' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 14, height: 14, borderRadius: 3 },
  remove: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
})
