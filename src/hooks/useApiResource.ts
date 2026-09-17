import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { AppState } from 'react-native'
import {
  ApiError,
  getErrorMessage,
  isCancelledError,
  isNetworkError,
  isRetryableError,
} from '../apis/client'
import { useReconnect } from '../lib/connectivity'

/** 포그라운드 복귀 때마다 부르면 앱 전환이 잦은 사용자에게 요청이 몰려, 이 간격 안에서는 건너뛴다. */
const FOREGROUND_REFETCH_MIN_INTERVAL_MS = 30_000

interface UseApiResourceOptions {
  /** false 면 부르지 않고 이전 상태도 비운다(예: 레이어가 꺼져 있을 때). 기본 true. */
  enabled?: boolean
  /** 연결이 돌아오면 다시 부른다. 기본 true. */
  refetchOnReconnect?: boolean
  /** 앱이 포그라운드로 돌아오면 다시 부른다. 기본 true. */
  refetchOnForeground?: boolean
  /** 오류 문구를 고를 수 없을 때(알 수 없는 예외) 보여줄 문구. */
  fallbackMessage?: string
}

export interface ApiResource<T> {
  /**
   * 마지막으로 성공한 값. 다시 불러오다 실패해도 지우지 않는다 — 끊겼다고
   * 멀쩡히 보이던 목록까지 사라지면 오히려 더 불편하다.
   */
  data: T | undefined
  /** 첫 로딩(보여줄 값이 아직 없음). */
  loading: boolean
  /** 값이 있는 상태에서 다시 불러오는 중. */
  refreshing: boolean
  /** 마지막 시도가 실패했을 때의 사용자용 문구. 성공하면 null. */
  errorMessage: string | null
  error: unknown
  /** 연결 불량(응답 자체를 못 받음)으로 실패했는지. */
  isNetworkError: boolean
  /** "다시 시도" 버튼을 띄울 만한 실패인지(4xx 인증·입력 오류는 false). */
  canRetry: boolean
  /** 다시 불러온다. 진행 중인 요청은 끊고 새로 보낸다. */
  retry: () => void
  /**
   * 안내만 닫는다(데이터·재연결 시 자동 갱신은 그대로). 사용자가 닫은 안내가
   * 계속 화면을 가리지 않게 하려는 것이다.
   */
  clearError: () => void
}

/**
 * 조회(GET) 전용 공통 훅. 로딩/오류/데이터/다시 시도와 재연결·포그라운드 자동 갱신을 묶는다.
 * 자동 재시도(백오프)는 client 가 이미 하므로 여기서는 "그래도 실패했을 때"의 UX 만 맡는다.
 *
 * `fetcher` 는 매 렌더 새로 만들어도 된다. 다시 부를 조건은 `deps` 로만 정한다.
 */
export function useApiResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: UseApiResourceOptions = {},
): ApiResource<T> {
  const {
    enabled = true,
    refetchOnReconnect = true,
    refetchOnForeground = true,
    fallbackMessage = '정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  } = options

  const [data, setData] = useState<T | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const controllerRef = useRef<AbortController | null>(null)
  const lastFetchedAtRef = useRef(0)
  const hasErrorRef = useRef(false)

  const run = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setPending(true)
    lastFetchedAtRef.current = Date.now()

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        hasErrorRef.current = false
        setData(result)
        setError(null)
      })
      .catch((caught: unknown) => {
        // 끊은 요청(화면 이탈, 새 요청으로 교체)은 결과를 버린다.
        if (controller.signal.aborted || isCancelledError(caught)) return
        hasErrorRef.current = true
        setError(caught)
        if (__DEV__ && !isNetworkError(caught)) console.warn('[useApiResource] 불러오기 실패:', caught)
      })
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null
          setPending(false)
        }
      })
  }, [])

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.abort()
      controllerRef.current = null
      hasErrorRef.current = false
      setData(undefined)
      setError(null)
      setPending(false)
      return
    }
    run()
    return () => {
      controllerRef.current?.abort()
    }
    // 다시 부를 조건은 호출부가 넘긴 deps 로만 정한다(fetcher 는 ref 로 최신값을 쓴다).
  }, [enabled, run, ...deps])

  // 재연결 알림은 실패했던 경우에만 받는다. 멀쩡한 화면까지 한꺼번에 다시 부르면 막 돌아온 서버에 몰린다.
  useReconnect(() => {
    if (hasErrorRef.current) run()
  }, enabled && refetchOnReconnect)

  useEffect(() => {
    if (!enabled || !refetchOnForeground) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      const stale = Date.now() - lastFetchedAtRef.current > FOREGROUND_REFETCH_MIN_INTERVAL_MS
      if (hasErrorRef.current || stale) run()
    })
    return () => subscription.remove()
  }, [enabled, refetchOnForeground, run])

  const clearError = useCallback(() => setError(null), [])

  const hasError = error !== null
  return {
    data,
    loading: pending && data === undefined,
    refreshing: pending && data !== undefined,
    errorMessage: hasError ? getErrorMessage(error, fallbackMessage) : null,
    error,
    isNetworkError: hasError && isNetworkError(error),
    // 서버가 명확히 거절한 4xx 만 버튼을 숨기고, 알 수 없는 예외는 다시 눌러볼 수 있게 둔다.
    canRetry: hasError && (isRetryableError(error) || !(error instanceof ApiError)),
    retry: run,
    clearError,
  }
}
