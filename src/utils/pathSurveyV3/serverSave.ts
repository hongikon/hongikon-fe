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

export type PushOutcome<V extends UploadedVersion = UploadedVersion> =
  | { kind: 'noKey' }
  | { kind: 'blocked' }
  | { kind: 'same'; versionId: number | null }
  | { kind: 'busy' }
  | { kind: 'canceled' }
  | { kind: 'noRoute'; fingerprint: string }
  | { kind: 'uploaded'; version: V; fingerprint: string; skipped: number }
  | { kind: 'failed'; text: string }

/**
 * One save to the server, in this order: no key, blocked (other tab or damaged data), same content, one already
 * going, then `beforeUpload` (may ask the person; false cancels), backup, server graph, upload. The caller records the state.
 * `begin` and `end` bracket everything after the busy check, so a second save meanwhile sees busy.
 * The key only goes to `upload`; it is never part of the outcome.
 */
export async function pushSurvey<V extends UploadedVersion>(input: {
  store: StoreV3
  devKey: string | undefined
  blocked: boolean
  state: ServerSaveState
  busy?: boolean
  begin?: () => void
  end?: () => void
  beforeUpload?: () => Promise<boolean>
  name?: string
  now?: number
  upload: (devKey: string, body: { sourceName: string; graph: ServerGraph; backup: unknown }) => Promise<V>
  errorText: (error: unknown) => string
}): Promise<PushOutcome<V>> {
  const { store, devKey, blocked, state } = input
  if (!devKey) return { kind: 'noKey' }
  if (blocked) return { kind: 'blocked' }
  const fingerprint = storeFingerprint(store)
  if (!shouldUpload(state, fingerprint)) return { kind: 'same', versionId: state.lastVersionId }
  if (input.busy) return { kind: 'busy' }
  const now = input.now ?? Date.now()
  input.begin?.()
  try {
    if (input.beforeUpload && !(await input.beforeUpload())) return { kind: 'canceled' }
    const backup = JSON.parse(serializeBackup(store, now))
    const made = buildServerGraph(backup)
    if (made.graph.vertices.length === 0 || made.graph.edges.length === 0) return { kind: 'noRoute', fingerprint }
    const sourceName = input.name?.trim() || `저장 ${new Date(now).toLocaleString('ko-KR')}`
    const version = await input.upload(devKey, { sourceName, graph: made.graph, backup })
    return { kind: 'uploaded', version, fingerprint, skipped: made.skipped.length }
  } catch (e) {
    return { kind: 'failed', text: input.errorText(e) }
  } finally {
    input.end?.()
  }
}

/** The state after an outcome. noKey, blocked, busy and canceled leave it as it was. */
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

// Times from the server

/** The server sends UTC without a zone (LocalDateTime). Null when it cannot be read. */
export function serverTimeMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()
  return Number.isNaN(ms) ? null : ms
}

