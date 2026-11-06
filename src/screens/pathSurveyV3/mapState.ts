import { STAIRS_COLOR } from '../../utils/pathSurveyStore'
import { floorChipLabel, shortBuildingName, type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { hasLevel, type NodeType, type SurveyEdgeV3, type SurveyNodeV3 } from '../../utils/pathSurveyV3/types'

/**
 * Turns the store into what the map draws. Pure so that the rules can be tested without a map.
 * Color means location and shape means type.
 */

export const OUTDOOR_COLOR = '#64748B'
export const NEUTRAL_COLOR = '#A8A29E'
export const SELECTED_RING = '#111827'
export const PENDING_RING = '#F97316'
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
  building: string | null
  floor: number | null
}

export const NO_FILTER: MapFilter = { building: null, floor: null }

export type MapMode = 'add' | 'link' | 'move'

export interface RenderNode {
  id: string
  lat: number
  lng: number
  shape: NodeShape
  fill: string
  ring: string
  ringWidth: number
  size: number
  /** Number part of the id. */
  num: string
  letter: string
  badge: string
  dim: boolean
  clickable: boolean
  draggable: boolean
  emphasized: boolean
}

export interface RenderEdge {
  id: string
  a: string
  b: string
  p: [number, number, number, number]
  color: string
  stairs: boolean
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
  if (!filter.building || node.scope !== 'indoor') return true
  const levels = node.levels ?? []
  if (filter.floor === null) return levels.some((l) => l.building === filter.building)
  return hasLevel(levels, { building: filter.building, floor: filter.floor })
}

const buildingsOf = (node: SurveyNodeV3) => [...new Set((node.levels ?? []).map((l) => l.building))]

/** Outdoor: outdoor color. Indoor: the color of the shared building. Entrance edges and links between buildings: neutral. */
export function edgeColor(a: SurveyNodeV3, b: SurveyNodeV3, index: BuildingIndex): string {
  if (a.scope !== 'indoor' && b.scope !== 'indoor') return OUTDOOR_COLOR
  if (a.scope !== 'indoor' || b.scope !== 'indoor' || a.type === 'entrance' || b.type === 'entrance') return NEUTRAL_COLOR
  const shared = buildingsOf(a).find((code) => buildingsOf(b).includes(code))
  return shared ? buildingColor(index, shared) : NEUTRAL_COLOR
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
}

export function buildRenderState(store: StoreV3, options: RenderOptions): { nodes: RenderNode[]; edges: RenderEdge[] } {
  const { index, filter, mode, selected, pending, selectedEdge } = options
  const byId = new Map(store.nodes.map((n) => [n.id, n]))
  const filtering = !!filter.building

  const edges = store.edges.flatMap((edge: SurveyEdgeV3): RenderEdge[] => {
    const a = byId.get(edge.a)
    const b = byId.get(edge.b)
    if (!a || !b || a === b) return []
    const strong = isNodeStrong(a, filter) && isNodeStrong(b, filter)
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
        weight: (emphasized ? 8 : 5) + (stairs ? 2 : 0),
        opacity: filtering && !strong ? 0.18 : 0.9,
        // Dim edges cannot be pressed, so overlapping floors are not hit by accident.
        clickable: !filtering || strong,
        snap: !filtering || strong,
      },
    ]
  })

  const nodes = store.nodes.map((node): RenderNode => {
    const strong = isNodeStrong(node, filter)
    const dim = filtering && !strong
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
    }
    return {
      id: node.id,
      lat: node.lat,
      lng: node.lng,
      shape: SHAPE_OF[node.type] ?? 'circle',
      fill,
      ring,
      ringWidth,
      size: node.type === 'basic' ? 18 : 22,
      num: node.id.replace(/^n/, ''),
      letter: buildings.length === 1 ? shortBuildingName(index.byCode.get(buildings[0]), buildings[0]) : '',
      badge: levelBadge(node, index),
      dim,
      clickable: !dim,
      draggable: !dim && mode === 'move',
      emphasized: node.id === selected || node.id === pending,
    }
  })

  return { nodes, edges }
}
