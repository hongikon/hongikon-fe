import { isHexColor, normalizeModule, type SurveyModule, type SurveyStore } from './pathSurveyStore'

/**
 * 경로망 조사 모듈 내보내기/가져오기. React Native 를 가져오지 않아 Node 단위 테스트에서 그대로 읽힌다.
 * 파일 모양: { format: 'hongikon.pathSurvey', version: 2, exportedAt, modules, customColors }.
 * 같은 id 의 모듈이 이미 있으면 updatedAt 이 더 최신인 쪽을 쓰고, 이쪽 것을 덮어쓰기 전에는 화면이 확인을 받는다.
 */

export const EXPORT_FORMAT = 'hongikon.pathSurvey'

export interface SurveyBundle {
  format: typeof EXPORT_FORMAT
  version: 2
  exportedAt: number
  modules: SurveyModule[]
  customColors: string[]
}

export function bundleOf(modules: readonly SurveyModule[], customColors: readonly string[] = [], now = Date.now()): SurveyBundle {
  return { format: EXPORT_FORMAT, version: 2, exportedAt: now, modules: [...modules], customColors: [...customColors] }
}

export const serializeAll = (store: SurveyStore, now = Date.now()) => JSON.stringify(bundleOf(store.modules, store.customColors, now), null, 2)
export const serializeModule = (module: SurveyModule, now = Date.now()) => JSON.stringify(bundleOf([module], [], now), null, 2)

/** 내보낸 파일, 저장소 값 그대로, 모듈 하나 — 어느 모양이든 받는다. 못 읽으면 이유를 담은 Error. */
export function parseBundle(text: string): { modules: SurveyModule[]; customColors: string[] } {
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('JSON 으로 읽지 못했어요. 내보낸 내용을 그대로 붙여 넣었는지 확인해 주세요.')
  }
  const list: unknown[] = Array.isArray(raw?.modules) ? raw.modules : raw && typeof raw === 'object' && Array.isArray(raw.nodes) ? [raw] : []
  if (list.length === 0) throw new Error('모듈이 들어 있지 않아요.')
  const modules = list.map((m) => normalizeModule(m)).filter((m): m is SurveyModule => !!m)
  if (modules.length === 0) throw new Error('모듈 모양이 맞지 않아 읽지 못했어요.')
  const colors: unknown[] = Array.isArray(raw?.customColors) ? raw.customColors : []
  return { modules, customColors: colors.filter(isHexColor).map((c) => c.toUpperCase()) }
}

export interface ImportPlan {
  /** 이쪽에 없는 모듈. */
  added: SurveyModule[]
  /** 같은 id 인데 들어온 쪽이 더 최신 — 덮어쓰기 전에 확인한다. */
  newer: SurveyModule[]
  /** 같은 id 인데 이쪽이 더 최신이거나 같다 — 이쪽 것을 둔다. */
  kept: SurveyModule[]
  customColors: string[]
}

export function planImport(store: SurveyStore, incoming: { modules: readonly SurveyModule[]; customColors?: readonly string[] }): ImportPlan {
  const plan: ImportPlan = { added: [], newer: [], kept: [], customColors: [...(incoming.customColors ?? [])] }
  for (const m of incoming.modules) {
    const local = store.modules.find((x) => x.id === m.id)
    if (!local) plan.added.push(m)
    else if (m.updatedAt > local.updatedAt) plan.newer.push(m)
    else plan.kept.push(m)
  }
  return plan
}

/**
 * 지점 id 는 전체에서 유일해야 한다. 다른 모듈과 겹치는 지점 id 가 있으면(예: 두 기기에서 따로 변환한 v1 '미분류' 의 n153)
 * 이 모듈 안에서 '모듈id-' 접두사를 붙이고 간선도 같이 고친다.
 */
