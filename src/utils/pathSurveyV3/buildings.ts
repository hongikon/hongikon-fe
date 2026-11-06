import type { LevelRef } from './types'
import { distanceToRingMeters, pointInRing } from './geo'

/**
 * Building list from GET /map/data, reduced to what the survey needs: search, stable colors,
 * floor chips, entrance labels and boundaries. The server has no alias or (today) floor count fields,
 * so aliases come from the name token, the entrance label prefix and the code suffix.
 */

export interface RawBuilding {
  id?: number
  code?: string
  name: string
  lat: number
  lng: number
  floors?: number
  basementFloors?: number
  entrances?: { label: string; minFloor: number; maxFloor: number; lat?: number; lng?: number }[]
  boundary?: [number, number][]
  extraBoundaries?: [number, number][][]
}

export interface BuildingEntry {
  code: string
  name: string
  /** Short letter for the map and for entrance labels (R, D2, MH). null when the building has neither. */
  letter: string | null
  order: number
  aliases: string[]
  floors?: number
  basementFloors?: number
  entrances: { label: string; floor: number; maxFloor: number }[]
  rings: [number, number][][]
}

export interface BuildingIndex {
  list: BuildingEntry[]
  byCode: Map<string, BuildingEntry>
  byLetter: Map<string, BuildingEntry>
  /** Entrance label on the server -> building code. */
  serverLabels: Map<string, string>
}

const NAME_TOKEN = /([A-Za-z][A-Za-z0-9]*)\uB3D9\s*$/ // trailing "X-dong" token
const LABEL_PREFIX = /^HI_([A-Z0-9]+)_/

const codeSuffix = (code: string) => (code.includes('_') ? code.slice(code.lastIndexOf('_') + 1) : code)

export function buildBuildingIndex(raw: readonly RawBuilding[]): BuildingIndex {
  // Server id order keeps colors stable when a building is added later.
  const sorted = raw
    .filter((b) => typeof b.code === 'string' && b.code)
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (x.b.id ?? Infinity) - (y.b.id ?? Infinity) || x.i - y.i)
  const list: BuildingEntry[] = []
  const byCode = new Map<string, BuildingEntry>()
  const byLetter = new Map<string, BuildingEntry>()
  const serverLabels = new Map<string, string>()
  sorted.forEach(({ b }, order) => {
    const code = b.code as string
    const prefixes = [...new Set((b.entrances ?? []).map((e) => LABEL_PREFIX.exec(e.label)?.[1]).filter((p): p is string => !!p))]
    const token = NAME_TOKEN.exec(b.name)?.[1]?.toUpperCase() ?? null
    const entry: BuildingEntry = {
      code,
      name: b.name,
      letter: token ?? prefixes[0] ?? null,
      order,
      aliases: [...new Set([token, ...prefixes, codeSuffix(code)].filter((a): a is string => !!a).map((a) => a.toLowerCase()))],
      floors: b.floors,
      basementFloors: b.basementFloors,
      entrances: (b.entrances ?? []).map((e) => ({ label: e.label, floor: e.minFloor, maxFloor: e.maxFloor })),
      rings: [b.boundary, ...(b.extraBoundaries ?? [])].filter((r): r is [number, number][] => Array.isArray(r) && r.length > 2),
    }
    list.push(entry)
    byCode.set(code, entry)
    for (const key of [token, ...prefixes]) if (key && !byLetter.has(key)) byLetter.set(key, entry)
    for (const e of b.entrances ?? []) serverLabels.set(e.label, code)
  })
  return { list, byCode, byLetter, serverLabels }
}

export const shortBuildingName = (entry: BuildingEntry | undefined, fallback = '?') => entry?.letter ?? entry?.name.slice(0, 2) ?? fallback

/** Exact alias first, then alias prefix, then name substring. Case does not matter. */
export function searchBuildings(index: BuildingIndex, query: string): BuildingEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return index.list
  const rank = (b: BuildingEntry) => {
    if (b.aliases.includes(q) || b.name.toLowerCase() === q) return 0
    if (b.aliases.some((a) => a.startsWith(q))) return 1
    if (b.name.toLowerCase().includes(q)) return 2
    return 3
  }
  return index.list
    .map((b) => ({ b, r: rank(b) }))
    .filter((x) => x.r < 3)
    .sort((x, y) => x.r - y.r || x.b.order - y.b.order)
    .map((x) => x.b)
}

/** Buildings whose chips show L and half floors without asking. Others add them through the floor search. */
const DEFAULT_SPECIAL_FLOORS: Record<string, number[]> = { hongik_r: [0, 1.5] }

export interface FloorOptions {
  /** Shown right away: server counts or the entrance range, special floors and floors already used. */
  main: number[]
  /** The rest of B5..30 behind "more". */
  more: number[]
  special: number[]
}

const WIDE_RANGE = { from: -5, to: 30 }
const NO_DATA_RANGE = { from: -5, to: 10 }

/**
 * Floor chips. The server has no floor counts today, so the range comes from the entrances minFloor and maxFloor.
 * Elevators often reach higher than any door, so the rest of the range stays one tap away.
 */
