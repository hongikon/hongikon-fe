import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getErrorMessage, isCancelledError } from '../apis/client'
import type { NewReportsScope } from '../apis/notificationSettings'
import {
  createReportKeyword,
  deleteReportKeyword,
  getNewReportsScope,
  getReportKeywords,
  isReportKeywordsApiKnownMissing,
  isReportKeywordsApiMissing,
  MAX_REPORT_KEYWORDS,
  patchNewReportsScope,
  type ReportKeyword,
} from '../apis/reportKeywords'
import { useToast } from '../components/common/Toast'
import * as haptics from '../lib/haptics'

/**
 * 설정 > 알림 > 캠퍼스 새 제보 알림 아래의 "받을 제보 범위"와 "제보 키워드". 서버에만 저장한다(게스트 불가).
 *
 * - `unsupported`: 서버에 제보 키워드 API 가 아직 없다(배포 전) → 화면은 "준비 중"으로만 보인다.
 * - `error`: 연결 문제 등으로 못 불러왔다 → 다시 시도.
 * 범위 변경·키워드 추가·삭제는 화면을 먼저 바꾸고(낙관적) 실패하면 되돌린 뒤 토스트로 알린다.
 */
export type ReportKeywordAlertsStatus = 'loading' | 'ready' | 'unsupported' | 'error'

/** 서버에 아직 저장되지 않은(추가 중인) 키워드는 음수 id 로 둔다. */
export function isPendingKeyword(item: ReportKeyword): boolean {
  return item.id < 0
}

export function useReportKeywordAlerts(active: boolean, accessToken: string | null) {
  const toast = useToast()
  const [status, setStatus] = useState<ReportKeywordAlertsStatus>('loading')
  const [scope, setScope] = useState<NewReportsScope>('CAMPUS')
  const [keywords, setKeywords] = useState<ReportKeyword[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  // 토큰은 ref 로 읽는다 — 재발급으로 토큰이 바뀔 때마다 다시 부르지 않게(useAdminAlertSetting 과 같은 이유).
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken
  const loggedIn = !!accessToken
  const scopeSeqRef = useRef(0)
  const tempIdRef = useRef(0)
  const keywordsRef = useRef(keywords)
  keywordsRef.current = keywords

  useEffect(() => {
    const token = tokenRef.current
    if (!active || !token) {
      // 꺼지거나 로그아웃하면 이전 계정 값을 들고 있지 않는다.
      scopeSeqRef.current++
      setStatus('loading')
      setKeywords([])
      setScope('CAMPUS')
      return
    }
    if (isReportKeywordsApiKnownMissing()) {
      setStatus('unsupported')
      return
    }
    let cancelled = false
    setStatus('loading')
    Promise.all([getReportKeywords(token), getNewReportsScope(token)])
      .then(([list, serverScope]) => {
        if (cancelled) return
        setKeywords(list)
        setScope(serverScope)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled || isCancelledError(error)) return
        setStatus(isReportKeywordsApiMissing(error) ? 'unsupported' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [active, loggedIn, reloadKey])

  const retry = useCallback(() => setReloadKey((n) => n + 1), [])

  const changeScope = useCallback(
    (next: NewReportsScope) => {
      const token = tokenRef.current
      if (status !== 'ready' || !token || next === scope) return
      const previous = scope
      const seq = ++scopeSeqRef.current
      setScope(next)
      haptics.tapLight()
      patchNewReportsScope(next, token)
        .then((saved) => {
          if (seq !== scopeSeqRef.current) return
          setScope(saved)
          if (saved !== next) {
            // 서버가 아직 'KEYWORDS' 를 모르면 'CAMPUS' 로 돌려준다.
            toast.show({ message: '키워드 제보 알림은 아직 준비 중이에요', tone: 'info' })
          }
        })
        .catch((error: unknown) => {
          if (seq !== scopeSeqRef.current) return
          setScope(previous)
          const notReady = error instanceof ApiError && (error.status === 400 || error.status === 404)
          toast.show({
            message: notReady
              ? '키워드 제보 알림은 아직 준비 중이에요'
              : getErrorMessage(error, '알림 범위를 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
            tone: 'warning',
          })
        })
    },
    [status, scope, toast],
  )

  /** 추가를 시작했으면 true(입력칸을 비워도 된다). 실패하면 목록에서 되돌리고 토스트로 알린다. */
  const addKeyword = useCallback(
    async (raw: string): Promise<boolean> => {
      const token = tokenRef.current
      const keyword = raw.trim()
      if (status !== 'ready' || !token || !keyword) return false
      const current = keywordsRef.current
      if (current.some((k) => k.keyword.toLowerCase() === keyword.toLowerCase())) {
        toast.show({ message: '이미 등록한 키워드예요', tone: 'info' })
        return false
      }
      if (current.length >= MAX_REPORT_KEYWORDS) {
        toast.show({ message: `제보 키워드는 ${MAX_REPORT_KEYWORDS}개까지 등록할 수 있어요`, tone: 'info' })
        return false
      }
      const temp: ReportKeyword = { id: --tempIdRef.current, keyword }
      setKeywords((prev) => [...prev, temp])
      haptics.tapLight()
      try {
        const created = await createReportKeyword(keyword, token)
        setKeywords((prev) => prev.map((k) => (k.id === temp.id ? created : k)))
        toast.show({ message: `'${created.keyword}' 제보를 알려드릴게요` })
        return true
      } catch (error) {
        setKeywords((prev) => prev.filter((k) => k.id !== temp.id))
        if (isReportKeywordsApiMissing(error)) {
          setStatus('unsupported')
          toast.show({ message: '제보 키워드 알림은 아직 준비 중이에요', tone: 'info' })
          return false
        }
        const message =
          error instanceof ApiError && error.status === 409
            ? '이미 등록한 키워드예요'
            : error instanceof ApiError && error.serverMessage
              ? error.serverMessage
              : getErrorMessage(error, '키워드를 추가하지 못했어요.')
        toast.show({ message, tone: 'warning' })
        return false
      }
    },
    [status, toast],
  )

  const removeKeyword = useCallback(
    async (item: ReportKeyword) => {
      const token = tokenRef.current
      if (!token || isPendingKeyword(item)) return
      setKeywords((prev) => prev.filter((k) => k.id !== item.id))
      haptics.tapLight()
      try {
        await deleteReportKeyword(item.id, token)
        toast.show({ message: `'${item.keyword}' 키워드를 지웠어요`, tone: 'info' })
      } catch (error) {
        // 이미 지워진 키워드(404)면 지운 것으로 본다.
        if (error instanceof ApiError && error.status === 404) return
        setKeywords((prev) =>
          prev.some((k) => k.id === item.id) ? prev : [...prev, item].sort((a, b) => sortKey(a) - sortKey(b)),
        )
        toast.show({ message: getErrorMessage(error, '키워드를 지우지 못했어요.'), tone: 'warning' })
      }
    },
    [toast],
  )

  return { status, scope, keywords, retry, changeScope, addKeyword, removeKeyword }
}

/** 되돌릴 때 원래 자리로. 추가 중인(음수 id) 키워드는 맨 뒤에 둔다. */
function sortKey(item: ReportKeyword): number {
  return item.id < 0 ? Number.MAX_SAFE_INTEGER + item.id : item.id
}
