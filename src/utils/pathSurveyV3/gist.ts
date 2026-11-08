import type { StorageLike, StoreV3 } from './store'
import { defaultStorage } from './store'
import { parseBackupText, serializeBackup, storeFingerprint } from './transfer'

/**
 * Gist sync of the whole v3 survey as one file. It follows the v2 way of working but shares nothing with it:
 * own storage key, own file name in the gist. Other files in a gist are left alone by GitHub's PATCH.
 * The token stays in this browser. It goes in the Authorization header only, never in messages or files.
 */

export const GIST_KEY_V3 = 'hongikon.pathSurvey.v3.gist'
export const GIST_FILE_V3 = 'hongikon-path-survey-v3.json'
const GIST_API = 'https://api.github.com/gists'
const TIMEOUT_MS = 20000

export interface GistStateV3 {
  token: string
  gistId: string
  lastSyncAt: number | null
  /** Local content at the last sync. A different fingerprint now means there are changes not sent yet. */
  lastSyncFingerprint: string | null
  /** exportedAt of the remote file at the last sync. A different one means somebody else sent something. */
  lastRemoteAt: number | null
}

export const EMPTY_GIST_STATE: GistStateV3 = { token: '', gistId: '', lastSyncAt: null, lastSyncFingerprint: null, lastRemoteAt: null }

export function loadGistState(storage: StorageLike | null = defaultStorage()): GistStateV3 {
  try {
    const raw = JSON.parse(storage?.getItem(GIST_KEY_V3) ?? 'null')
    if (!raw || typeof raw !== 'object') return EMPTY_GIST_STATE
    return {
      token: typeof raw.token === 'string' ? raw.token : '',
      gistId: typeof raw.gistId === 'string' ? raw.gistId : '',
      lastSyncAt: typeof raw.lastSyncAt === 'number' ? raw.lastSyncAt : null,
      lastSyncFingerprint: typeof raw.lastSyncFingerprint === 'string' ? raw.lastSyncFingerprint : null,
      lastRemoteAt: typeof raw.lastRemoteAt === 'number' ? raw.lastRemoteAt : null,
    }
  } catch {
    return EMPTY_GIST_STATE
  }
}

export function saveGistState(state: GistStateV3, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(GIST_KEY_V3, JSON.stringify({ ...state, token: state.token.trim(), gistId: state.gistId.trim() }))
  } catch {
    // Then it only lasts for this tab.
  }
}

/** A failure with screen text. It never contains the token. */
export class GistErrorV3 extends Error {}

const REASONS: Record<number, string> = {
  401: '토큰이 맞지 않거나 만료됐어요(401).',
  403: '토큰에 Gist 권한이 없거나 GitHub 요청 한도를 넘었어요(403).',
  404: 'Gist 를 찾지 못했어요. gist id 와, 그 Gist 가 이 토큰 계정 것인지 확인해 주세요(404).',
  422: 'GitHub 가 보낸 내용을 받지 않았어요(422).',
}

async function request(url: string, init: { method?: string; body?: string }, token: string, fetchImpl: typeof fetch): Promise<any> {
  if ((globalThis as any).navigator?.onLine === false) throw new GistErrorV3('오프라인이에요. 변경은 이 브라우저에 있으니 온라인이 되면 다시 눌러 주세요.')
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null
  let res: Response
  try {
    res = await fetchImpl(url, {
      method: init.method ?? 'GET',
      body: init.body,
      signal: controller?.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch (e) {
    // The message of the original error is not passed on: it is not ours and could quote the request.
    const aborted = (e as any)?.name === 'AbortError'
    throw new GistErrorV3(aborted ? `GitHub 응답이 ${TIMEOUT_MS / 1000}초 안에 오지 않았어요.` : 'GitHub 에 닿지 못했어요. 네트워크 연결을 확인해 주세요.')
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (res.ok) return res.json()
  throw new GistErrorV3(REASONS[res.status] ?? `GitHub 오류 ${res.status}${res.status >= 500 ? '. 잠시 뒤 다시 시도해 주세요' : ''}.`)
}

export interface RemoteSurvey {
  store: StoreV3
  exportedAt: number | null
  fingerprint: string
}

/** The survey file in the gist. null when the gist has no v3 file yet. */
export async function fetchGistSurvey(state: Pick<GistStateV3, 'token' | 'gistId'>, fetchImpl: typeof fetch = (globalThis as any).fetch, now = Date.now()): Promise<RemoteSurvey | null> {
  const id = state.gistId.trim()
  if (!id) throw new GistErrorV3('gist id 를 먼저 넣어 주세요.')
  const gist = await request(`${GIST_API}/${encodeURIComponent(id)}`, {}, state.token.trim(), fetchImpl)
  const file = gist?.files?.[GIST_FILE_V3]
  if (!file) return null
  let content: string = file.content ?? ''
  if (file.truncated && file.raw_url) {
    try {
      const raw = await fetchImpl(file.raw_url)
      if (!raw.ok) throw new Error('raw')
      content = await raw.text()
    } catch {
      throw new GistErrorV3('Gist 파일이 커서 따로 받아야 하는데 받지 못했어요.')
    }
  }
  try {
    const store = parseBackupText(content, now)
    const exportedAt = JSON.parse(content).exportedAt
    return { store, exportedAt: typeof exportedAt === 'number' ? exportedAt : null, fingerprint: storeFingerprint(store) }
  } catch (e) {
    throw new GistErrorV3(`Gist 의 ${GIST_FILE_V3} 을 읽지 못했어요. ${(e as Error).message}`)
  }
}

/** Sends the whole survey. Without a gist id it makes a new secret gist. Returns the gist id. */
export async function pushGistSurvey(
  state: Pick<GistStateV3, 'token' | 'gistId'>,
  store: StoreV3,
  fetchImpl: typeof fetch = (globalThis as any).fetch,
  now = Date.now(),
): Promise<string> {
  const token = state.token.trim()
  if (!token) throw new GistErrorV3('GitHub 토큰을 먼저 넣어 주세요.')
  const files = { [GIST_FILE_V3]: { content: serializeBackup(store, now) } }
  const id = state.gistId.trim()
  const gist = id
    ? await request(`${GIST_API}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ files }) }, token, fetchImpl)
    : await request(GIST_API, { method: 'POST', body: JSON.stringify({ description: 'hongikon path survey v3', public: false, files }) }, token, fetchImpl)
  if (typeof gist?.id !== 'string') throw new GistErrorV3('GitHub 응답에 gist id 가 없어요.')
  return gist.id
}

/** True when sending would replace something this browser has not seen. */
export function remoteHasOtherChanges(state: Pick<GistStateV3, 'lastRemoteAt'>, remote: RemoteSurvey | null, localFingerprint: string): boolean {
  if (!remote || remote.fingerprint === localFingerprint) return false
  return remote.exportedAt === null || remote.exportedAt !== state.lastRemoteAt
}

export const afterSync = (state: GistStateV3, gistId: string, fingerprint: string, remoteAt: number | null, now = Date.now()): GistStateV3 => ({
  ...state,
  gistId,
  lastSyncAt: now,
  lastSyncFingerprint: fingerprint,
  lastRemoteAt: remoteAt,
})
