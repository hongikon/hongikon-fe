import { apiGetRaw } from './client'
import type { Building, Facility, Partner } from '../types'

/**
 * 지도 데이터(건물·편의시설·제휴업체) 한 벌. `GET /map/data` 응답(비로그인 허용).
 * 예전에는 앱 상수(`constants/buildings.ts` 등)로 들고 있었고, 2026-10 부터 서버(관리자 화면에서 고친다)에서 받는다.
 * 좌표·혜택은 사용자가 확인한 값이라 앱에서 고치지 않고 받은 그대로 쓴다.
 */
export interface MapData {
  /** 응답 본문의 해시(서버가 계산). ETag 와 같은 값. */
  version: string
  buildings: Building[]
  facilities: Facility[]
  partners: Partner[]
}

export type FetchMapDataResult =
  | { status: 'ok'; data: MapData; etag: string | null }
  | { status: 'notModified' }

/** 한 번 시도의 제한 시간. 재시도(1초·3초 뒤)는 지도 데이터 저장소(`lib/mapData.ts`)가 맡는다. */
const MAP_DATA_TIMEOUT_MS = 8_000

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/**
 * 응답 모양을 한 번 거른다. 필수 값(이름·좌표 등)이 빠진 항목은 지도에 올릴 수 없으니 버리고,
 * 나머지 필드는 서버가 준 그대로 둔다(값을 고치지 않는다).
 */
export function normalizeMapData(raw: unknown): MapData {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const buildings = arrayOf(body.buildings).filter(
    (b): b is Building =>
      !!b &&
      typeof (b as Building).name === 'string' &&
      isFiniteNumber((b as Building).lat) &&
      isFiniteNumber((b as Building).lng),
  )
  const facilities = arrayOf(body.facilities).filter(
    (f): f is Facility =>
      !!f &&
      typeof (f as Facility).id === 'string' &&
      typeof (f as Facility).kind === 'string' &&
      typeof (f as Facility).buildingName === 'string',
  )
  const partners = arrayOf(body.partners).filter(
    (p): p is Partner =>
      !!p &&
      typeof (p as Partner).id === 'string' &&
      typeof (p as Partner).name === 'string' &&
      typeof (p as Partner).category === 'string' &&
      isFiniteNumber((p as Partner).lat) &&
      isFiniteNumber((p as Partner).lng),
  )
  return {
    version: typeof body.version === 'string' ? body.version : '',
    buildings,
    facilities,
    partners,
  }
}

/**
 * 지도 데이터를 받는다. `etag` 를 주면 If-None-Match 로 보내, 바뀐 게 없으면 304 → `notModified`.
 * 실패는 `client.ts` 의 ApiError / NetworkError / RequestCancelledError 로 던진다.
 */
export async function fetchMapData({
  etag,
  signal,
}: { etag?: string | null; signal?: AbortSignal } = {}): Promise<FetchMapDataResult> {
  const response = await apiGetRaw('/map/data', {
    headers: etag ? { 'If-None-Match': etag } : undefined,
    timeoutMs: MAP_DATA_TIMEOUT_MS,
    retries: 0,
    signal,
  })
  if (response.status === 304) return { status: 'notModified' }
  const data = normalizeMapData(await response.json<unknown>())
  // CORS 가 ETag 를 노출하지 않으면 헤더를 못 읽는다. 서버 ETag 는 "<version>" 이라 본문 version 으로 대신 만든다.
  const etagHeader = response.headers.get('ETag')
  return { status: 'ok', data, etag: etagHeader || (data.version ? `"${data.version}"` : null) }
}
