import type { GraphReport } from '../../apis/routeGraph'
import { buildServerGraph, type ServerGraph } from './serverGraph'
import { defaultStorage, type StorageLike, type StoreV3 } from './store'
import { serializeBackup, storeFingerprint } from './transfer'

/**
 * Save button to server draft: the small state kept in this browser and the rules around it.
 * Pure functions only; the screen does the request. The state never holds the dev key or any other secret:
 * only version ids, times, content fingerprints and screen text.
 */

export const SERVER_KEY_V3 = 'hongikon.pathSurvey.v3.server'

export interface ServerSaveState {
  /** Draft id the last successful save made (or that this browser loaded and found equal). */
  lastVersionId: number | null
  lastAt: number | null
  /** Content fingerprint of that draft. Same fingerprint now means nothing to upload. */
  lastFingerprint: string | null
  /** Screen text of the last failed save, cleared by the next success or skip. */
  lastError: string | null
  /** Content found to have no route to upload (no edge). Not a failure. */
  noRouteFingerprint: string | null
}

export const EMPTY_SERVER_STATE: ServerSaveState = {
  lastVersionId: null,
  lastAt: null,
  lastFingerprint: null,
  lastError: null,
  noRouteFingerprint: null,
}

const numberOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

/** Only the known fields are read back, so nothing else stored under the key ever reaches the screen. */
export function loadServerSaveState(storage: StorageLike | null = defaultStorage()): ServerSaveState {
  try {
    const raw = JSON.parse(storage?.getItem(SERVER_KEY_V3) ?? 'null')
    if (!raw || typeof raw !== 'object') return EMPTY_SERVER_STATE
    return {
      lastVersionId: numberOrNull(raw.lastVersionId),
      lastAt: numberOrNull(raw.lastAt),
      lastFingerprint: textOrNull(raw.lastFingerprint),
      lastError: textOrNull(raw.lastError),
      noRouteFingerprint: textOrNull(raw.noRouteFingerprint),
    }
  } catch {
    return EMPTY_SERVER_STATE
  }
}

/** Writes the known fields only, so a caller passing a wider object cannot store extra values. */
export function saveServerSaveState(state: ServerSaveState, storage: StorageLike | null = defaultStorage()): void {
  const clean: ServerSaveState = {
    lastVersionId: numberOrNull(state.lastVersionId),
    lastAt: numberOrNull(state.lastAt),
    lastFingerprint: textOrNull(state.lastFingerprint),
    lastError: textOrNull(state.lastError),
    noRouteFingerprint: textOrNull(state.noRouteFingerprint),
  }
  try {
    storage?.setItem(SERVER_KEY_V3, JSON.stringify(clean))
  } catch {
    // Only the status text depends on this.
  }
}

export const afterUpload = (state: ServerSaveState, versionId: number, fingerprint: string, now = Date.now()): ServerSaveState => ({
  ...state,
  lastVersionId: versionId,
  lastAt: now,
  lastFingerprint: fingerprint,
  lastError: null,
  noRouteFingerprint: null,
})

export const afterFailure = (state: ServerSaveState, text: string): ServerSaveState => ({ ...state, lastError: text })

export const afterNoRoute = (state: ServerSaveState, fingerprint: string): ServerSaveState => ({ ...state, lastError: null, noRouteFingerprint: fingerprint })

/** Nothing to send: the server already has this content as the last draft from here. */
export const afterSkip = (state: ServerSaveState): ServerSaveState => (state.lastError ? { ...state, lastError: null } : state)

/** Upload only when the content differs from the last successful draft. A failure in between does not matter: the server still has that draft. */
export const shouldUpload = (state: Pick<ServerSaveState, 'lastFingerprint'>, fingerprint: string): boolean => state.lastFingerprint !== fingerprint

export type ServerSaveView =
  | 'noKey' // no dev key in this tab: browser save only
  | 'blocked' // another tab saved, or the stored data was damaged: no saving at all
  | 'saving'
  | 'failed'
  | 'noRoute' // nothing routable to upload, not a failure
  | 'never' // never saved to the server from this browser
  | 'changed' // changes not on the server yet
  | 'synced'

export function serverSaveStateOf(
  state: ServerSaveState,
  fingerprint: string,
  flags: { hasKey: boolean; blocked: boolean; saving: boolean },
): ServerSaveView {
  if (flags.blocked) return 'blocked'
  if (!flags.hasKey) return 'noKey'
  if (flags.saving) return 'saving'
  if (state.lastFingerprint === fingerprint) return 'synced'
  if (state.lastError) return 'failed'
  if (state.noRouteFingerprint === fingerprint) return 'noRoute'
  return state.lastFingerprint === null ? 'never' : 'changed'
}

