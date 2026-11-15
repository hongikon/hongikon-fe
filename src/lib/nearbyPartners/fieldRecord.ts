import AsyncStorage from '@react-native-async-storage/async-storage'
import { nearbyDevTools } from './debug'

/**
 * 현장 측정 기록(11-13, 졸업프로젝트 위치 보정 평가용). 테스트 앱·관리자 계정에서만 쓴다(`nearbyDevTools`).
 *
 * 판단 기록(`debugLog`)과 달리 좌표를 남긴다 — 나중에 같은 기록을 지금 방식·칼만 필터·건물 외곽·HMM 에 똑같이 다시 넣어
 * 비교하려면 받은 위치 그대로가 필요하다. 그래서:
 * - 테스터가 '측정 시작'을 누른 동안만 남긴다. 끄면 더 남기지 않는다.
 * - 이 휴대폰에만 두고 서버로 보내지 않는다. 테스터가 '내보내기'로 직접 공유할 때만 밖으로 나간다.
 * - '기록 지우기'로 바로 지운다.
 *
 * 남기는 것: 위치 하나마다 시각·위치 종류·위도·경도·오차·다듬은 위치·가장 가까운 가게와 거리·머무는 중인 가게·보낸 알림,
 * 그리고 테스터가 누른 정답("○○에 들어감", "나옴").
 */

export type FieldFix = {
  k: 'fix'
  t: number
  /** 위치 종류: 'GPS' | 'Wi-Fi·기지국' | 'GPS 한 번'. */
  src: string
  lat: number
  lng: number
  acc: number | null
  /** 판단에 넣은 위치(GPS 는 칼만 필터로 다듬은 값, 그 밖에는 받은 값 그대로). */
  slat: number
  slng: number
  nearId?: string
  nearName?: string
  nearM?: number
  /** 머무는 중으로 본 가게 id. */
  inside: string[]
  /** 이 위치에서 새로 보낸 알림의 가게 id. */
  alert?: string
}

export type FieldTruth = { k: 'truth'; t: number; ev: 'enter' | 'exit'; shop: string; name: string }
export type FieldNote = { k: 'note'; t: number; text: string }
export type FieldEntry = FieldFix | FieldTruth | FieldNote

interface Meta {
  recording: boolean
  startedAt: number | null
  chunks: number
}

const META_KEY = 'hongikon_field_meta_v1'
const CHUNK_PREFIX = 'hongikon_field_chunk_v1_'
/** 한 묶음에 이만큼씩 저장한다(위치마다 전체를 다시 쓰지 않게). */
const CHUNK_SIZE = 300
/** 이만큼(5초 간격이면 약 16시간)을 넘으면 더 남기지 않는다. */
const MAX_CHUNKS = 40

let meta: Meta | null = null
let current: FieldEntry[] | null = null
let chain: Promise<unknown> = Promise.resolve()

const EMPTY: Meta = { recording: false, startedAt: null, chunks: 0 }

async function loadMeta(): Promise<Meta> {
  if (meta) return meta
  try {
    const raw = await AsyncStorage.getItem(META_KEY)
    meta = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Meta>) } : { ...EMPTY }
  } catch {
    meta = { ...EMPTY }
  }
  return meta
}

async function saveMeta(next: Meta): Promise<void> {
  meta = next
  await AsyncStorage.setItem(META_KEY, JSON.stringify(next)).catch(() => {})
}

async function loadChunk(index: number): Promise<FieldEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CHUNK_PREFIX + index)
    return raw ? (JSON.parse(raw) as FieldEntry[]) : []
  } catch {
    return []
  }
}

function queue<T>(job: () => Promise<T>): Promise<T> {
  const next = chain.then(job)
  chain = next.catch(() => {})
  return next
}

/** 지금 측정 중인지. 앱이 꺼진 채 백그라운드로 깨어나도 저장된 값을 읽는다. */
export async function fieldRecording(): Promise<boolean> {
  if (!nearbyDevTools()) return false
  return (await loadMeta()).recording
}

