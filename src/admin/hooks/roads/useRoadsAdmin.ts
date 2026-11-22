import { useMemo, useRef, useState } from 'react'
import { Platform, type GestureResponderEvent, type View } from 'react-native'
import { createWalkRestriction, deleteWalkRestriction, fetchWalkGraph, fetchWalkRestrictions } from '../../api'
import type { AdminWalkGraph, AdminWalkRestriction, WalkRestrictionKind, WalkRestrictionPurpose } from '../../types'
import { mapLoadErrorMessage, mapWriteErrorMessage } from '../../utils/facilities/mapForm'
import { activeTargets, buildRoadInput, buildRoadMap, emptyRoadDraft, filterEntrances, pickAt, type RoadDraft } from '../../utils/roads/roadMap'
import { useAdminLoad } from '../common/useAdminLoad'

/** 1배일 때 그림이 들어갈 칸(px). 확대는 여기에 곱한다(넘치면 지도 칸 안에서 스크롤). */
const MAP_WIDTH = 880
const MAP_HEIGHT = 600

/**
 * 길 관리 화면의 상태: 경로망·제한 목록 불러오기, 지도에서 구간·출입구 고르기, 새 제한 저장, 풀기.
 */
export function useRoadsAdmin() {
  const [graph, setGraph] = useState<AdminWalkGraph | null>(null)
  const list = useAdminLoad(
    (signal) =>
      Promise.all([fetchWalkRestrictions(signal), fetchWalkGraph(signal)]).then(([restrictions, walkGraph]) => {
        setGraph(walkGraph)
        return restrictions
      }),
    (err) => mapLoadErrorMessage(err, '길 정보를 불러오지 못했습니다.'),
    [],
  )
  const restrictions = list.data ?? []
  const [zoom, setZoom] = useState(1)
  const [draft, setDraft] = useState<RoadDraft>(emptyRoadDraft())
  const [entranceQuery, setEntranceQuery] = useState('')
  const [buildingQuery, setBuildingQuery] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const roadMap = useMemo(() => (graph ? buildRoadMap(graph, MAP_WIDTH * zoom, MAP_HEIGHT * zoom) : null), [graph, zoom])
  const blocked = useMemo(
    () => ({
      closure: {
        edges: activeTargets(restrictions, 'EDGE', 'CLOSURE'),
        entrances: activeTargets(restrictions, 'ENTRANCE', 'CLOSURE'),
        buildings: activeTargets(restrictions, 'BUILDING_PASS', 'CLOSURE'),
      },
      rule: {
        edges: activeTargets(restrictions, 'EDGE', 'RULE'),
        entrances: activeTargets(restrictions, 'ENTRANCE', 'RULE'),
        buildings: activeTargets(restrictions, 'BUILDING_PASS', 'RULE'),
      },
    }),
    [restrictions],
  )
  const closures = useMemo(() => restrictions.filter((r) => r.purpose === 'CLOSURE'), [restrictions])
  const rules = useMemo(() => restrictions.filter((r) => r.purpose === 'RULE'), [restrictions])
  const entranceOptions = useMemo(
    () => filterEntrances(roadMap?.entrances ?? [], entranceQuery).slice(0, 40),
    [roadMap, entranceQuery],
  )
  const buildingOptions = useMemo(() => {
    const q = buildingQuery.trim()
    const all = [...(graph?.buildings ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    return q ? all.filter((b) => b.name.includes(q) || b.code.includes(q)) : all
  }, [graph, buildingQuery])

  const setKind = (kind: WalkRestrictionKind) => {
    setDraft((d) => ({ ...emptyRoadDraft(kind, d.purpose), cause: d.cause }))
    setErrors([])
  }
  /** 임시 통제 ↔ 상시 규칙. 고른 대상은 그대로 둔다. */
  const setPurpose = (purpose: WalkRestrictionPurpose) => {
    setDraft((d) => ({ ...d, purpose }))
    setErrors([])
  }
  const update = (patch: Partial<RoadDraft>) => setDraft((d) => ({ ...d, ...patch }))
  /** 지도에서 구간을 누르면 '길 구간 막기'로, 출입구를 누르면 '출입구 닫기'로 고른다. */
  const mapPressRef = useRef<View | null>(null)
  const onMapPress = (event: GestureResponderEvent) => {
    if (!roadMap) return
    let x = event.nativeEvent.locationX
    let y = event.nativeEvent.locationY
    if (Platform.OS === 'web') {
      // 웹의 location 은 눌린 안쪽 요소 기준이라, 누름 칸의 화면 위치로 다시 잰다.
      const node = mapPressRef.current as unknown as { getBoundingClientRect?: () => { left: number; top: number } } | null
      const rect = node?.getBoundingClientRect?.()
      const page = event.nativeEvent as unknown as { clientX?: number; clientY?: number; pageX: number; pageY: number }
      if (rect) {
        x = (page.clientX ?? page.pageX) - rect.left
        y = (page.clientY ?? page.pageY) - rect.top
      }
    }
    const pick = pickAt(roadMap, x, y)
    if (pick?.kind === 'EDGE') setDraft((d) => ({ ...d, kind: 'EDGE', target: pick.key }))
    else if (pick?.kind === 'ENTRANCE') setDraft((d) => ({ ...d, kind: 'ENTRANCE', target: pick.label }))
  }

  const save = async () => {
    const result = buildRoadInput(draft)
    setErrors(result.errors)
    if (!result.input) return
    setSaving(true)
    try {
      const saved = await createWalkRestriction(result.input)
      list.setData((prev) => [...(prev ?? []), saved])
      setNotice(
        saved.purpose === 'RULE'
          ? `${saved.label} — 상시 길 규칙으로 넣었습니다. 길찾기가 늘 이곳을 피합니다.`
          : `${saved.label} — 임시 통제를 넣었습니다. 기간 동안 길찾기가 피하고 앱 길찾기 지도에 금지 표시가 뜹니다.`,
      )
      setDraft(emptyRoadDraft(draft.kind, draft.purpose))
    } catch (err) {
      setErrors([mapWriteErrorMessage(err, '저장하지 못했습니다.')])
    } finally {
      setSaving(false)
    }
  }

  const remove = async (restriction: AdminWalkRestriction) => {
    setRemovingId(restriction.id)
    try {
      await deleteWalkRestriction(restriction.id)
      list.setData((prev) => (prev ?? []).filter((r) => r.id !== restriction.id))
      setNotice(`${restriction.label} — 풀었습니다.`)
      setConfirmingId(null)
    } catch (err) {
      list.setError(mapWriteErrorMessage(err, '풀지 못했습니다.'))
    } finally {
      setRemovingId(null)
    }
  }

  return {
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    restrictions,
    roadMap,
    zoom,
    setZoom,
    blocked,
    closures,
    rules,
    draft,
    setKind,
    setPurpose,
    update,
    mapPressRef,
    onMapPress,
    entranceQuery,
    setEntranceQuery,
    entranceOptions,
    buildingQuery,
    setBuildingQuery,
    buildingOptions,
    errors,
    saving,
    save,
    notice,
    confirmingId,
    setConfirmingId,
    removingId,
    remove,
  }
}