export function serverTimeText(iso: string | null | undefined): string {
  const ms = serverTimeMs(iso)
  if (ms === null) return iso ?? ''
  return new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export interface VersionLike {
  id: number
  sourceName: string | null
  createdAt: string
}

/** "#15(time, name)" for notices and confirmations. */
export const versionLabel = (v: VersionLike): string => `#${v.id}(${[serverTimeText(v.createdAt), v.sourceName?.trim()].filter(Boolean).join(', ')})`

/** Records a server version as what this browser now holds: after loading it, or after finding it equal to the local content. */
export const afterAdopt = (state: ServerSaveState, version: VersionLike, fingerprint: string, now = Date.now()): ServerSaveState =>
  afterUpload(state, version.id, fingerprint, serverTimeMs(version.createdAt) ?? now)

// Status line under the save button

export type StatusTone = 'ok' | 'warn' | 'error' | 'muted'

export interface ServerStatusLine {
  text: string
  tone: StatusTone
  /** Pressing the line tries the upload again. */
  retry: boolean
}

const trimEnd = (text: string) => text.trim().replace(/[.\s]+$/, '')

export function serverStatusLine(view: ServerSaveView, state: ServerSaveState, errors: number, clock: (at: number) => string): ServerStatusLine {
  const last = state.lastVersionId === null ? '' : `#${state.lastVersionId}${state.lastAt === null ? '' : ` ${clock(state.lastAt)}`}`
  const withErrors = (text: string) => (errors > 0 ? `${text} (점검 오류 ${errors}건 포함)` : text)
  switch (view) {
    case 'blocked':
      return { text: '서버 저장 멈춤: 이 탭은 저장을 멈췄어요', tone: 'error', retry: false }
    case 'noKey':
      return { text: '브라우저에만 저장됨: 이 탭에 서버 암호키가 없어요', tone: 'muted', retry: false }
    case 'saving':
      return { text: withErrors('서버 저장 중...'), tone: 'muted', retry: false }
    case 'synced':
      return { text: withErrors(`서버 저장됨 ${last}`), tone: 'ok', retry: false }
    case 'failed':
      return { text: withErrors(`서버 저장 실패: ${trimEnd(state.lastError ?? '')}. 눌러서 다시 시도`), tone: 'error', retry: true }
    case 'noRoute':
      return { text: '서버에 올릴 길 없음', tone: 'muted', retry: false }
    case 'never':
      return { text: withErrors('서버에 안 올린 변경 있음 (서버 저장한 적 없음)'), tone: 'warn', retry: false }
    case 'changed':
      return { text: withErrors(`서버에 안 올린 변경 있음 (마지막 서버 저장 ${last})`), tone: 'warn', retry: false }
  }
}

// Notices after a save

const SERVER_PART: Partial<Record<PushOutcome['kind'], string>> = {
  noKey: '이 탭에 서버 암호키가 없어 서버에는 올리지 않았어요.',
  noRoute: '서버 저장 안 함(올릴 길 없음).',
  busy: '서버에 올리는 중이라 이번 것은 건너뛰었어요. 끝난 뒤 다시 눌러 주세요.',
  canceled: '서버에는 올리지 않았어요.',
}

/** The server half of a notice. Null for blocked: the notice that saving stopped stays. */
export function serverNoticeText(outcome: PushOutcome, browserSaved = true): string | null {
  if (outcome.kind === 'blocked') return null
  if (outcome.kind === 'uploaded') return `서버 초안 #${outcome.version.id}${browserSaved ? '에도' : '에는'} 저장했어요.`
  if (outcome.kind === 'same') return `서버에는 이미 같은 내용${outcome.versionId === null ? '' : `(#${outcome.versionId})`}이 있어 다시 올리지 않았어요.`
  if (outcome.kind === 'failed') return `서버 저장 실패: ${trimEnd(outcome.text)}. 저장을 다시 누르거나 위 상태 줄을 눌러 다시 시도해 주세요.`
  return SERVER_PART[outcome.kind] ?? null
}

export const BROWSER_SAVE_FAILED_TEXT = '브라우저에는 저장하지 못했어요(저장 공간 부족). 저장 지점 탭에서 필요 없는 것을 지워 주세요.'

/** The save button notice: the browser result first, then the server result. Null keeps the notice on screen. */
export function saveNoticeText(browserSaved: boolean, outcome: PushOutcome): string | null {
  const server = serverNoticeText(outcome, browserSaved)
  if (server === null) return browserSaved ? null : BROWSER_SAVE_FAILED_TEXT
  return `${browserSaved ? '브라우저에 저장했어요.' : BROWSER_SAVE_FAILED_TEXT} ${server}`
}

// Entering the screen

export type ServerOffer<V extends VersionLike = VersionLike> =
  /** (a) This browser never saved to the server and has a survey: offer to save it as the base. Never automatic. */
  | { kind: 'baseline' }
  /** (b) newer = true: another device saved after this browser. (c) newer = false: this browser is empty. */
  | { kind: 'load'; version: V; newer: boolean }

export function offerText(offer: ServerOffer): string {
  if (offer.kind === 'baseline') return '이 브라우저의 조사 내용이 서버에 아직 없어요. 이 내용을 서버에 기준으로 저장할까요?'
  return offer.newer
    ? `다른 기기에서 저장한 ${versionLabel(offer.version)}가 서버에 있어요.`
    : `이 브라우저는 비어 있어요. 서버에 저장된 ${versionLabel(offer.version)}가 있어요.`
}

const newestOf = <V extends { id: number }>(versions: readonly V[]): V | null =>
  versions.reduce<V | null>((best, v) => (!best || v.id > best.id ? v : best), null)

/**
 * The one list call when the screen opens. Order: empty browser (c), no server record (a), otherwise (b) by id;
 * in (b) the backup is fetched only when the ids differ, and the same content is recorded quietly instead of offered.
 * `seenId` is the newest id seen, the reference for the check before the next save. Failures give no offer.
 */
export async function checkOnEntry<V extends VersionLike>(input: {
  state: ServerSaveState
  store: Pick<StoreV3, 'nodes' | 'edges'>
  listVersions: () => Promise<{ versions: readonly V[] }>
  backupFingerprint: (id: number) => Promise<string>
  now?: number
}): Promise<{ offer: ServerOffer<V> | null; state: ServerSaveState; seenId: number | null }> {
  const { state, store } = input
  let versions: readonly V[]
  try {
    versions = (await input.listVersions()).versions
  } catch {
    return { offer: null, state, seenId: null }
  }
  const newest = newestOf(versions)
  const seenId = newest?.id ?? null
  if (store.nodes.length === 0) return { offer: newest ? { kind: 'load', version: newest, newer: false } : null, state, seenId }
  if (state.lastVersionId === null) return { offer: { kind: 'baseline' }, state, seenId }
  const newer = newerOnServer(versions, state)
  if (!newer) return { offer: null, state, seenId }
  try {
    const fingerprint = storeFingerprint(store)
    if ((await input.backupFingerprint(newer.id)) === fingerprint) {
      return { offer: null, state: afterAdopt(state, newer, fingerprint, input.now), seenId }
    }
  } catch {
    // Could not compare: offer it, the person decides.
  }
  return { offer: { kind: 'load', version: newer, newer: true }, state, seenId }
}

// Before an upload from the save button

/**
 * Asks before making a new draft when another device saved after the newest version this tab knows (its own draft,
 * a loaded one, or the newest seen in a list). With nothing known yet (first save, list never read) it does not ask.
 * A failed list does not stop the upload. Canceling keeps `seenId`, so the next save asks again.
 */
export async function overwriteCheck<V extends VersionLike>(input: {
  lastVersionId: number | null
  seenId: number | null
  listVersions: () => Promise<{ versions: readonly V[] }>
  confirm: (newer: V) => boolean
}): Promise<{ go: boolean; seenId: number | null }> {
  const known = [input.lastVersionId, input.seenId].filter((id): id is number => id !== null)
  if (known.length === 0) return { go: true, seenId: input.seenId }
  let versions: readonly V[]
  try {
    versions = (await input.listVersions()).versions
  } catch {
    return { go: true, seenId: input.seenId }
  }
  const newer = newerOnServer(versions, { lastVersionId: Math.max(...known) })
  if (!newer) return { go: true, seenId: newestOf(versions)?.id ?? input.seenId }
  return input.confirm(newer) ? { go: true, seenId: newer.id } : { go: false, seenId: input.seenId }
}

export const overwriteQuestion = (newer: VersionLike): string =>
  `다른 기기에서 저장한 ${versionLabel(newer)}가 서버에 있어요. 그래도 이 내용으로 새 초안을 만들까요?`

/** Loading over local work that is not on the server: shown first in the overwrite confirmation. */
export const UNSENT_WARNING_TEXT = '서버에 안 올린 변경이 있어요. 불러오면 저장 지점에만 남아요.'

export const hasUnsentChanges = (state: Pick<ServerSaveState, 'lastFingerprint'>, store: Pick<StoreV3, 'nodes' | 'edges'>): boolean =>
  (store.nodes.length > 0 || store.edges.length > 0) && state.lastFingerprint !== storeFingerprint(store)
