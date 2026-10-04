import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ANONYMOUS_NAME } from '../utils/nickname'

/**
 * "이 사용자의 제보 숨기기"(App Store 가이드라인 1.2의 사용자 차단). 기기에만 저장하고 서버로 보내지 않는다.
 *
 * 서버가 제보마다 싣는 `authorKey`(사용자 id 의 HMAC, 불투명한 값)로 작성자를 구분한다. `authorKey` 가 없는
 * 서버(배포 전)에서는 숨기기 메뉴 자체를 보이지 않는다. 숨긴 목록은 설정 > 일반 > 숨긴 사용자에서 풀 수 있다.
 *
 * 목록은 "누가 쓰는 중인지"마다 따로 둔다(같은 기기를 다른 사람이 쓰면 이전 사람의 차단 목록이 보이면 안 된다).
 * - 로그인: 계정마다 `@hongikon_hidden_authors:u:{회원 번호}`. 회원 번호는 액세스 토큰의 sub(`getUserIdFromToken`).
 * - 둘러보기·로그아웃 상태: `@hongikon_hidden_authors:guest` 하나.
 * - 로그인했는데 토큰에서 회원 번호를 못 읽으면(서버 형식이 바뀐 경우 등) 저장하지 않고 이번 실행 메모리에만 둔다 —
 *   다른 계정과 섞일 수 있는 공용 칸에 넣는 것보다 낫다.
 * 어느 칸을 쓸지는 `AuthContext` 가 로그인 상태가 바뀔 때마다 `setHiddenAuthorsOwner` 로 알린다. 로그아웃하면 게스트 칸으로,
 * 다시 로그인하면 그 계정 칸으로 바뀌고 구독 중인 화면이 다시 그려진다. 탈퇴하면 그 계정 칸을 지운다(`deleteAccountHiddenAuthors`).
 *
 * 예전 버전은 칸 없이 `@hongikon_hidden_authors` 하나에 두었다. 업데이트 뒤 처음 칸이 정해질 때 한 번, 그때 상태의 칸
 * (로그인 중이면 그 계정, 아니면 게스트)으로 옮기고 예전 키를 지운다.
 */

const LEGACY_STORAGE_KEY = '@hongikon_hidden_authors'
const STORAGE_KEY_PREFIX = '@hongikon_hidden_authors:'
const GUEST_SCOPE = 'guest'
/** 회원 번호를 모르는 로그인 — 저장하지 않는 칸. */
const MEMORY_ONLY_SCOPE = 'memory'

/** 앱 닉네임이 없는 사용자(가린 로그인 이름·익명)를 목록에서 부르는 이름. */
export const HIDDEN_ANONYMOUS_LABEL = '익명 사용자'

/**
 * 숨긴 목록에 남길 이름. 앱 닉네임(한글·영문·숫자·_)만 그대로 두고, 가린 카카오·Apple 이름('홍**')이나 '익명'은
 * '익명 사용자'로 바꾼다 — 성씨 같은 실명 일부로 상대가 누군지 짐작되지 않게 한다. 앱 닉네임에는 '*'가 들어갈 수 없다.
 */
export function hiddenAuthorLabel(name: string | null | undefined): string {
  const trimmed = name?.trim()
  if (!trimmed || trimmed === ANONYMOUS_NAME || trimmed.includes('*')) return HIDDEN_ANONYMOUS_LABEL
  return trimmed
}
/** 너무 길어지지 않게 최근 것만 남긴다. */
const MAX_ENTRIES = 500

export interface HiddenAuthor {
  /** 서버가 준 authorKey. */
  key: string
  /** 목록에 보일 이름: 앱 닉네임, 없으면 '익명 사용자'(`hiddenAuthorLabel`). */
  label: string
  /** 숨긴 시각(ISO). */
  hiddenAt: string
}

/** 지금 목록의 주인. `AuthContext` 가 상태를 정하기 전에는 '알 수 없음'이라 아무것도 불러오지 않는다. */
export type HiddenAuthorsOwner = { kind: 'guest' } | { kind: 'account'; userId: number | null }

function scopeOf(owner: HiddenAuthorsOwner): string {
  if (owner.kind === 'guest') return GUEST_SCOPE
  return owner.userId === null ? MEMORY_ONLY_SCOPE : `u:${owner.userId}`
}