export function ensureUniqueNodeIds(module: SurveyModule, others: readonly SurveyModule[]): SurveyModule {
  const taken = new Set(others.filter((o) => o.id !== module.id).flatMap((o) => o.nodes.map((n) => n.id)))
  const rename = new Map<string, string>()
  const own = new Set(module.nodes.map((n) => n.id))
  for (const n of module.nodes) {
    if (!taken.has(n.id)) continue
    let id = `${module.id}-${n.id}`
    for (let i = 2; taken.has(id) || own.has(id); i += 1) id = `${module.id}-${n.id}-${i}`
    rename.set(n.id, id)
    own.add(id)
  }
  if (rename.size === 0) return module
  const r = (id: string) => rename.get(id) ?? id
  return {
    ...module,
    nodes: module.nodes.map((n) => ({ ...n, id: r(n.id) })),
    edges: module.edges.map((e) => ({ ...e, a: r(e.a), b: r(e.b) })),
  }
}

/** 계획을 적용한다. overwrite 가 false 면 newer 도 건너뛴다(사용자가 덮어쓰기를 거절한 경우). */
export function applyImport(store: SurveyStore, plan: ImportPlan, overwrite: boolean, now = Date.now()): SurveyStore {
  const replacing = overwrite ? plan.newer : []
  if (plan.added.length === 0 && replacing.length === 0 && plan.customColors.every((c) => store.customColors.includes(c))) return store
  let modules = store.modules.map((m) => replacing.find((x) => x.id === m.id) ?? m)
  for (const m of plan.added) modules = [...modules, m]
  const touched = new Set([...plan.added, ...replacing].map((m) => m.id))
  modules = modules.map((m) => (touched.has(m.id) ? ensureUniqueNodeIds(m, modules) : m))
  const active = modules.find((m) => m.id === store.activeModuleId)
  return {
    ...store,
    modules,
    activeModuleId: active && active.status === 'draft' ? active.id : null,
    customColors: [...new Set([...store.customColors, ...plan.customColors])],
    updatedAt: now,
  }
}

export function describePlan(plan: ImportPlan): string {
  const parts = [`새 모듈 ${plan.added.length}`]
  if (plan.newer.length) parts.push(`더 최신이라 덮어쓸 모듈 ${plan.newer.length}(${plan.newer.map((m) => m.name).join(', ')})`)
  if (plan.kept.length) parts.push(`이 기기 것이 최신이거나 같아 그대로 둘 모듈 ${plan.kept.length}`)
  return parts.join(' · ')
}

// 브라우저 도우미(웹 전용 화면)

/** 파일로 저장(다운로드). 웹이 아니면 false. */
export function downloadText(filename: string, text: string): boolean {
  const g = globalThis as any
  if (!g.document || !g.URL?.createObjectURL || !g.Blob) return false
  const url = g.URL.createObjectURL(new g.Blob([text], { type: 'application/json;charset=utf-8' }))
  const a = g.document.createElement('a')
  a.href = url
  a.download = filename
  g.document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => g.URL.revokeObjectURL(url), 1000)
  return true
}

