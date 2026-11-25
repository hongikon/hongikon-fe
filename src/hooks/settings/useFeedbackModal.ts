import { useEffect, useRef, useState } from 'react'
import * as haptics from '../../lib/haptics'
import { useAuth } from '../../contexts/AuthContext'
import { submitFeedback } from '../../apis/feedback'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import type { FeedbackModalProps } from '../../components/settings/FeedbackModal'

/** FeedbackModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useFeedbackModal({ visible }: Pick<FeedbackModalProps, 'visible'>) {
  const { accessToken } = useAuth()
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  /**
   * 전송 실패 안내. Alert 대신 화면 안에 남기는 이유: 웹의 Alert 는 아무것도 띄우지 않고,
   * 네이티브에서도 닫으면 무엇이 실패했는지 사라진다. 입력한 내용은 그대로 둔다.
   */
  const [submitError, setSubmitError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)
  // 접수 완료. 웹에선 Alert 가 아무것도 띄우지 않아(react-native-web) 화면 안에서 알려준다.
  const [submitted, setSubmitted] = useState(false)
  const [validation, setValidation] = useState<string | null>(null)

  /** 요청 세대. 창을 닫을 때 올려, 닫은 뒤 늦게 끝난 전송 결과가 다음에 연 빈 창을 건드리지 못하게 한다. */
  const requestGenRef = useRef(0)

  useEffect(() => {
    if (!visible) {
      requestGenRef.current += 1
      setSubmitted(false)
      setValidation(null)
      setContent('')
      setContact('')
      setSubmitting(false)
      setSubmitError(null)
    }
  }, [visible])

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      setValidation('문의 내용을 입력해 주세요.')
      return
    }
    setValidation(null)

    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    setSubmitting(true)
    setSubmitError(null)
    try {
      // POST 라 client 가 자동으로 다시 보내지 않는다(중복 접수 방지). 실패하면 사용자가 직접 다시 보낸다.
      await submitFeedback({ content: trimmed, contact: contact.trim() || undefined }, accessToken)
      if (isStale()) return
      setSubmitted(true)
      haptics.success()
    } catch (error) {
      if (isStale()) return
      setSubmitError({
        message: getErrorMessage(error, '문의를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
        network: isNetworkError(error),
        retryable: isRetryableError(error),
      })
    } finally {
      if (!isStale()) setSubmitting(false)
    }
  }
  return {
    content,
    setContent,
    contact,
    setContact,
    submitting,
    submitError,
    submitted,
    validation,
    handleSubmit,
  }
}