/** The newest version on the server that this browser did not make or load, or null. Ids only grow, so they order versions. */
export function newerOnServer<V extends { id: number }>(versions: readonly V[], state: Pick<ServerSaveState, 'lastVersionId'>): V | null {
  let newest: V | null = null
  for (const v of versions) if (!newest || v.id > newest.id) newest = v
  if (!newest) return null
  return state.lastVersionId === null || newest.id > state.lastVersionId ? newest : null
}

/** Lines to put first in the apply confirmation. A missing report is a warning, not a stop. */
export function activationWarnings(report: GraphReport | null | undefined): string[] {
  if (!report) return ['검사 결과를 받지 못했어요. 떨어진 점, 건물 code, 끊긴 길을 확인하지 못한 채 적용해요.']
  const lines: string[] = []
  const { checks, comparison } = report
  if (checks.detachedVertices > 0) lines.push(`큰 길망과 떨어진 점 ${checks.detachedVertices}개(길찾기에 안 쓰임): ${checks.detachedSample.join(', ')}`)
  if (checks.unresolvedBuildingCodes.length > 0) lines.push(`서버 건물로 이어지지 않는 건물 code: ${checks.unresolvedBuildingCodes.join(', ')}`)
  if (comparison.becameEstimate > 0) lines.push(`운영보다 길이 끊겨 직선 어림이 된 건물 쌍 ${comparison.becameEstimate}`)
  return lines
}

export interface UploadedVersion {
  id: number
  vertexCount: number
  edgeCount: number
}

export type PushOutcome =
  | { kind: 'noKey' }
  | { kind: 'blocked' }
  | { kind: 'same'; versionId: number | null }
  | { kind: 'noRoute'; fingerprint: string }
  | { kind: 'uploaded'; version: UploadedVersion; fingerprint: string; skipped: number }
  | { kind: 'failed'; text: string }

/**
 * One save to the server, in this order: no key, blocked (other tab or damaged data), same content, then
 * backup, server graph, upload. The caller guards against a second run while one is going, and records the state.
 * The key only goes to `upload`; it is never part of the outcome.
 */
export async function pushSurvey(input: {
  store: StoreV3
  devKey: string | undefined
  blocked: boolean
  state: ServerSaveState
  name?: string
  now?: number
  upload: (devKey: string, body: { sourceName: string; graph: ServerGraph; backup: unknown }) => Promise<UploadedVersion>
  errorText: (error: unknown) => string
}): Promise<PushOutcome> {
  const { store, devKey, blocked, state } = input
  if (!devKey) return { kind: 'noKey' }
  if (blocked) return { kind: 'blocked' }
  const fingerprint = storeFingerprint(store)
  if (!shouldUpload(state, fingerprint)) return { kind: 'same', versionId: state.lastVersionId }
  const now = input.now ?? Date.now()
  try {
    const backup = JSON.parse(serializeBackup(store, now))
    const made = buildServerGraph(backup)
    if (made.graph.vertices.length === 0 || made.graph.edges.length === 0) return { kind: 'noRoute', fingerprint }
    const sourceName = input.name?.trim() || `저장 ${new Date(now).toLocaleString('ko-KR')}`
    const version = await input.upload(devKey, { sourceName, graph: made.graph, backup })
    return { kind: 'uploaded', version, fingerprint, skipped: made.skipped.length }
  } catch (e) {
    return { kind: 'failed', text: input.errorText(e) }
  }
}

/** The state after an outcome. noKey and blocked leave it as it was. */
export function stateAfter(state: ServerSaveState, outcome: PushOutcome, now = Date.now()): ServerSaveState {
  if (outcome.kind === 'uploaded') return afterUpload(state, outcome.version.id, outcome.fingerprint, now)
  if (outcome.kind === 'failed') return afterFailure(state, outcome.text)
  if (outcome.kind === 'noRoute') return afterNoRoute(state, outcome.fingerprint)
  if (outcome.kind === 'same') return afterSkip(state)
  return state
}

export const KEY_REJECTED_TEXT = '서버가 암호키를 받지 않았어요. 탭을 닫고 /dev/path-survey-v3 에서 암호키를 다시 입력해 주세요.'

/** Route graph requests send the dev key, not a login, so 401 and 403 mean the key was refused. */
export function serverErrorText(error: unknown, fallback: string, generic: (error: unknown, fallback: string) => string): string {
  const status = (error as { status?: unknown } | null)?.status
  if (status === 401 || status === 403) return KEY_REJECTED_TEXT
  return generic(error, fallback)
}