export function setFieldRecording(on: boolean, now: number = Date.now()): Promise<void> {
  return queue(async () => {
    const m = await loadMeta()
    await saveMeta({ ...m, recording: on, startedAt: on ? now : m.startedAt })
    current = null
  }).then(() => recordField({ k: 'note', t: now, text: on ? '측정 시작' : '측정 끝' }, true))
}

/** 한 줄 남긴다. 측정 중이 아니거나 도구를 못 쓰는 계정이면 아무것도 하지 않는다. */
export function recordField(entry: FieldEntry, force = false): Promise<void> {
  if (!nearbyDevTools()) return Promise.resolve()
  return queue(async () => {
    const m = await loadMeta()
    if (!m.recording && !force) return
    let chunks = Math.max(m.chunks, 1)
    if (!current) current = await loadChunk(chunks - 1)
    if (current.length >= CHUNK_SIZE) {
      if (chunks >= MAX_CHUNKS) return
      chunks += 1
      current = []
    }
    current.push(entry)
    await AsyncStorage.setItem(CHUNK_PREFIX + (chunks - 1), JSON.stringify(current)).catch(() => {})
    if (chunks !== m.chunks) await saveMeta({ ...m, chunks })
  })
}

/** 모든 기록(오래된 것부터). 백그라운드 작업이 다른 실행에서 남긴 것도 읽게 저장소에서 다시 읽는다. */
export function readFieldEntries(): Promise<{ entries: FieldEntry[]; recording: boolean; startedAt: number | null }> {
  return queue(async () => {
    meta = null
    current = null
    const m = await loadMeta()
    const entries: FieldEntry[] = []
    for (let i = 0; i < m.chunks; i += 1) entries.push(...(await loadChunk(i)))
    return { entries, recording: m.recording, startedAt: m.startedAt }
  })
}

export function clearFieldEntries(): Promise<void> {
  return queue(async () => {
    const m = await loadMeta()
    const keys = Array.from({ length: m.chunks }, (_, i) => CHUNK_PREFIX + i)
    if (keys.length > 0) await AsyncStorage.multiRemove(keys).catch(() => {})
    current = null
    await saveMeta({ recording: m.recording, startedAt: m.recording ? m.startedAt : null, chunks: 0 })
  })
}

/** 한국 시간 'YYYY-MM-DD HH:MM:SS'. */
export function fieldClock(ms: number): string {
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const CSV_HEADER = [
  'time_kst', 'epoch_ms', 'kind', 'source', 'lat', 'lng', 'accuracy_m', 'smooth_lat', 'smooth_lng',
  'nearest_id', 'nearest_name', 'nearest_m', 'inside_ids', 'alert_id', 'truth_event', 'truth_shop_id', 'truth_shop_name', 'note',
]

/** 분석용 CSV(한 줄에 기록 하나). */
export function fieldCsv(entries: readonly FieldEntry[]): string {
  const rows = entries.map((e) => {
    const base: (string | number | undefined)[] = [fieldClock(e.t), e.t, e.k]
    if (e.k === 'fix') {
      return [...base, e.src, e.lat.toFixed(7), e.lng.toFixed(7), e.acc === null ? '' : Math.round(e.acc), e.slat.toFixed(7), e.slng.toFixed(7),
        e.nearId, e.nearName, e.nearM === undefined ? '' : Math.round(e.nearM), e.inside.join(' '), e.alert, '', '', '', '']
    }
    if (e.k === 'truth') return [...base, '', '', '', '', '', '', '', '', '', '', '', e.ev, e.shop, e.name, '']
    return [...base, '', '', '', '', '', '', '', '', '', '', '', '', '', '', e.text]
  })
  return [CSV_HEADER, ...rows].map((row) => row.map(cell).join(',')).join('\n')
}
