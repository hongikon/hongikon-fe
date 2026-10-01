import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CategoryKey } from '../constants/colors'
import { SUBSCRIBABLE_ITEMS } from '../constants/news'
import { useAuth } from './AuthContext'
import {
  getNotificationCategories,
  setNotificationCategoryEnabled,
} from '../apis/notifications'
import {
  deleteMySubscription,
  getMySubscriptions,
  isSubscriptionApiMissing,
  putMySubscription,
} from '../apis/subscriptions'
import {
  getNotificationSettings,
  isNotificationSettingsApiMissing,
  patchNotificationSettings,
} from '../apis/notificationSettings'
import { isRetryableError } from '../apis/client'
import { useReconnect } from '../lib/connectivity'
import {
  createBoardSyncQueue,
  diffBoardSubscriptions,
  mergeBoardSubscriptions,
  type BoardTarget,
} from '../utils/boardSubscriptionSync'
import {
  resolveReportAlertPrefs,
  sameReportAlertPrefs,
  type ReportAlertPrefs,
} from '../utils/reportAlertSync'
import {
  DEFAULT_SETTINGS,
  restoreSettings,
  type Settings,
  type StoredSettings,
} from '../utils/settingsStorage'

export { ALL_CATEGORIES } from '../utils/settingsStorage'

const STORAGE_KEY = '@hongik_settings'

interface SettingsContextValue {
  settings: Settings
  toggleSubscriptionAlert: () => void
  toggleAlertCategory: (cat: CategoryKey) => void
  toggleSubscribedDept: (id: string) => void
  /** 구독 중인 게시판의 알림만 켜고 끈다. 구독하지 않은 게시판이면 아무 일도 하지 않는다. */
  toggleDeptAlert: (id: string) => void
  isDeptAlertOn: (id: string) => boolean
  /** 내 제보 결과(승인·반려) 알림 켜고 끄기. */
  toggleReportStatusAlert: () => void
  /** 캠퍼스 새 제보 알림 켜고 끄기. */
  toggleNewReportAlert: () => void
  toggleBookmark: (id: string) => void
  isBookmarked: (id: string) => boolean
  resetSettings: () => void
}

/** 앱이 그릴 수 있는 게시판(TREE_DATA 리프). 서버에서만 온 모르는 sourceId 를 거르는 데 쓴다. */
const KNOWN_BOARD_IDS: ReadonlySet<string> = new Set(SUBSCRIBABLE_ITEMS.map((item) => item.id))

