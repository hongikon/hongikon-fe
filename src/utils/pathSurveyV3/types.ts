/**
 * Path survey v3 data model. One flat graph of nodes and edges (no modules).
 * This folder has no React Native imports so Node tests can load it directly.
 */

export const EXPORT_FORMAT_V3 = 'hongikon.pathSurvey'

export type NodeScope = 'outdoor' | 'indoor'
export type NodeType = 'basic' | 'stairs' | 'elevator' | 'entrance'
export const NODE_TYPES: readonly NodeType[] = ['basic', 'stairs', 'elevator', 'entrance']

/** List based so that later kinds (for example ramp) only need a new entry here. */
export const EDGE_KINDS = ['normal', 'stairs'] as const
export type EdgeKind = (typeof EDGE_KINDS)[number]

/** building is the server building code. floor: 1, 2.. above ground, -1, -2.. below, 0 is the L floor, x.5 is a mezzanine. */
export interface LevelRef {
  building: string
  floor: number
}

export type LevelPair = [LevelRef, LevelRef]

export interface SurveyNodeV3 {
  /** 'n' + global sequence. */
  id: string
  lat: number
  lng: number
  scope: NodeScope
  type: NodeType
  levels?: LevelRef[]
  /** stairs and elevator only: pairs of floors at the same height in two buildings. */
  ties?: LevelPair[]
  entranceLabel?: string
  memo?: string
  legacyId?: string
}

export interface SurveyEdgeV3 {
  /** 'e' + global sequence. */
  id: string
  a: string
  b: string
  kind: EdgeKind
  memo?: string
  /** Each pair is [level on a, level on b]. Only used when a and b share no floor. */
  pairs?: LevelPair[]
}

export interface GraphVertex {
  id: string
  node: string
  building?: string
  floor?: number
  lat: number
  lng: number
  type: NodeType
}

export type GraphEdgeKind = EdgeKind | 'stairs_vertical' | 'elevator_vertical' | 'tie'

export interface GraphEdge {
  a: string
  b: string
  kind: GraphEdgeKind
  meters?: number
}

export interface SurveyGraph {
  vertices: GraphVertex[]
  edges: GraphEdge[]
}

export interface SurveyFileV3 {
  format: typeof EXPORT_FORMAT_V3
  version: 3
  exportedAt: number
  nodes: SurveyNodeV3[]
  edges: SurveyEdgeV3[]
  /** Derived on export and only present when the check has no errors. Never stored. */
  graph?: SurveyGraph
  /** Only in the graph export: labels to add to the server list later. */
  report?: { labelsNotOnServer: string[] }
}

export const isEdgeKind = (value: unknown): value is EdgeKind => (EDGE_KINDS as readonly unknown[]).includes(value)
export const isNodeType = (value: unknown): value is NodeType => (NODE_TYPES as readonly unknown[]).includes(value)

/** Any building may use 0 (L floor) and half floors. Other fractions are a check error. */
export const isValidFloor = (floor: unknown): floor is number =>
  typeof floor === 'number' && Number.isFinite(floor) && Number.isInteger(floor * 2)

export const levelKey = (level: LevelRef) => `${level.building}:${level.floor}`
export const sameLevel = (x: LevelRef, y: LevelRef) => x.building === y.building && x.floor === y.floor
export const hasLevel = (levels: readonly LevelRef[] | undefined, level: LevelRef) => !!levels?.some((l) => sameLevel(l, level))
export const vertexId = (nodeId: string, level: LevelRef) => `${nodeId}@${level.building}:${level.floor}`
