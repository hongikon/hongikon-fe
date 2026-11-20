import { useEffect, useRef, useState } from 'react'
import * as haptics from '../../lib/haptics'
import { useAuth } from '../../contexts/AuthContext'
import { submitFeedback } from '../../apis/feedback'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import type { InfoSuggestType } from '../../constants/feedback'
import {
  EMPTY_DRAFT,
  buildContent,
  missingFields,
  retypeDraft,
  type Draft,
  type InfoSuggestLocation,
  type InfoSuggestPrefill,
  type RequiredField,
} from '../../utils/settings/infoSuggest'

/**
 * "지도에서 위치 찍기"로 창을 닫았다가(설정 → 지도) 다시 열 때 입력해 둔 내용을 되살리기 위한 임시 보관.
 * 설정 화면과 지도 화면이 각자 이 창을 띄우므로 컴포넌트 밖에 둔다.
 */
let savedDraft: Draft | null = null

interface Options {
  visible: boolean
  location: InfoSuggestLocation | null
  prefill: InfoSuggestPrefill | null
  onPickOnMap?: () => void
}

/**
 * 정보 제보 창의 입력값·검사·보내기. 문의(`POST /feedback`)로 보내고, 닫으면 처음 상태로 되돌린다.
 */
export function useInfoSuggestForm({ visible, location, prefill, onPickOnMap }: Options) {
  const { accessToken } = useAuth()
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)
  // 접수 완료. 웹에선 Alert 가 뜨지 않아 화면 안에서 알려준다.
  const [submitted, setSubmitted] = useState(false)

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  // 지도에서 위치를 찍고 돌아왔으면 입력해 두었던 내용을 되살린다(종류와 모든 칸).
  // 미리 채울 값이 있으면(제휴 시트의 정보 수정 요청) 그 값으로 시작한다.
  useEffect(() => {
    if (visible && savedDraft) {
      const restored = savedDraft
      savedDraft = null
      setDraft(restored)
    } else if (visible && prefill) {
      setDraft({ ...EMPTY_DRAFT, ...prefill })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const handlePickOnMap = () => {
    savedDraft = draft
    onPickOnMap?.()
  }

  /** 요청 세대. 창을 닫을 때 올려, 닫은 뒤 늦게 끝난 전송 결과가 다음에 연 빈 창을 건드리지 못하게 한다. */
  const requestGenRef = useRef(0)

  useEffect(() => {
    if (!visible) {
      requestGenRef.current += 1
      setDraft(EMPTY_DRAFT)
      setAttempted(false)
      setSubmitting(false)
      setSubmitError(null)
      setSubmitted(false)
    }
  }, [visible])

  const missing = missingFields(draft, location)
  const invalid = (field: RequiredField) => attempted && missing.includes(field)

  const changeType = (type: InfoSuggestType) => {
    if (type === draft.type) return
    setDraft((prev) => retypeDraft(prev, type))
    setAttempted(false)
  }

  const handleSubmit = async () => {
    if (missing.length > 0) {
      setAttempted(true)
      haptics.warning()
      return
    }
    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    setSubmitting(true)
    setSubmitError(null)
    try {
      // POST 라 자동으로 다시 보내지 않는다(중복 접수 방지). 실패하면 사용자가 직접 다시 보낸다.
      await submitFeedback(
        { content: buildContent(draft, location), contact: draft.contact.trim() || undefined },
        accessToken,
      )
      if (isStale()) return
      setSubmitted(true)
      haptics.success()
    } catch (error) {
      if (isStale()) return
      setSubmitError({
        message: getErrorMessage(error, '제보를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
        network: isNetworkError(error),
        retryable: isRetryableError(error),
      })
    } finally {
      if (!isStale()) setSubmitting(false)
    }
  }

  return {
    draft,
    setDraft,
    update,
    attempted,
    missing,
    invalid,
    submitting,
    submitError,
    submitted,
    changeType,
    handleSubmit,
    handlePickOnMap,
  }
}

export type InfoSuggestForm = ReturnType<typeof useInfoSuggestForm>
