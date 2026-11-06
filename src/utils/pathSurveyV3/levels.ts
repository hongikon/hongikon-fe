import { haversineMeters } from './geo'
import { buildingsContaining, floorChipLabel, floorOptions, type BuildingEntry, type BuildingIndex } from './buildings'
import { isValidFloor, sameLevel, type LevelPair, type LevelRef, type SurveyNodeV3 } from './types'

/** Pure helpers behind the building and floor pickers. */

export interface LevelGroup {
  building: string
  floors: number[]
}

/** Levels grouped per building, in first seen order, floors sorted. */
export function groupLevels(levels: readonly LevelRef[]): LevelGroup[] {
  const groups = new Map<string, number[]>()
  for (const level of levels) groups.set(level.building, [...(groups.get(level.building) ?? []), level.floor])
  return [...groups].map(([building, floors]) => ({ building, floors: [...new Set(floors)].sort((x, y) => x - y) }))
}

/** Checks or unchecks one floor. single keeps exactly one level, for entrances. */
export function toggleFloor(levels: readonly LevelRef[], building: string, floor: number, single = false): LevelRef[] {
  const level = { building, floor }
  if (levels.some((l) => sameLevel(l, level))) return levels.filter((l) => !sameLevel(l, level))
  return single ? [level] : [...levels, level]
}

export const removeBuildingLevels = (levels: readonly LevelRef[], building: string): LevelRef[] => levels.filter((l) => l.building !== building)

/** Largest floor number accepted from typing, and the widest range. They stop a typo from selecting hundreds of floors. */
export const MAX_TYPED_FLOOR = 99
export const MAX_TYPED_RANGE = 60

/**
 * Accepts 2, 1.5, L, B1 and B1.5. Below ground is written with B only: a minus sign is the range separator.
 * null when the text is not a floor (only half steps are floors).
 */
export function parseFloorQuery(text: string): number | null {
  const q = text.trim().toUpperCase()
  if (!q) return null
  if (q === 'L') return 0
  const m = /^(B?)(\d+(?:\.\d+)?)$/.exec(q)
  if (!m) return null
  const size = Number(m[2])
  if (size > MAX_TYPED_FLOOR || (m[1] && size === 0)) return null
  const value = m[1] ? -size : size
  return isValidFloor(value) ? value : null
}

export interface FloorInput {
  /** Floors to add, sorted, no repeats. */
  floors: number[]
  /** Parts that could not be read. */
  bad: string[]
  /** Parts written with a minus sign, which are not accepted. */
  negative: string[]
  /** True when a range or a list was typed, as opposed to one floor (which also works as a search). */
  isList: boolean
}

/**
 * Reads floor input such as 1-15, B3-5, B3-B1 or B2-3, 5, 8-10. A range fills whole floors between its two
 * ends, and the ends count as typed even when they are half floors. The order of the ends does not matter.
 * Floor 0 is the L floor, which most buildings do not have, so a range only passes through it when asked to.
 */
export function parseFloorInput(text: string, options: { includeL?: boolean } = {}): FloorInput {
  const parts = text
    .toUpperCase()
    .replace(/(\S)\s*-\s*(\S)/g, '$1-$2')
    .split(/[,\s]+/)
    .filter(Boolean)
  const floors = new Set<number>()
  const bad: string[] = []
  const negative: string[] = []
  for (const part of parts) {
    if (part.startsWith('-')) {
      negative.push(part)
      continue
    }
    const ends = part.split('-')
    const from = parseFloorQuery(ends[0])
    const to = ends.length === 2 ? parseFloorQuery(ends[1]) : from
    if (ends.length > 2 || from === null || to === null || Math.abs(to - from) > MAX_TYPED_RANGE) {
      bad.push(part)
      continue
    }
    const low = Math.min(from, to)
    const high = Math.max(from, to)
    floors.add(from)
    floors.add(to)
    for (let floor = Math.ceil(low); floor <= high; floor += 1) {
      if (floor !== 0 || options.includeL) floors.add(floor + 0)
    }
  }
  return { floors: [...floors].sort((x, y) => x - y), bad, negative, isList: parts.length > 1 || parts.some((p) => p.includes('-') && !p.startsWith('-')) }
}