function toReportAlertPrefs(s: Settings): ReportAlertPrefs {
  return { reportStatus: s.reportStatusAlert, newReports: s.newReportAlert }
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return

        const { settings: restored, changed } = restoreSettings(JSON.parse(raw) as StoredSettings)
        setSettings(restored)

        // 옮긴 값이 있으면 다음 실행부터 다시 계산하지 않도록 바로 저장한다.
        if (changed) return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(restored))
      })
      .catch((error) => {
        if (__DEV__) console.warn('설정을 불러오지 못해 기본값으로 시작합니다:', error)
      })
      .finally(() => setLoaded(true))
  }, [])

  /**
   * 저장은 상태가 바뀐 뒤에 따라간다.
   *
   * 예전에는 setSettings 의 갱신 함수 안에서 저장까지 했는데 갱신 함수는 순수해야 한다.
   * React 가 같은 갱신 함수를 두 번 부르면 저장도 두 번 일어나고 setState 도 겹쳐 돌았다.
   */
  useEffect(() => {
    if (!loaded) return

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch((error) => {
      if (__DEV__) console.warn('설정을 저장하지 못했습니다:', error)
    })
  }, [settings, loaded])

  /**
   * 서버에 아직 반영하지 못한 알림 분야 변경(분야 → 켜짐 여부).
   * 끊긴 상태에서 토글해도 화면은 바로 바뀌고, 연결이 돌아오면 마지막 값만 다시 보낸다.
   * PATCH 가 절댓값을 덮어쓰는 요청이라 늦게 다시 보내도 결과가 어긋나지 않는다.
   */
  const pendingCategoryChangesRef = useRef(new Map<CategoryKey, boolean>())
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  // 서버에서 분야를 끝내 못 받아온 상태. 재연결·포그라운드 때 다시 부를지 판단한다.
  const [categoryFetchFailed, setCategoryFetchFailed] = useState(false)
  const [categoryFetchNonce, setCategoryFetchNonce] = useState(0)

  const isLoggedIn = Boolean(accessToken)

  // 로그아웃·계정 전환 시 이전 계정의 미전송 변경을 다른 계정에 보내면 안 된다.
  // 토큰 재발급(accessToken 값만 바뀜)에는 비우지 않는다 — 계정이 바뀌려면 반드시 로그아웃(null)을 거친다.
  // 서버 값을 받아오는 아래 효과보다 먼저 돌아야 해서 앞에 둔다.
  useEffect(() => {
    pendingCategoryChangesRef.current.clear()
    setCategoryFetchFailed(false)
  }, [isLoggedIn])

  /**
   * 로그인하면 서버에 저장된 알림 분야가 기기 로컬 값을 덮는다 — 로그인한
   * 사용자에게는 서버가 진실 소스다. 게스트(accessToken 없음)는 계속 로컬 값만 쓴다.
   * 단, 아직 서버에 못 보낸 변경은 사용자가 방금 고른 값이라 서버 값보다 우선한다.
   */
  useEffect(() => {
    if (!loaded || !accessToken) return

    let cancelled = false
    getNotificationCategories(accessToken)
      .then((categories) => {
        if (cancelled) return
        setCategoryFetchFailed(false)
        const pending = pendingCategoryChangesRef.current
        const enabled = categories
          .filter((c) => pending.get(c.category) ?? c.enabled)
          .map((c) => c.category)
        setSettings((prev) => ({ ...prev, alertCategories: enabled }))
      })
      .catch((error) => {
        if (cancelled) return
        // 로컬 값으로 계속 쓸 수 있어 화면을 막지 않는다. 연결이 돌아오면 다시 받아온다.
        setCategoryFetchFailed(isRetryableError(error))
        if (__DEV__) console.warn('알림 분야 설정을 불러오지 못했습니다:', error)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, loaded, categoryFetchNonce])

  /** 못 보낸 변경을 다시 보낸다. 보내는 사이 사용자가 또 바꿨으면 그 값은 남겨 둔다. */
  const flushPendingCategoryChanges = useCallback(() => {
    if (!accessToken) return
    const pending = pendingCategoryChangesRef.current
    pending.forEach((enabled, category) => {
      setNotificationCategoryEnabled(category, enabled, accessToken)
        .then(() => {
          if (pending.get(category) === enabled) pending.delete(category)
        })
        .catch((error) => {
          if (!isRetryableError(error)) pending.delete(category)
          if (__DEV__) console.warn('알림 분야 설정을 다시 저장하지 못했습니다:', error)
        })
    })
  }, [accessToken])

  /**
   * 게시판 구독 서버 동기화(`/users/me/subscriptions`). 새 소식 푸시는 서버 구독 목록과
   * 게시판별 `alertEnabled` 로 대상을 정해서, 로컬에만 두면 아무도 받지 못한다.
   *
   * - 화면은 바로 바꾸고(낙관적 반영) 서버 저장은 게시판별 대기열이 뒤따른다(`createBoardSyncQueue`).
   * - 서버에 구독 API 가 아직 없으면(404, 또는 재발급 뒤에도 401 — `isSubscriptionApiMissing`) 이번 실행 동안은 로컬에만 두고 다시 보내지 않는다.
   *   다음 실행 때 로그인 합치기가 로컬 상태로 차이를 다시 계산하므로 잃는 값은 없다.
   * - 게스트는 로컬에만 둔다. 로그인하면 합집합으로 합쳐 서버로 올라간다.
   */
  const accessTokenRef = useRef(accessToken)
  accessTokenRef.current = accessToken
  const boardQueueRef = useRef<ReturnType<typeof createBoardSyncQueue> | null>(null)
  if (!boardQueueRef.current) {
    boardQueueRef.current = createBoardSyncQueue({
      send: async (sourceId, target) => {
        const token = accessTokenRef.current
        // 로그아웃 직후라면 보낼 계정이 없다. 대기열은 로그아웃 때 비워진다.
        if (!token) return
        if (target === null) await deleteMySubscription(sourceId, token)
        else await putMySubscription(sourceId, target, token)
      },
      classify: (error) =>
        isSubscriptionApiMissing(error) ? 'unsupported' : isRetryableError(error) ? 'retry' : 'drop',
      onUnsupported: () => {
        if (__DEV__) console.warn('서버에 게시판 구독 API 가 아직 없어(404·재발급 뒤 401) 이번 실행 동안 구독은 기기에만 저장합니다.')
      },
      log: (message, error) => {
        if (__DEV__ && !isSubscriptionApiMissing(error)) console.warn(message, error)
      },
    })
  }
  const boardQueue = boardQueueRef.current
  /** 로그인 직후 합치기가 연결 문제로 실패했는지. 그러면 재연결·포그라운드 때 다시 한다. */
  const [boardSyncFailed, setBoardSyncFailed] = useState(false)
  const [boardSyncNonce, setBoardSyncNonce] = useState(0)

  // 로그아웃하면 이전 계정의 미전송 변경을 버린다. 토큰 재발급(accessToken 값만 바뀜)에는 비우지 않는다 —
  // 계정이 바뀌려면 반드시 로그아웃(null)을 거친다.
  useEffect(() => {
    if (isLoggedIn) return
    boardQueue.clear()
    setBoardSyncFailed(false)
  }, [isLoggedIn, boardQueue])

  /** 로그인 상태일 때만 서버로 보낸다. 게스트 변경은 로그인 때 합치기가 한꺼번에 올린다. */
  const queueBoardChange = useCallback(
    (sourceId: string, target: BoardTarget) => {
      if (accessTokenRef.current) boardQueue.set(sourceId, target)
    },
    [boardQueue],
  )

  /**
   * 로그인하면 서버 구독과 로컬 구독을 합친다(기준은 `mergeBoardSubscriptions` 주석).
   * 합친 뒤 서버와 다른 게시판만 대기열에 넣어 보낸다.
   */
  useEffect(() => {
    if (!loaded || !isLoggedIn || boardQueue.isUnsupported()) return

    let cancelled = false
    ;(async () => {
      const token = accessTokenRef.current
      if (!token) return
      const server = await getMySubscriptions(token)
      if (cancelled) return

      const pending = boardQueue.pending
      const toState = (s: Settings) => ({ subscribed: s.subscribedDepts, muted: s.mutedDepts })
      const merged = mergeBoardSubscriptions(toState(settingsRef.current), server, KNOWN_BOARD_IDS, pending)
      setSettings((prev) => {
        // 기다리는 사이 사용자가 바꾼 값(prev)을 기준으로 다시 합친다.
        const next = mergeBoardSubscriptions(toState(prev), server, KNOWN_BOARD_IDS, pending)
        return { ...prev, subscribedDepts: next.subscribed, mutedDepts: next.muted }
      })
      setBoardSyncFailed(false)

      const { toPut, toDelete } = diffBoardSubscriptions(merged, server, KNOWN_BOARD_IDS)
      // 이미 대기 중인 게시판은 그 값이 더 최신이라 건드리지 않는다.
      for (const [sourceId, alertEnabled] of toPut) {
        if (!pending.has(sourceId)) boardQueue.set(sourceId, alertEnabled)
      }
      for (const sourceId of toDelete) {
        if (!pending.has(sourceId)) boardQueue.set(sourceId, null)
      }
    })().catch((error) => {
      if (cancelled) return
      if (isSubscriptionApiMissing(error)) {
        boardQueue.markUnsupported()
        return
      }
      // 로컬 값으로 계속 쓸 수 있어 화면을 막지 않는다. 연결이 돌아오면 다시 합친다.
      setBoardSyncFailed(isRetryableError(error))
      if (__DEV__) console.warn('게시판 구독을 서버와 맞추지 못했습니다:', error)
    })

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, loaded, boardSyncNonce, boardQueue])

  /**
   * 제보 알림 설정 서버 동기화(`/users/me/notification-settings`). 제보 푸시는 서버 값으로 대상을 정한다.
   * 맞추는 규칙은 `utils/reportAlertSync.ts` — 서버에 못 올린 변경(`reportAlertsDirty`)이 있으면 로컬이 이긴다.
   * 서버에 API 가 아직 없으면(404) 이번 실행 동안은 기기에만 두고, dirty 로 남겨 배포 뒤 다음 실행 때 올린다.
   */
  const reportAlertsUnsupportedRef = useRef(false)
  const reportAlertsSeqRef = useRef(0)
  const [reportAlertsFetchFailed, setReportAlertsFetchFailed] = useState(false)
  const [reportAlertsFetchNonce, setReportAlertsFetchNonce] = useState(0)

  /** 이 값을 서버로 올린다. 보내는 사이 또 바뀌었으면 dirty 를 그대로 둔다(마지막 요청이 다시 지운다). */
  const pushReportAlerts = useCallback((prefs: ReportAlertPrefs) => {
    const token = accessTokenRef.current
    if (!token || reportAlertsUnsupportedRef.current) return
    const seq = ++reportAlertsSeqRef.current
    patchNotificationSettings(prefs, token)
      .then(() => {
        if (seq !== reportAlertsSeqRef.current) return
        setSettings((prev) =>
          sameReportAlertPrefs(toReportAlertPrefs(prev), prefs) ? { ...prev, reportAlertsDirty: false } : prev,
        )
      })
      .catch((error) => {
        if (isNotificationSettingsApiMissing(error)) {
          reportAlertsUnsupportedRef.current = true
          if (__DEV__) console.warn('서버에 제보 알림 설정 API 가 아직 없어(404) 이번 실행 동안 기기에만 저장합니다.')
          return
        }
        // 연결 문제면 dirty 로 남겨 두었다가 재연결·포그라운드 때 다시 보낸다.
        if (isRetryableError(error)) return
        // 서버가 거절한 변경은 다시 보내도 같으니 서버 값을 다시 받아 화면을 맞춘다.
        if (seq === reportAlertsSeqRef.current) {
          setSettings((prev) => ({ ...prev, reportAlertsDirty: false }))
          setReportAlertsFetchNonce((n) => n + 1)
        }
        if (__DEV__) console.warn('제보 알림 설정이 거절되었습니다:', error)
      })
  }, [])

  // 로그아웃하면 이전 계정이 못 올린 변경을 다음 계정에 올리지 않게 dirty 를 지운다.
  // (처음부터 게스트인 실행에서는 지우지 않는다 — 게스트로 바꾼 값은 로그인 때 올라가야 한다.)
  const wasLoggedInRef = useRef(isLoggedIn)
  useEffect(() => {
    if (wasLoggedInRef.current && !isLoggedIn) {
      reportAlertsSeqRef.current++
      setReportAlertsFetchFailed(false)
      setSettings((prev) => (prev.reportAlertsDirty ? { ...prev, reportAlertsDirty: false } : prev))
    }
    wasLoggedInRef.current = isLoggedIn
  }, [isLoggedIn])

  useEffect(() => {
    if (!loaded || !isLoggedIn || reportAlertsUnsupportedRef.current) return

    let cancelled = false
    const token = accessTokenRef.current
    if (!token) return
    getNotificationSettings(token)
      .then((server) => {
        if (cancelled) return
        setReportAlertsFetchFailed(false)
        const current = settingsRef.current
        const { toPatch } = resolveReportAlertPrefs(toReportAlertPrefs(current), server, current.reportAlertsDirty)
        setSettings((prev) => {
          const resolved = resolveReportAlertPrefs(toReportAlertPrefs(prev), server, prev.reportAlertsDirty)
          return {
            ...prev,
            reportStatusAlert: resolved.next.reportStatus,
            newReportAlert: resolved.next.newReports,
            reportAlertsDirty: resolved.toPatch !== null,
          }
        })
        if (toPatch) pushReportAlerts(toPatch)
      })
      .catch((error) => {
        if (cancelled) return
        if (isNotificationSettingsApiMissing(error)) {
          reportAlertsUnsupportedRef.current = true
          return
        }
        setReportAlertsFetchFailed(isRetryableError(error))
        if (__DEV__) console.warn('제보 알림 설정을 불러오지 못했습니다:', error)
      })

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, loaded, reportAlertsFetchNonce, pushReportAlerts])

  const recoverServerSync = useCallback(() => {
    if (!accessToken) return
    if (!reportAlertsUnsupportedRef.current) {
      if (reportAlertsFetchFailed) setReportAlertsFetchNonce((n) => n + 1)
      else if (settingsRef.current.reportAlertsDirty) pushReportAlerts(toReportAlertPrefs(settingsRef.current))
    }
    if (categoryFetchFailed) setCategoryFetchNonce((n) => n + 1)
    if (pendingCategoryChangesRef.current.size > 0) flushPendingCategoryChanges()
    if (boardQueue.isUnsupported()) return
    if (boardSyncFailed) setBoardSyncNonce((n) => n + 1)
    if (boardQueue.pending.size > 0) boardQueue.flush()
  }, [
    accessToken,
    categoryFetchFailed,
    flushPendingCategoryChanges,
    boardSyncFailed,
    boardQueue,
    reportAlertsFetchFailed,
    pushReportAlerts,
  ])

  useReconnect(recoverServerSync, Boolean(accessToken))

  useEffect(() => {
    if (!accessToken) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') recoverServerSync()
    })
    return () => subscription.remove()
  }, [accessToken, recoverServerSync])

  const toggleSubscriptionAlert = useCallback(() => {
    setSettings((prev) => ({ ...prev, subscriptionAlert: !prev.subscriptionAlert }))
  }, [])

  /**
   * 화면은 바로 바꾸고(낙관적 반영) 서버 저장은 뒤따른다. 서버 호출은 setSettings 갱신 함수
   * 밖에서 한다 — 갱신 함수는 순수해야 하고, React 가 두 번 부르면 요청도 두 번 나간다.
   */
  const toggleAlertCategory = useCallback(
    (cat: CategoryKey) => {
      const nextEnabled = !settingsRef.current.alertCategories.includes(cat)
      const applyLocal = (enabled: boolean) =>
        setSettings((prev) => {
          const without = prev.alertCategories.filter((c) => c !== cat)
          return { ...prev, alertCategories: enabled ? [...without, cat] : without }
        })

      applyLocal(nextEnabled)
      if (!accessToken) return

      const pending = pendingCategoryChangesRef.current
      pending.set(cat, nextEnabled)
      setNotificationCategoryEnabled(cat, nextEnabled, accessToken)
        .then(() => {
          if (pending.get(cat) === nextEnabled) pending.delete(cat)
        })
        .catch((error) => {
          // 연결 문제면 값을 남겨 두었다가 재연결 때 다시 보낸다.
          if (isRetryableError(error)) {
            if (__DEV__) console.warn('알림 분야 설정을 저장하지 못해 연결되면 다시 보냅니다:', error)
            return
          }
          // 서버가 거절한 변경(권한·입력 오류)은 다시 보내도 같으니 화면을 서버 상태로 되돌린다.
          if (pending.get(cat) === nextEnabled) {
            pending.delete(cat)
            applyLocal(!nextEnabled)
          }
          if (__DEV__) console.warn('알림 분야 설정이 거절되었습니다:', error)
        })
    },
    [accessToken],
  )

  /**
   * 화면은 바로 바꾸고(낙관적 반영), 로그인 상태면 서버 구독도 뒤따라 맞춘다. 실패해도 화면은 막지 않는다.
   * 새로 구독하면 알림은 켜진 채 시작하고, 해지하면 그 게시판의 알림 설정도 함께 지운다.
   */
  const toggleSubscribedDept = useCallback(
    (id: string) => {
      const nextSubscribed = !settingsRef.current.subscribedDepts.includes(id)
      setSettings((prev) => ({
        ...prev,
        subscribedDepts: toggleInList(prev.subscribedDepts, id),
        mutedDepts: prev.mutedDepts.filter((d) => d !== id),
      }))
      queueBoardChange(id, nextSubscribed ? true : null)
    },
    [queueBoardChange],
  )

  const toggleDeptAlert = useCallback(
    (id: string) => {
      const current = settingsRef.current
      if (!current.subscribedDepts.includes(id)) return
      const nextAlert = current.mutedDepts.includes(id)
      setSettings((prev) => ({
        ...prev,
        mutedDepts: nextAlert ? prev.mutedDepts.filter((d) => d !== id) : [...prev.mutedDepts, id],
      }))
      queueBoardChange(id, nextAlert)
    },
    [queueBoardChange],
  )

  /** 화면은 바로 바꾸고 dirty 로 표시한 뒤, 로그인 상태면 서버로 올린다. 게스트 값은 로그인 때 올라간다. */
  const setReportAlert = useCallback(
    (key: 'reportStatusAlert' | 'newReportAlert', value: boolean) => {
      const prefs = toReportAlertPrefs({ ...settingsRef.current, [key]: value })
      setSettings((prev) => ({ ...prev, [key]: value, reportAlertsDirty: true }))
      if (accessTokenRef.current) pushReportAlerts(prefs)
    },
    [pushReportAlerts],
  )

  const toggleReportStatusAlert = useCallback(
    () => setReportAlert('reportStatusAlert', !settingsRef.current.reportStatusAlert),
    [setReportAlert],
  )

  const toggleNewReportAlert = useCallback(
    () => setReportAlert('newReportAlert', !settingsRef.current.newReportAlert),
    [setReportAlert],
  )

  const isDeptAlertOn = useCallback(
    (id: string) => settings.subscribedDepts.includes(id) && !settings.mutedDepts.includes(id),
    [settings.subscribedDepts, settings.mutedDepts],
  )

  const toggleBookmark = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      bookmarkedNews: toggleInList(prev.bookmarkedNews, id),
    }))
  }, [])

  const isBookmarked = useCallback(
    (id: string) => settings.bookmarkedNews.includes(id),
    [settings.bookmarkedNews]
  )

  const resetSettings = useCallback(() => {
    // 초기화하면 구독 게시판이 비므로 서버 구독도 해지한다 — 안 그러면 다음 로그인 때 합치기로 되살아난다.
    for (const id of settingsRef.current.subscribedDepts) queueBoardChange(id, null)
    // 제보 알림도 기본값으로 서버에 올린다 — 안 그러면 다음 로그인 때 서버 값이 되살아난다.
    setSettings({ ...DEFAULT_SETTINGS, reportAlertsDirty: true })
    if (accessTokenRef.current) pushReportAlerts(toReportAlertPrefs(DEFAULT_SETTINGS))
  }, [queueBoardChange, pushReportAlerts])

  /**
   * 값을 매 렌더 새 객체로 만들면 설정을 건드리지 않아도 모든 소비자가 다시 그려진다.
   * 소식 목록처럼 항목이 많은 화면에서 특히 크게 걸린다.
   */
  const value = useMemo(
    () => ({
      settings,
      toggleSubscriptionAlert,
      toggleAlertCategory,
      toggleSubscribedDept,
      toggleDeptAlert,
      isDeptAlertOn,
      toggleReportStatusAlert,
      toggleNewReportAlert,
      toggleBookmark,
      isBookmarked,
      resetSettings,
    }),
    [
      settings,
      toggleSubscriptionAlert,
      toggleAlertCategory,
      toggleSubscribedDept,
      toggleDeptAlert,
      isDeptAlertOn,
      toggleReportStatusAlert,
      toggleNewReportAlert,
      toggleBookmark,
      isBookmarked,
      resetSettings,
    ]
  )

  if (!loaded) return null

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
