import { apiRequest } from './client'
import type { RouteAlternative } from './routes'
import type { ServerGraph } from '../utils/pathSurveyV3/serverGraph'

/**
 * 경로 조사 도구 '서버' 탭(11-10): 경로망 올리기(초안·검사·비교) → 길 시험 → 운영에 적용·되돌리기, 백업 다시 불러오기.
 * 서버 hongikon-be RouteGraphController(/map/route-graph). /dev 게이트 암호키를 X-Dev-Key 로 보낸다(로그인 아님).
 */

export type GraphVersionStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export interface GraphVersionSummary {
  id: number
  status: GraphVersionStatus
  sourceName: string | null
  exportedAt: string | null
  vertexCount: number
  edgeCount: number
  createdAt: string
  activatedAt: string | null
}

export interface GraphChange {
  from: string
  to: string
  activeSeconds: number
  draftSeconds: number
  activeEstimate: boolean
  draftEstimate: boolean
}

export interface GraphReport {
  checks: {
    vertices: number
    edges: number
    detachedVertices: number
    detachedSample: string[]
    unresolvedBuildingCodes: string[]
    buildingsWithoutEntrances: string[]
  }
  comparison: {
    /** 비교한 운영 경로망: 'file'(저장소 기본) 또는 'v{id}'. */
    against: string
    pairs: number
    same: number
    faster: number
    slower: number
    becameEstimate: number
    becameReal: number
    biggest: GraphChange[]
  }
}

export interface GraphVersion extends GraphVersionSummary {
  report: GraphReport | null
}

export interface GraphVersionList {
  /** 지금 운영 길찾기가 쓰는 경로망: 'file' 또는 'v{id}'. */
  activeSource: string
  bundledExportedAt: string
  versions: GraphVersionSummary[]
}

const UPLOAD_TIMEOUT_MS = 90_000

function headers(devKey: string) {
  return { headers: { 'X-Dev-Key': devKey }, skipTokenRefresh: true }
}

export function listGraphVersions(devKey: string): Promise<GraphVersionList> {
  return apiRequest<GraphVersionList>('/map/route-graph/versions', headers(devKey))
}

export function getGraphVersion(devKey: string, id: number): Promise<GraphVersion> {
  return apiRequest<GraphVersion>(`/map/route-graph/versions/${id}`, headers(devKey))
}

/** 올리면 서버가 검사하고 운영 경로망과 건물 쌍마다 비교한다(수 초). 운영에는 아직 쓰이지 않는 초안. */
export function uploadGraphVersion(
  devKey: string,
  body: { sourceName: string; graph: ServerGraph; backup: unknown },
): Promise<GraphVersion> {
  return apiRequest<GraphVersion>('/map/route-graph/versions', {
    ...headers(devKey),
    method: 'POST',
    body,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    retries: 0,
  })
}

/** 운영에 적용 — 바로 앱 길찾기가 이 경로망을 쓴다(배포 없음). 예전 버전을 다시 적용하면 되돌아간다. */
export function activateGraphVersion(devKey: string, id: number): Promise<GraphVersion> {
  return apiRequest<GraphVersion>(`/map/route-graph/versions/${id}/activate`, { ...headers(devKey), method: 'POST', retries: 0 })
}

/** 올릴 때 함께 보낸 백업 원본(조사 도구로 다시 불러오기). */
export async function fetchGraphBackup(devKey: string, id: number): Promise<string> {
  const value = await apiRequest<unknown>(`/map/route-graph/versions/${id}/backup`, { ...headers(devKey), timeoutMs: 30_000 })
  return JSON.stringify(value)
}

/** 길 시험: 이 버전 경로망과 지금 운영 경로망으로 찾은 길을 나란히. */
export function previewGraphRoutes(
  devKey: string,
  id: number,
  query: { from: number; fromFloor: number | null; to: number; toFloor: number | null },
): Promise<{ version: RouteAlternative[]; active: RouteAlternative[] }> {
  const floor = (name: string, value: number | null) => (value === null ? '' : `&${name}=${encodeURIComponent(String(value))}`)
  return apiRequest(
    `/map/route-graph/versions/${id}/routes?from=${query.from}${floor('fromFloor', query.fromFloor)}&to=${query.to}${floor('toFloor', query.toFloor)}`,
    { ...headers(devKey), timeoutMs: 30_000 },
  )
}
