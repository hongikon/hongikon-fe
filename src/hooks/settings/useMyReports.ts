import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { deleteReport } from '../../apis/reports'
import { ApiError, getErrorMessage, isCancelledError, isNetworkError, isRetryableError } from '../../apis/client'
import { getMyReports, isMyReportsApiKnownMissing, isMyReportsApiMissing, type MyReport } from '../../apis/myReports'
import { mergeReportPages, resolveDisplayStatus } from '../../utils/myReports'
import { confirmAction } from '../../utils/common/dialog'
import { deleteConfirmMessage } from '../../utils/settings/myReports'
import type { useToast } from '../../components/common/Toast'
import { useMutation } from '../query/useMutation'
import { QUERY_KEYS } from '../../constants/queryKeys'

export type MyReportsLoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string; retryable: boolean; network: boolean }
  | { kind: 'missing' }

interface Options {
  visible: boolean
  /** 창 안의 토스트(ToastViewport)로 알린다. */
  toast: ReturnType<typeof useToast>
  /** 목록이 바뀌었을 때(새로 불러옴·삭제) — 설정 줄의 승인 대기 배지를 맞춘다 */
  onChanged?: () => void
}

/**
 * 내 제보 내역 목록: 열 때마다 처음부터 받기, 당겨서 새로고침, 끝까지 내리면 다음 페이지, 지우기.
 * 서버에 API 가 없으면(배포 전) 'missing'.
 */
export function useMyReports({ visible, toast, onChanged }: Options) {
  const { accessToken } = useAuth()
  const [items, setItems] = useState<MyReport[]>([])
  const [state, setState] = useState<MyReportsLoadState>({ kind: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // 지우는 중인 제보 id 들. 하나만 들고 있으면 A 를 지우는 사이 B 를 지울 때 A 의 버튼이 다시 살아나 같은 삭제를 두 번 보낼 수 있었고,
  // 먼저 끝난 A 가 B 의 스피너까지 내렸다.
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<number>>(() => new Set())
  const pageRef = useRef(0)
  const hasNextRef = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)
  // 토큰은 ref 로 읽는다 — 401 → 재발급으로 토큰이 바뀔 때마다 처음부터 다시 부르지 않게(재요청은 client 가 한다).
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  const load = useCallback(async (page: number, mode: 'initial' | 'refresh' | 'more') => {
    const token = tokenRef.current
    if (!token) return
    if (isMyReportsApiKnownMissing()) {
      setState({ kind: 'missing' })
      return
    }
    if (mode !== 'more') controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    if (mode === 'initial') setState({ kind: 'loading' })
    if (mode === 'refresh') setRefreshing(true)
    if (mode === 'more') setLoadingMore(true)
    try {
      const result = await getMyReports(page, token, controller.signal)
      if (controller.signal.aborted) return
      const content = Array.isArray(result?.content) ? result.content : []
      setItems((prev) => (page === 0 ? content : mergeReportPages(prev, content)))
      pageRef.current = page
      hasNextRef.current = !!result?.hasNext
      setState({ kind: 'ready' })
      if (page === 0) onChangedRef.current?.()
    } catch (error) {
      if (controller.signal.aborted || isCancelledError(error)) return
      if (isMyReportsApiMissing(error)) {
        setState({ kind: 'missing' })
      } else if (mode === 'more') {
        toast.show({ message: '다음 제보를 불러오지 못했어요. 잠시 뒤 다시 내려 주세요.', tone: 'info' })
      } else if (mode === 'refresh') {
        toast.show({ message: getErrorMessage(error, '새로 불러오지 못했어요.'), tone: 'info' })
      } else {
        setState({
          kind: 'error',
          message: getErrorMessage(error, '내 제보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
          retryable: isRetryableError(error),
          network: isNetworkError(error),
        })
      }
    } finally {
      if (mode === 'refresh') setRefreshing(false)
      if (mode === 'more') setLoadingMore(false)
    }
  }, [toast])

  // 열 때마다 처음부터 새로 받는다(검토 결과가 그사이 바뀌었을 수 있다).
  useEffect(() => {
    if (!visible) {
      controllerRef.current?.abort()
      return
    }
    setItems([])
    hasNextRef.current = false
    void load(0, 'initial')
  }, [visible, load])

  const handleEndReached = () => {
    if (state.kind !== 'ready' || loadingMore || refreshing || !hasNextRef.current) return
    void load(pageRef.current + 1, 'more')
  }

  /** 지우기는 서버가 확인한 뒤 목록에서 뺀다(검토 중이면 409 로 거절되는 일이 잦아 먼저 빼면 깜빡인다). */
  const deleteMutation = useMutation(
    ({ reportId, token }: { reportId: number; token: string }) => deleteReport(reportId, token),
    {
      onMutate: ({ reportId }) => setDeletingIds((prev) => new Set(prev).add(reportId)),
      onSuccess: (_result, { reportId }) => {
        setItems((prev) => prev.filter((r) => r.id !== reportId))
        toast.show({ message: '제보를 삭제했어요' })
        onChangedRef.current?.()
      },
      onError: (error) => {
        const conflict = error instanceof ApiError && error.status === 409
        toast.show({
          message: conflict
            ? '신고로 검토 중인 제보는 운영진 검토가 끝난 뒤에 지울 수 있어요.'
            : getErrorMessage(error, '삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
          tone: 'warning',
        })
      },
      onSettled: ({ reportId }) =>
        setDeletingIds((prev) => {
          const next = new Set(prev)
          next.delete(reportId)
          return next
        }),
      // 지운 제보가 지도에 남아 있지 않게 지도 제보 레이어도 다시 받는다.
      invalidates: [QUERY_KEYS.reports],
    },
  )
  const sendDelete = deleteMutation.mutate

  const handleDelete = useCallback((report: MyReport) => {
    const status = resolveDisplayStatus(report)
    confirmAction({
      title: '제보 삭제',
      message: deleteConfirmMessage(status),
      confirmLabel: '삭제',
      destructive: true,
      onConfirm: async () => {
        const token = tokenRef.current
        if (!token) return
        await sendDelete({ reportId: report.id, token })
      },
    })
  }, [sendDelete])

  return { items, state, refreshing, loadingMore, deletingIds, load, handleEndReached, handleDelete }
}
