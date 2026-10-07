import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { fetchMapData, normalizeMapData, type MapData } from '../apis/mapData'
import { isCancelledError, isRetryableError } from '../apis/client'
import { onReconnect } from './connectivity'
import type { Building, Exhibition, Facility, Partner } from '../types'

/**
 * 지도 데이터(건물·편의시설·제휴업체) 앱 전역 저장소. 앱 시작 때 한 번 불러온다(`initMapData`, App.tsx).
 *
 * 1. 기기에 저장해 둔 지난 응답(AsyncStorage `hongikon_map_data_v1`)이 있으면 바로 내놓는다(status 'ready').
 * 2. 이어서 서버(`GET /map/data`)에 ETag 로 새 데이터가 있는지 묻는다. 304 면 그대로, 새 데이터면 바꾸고 저장한다.
 * 3. 실패하면 1초·3초 뒤 두 번 더 시도한다. 저장본도 없고 셋 다 실패하면 status 'error' — 화면이 "다시 시도"(`reload`)를 띄운다.
 * 4. 앱이 포그라운드로 돌아왔는데 마지막 성공(실패했으면 마지막 시도)이 30분을 넘었으면 다시 확인한다.
 *    연결이 끊겼다 돌아와도 실패 상태면 다시 받되, 실패가 이어질수록 간격을 늘린다(`RECONNECT_COOLDOWNS_MS`).
 * 5. 4xx(401·404 등)는 몇 번을 보내도 같으니 재시도하지 않는다.
 *
 * React 화면은 `useMapData()`, 화면 밖 유틸은 데이터를 인자로 받거나 `getMapDataSnapshot()` 을 쓴다.
 */

export type MapDataStatus = 'loading' | 'ready' | 'error'

export interface MapDataState {
  status: MapDataStatus
  /** 마지막으로 받은(또는 저장해 둔) 데이터. 한 번도 못 받았으면 null. */
  data: MapData | null
}

const STORAGE_KEY = 'hongikon_map_data_v1'
/** 첫 시도 뒤 재시도 간격. */
const RETRY_DELAYS_MS = [1_000, 3_000]
/** 포그라운드로 돌아왔을 때 다시 확인하는 기준. */
const STALE_AFTER_MS = 30 * 60 * 1000
/**
 * 연결 복구 알림으로 다시 받기 전, 직전 실패 묶음(시도 3번) 뒤 기다리는 시간. 실패가 이어질수록 늘어난다.
 * 연결 상태는 앱 전역이라 `/map/data` 만 5xx·시간 초과로 실패하고 `/status` 는 멀쩡하면, 확인 요청이 성공할 때마다
 * "다시 연결됨" 이 와서 쉬지 않고 다시 받게 된다(1분에 30번 넘게). "다시 시도" 버튼은 이 간격과 상관없이 바로 받는다.
 */
const RECONNECT_COOLDOWNS_MS = [0, 30_000, 60_000, 120_000, 300_000]

interface StoredMapData {
  data: MapData
  etag: string | null
  savedAt: number
}

let state: MapDataState = { status: 'loading', data: null }
let etag: string | null = null
/** 마지막으로 서버에서 받았거나(200) 바뀐 게 없음을 확인한(304) 시각. */
let lastSuccessAt = 0
/** 마지막으로 서버에 물은 시각(성공·실패 상관없이). 실패가 이어질 때 포그라운드 복귀마다 다시 묻지 않게 한다. */
let lastAttemptAt = 0
/** 이어서 실패한 묶음 수. 한 번이라도 받으면 0. */
let failedCycles = 0
let lastFailedCycleAt = 0
let started = false
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function setState(next: MapDataState): void {
  state = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getState(): MapDataState {
  return state
}

/** 화면 밖 유틸용. 아직 아무것도 없으면 null. */
export function getMapDataSnapshot(): MapData | null {
  return state.data
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readStored(): Promise<StoredMapData | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredMapData>
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return null
    return {
      data: normalizeMapData(parsed.data),
      etag: typeof parsed.etag === 'string' ? parsed.etag : null,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    }
  } catch {
    // 저장본이 깨졌으면 없는 셈 친다 — 서버에서 새로 받는다.
    return null
  }
}

async function writeStored(value: StoredMapData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 저장에 실패해도(용량 등) 이번 실행에서는 받은 데이터로 지도를 그린다.
  }
}