function storageKeyOf(target: string): string | null {
  return target === MEMORY_ONLY_SCOPE ? null : STORAGE_KEY_PREFIX + target
}

let entries: HiddenAuthor[] = []
let keySet: ReadonlySet<string> = new Set()
/** 지금 칸. undefined 면 아직 모른다(로그인 상태 복원 전). */
let scope: string | undefined
/** 칸이 바뀔 때마다 올린다. 늦게 끝난 불러오기·저장이 다른 칸의 목록을 덮지 않게 견준다. */
let generation = 0
/** 이 번호의 칸을 다 불러왔는지. */
let loadedGeneration = -1
let loading: Promise<void> | null = null
/** 예전(칸 없는) 키 옮기기. 앱 실행마다 한 번, 처음 저장 칸을 불러올 때 시작한다(`readBucket`). */
let legacyMigration: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(next: HiddenAuthor[]) {
  entries = next
  keySet = new Set(next.map((entry) => entry.key))
  listeners.forEach((listener) => listener())
}

function persist() {
  const key = scope === undefined ? null : storageKeyOf(scope)
  if (!key) return
  AsyncStorage.setItem(key, JSON.stringify(entries)).catch((error) => {
    if (__DEV__) console.warn('숨긴 사용자 목록을 저장하지 못했어요:', error)
  })
}

/** 지금 칸을 다 불러온 뒤 저장한다. 그 사이 칸이 바뀌었으면(로그아웃 등) 저장하지 않는다 — 다른 사람 칸을 덮지 않게. */
function persistAfterLoad() {
  const gen = generation
  void ensureLoaded().then(() => {
    if (gen === generation) persist()
  })
}

function isHiddenAuthor(value: unknown): value is HiddenAuthor {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<HiddenAuthor>
  return typeof entry.key === 'string' && entry.key.length > 0 && typeof entry.label === 'string'
}

/** 저장된 JSON → 목록. 형식이 틀리면 빈 목록. */
function parseStored(raw: string | null): HiddenAuthor[] {
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isHiddenAuthor).map((entry) => ({
    key: entry.key,
    // 예전 버전이 저장한 가린 실명('홍**')도 불러올 때 '익명 사용자'로 바꾼다.
    label: hiddenAuthorLabel(entry.label),
    hiddenAt: typeof entry.hiddenAt === 'string' ? entry.hiddenAt : new Date(0).toISOString(),
  }))
}

/** 앞 목록을 우선해 합친다(같은 authorKey 는 한 번만). */
function mergeEntries(first: readonly HiddenAuthor[], second: readonly HiddenAuthor[]): HiddenAuthor[] {
  const seen = new Set(first.map((entry) => entry.key))
  return [...first, ...second.filter((entry) => !seen.has(entry.key))].slice(0, MAX_ENTRIES)
}

/** 예전 키(칸 없는 목록)를 이 칸으로 옮기고 예전 키를 지운다. 없으면 할 일이 없다. */
async function migrateLegacyInto(key: string): Promise<void> {
  const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacyRaw === null) return
  const merged = mergeEntries(parseStored(await AsyncStorage.getItem(key)), parseStored(legacyRaw))
  await AsyncStorage.setItem(key, JSON.stringify(merged))
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY)
}

/**
 * 칸 하나를 읽는다. 이번 실행에서 처음 읽는 저장 칸이면 예전 키를 먼저 이 칸으로 옮긴다 — 처음 정해진 칸이 곧 업데이트
 * 직후의 상태(로그인 중이면 그 계정, 아니면 게스트)다. 옮기기는 한 번만 시작하고, 그 사이 칸이 바뀌어 다른 칸을 읽더라도
 * 옮기기가 끝나길 기다린다(두 칸에 함께 옮겨지지 않게). 옮기다 실패하면 예전 키가 남아 다음 실행 때 다시 옮긴다.
 */
async function readBucket(key: string): Promise<HiddenAuthor[]> {
  if (!legacyMigration) {
    legacyMigration = migrateLegacyInto(key).catch((error) => {
      if (__DEV__) console.warn('예전 숨긴 사용자 목록을 옮기지 못했어요:', error)
    })
  }
  await legacyMigration
  return parseStored(await AsyncStorage.getItem(key))
}

