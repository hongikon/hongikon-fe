import { haversineMeters } from './geo'
import { buildingsContaining, floorChipLabel, type BuildingIndex } from './buildings'
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

/** Accepts 2, -1, 1.5, L and B1. null when the text is not a floor (only half steps are floors). */
export function parseFloorQuery(text: string): number | null {
  const q = text.trim().toUpperCase()
  if (!q) return null
  if (q === 'L') return 0
  const basement = /^B(\d+(?:\.\d+)?)$/.exec(q)
  const value = basement ? -Number(basement[1]) : /^-?\d+(?:\.\d+)?$/.test(q) ? Number(q) : NaN
  return isValidFloor(value) ? value + 0 : null
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

/** Points inside one building's boundary, for "select all inside". */
export function nodesInBuilding(nodes: readonly SurveyNodeV3[], index: BuildingIndex, code: string, outdoorOnly = true): string[] {
  return nodes
    .filter((n) => (!outdoorOnly || n.scope === 'outdoor') && buildingsContaining(index, n.lat, n.lng).some((b) => b.code === code))
    .map((n) => n.id)
}