/** 서버에 한 번(+재시도 두 번) 묻는다. 동시에 여러 번 불려도 요청은 하나만 나간다. */
function refresh(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    lastAttemptAt = Date.now()
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1])
      try {
        // 저장본 없이 ETag 만 보내면 304 를 받아도 그릴 게 없다.
        const result = await fetchMapData({ etag: state.data ? etag : null })
        lastSuccessAt = Date.now()
        failedCycles = 0
        if (result.status === 'notModified') {
          if (state.status !== 'ready') setState({ status: 'ready', data: state.data })
          return
        }
        etag = result.etag
        setState({ status: 'ready', data: result.data })
        await writeStored({ data: result.data, etag: result.etag, savedAt: Date.now() })
        return
      } catch (error) {
        if (isCancelledError(error)) return
        if (__DEV__) console.warn(`[mapData] 지도 데이터를 받지 못함 (시도 ${attempt + 1}/${RETRY_DELAYS_MS.length + 1})`)
        // 4xx(아직 배포 전이라 401·404 등)는 다시 보내도 같다.
        if (!isRetryableError(error)) break
      }
    }
    failedCycles += 1
    lastFailedCycleAt = Date.now()
    // 저장본이 있으면 그걸 계속 쓴다(조용히). 아무것도 없을 때만 오류로 알린다.
    if (!state.data) setState({ status: 'error', data: null })
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

/**
 * 앱 시작 때 한 번 부른다(여러 번 불러도 처음 한 번만 동작). 저장본을 먼저 내놓고 서버에 새 데이터를 묻는다.
 */
export function initMapData(): void {
  if (started) return
  started = true
  void (async () => {
    const stored = await readStored()
    // 저장본을 읽는 사이 서버 응답이 먼저 왔으면 덮지 않는다.
    if (stored && !state.data) {
      etag = stored.etag
      setState({ status: 'ready', data: stored.data })
    }
    await refresh()
  })()

  AppState.addEventListener('change', (appState) => {
    if (appState !== 'active') return
    if (Date.now() - Math.max(lastSuccessAt, lastAttemptAt) > STALE_AFTER_MS) void refresh()
  })
  // 실패 상태에서 연결이 돌아오면 다시 받는다. 첫 실패 뒤엔 바로, 실패가 이어지면 간격을 늘려 가며.
  onReconnect(() => {
    if (state.status !== 'error') return
    const cooldown = RECONNECT_COOLDOWNS_MS[Math.min(failedCycles, RECONNECT_COOLDOWNS_MS.length) - 1] ?? 0
    if (Date.now() - lastFailedCycleAt < cooldown) return
    reloadMapData()
  })
}

/** "다시 시도". 실패 상태였으면 불러오는 중으로 바꾸고 다시 받는다. */
export function reloadMapData(): void {
  if (state.status === 'error') setState({ status: 'loading', data: null })
  void refresh()
}

/**
 * 관리자 화면에서 제휴업체·편의시설·전시를 고친 뒤 부른다. 이 실행에서 지도 데이터를 쓰고 있을 때만(앱 관리 탭) 서버에 다시 묻는다
 * — 웹 관리자 콘솔(`/admin`)은 지도를 그리지 않아 받지 않는다.
 */
export function refreshMapData(): void {
  if (!started) return
  void refresh()
}

const EMPTY_BUILDINGS: Building[] = []
const EMPTY_FACILITIES: Facility[] = []
const EMPTY_PARTNERS: Partner[] = []
const EMPTY_EXHIBITIONS: Exhibition[] = []

export interface UseMapDataResult {
  status: MapDataStatus
  data: MapData | null
  /** 데이터가 없으면 빈 배열(같은 참조). */
  buildings: Building[]
  facilities: Facility[]
  partners: Partner[]
  /** 전시. 예전 서버·저장본에는 없어 빈 배열. */
  exhibitions: Exhibition[]
  reload: () => void
}

export function useMapData(): UseMapDataResult {
  const current = useSyncExternalStore(subscribe, getState, getState)
  return {
    status: current.status,
    data: current.data,
    buildings: current.data?.buildings ?? EMPTY_BUILDINGS,
    facilities: current.data?.facilities ?? EMPTY_FACILITIES,
    partners: current.data?.partners ?? EMPTY_PARTNERS,
    exhibitions: current.data?.exhibitions ?? EMPTY_EXHIBITIONS,
    reload: reloadMapData,
  }
}