/** 지금 칸을 (아직이면) 불러온다. 칸을 모르면 할 일이 없다. */
function ensureLoaded(): Promise<void> {
  if (scope === undefined || loadedGeneration === generation) return Promise.resolve()
  if (!loading) {
    const gen = generation
    const key = storageKeyOf(scope)
    loading = (key ? readBucket(key) : Promise.resolve<HiddenAuthor[]>([]))
      .then((restored) => {
        if (gen !== generation) return
        // 불러오기 전에 이미 숨긴 항목(빠른 탭)이 있으면 함께 남긴다.
        emit(mergeEntries(entries, restored))
      })
      .catch((error) => {
        if (__DEV__) console.warn('숨긴 사용자 목록을 불러오지 못했어요:', error)
      })
      .finally(() => {
        if (gen === generation) loadedGeneration = gen
      })
  }
  return loading
}

/**
 * 목록의 주인을 정한다(`AuthContext` 가 로그인 상태가 바뀔 때마다 부른다). 같은 칸이면 아무 일도 없다 — 토큰 재발급은
 * 회원 번호가 같아 칸이 그대로다. 칸이 바뀌면 화면의 목록을 비우고 새 칸을 불러와 구독 중인 화면을 다시 그린다.
 * 칸을 정하기 전에 숨긴 항목(앱을 켜자마자 누른 경우)은 처음 정해진 칸에 넣는다.
 */
export function setHiddenAuthorsOwner(owner: HiddenAuthorsOwner): void {
  const next = scopeOf(owner)
  if (next === scope) return
  const first = scope === undefined
  scope = next
  generation += 1
  loading = null
  emit(first ? entries : [])
  void ensureLoaded().then(() => {
    // 칸을 정하기 전에 숨긴 항목이 있었으면 합친 목록을 저장해 둔다.
    if (first && entries.length > 0) persistAfterLoad()
  })
}

/**
 * 탈퇴한 계정의 숨긴 목록을 기기에서 지운다. 지금 그 계정 칸이면 먼저 게스트 칸으로 바꿔, 뒤늦은 저장이 지운 칸을 되살리지 않게 한다.
 * 회원 번호를 모르면(저장하지 않는 칸) 지울 것이 없다. 실패해도 탈퇴는 막지 않는다.
 */
export async function deleteAccountHiddenAuthors(userId: number | null): Promise<void> {
  if (userId === null) return
  const target = scopeOf({ kind: 'account', userId })
  if (scope === target) setHiddenAuthorsOwner({ kind: 'guest' })
  const key = storageKeyOf(target)
  if (!key) return
  try {
    await AsyncStorage.removeItem(key)
  } catch (error) {
    if (__DEV__) console.warn('탈퇴한 계정의 숨긴 사용자 목록을 지우지 못했어요:', error)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  void ensureLoaded()
  return () => {
    listeners.delete(listener)
  }
}

export function hideAuthor(key: string, label: string): void {
  if (!key || keySet.has(key)) return
  const next = [{ key, label: hiddenAuthorLabel(label), hiddenAt: new Date().toISOString() }, ...entries].slice(0, MAX_ENTRIES)
  emit(next)
  // 불러오기 전이면 불러온 뒤(합쳐진 목록으로) 저장한다.
  persistAfterLoad()
}

export function unhideAuthor(key: string): void {
  if (!keySet.has(key)) return
  emit(entries.filter((entry) => entry.key !== key))
  persistAfterLoad()
}

/** 숨긴 사용자 목록(최근 숨긴 순). */
export function useHiddenAuthors(): HiddenAuthor[] {
  return useSyncExternalStore(subscribe, () => entries, () => entries)
}

/** 숨긴 authorKey 집합. 목록이 바뀔 때만 새 객체가 된다(useMemo 의존성으로 쓸 수 있다). */
export function useHiddenAuthorKeys(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => keySet, () => keySet)
}

/** 숨긴 사용자의 제보를 뺀다. authorKey 가 없는 제보(구버전 서버)는 그대로 둔다. */
export function withoutHiddenAuthors<T extends { authorKey?: string | null }>(
  reports: readonly T[],
  hidden: ReadonlySet<string>,
): T[] {
  if (hidden.size === 0) return reports as T[]
  return reports.filter((report) => !report.authorKey || !hidden.has(report.authorKey))
}
