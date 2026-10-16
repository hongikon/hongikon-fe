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

// ── 브라우저 도우미(웹 전용 화면) ──

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
