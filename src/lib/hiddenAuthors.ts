import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ANONYMOUS_NAME } from '../utils/nickname'

/**
 * "이 사용자의 제보 숨기기"(App Store 가이드라인 1.2의 사용자 차단). 기기에만 저장하고 서버로 보내지 않는다.
 *
 * 서버가 제보마다 싣는 `authorKey`(사용자 id 의 HMAC, 불투명한 값)로 작성자를 구분한다. `authorKey` 가 없는
 * 서버(배포 전)에서는 숨기기 메뉴 자체를 보이지 않는다. 숨긴 목록은 설정 > 일반 > 숨긴 사용자에서 풀 수 있다.
 */

const STORAGE_KEY = '@hongikon_hidden_authors'
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

let entries: HiddenAuthor[] = []
let keySet: ReadonlySet<string> = new Set()
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(next: HiddenAuthor[]) {
  entries = next
  keySet = new Set(next.map((entry) => entry.key))
  listeners.forEach((listener) => listener())
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch((error) => {
    if (__DEV__) console.warn('숨긴 사용자 목록을 저장하지 못했어요:', error)
  })
}

function isHiddenAuthor(value: unknown): value is HiddenAuthor {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<HiddenAuthor>
  return typeof entry.key === 'string' && entry.key.length > 0 && typeof entry.label === 'string'
}

/** 앱 시작 후 처음 구독할 때 한 번 불러온다. */
function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve()
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return
        // 불러오기 전에 이미 숨긴 항목(빠른 탭)이 있으면 함께 남긴다.
        const restored = parsed.filter(isHiddenAuthor).map((entry) => ({
          key: entry.key,
          // 예전 버전이 저장한 가린 실명('홍**')도 불러올 때 '익명 사용자'로 바꾼다.
          label: hiddenAuthorLabel(entry.label),
          hiddenAt: typeof entry.hiddenAt === 'string' ? entry.hiddenAt : new Date(0).toISOString(),
        }))
        const merged = [...entries, ...restored.filter((entry) => !keySet.has(entry.key))]
        emit(merged)
      })
      .catch((error) => {
        if (__DEV__) console.warn('숨긴 사용자 목록을 불러오지 못했어요:', error)
      })
      .finally(() => {
        loaded = true
      })
  }
  return loading
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
  void ensureLoaded().then(persist)
}

export function unhideAuthor(key: string): void {
  if (!keySet.has(key)) return
  emit(entries.filter((entry) => entry.key !== key))
  void ensureLoaded().then(persist)
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