export function floorOptions(entry: BuildingEntry | undefined, used: readonly number[] = []): FloorOptions {
  const special = entry ? (DEFAULT_SPECIAL_FLOORS[entry.code] ?? []) : []
  const range = (from: number, to: number) => {
    const out: number[] = []
    for (let f = Math.ceil(from); f <= Math.floor(to); f += 1) if (f !== 0) out.push(f)
    return out
  }
  const known = entry?.entrances ?? []
  let base: number[]
  if (entry?.floors && entry.floors > 0) base = range(-(entry.basementFloors ?? 0), entry.floors)
  else if (known.length) {
    const low = Math.min(...known.map((e) => e.floor))
    const high = Math.max(...known.map((e) => e.maxFloor))
    base = [...range(low, high), ...known.flatMap((e) => [e.floor, e.maxFloor])]
  } else base = range(NO_DATA_RANGE.from, NO_DATA_RANGE.to)
  const main = [...new Set([...base, ...special, ...used])].sort((x, y) => x - y)
  const more = range(WIDE_RANGE.from, WIDE_RANGE.to).filter((f) => !main.includes(f))
  return { main, more, special }
}

/** LF -> 0, B1 and B1F -> -1, 1F -> 1, 1F5 -> 1.5, B1F5 -> -1.5. null when unreadable. */
export function parseFloorToken(token: string): number | null {
  if (token === 'LF') return 0
  const m = /^(B?)(\d+)(?:F(\d)?)?$/.exec(token)
  if (!m || (!m[1] && !token.includes('F'))) return null
  const value = m[3] ? Number(`${m[2]}.${m[3]}`) : Number(m[2])
  if (value === 0) return null
  return m[1] ? -value : value
}

/** Same notation as the server labels: 1F, 1F5, B1, B1F5, LF. */
export function formatFloorToken(floor: number): string {
  if (floor === 0) return 'LF'
  const abs = Math.abs(floor)
  const whole = Math.trunc(abs)
  const half = abs !== whole
  if (floor < 0) return half ? `B${whole}F5` : `B${whole}`
  return half ? `${whole}F5` : `${whole}F`
}

/** Short floor text for chips and badges: B1, L, 1, 1.5. */
export function floorChipLabel(floor: number): string {
  if (floor === 0) return 'L'
  return floor < 0 ? `B${Math.abs(floor)}` : `${floor}`
}

export const ENTRANCE_LABEL = /^HI_([A-Z0-9]+)_([A-Z0-9]+)(?:_\d+)?_ENTER$/

/** Reads building letter and floor from a standard entrance label. */
export function parseEntranceLabel(label: string): { letter: string; floor: number } | null {
  const m = ENTRANCE_LABEL.exec(label)
  if (!m) return null
  const floor = parseFloorToken(m[2])
  return floor === null ? null : { letter: m[1], floor }
}

/** HI_X_B1F_ENTER spelling used in old memos -> HI_X_B1_ENTER spelling used by the server, when that label exists. */
export function serverLabelFor(index: BuildingIndex, label: string): string | null {
  if (index.serverLabels.has(label)) return label
  const normalized = label.replace(/_B(\d+)F(?=_)/, '_B$1')
  return index.serverLabels.has(normalized) ? normalized : null
}

/** New label HI_<letter>_<floor>_<n>_ENTER. The number goes up until nothing else uses the label. */
export function nextEntranceLabel(index: BuildingIndex, level: LevelRef, used: Iterable<string>): string {
  const letter = index.byCode.get(level.building)?.letter ?? codeSuffix(level.building).toUpperCase()
  const taken = new Set(used)
  for (const key of index.serverLabels.keys()) taken.add(key)
  const token = formatFloorToken(level.floor)
  for (let n = 1; ; n += 1) {
    const label = `HI_${letter}_${token}_${n}_ENTER`
    if (!taken.has(label)) return label
  }
}

/** Buildings whose boundary contains the point. */
export const buildingsContaining = (index: BuildingIndex, lat: number, lng: number): BuildingEntry[] =>
  index.list.filter((b) => b.rings.some((ring) => pointInRing(lat, lng, ring)))

/** 0 inside, otherwise meters to the nearest outline. null when the building has no boundary. */
export function distanceToBuilding(entry: BuildingEntry, lat: number, lng: number): number | null {
  if (entry.rings.length === 0) return null
  if (entry.rings.some((ring) => pointInRing(lat, lng, ring))) return 0
  return Math.min(...entry.rings.map((ring) => distanceToRingMeters(lat, lng, ring)))
}

export const BUILDINGS_CACHE_KEY = 'hongikon.pathSurvey.v3.buildings'

type CacheStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void }

const cacheStorage = (): CacheStorage | null => {
  try {
    return (globalThis as any).localStorage ?? null
  } catch {
    return null
  }
}

/** Keeps only the fields used here, so the survey still has its building list when offline. */
export function saveBuildingCache(raw: readonly RawBuilding[], storage: CacheStorage | null = cacheStorage()): boolean {
  try {
    if (!storage) return false
    const value = JSON.stringify(
      raw.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        lat: b.lat,
        lng: b.lng,
        floors: b.floors,
        basementFloors: b.basementFloors,
        entrances: (b.entrances ?? []).map((e) => ({ label: e.label, minFloor: e.minFloor, maxFloor: e.maxFloor })),
        boundary: b.boundary,
        extraBoundaries: b.extraBoundaries,
      })),
    )
    if (storage.getItem(BUILDINGS_CACHE_KEY) !== value) storage.setItem(BUILDINGS_CACHE_KEY, value)
    return true
  } catch {
    return false
  }
}

export function loadBuildingCache(storage: CacheStorage | null = cacheStorage()): RawBuilding[] {
  try {
    const parsed = JSON.parse(storage?.getItem(BUILDINGS_CACHE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
