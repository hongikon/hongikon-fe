import { STAIRS_COLOR } from '../../utils/pathSurveyStore'
import { floorChipLabel, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import type { NodeType, SurveyEdgeV3, SurveyNodeV3 } from '../../utils/pathSurveyV3/types'

/**
 * Turns the store into what the map draws. Pure so that the rules can be tested without a map.
 * Color means location and shape means type.
 */

export const OUTDOOR_COLOR = '#64748B'
export const NEUTRAL_COLOR = '#A8A29E'
/** Outdoor to entrance edges and links between buildings: told apart by the dashed style, dark enough to read as dashes. */
export const NEUTRAL_EDGE_COLOR = '#57534E'
export const SELECTED_RING = '#111827'
export const PENDING_RING = '#F97316'
export const MULTI_RING = '#7C3AED'
export { STAIRS_COLOR }

/** Twelve colors that stay readable on the map and differ from the outdoor, neutral and stairs colors. */
export const BUILDING_COLORS = [
  '#2563EB',
  '#DC2626',
  '#16A34A',
  '#9333EA',
  '#EA580C',
  '#0891B2',
  '#DB2777',
  '#65A30D',
  '#CA8A04',
  '#4F46E5',
  '#0D9488',
  '#92400E',
] as const

export type NodeShape = 'circle' | 'square' | 'diamond' | 'triangle'

export const SHAPE_OF: Record<NodeType, NodeShape> = { basic: 'circle', entrance: 'square', elevator: 'diamond', stairs: 'triangle' }

export interface MapFilter {
  /** Empty means all buildings. Each selected building has all floors (null) or one floor. */
  selections: readonly { building: string; floor: number | null }[]
}

export const NO_FILTER: MapFilter = { selections: [] }

/** Selected buildings in the order of the server building list. Codes missing from the list go last. */
export function selectionsInListOrder(filter: MapFilter, index: BuildingIndex): MapFilter['selections'] {
  const orderOf = (code: string) => index.byCode.get(code)?.order ?? Number.MAX_SAFE_INTEGER
  return [...filter.selections].sort((x, y) => orderOf(x.building) - orderOf(y.building))
}

export type MapMode = 'add' | 'link' | 'move' | 'select'

/** What the point labels show. */
export type LabelMode = 'none' | 'number' | 'full' | 'selected'

export interface RenderNode {
  id: string
  lat: number
  lng: number
  shape: NodeShape
  fill: string
  ring: string
  ringWidth: number
  size: number
  /** Number part of the id. Empty when this point has no label. */
  num: string
  letter: string
  badge: string
  dim: boolean
  clickable: boolean
  draggable: boolean
  /** Selected points: on top and the label does not depend on the zoom. */
  emphasized: boolean
  /** The next chained point joins this one. */
  anchor: boolean
}

export interface RenderEdge {
  id: string
  a: string
  b: string
  p: [number, number, number, number]
  color: string
  stairs: boolean
  /** Neutral edge drawn with dashes. Stairs have their own look. */
  dashed: boolean
  weight: number
  opacity: number
  clickable: boolean
  /** A dragged node may split this edge. */
  snap: boolean
}

export function buildingColor(index: BuildingIndex, code: string): string {
  const entry = index.byCode.get(code)
  return entry ? BUILDING_COLORS[entry.order % BUILDING_COLORS.length] : NEUTRAL_COLOR
}

/** Strong means drawn at full color. Outdoor points always are. Without a building filter everything is. */
export function isNodeStrong(node: SurveyNodeV3, filter: MapFilter): boolean {
  if (filter.selections.length === 0 || node.scope !== 'indoor') return true
  const levels = node.levels ?? []
  return filter.selections.some(({ building, floor }) => levels.some((l) => l.building === building && (floor === null || l.floor === floor)))
}

/**
 * May this point be pressed, dragged and edited. With "only the filter" off every point may, dim or not.
 * With it on (the default) only strong points may: outdoor points and points matching the filter.
 */
export const isNodeEditable = (node: SurveyNodeV3, filter: MapFilter, onlyFilter: boolean): boolean => !onlyFilter || isNodeStrong(node, filter)

/** An edge may be edited when both end points may. */
export const isEdgeEditable = (a: SurveyNodeV3, b: SurveyNodeV3, filter: MapFilter, onlyFilter: boolean): boolean =>
  isNodeEditable(a, filter, onlyFilter) && isNodeEditable(b, filter, onlyFilter)

/** The ids among these that are points that may be edited. Unknown ids are dropped. */
export function editableNodeIds(store: StoreV3, ids: readonly string[], filter: MapFilter, onlyFilter: boolean): string[] {
  const byId = new Map(store.nodes.map((n) => [n.id, n]))
  return ids.filter((id) => {
    const node = byId.get(id)
    return !!node && isNodeEditable(node, filter, onlyFilter)
  })
}

export function canEditEdge(store: StoreV3, id: string | null, filter: MapFilter, onlyFilter: boolean): boolean {
  const edge = id ? store.edges.find((e) => e.id === id) : undefined
  const a = edge && store.nodes.find((n) => n.id === edge.a)
  const b = edge && store.nodes.find((n) => n.id === edge.b)
  return !!a && !!b && isEdgeEditable(a, b, filter, onlyFilter)
}

export interface EditSelection {
  selected: string | null
  selectedEdge: string | null
  pending: string | null
  multi: readonly string[]
}

/** What stays selected after the filter or the "only the filter" box changed: only what may still be edited. */
export function editableSelection(store: StoreV3, selection: EditSelection, filter: MapFilter, onlyFilter: boolean): EditSelection {
  const keep = (id: string | null) => (id && editableNodeIds(store, [id], filter, onlyFilter).length ? id : null)
  return {
    selected: keep(selection.selected),
    selectedEdge: canEditEdge(store, selection.selectedEdge, filter, onlyFilter) ? selection.selectedEdge : null,
    pending: keep(selection.pending),
    multi: editableNodeIds(store, selection.multi, filter, onlyFilter),
  }
}

const buildingsOf = (node: SurveyNodeV3) => [...new Set((node.levels ?? []).map((l) => l.building))]

/** An edge from outdoors to indoors, or a link between buildings. Display only: the check rules do not use this. */
export function isNeutralEdge(a: SurveyNodeV3, b: SurveyNodeV3): boolean {
  if (a.scope !== 'indoor' && b.scope !== 'indoor') return false
  if (a.scope !== 'indoor' || b.scope !== 'indoor') return true
  return !buildingsOf(a).some((code) => buildingsOf(b).includes(code))
}

/** Outdoor: outdoor color. Indoor in one building, entrances included: that building's color. Outdoor to indoor and between buildings: neutral. */
export function edgeColor(a: SurveyNodeV3, b: SurveyNodeV3, index: BuildingIndex): string {
  if (a.scope !== 'indoor' && b.scope !== 'indoor') return OUTDOOR_COLOR
  if (isNeutralEdge(a, b)) return NEUTRAL_EDGE_COLOR
  const shared = buildingsOf(a).find((code) => buildingsOf(b).includes(code))
  return shared ? buildingColor(index, shared) : NEUTRAL_EDGE_COLOR
}

/** 1-3 for floors of one building, K/T for several buildings, nothing for a single floor. */
export function levelBadge(node: SurveyNodeV3, index: BuildingIndex): string {
  const levels = node.levels ?? []
  if (node.scope !== 'indoor' || levels.length < 2) return ''
  const buildings = buildingsOf(node)
  if (buildings.length > 1) return buildings.map((code) => shortBuildingName(index.byCode.get(code), code)).join('/')
  const floors = levels.map((l) => l.floor)
  return `${floorChipLabel(Math.min(...floors))}-${floorChipLabel(Math.max(...floors))}`
}

export interface RenderOptions {
  index: BuildingIndex
  filter: MapFilter
  mode: MapMode
  selected: string | null
  pending: string | null
  selectedEdge: string | null
  multi?: readonly string[]
  labelMode?: LabelMode
  /** Chain base point. Pass it only while chaining is on. */
  anchor?: string | null
  /** "Only the filter can be edited". On by default: points outside the filter are dim and locked. Off: dim but editable. */
  onlyFilter?: boolean
}

export function buildRenderState(store: StoreV3, options: RenderOptions): { nodes: RenderNode[]; edges: RenderEdge[] } {
  const { index, filter, mode, selected, pending, selectedEdge, labelMode = 'full', onlyFilter = true } = options
  const multi = new Set(options.multi ?? [])
  const byId = new Map(store.nodes.map((n) => [n.id, n]))
  const filtering = filter.selections.length > 0

  const edges = store.edges.flatMap((edge: SurveyEdgeV3): RenderEdge[] => {
    const a = byId.get(edge.a)
    const b = byId.get(edge.b)
    if (!a || !b || a === b) return []
    const strong = isNodeStrong(a, filter) && isNodeStrong(b, filter)
    const editable = isEdgeEditable(a, b, filter, onlyFilter)
    const emphasized = edge.id === selectedEdge
    const stairs = edge.kind === 'stairs'
    return [
      {
        id: edge.id,
        a: a.id,
        b: b.id,
        p: [a.lat, a.lng, b.lat, b.lng],
        color: stairs ? STAIRS_COLOR : edgeColor(a, b, index),
        stairs,
        dashed: !stairs && isNeutralEdge(a, b),
        weight: (emphasized ? 8 : 5) + (stairs ? 2 : 0),
        opacity: filtering && !strong ? 0.18 : 0.9,
        // Locked edges cannot be pressed, so overlapping floors are not hit by accident.
        clickable: editable,
        snap: editable,
      },
    ]
  })

  const nodes = store.nodes.map((node): RenderNode => {
    const strong = isNodeStrong(node, filter)
    const isAnchor = node.id === options.anchor
    // The base point stays readable under a filter, because the next point is about to join it.
    const dim = filtering && !strong && !isAnchor
    // The base point also stays pressable, as before this option existed.
    const editable = isAnchor || isNodeEditable(node, filter, onlyFilter)
    const indoor = node.scope === 'indoor'
    const buildings = indoor ? buildingsOf(node) : []
    const fill = !indoor ? OUTDOOR_COLOR : buildings[0] ? buildingColor(index, buildings[0]) : NEUTRAL_COLOR
    let ring = buildings.length > 1 ? NEUTRAL_COLOR : '#FFFFFF'
    let ringWidth = buildings.length > 1 ? 3 : 2
    if (node.id === selected) {
      ring = SELECTED_RING
      ringWidth = 3
    } else if (node.id === pending) {
      ring = PENDING_RING
      ringWidth = 3
    } else if (multi.has(node.id)) {
      ring = MULTI_RING
      ringWidth = 4
    }
    const emphasized = node.id === selected || node.id === pending || multi.has(node.id) || isAnchor
    // With a floor filter on, only the points that match it keep a label. Outdoor points are strong but do not match.
    const labelled = labelMode === 'none' ? false : labelMode === 'selected' ? emphasized : emphasized || (!dim && (!filtering || indoor))
    const withLetter = emphasized || labelMode === 'full'
    const letter = buildings.length === 1 ? shortBuildingName(index.byCode.get(buildings[0]), buildings[0]) : ''
    return {
      id: node.id,
      lat: node.lat,
      lng: node.lng,
      shape: SHAPE_OF[node.type] ?? 'circle',
      fill,
      ring,
      ringWidth,
      size: node.type === 'basic' ? 18 : 22,
      num: labelled ? node.id.replace(/^n/, '') : '',
      letter: labelled && withLetter ? letter : '',
      badge: labelled && withLetter ? levelBadge(node, index) : '',
      dim,
      clickable: editable,
      draggable: editable && mode === 'move',
      emphasized,
      anchor: isAnchor,
    }
  })

  return { nodes, edges }
}
