import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { createKeywordSubscription, deleteKeywordSubscription, getKeywordSubscriptions, type KeywordSubscription } from '../../apis/notifications'
import { ApiError, getErrorMessage } from '../../apis/client'
import { useToast } from '../../components/common/Toast'
import * as haptics from '../../lib/haptics'
import { useMutation } from '../query/useMutation'
import { MAX_KEYWORDS } from '../../utils/settings/keywordAlertsModal'
import type { KeywordAlertsModalProps } from '../../components/settings/KeywordAlertsModal'

/** KeywordAlertsModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useKeywordAlertsModal({ visible }: Pick<KeywordAlertsModalProps, 'visible'>) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [keywords, setKeywords] = useState<KeywordSubscription[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const loadSeqRef = useRef(0)

  const load = useCallback(() => {
    if (!accessToken) return
    const seq = ++loadSeqRef.current
    setLoadError(null)
    getKeywordSubscriptions(accessToken)
      .then((list) => {
        if (seq === loadSeqRef.current) setKeywords(list)
      })
      .catch((error) => {
        if (seq === loadSeqRef.current) setLoadError(getErrorMessage(error, '키워드를 불러오지 못했어요.'))
      })
  }, [accessToken])

  useEffect(() => {
    if (visible) load()
  }, [visible, load])

  /** 키워드 추가는 서버가 만든 구독(id)을 받아 넣는다. */
  const addMutation = useMutation(
    ({ keyword, token }: { keyword: string; token: string }) => createKeywordSubscription(keyword, token),
    {
      onSuccess: (created) => {
        setKeywords((prev) => [...(prev ?? []), created])
        setInput('')
        haptics.tapLight()
        toast.show({ message: `'${created.keyword}' 소식을 알려드릴게요` })
      },
      onError: (error) => {
        const message =
          error instanceof ApiError && error.status === 409
            ? '이미 등록한 키워드예요'
            : getErrorMessage(error, '키워드를 추가하지 못했어요.')
        toast.show({ message, tone: 'info' })
      },
    },
  )

  const submitting = addMutation.pending

  const trimmed = input.trim()
  const list = keywords ?? []
  const duplicate = list.some((k) => k.keyword.toLowerCase() === trimmed.toLowerCase())
  const full = list.length >= MAX_KEYWORDS
  const canAdd = Boolean(accessToken) && keywords !== null && trimmed.length > 0 && !duplicate && !full && !submitting

  const handleAdd = async () => {
    if (!canAdd || !accessToken) return
    await addMutation.mutate({ keyword: trimmed, token: accessToken })
  }

  /** 키워드 지우기. 화면에서 먼저 빼고, 실패하면 되돌린다(이미 지워진 404 는 지운 것으로 본다). */
  const deleteMutation = useMutation(
    ({ item, token }: { item: KeywordSubscription; token: string }) => deleteKeywordSubscription(item.id, token),
    {
      onMutate: ({ item }) => {
        setKeywords((prev) => (prev ?? []).filter((k) => k.id !== item.id))
        haptics.tapLight()
      },
      onSuccess: (_result, { item }) => toast.show({ message: `'${item.keyword}' 키워드를 지웠어요`, tone: 'info' }),
      onError: (error, { item }) => {
        if (error instanceof ApiError && error.status === 404) return
        setKeywords((prev) => (prev ? [...prev, item].sort((a, b) => a.id - b.id) : prev))
        toast.show({ message: getErrorMessage(error, '키워드를 지우지 못했어요.'), tone: 'info' })
      },
    },
  )

  const handleDelete = async (item: KeywordSubscription) => {
    if (!accessToken) return
    await deleteMutation.mutate({ item, token: accessToken })
  }

  const hint = duplicate
    ? '이미 등록한 키워드예요'
    : full
      ? `키워드는 ${MAX_KEYWORDS}개까지 등록할 수 있어요`
      : '제목에 이 단어가 들어간 새 소식을 게시판 구독과 관계없이 알려드려요'
  return {
    keywords,
    loadError,
    input,
    setInput,
    load,
    submitting,
    list,
    duplicate,
    full,
    canAdd,
    handleAdd,
    handleDelete,
    hint,
  }
}