/** Floors the building itself does not list. Floors only used in the survey data do not make them listed. */
export function floorsOutsideBuilding(entry: BuildingEntry | undefined, floors: readonly number[]): number[] {
  const listed = floorOptions(entry, []).main
  return floors.filter((floor) => !listed.includes(floor))
}

/** Chips matching the search: same number, or the chip text starts with what was typed. */
export function filterFloors(floors: readonly number[], query: string): number[] {
  const q = query.trim().toUpperCase()
  if (!q) return [...floors]
  const exact = parseFloorQuery(q)
  return floors.filter((f) => f === exact || floorChipLabel(f).toUpperCase().startsWith(q))
}

/** Floors already used per building. They always appear as chips. */
export function usedFloorsByBuilding(nodes: readonly SurveyNodeV3[]): Map<string, number[]> {
  const used = new Map<string, Set<number>>()
  for (const node of nodes) {
    for (const level of node.levels ?? []) {
      if (!used.has(level.building)) used.set(level.building, new Set())
      used.get(level.building)!.add(level.floor)
    }
  }
  return new Map([...used].map(([code, floors]) => [code, [...floors]]))
}

/**
 * Same height pairs going up from one known pair, for example A3=B1 gives A4=B2, A5=B3 and so on, as long
 * as both floors are on the node. Existing pairs are kept and not repeated.
 */
export function fillTiesUpward(levels: readonly LevelRef[], existing: readonly LevelPair[], start: LevelPair): LevelPair[] {
  const out: LevelPair[] = [...existing]
  const has = (x: LevelRef, y: LevelRef) => out.some(([p, q]) => (sameLevel(p, x) && sameLevel(q, y)) || (sameLevel(p, y) && sameLevel(q, x)))
  const floorsOf = (building: string) => levels.filter((l) => l.building === building).map((l) => l.floor).sort((a, b) => a - b)
  const left = floorsOf(start[0].building)
  const right = floorsOf(start[1].building)
  let i = left.indexOf(start[0].floor)
  let j = right.indexOf(start[1].floor)
  if (i < 0 || j < 0) return out
  for (; i < left.length && j < right.length; i += 1, j += 1) {
    const x = { building: start[0].building, floor: left[i] }
    const y = { building: start[1].building, floor: right[j] }
    if (!has(x, y)) out.push([x, y])
  }
  return out
}

/** Other points standing on almost the same spot. Stacked floors are hard to press on the map. */
export function nodesNear(nodes: readonly SurveyNodeV3[], node: SurveyNodeV3, meters = 3): SurveyNodeV3[] {
  return nodes.filter((n) => n.id !== node.id && haversineMeters(n.lat, n.lng, node.lat, node.lng) <= meters)
}

/** Buildings a selection touches: the levels of a point, otherwise the boundaries it stands in. */
export function selectionBuildings(nodes: readonly SurveyNodeV3[], ids: readonly string[], index: BuildingIndex): string[] {
  const targets = new Set(ids)
  const codes = nodes.flatMap((node) => {
    if (!targets.has(node.id)) return []
    const own = (node.levels ?? []).map((l) => l.building)
    return own.length ? own : buildingsContaining(index, node.lat, node.lng).map((b) => b.code)
  })
  return [...new Set(codes)]
}

/** Points inside one building's boundary, for "select all inside". */
export function nodesInBuilding(nodes: readonly SurveyNodeV3[], index: BuildingIndex, code: string, outdoorOnly = true): string[] {
  return nodes
    .filter((n) => (!outdoorOnly || n.scope === 'outdoor') && buildingsContaining(index, n.lat, n.lng).some((b) => b.code === code))
    .map((n) => n.id)
}