export async function copyText(text: string): Promise<boolean> {
  try {
    const clip = (globalThis as any).navigator?.clipboard
    if (!clip?.writeText) return false
    await clip.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 파일 고르기 창을 열어 고른 파일 내용을 돌려준다. 취소하면 null. */
export function pickTextFile(): Promise<string | null> {
  const g = globalThis as any
  if (!g.document) return Promise.resolve(null)
  return new Promise((resolve) => {
    const input = g.document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json,text/plain'
    input.onchange = async () => {
      const file = input.files?.[0]
      resolve(file ? await file.text() : null)
    }
    input.click()
  })
}

export const stamp = (now = new Date()) =>
  `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes(),
  ).padStart(2, '0')}`

// GitHub Gist 동기화(조사자 1명 가정)
// 토큰과 gist id 는 사용자가 화면에서 넣고 그 기기 localStorage 에만 둔다. 코드·로그·오류 문구에 토큰을 넣지 않는다.

export const GIST_SETTINGS_KEY = 'hongikon.pathSurvey.gist'
export const GIST_META_KEY = 'hongikon.pathSurvey.gistMeta'
export const GIST_FILE = 'hongikon-path-survey.json'
const GIST_API = 'https://api.github.com/gists'
const GIST_TIMEOUT_MS = 20000

export interface GistSettings {
  token: string
  gistId: string
}

export interface GistMeta {
  /** 마지막으로 올리거나 불러온 시각. */
  lastSyncAt: number | null
  /** 그때 저장소의 updatedAt — 이보다 지금 저장소가 새로우면 올리지 않은 변경이 있다. */
  syncedStoreUpdatedAt: number | null
  /** 그때 모듈별 updatedAt. 이 기기에서 지운 모듈과 다른 기기에서 새로 만든 모듈을 가르는 데 쓴다. */
  synced: Record<string, number>
}

export const EMPTY_META: GistMeta = { lastSyncAt: null, syncedStoreUpdatedAt: null, synced: {} }

type Storage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void }
const ls = (): Storage | null => {
  try {
    return (globalThis as any).localStorage ?? null
  } catch {
    return null
  }
}

function readJSON<T>(key: string, fallback: T, storage: Storage | null): T {
  try {
    const raw = storage?.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export const loadGistSettings = (storage = ls()): GistSettings => {
  const s = readJSON<GistSettings>(GIST_SETTINGS_KEY, { token: '', gistId: '' }, storage)
  return { token: typeof s.token === 'string' ? s.token : '', gistId: typeof s.gistId === 'string' ? s.gistId : '' }
}

export function saveGistSettings(settings: GistSettings, storage = ls()): void {
  try {
    if (!settings.token && !settings.gistId) storage?.removeItem?.(GIST_SETTINGS_KEY)
    else storage?.setItem(GIST_SETTINGS_KEY, JSON.stringify({ token: settings.token.trim(), gistId: settings.gistId.trim() }))
  } catch {
    // 저장이 막혀 있으면 이번 탭에서만 쓴다.
  }
}

export const loadGistMeta = (storage = ls()): GistMeta => readJSON<GistMeta>(GIST_META_KEY, EMPTY_META, storage)

export function saveGistMeta(meta: GistMeta, storage = ls()): void {
  try {
    storage?.setItem(GIST_META_KEY, JSON.stringify(meta))
  } catch {
    // 표시용 정보라 저장이 안 돼도 조사 내용에는 영향이 없다.
  }
}

export function metaAfterSync(store: SurveyStore, remoteModules: readonly SurveyModule[] = [], now = Date.now()): GistMeta {
  const synced: Record<string, number> = {}
  for (const m of remoteModules) synced[m.id] = m.updatedAt
  for (const m of store.modules) synced[m.id] = Math.max(synced[m.id] ?? 0, m.updatedAt)
  return { lastSyncAt: now, syncedStoreUpdatedAt: store.updatedAt, synced }
}

export const hasUnsyncedChanges = (store: SurveyStore, meta: GistMeta) =>
  meta.syncedStoreUpdatedAt === null ? store.modules.length > 0 : store.updatedAt > meta.syncedStoreUpdatedAt

/** 사람이 읽을 사유를 담은 실패. 토큰은 넣지 않는다. */
export class GistError extends Error {}

const isOffline = () => (globalThis as any).navigator?.onLine === false

async function gistFetch(url: string, init: { method?: string; body?: string }, token: string, fetchImpl: typeof fetch): Promise<any> {
  if (isOffline()) throw new GistError('오프라인이에요. 변경은 이 기기에 저장돼 있으니 온라인이 되면 다시 눌러 주세요.')
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), GIST_TIMEOUT_MS) : null
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
    const aborted = (e as any)?.name === 'AbortError'
    throw new GistError(aborted ? `GitHub 응답이 ${GIST_TIMEOUT_MS / 1000}초 안에 오지 않았어요.` : 'GitHub 에 닿지 못했어요(네트워크 연결을 확인해 주세요).')
  } finally {
    if (timer) clearTimeout(timer)
  }
  if (res.ok) return res.json()
  const reasons: Record<number, string> = {
    401: '토큰이 맞지 않거나 만료됐어요(401).',
    403: '토큰에 Gist 권한이 없거나 GitHub 요청 한도를 넘었어요(403).',
    404: 'Gist 를 찾지 못했어요. gist id 와, 그 Gist 가 이 토큰 계정 것인지 확인해 주세요(404).',
    422: 'GitHub 가 보낸 내용을 받지 않았어요(422).',
  }
  throw new GistError(reasons[res.status] ?? `GitHub 오류 ${res.status}${res.status >= 500 ? ' — 잠시 뒤 다시 시도해 주세요' : ''}.`)
}

/** Gist 에 올라간 조사 내용. 파일이 없으면 null. */
export async function fetchGistBundle(
  settings: GistSettings,
  fetchImpl: typeof fetch = (globalThis as any).fetch,
): Promise<{ modules: SurveyModule[]; customColors: string[] } | null> {
  if (!settings.gistId.trim()) throw new GistError('gist id 를 먼저 넣어 주세요.')
  const gist = await gistFetch(`${GIST_API}/${encodeURIComponent(settings.gistId.trim())}`, {}, settings.token.trim(), fetchImpl)
  const file = gist?.files?.[GIST_FILE]
  if (!file) return null
  let content: string = file.content ?? ''
  if (file.truncated && file.raw_url) {
    try {
      const raw = await fetchImpl(file.raw_url)
      if (!raw.ok) throw new Error()
      content = await raw.text()
    } catch {
      throw new GistError('Gist 파일이 커서 따로 받아야 하는데 받지 못했어요.')
    }
  }
  try {
    return parseBundle(content)
  } catch (e) {
    throw new GistError(`Gist 의 ${GIST_FILE} 을 읽지 못했어요 · ${(e as Error).message}`)
  }
}

/** 올린다. gist id 가 비어 있으면 비공개 Gist 를 새로 만들고 그 id 를 돌려준다. */
export async function pushGistBundle(
  settings: GistSettings,
  store: SurveyStore,
  fetchImpl: typeof fetch = (globalThis as any).fetch,
  now = Date.now(),
): Promise<string> {
  if (!settings.token.trim()) throw new GistError('GitHub 토큰을 먼저 넣어 주세요.')
  const files = { [GIST_FILE]: { content: serializeAll(store, now) } }
  const id = settings.gistId.trim()
  const gist = id
    ? await gistFetch(`${GIST_API}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ files }) }, settings.token.trim(), fetchImpl)
    : await gistFetch(GIST_API, { method: 'POST', body: JSON.stringify({ description: '홍익온 경로망 조사', public: false, files }) }, settings.token.trim(), fetchImpl)
  if (typeof gist?.id !== 'string') throw new GistError('GitHub 응답에 gist id 가 없어요.')
  return gist.id
}

export interface PushConflicts {
  /** 원격 쪽 updatedAt 이 이 기기보다 새로운 모듈 — 올리면 원격 변경이 사라진다. */
  remoteNewer: SurveyModule[]
  /** 원격에만 있고, 마지막 동기화 뒤 이 기기에서 지운 것도 아닌 모듈 — 다른 기기에서 새로 만든 것. */
  remoteOnly: SurveyModule[]
}

export function pushConflicts(store: SurveyStore, remote: readonly SurveyModule[], meta: GistMeta): PushConflicts {
  const out: PushConflicts = { remoteNewer: [], remoteOnly: [] }
  for (const r of remote) {
    const local = store.modules.find((m) => m.id === r.id)
    if (local) {
      if (r.updatedAt > local.updatedAt) out.remoteNewer.push(r)
    } else if (!(r.id in meta.synced) || r.updatedAt > meta.synced[r.id]) {
      out.remoteOnly.push(r)
    }
  }
  return out
}

/** 불러올 때, 마지막 동기화 뒤 이 기기에서 지운 모듈(원격도 그 뒤 바뀌지 않음)은 되살리지 않는다. */
export function dropLocallyDeleted(plan: ImportPlan, meta: GistMeta): { plan: ImportPlan; skipped: SurveyModule[] } {
  const skipped = plan.added.filter((m) => m.id in meta.synced && m.updatedAt <= meta.synced[m.id])
  return { plan: { ...plan, added: plan.added.filter((m) => !skipped.includes(m)) }, skipped }
}
