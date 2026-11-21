import { useEffect, useRef, useState } from 'react'
import * as haptics from '../../lib/haptics'
import { useAuth } from '../../contexts/AuthContext'
import { submitFeedback } from '../../apis/feedback'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import { OFFICIAL_REQUEST_PREFIX } from '../../constants/feedback'
import type { OfficialRequestModalProps } from '../../components/settings/OfficialRequestModal'

/** OfficialRequestModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useOfficialRequestModal({ visible, memberNumber, currentName }: Pick<OfficialRequestModalProps, 'visible' | 'memberNumber' | 'currentName'>) {
  const { accessToken } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [proof, setProof] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [validation, setValidation] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<{ message: string; network: boolean; retryable: boolean } | null>(null)
  /** 창을 닫으면 올려, 늦게 끝난 전송 결과가 다음에 연 빈 창을 건드리지 못하게 한다. */
  const requestGenRef = useRef(0)

  useEffect(() => {
    if (!visible) {
      requestGenRef.current += 1
      setOrgName('')
      setProof('')
      setContact('')
      setSubmitting(false)
      setSubmitted(false)
      setValidation(null)
      setSubmitError(null)
    }
  }, [visible])

  const handleSubmit = async () => {
    if (submitting) return
    const name = orgName.trim()
    const reach = contact.trim()
    if (name.length < 2) {
      setValidation('단체 이름을 적어 주세요. 예: 경영대학 학생회')
      return
    }
    if (!reach) {
      setValidation('확인 연락을 받을 이메일이나 전화번호를 적어 주세요.')
      return
    }
    setValidation(null)
    const content = [
      `${OFFICIAL_REQUEST_PREFIX} ${name}`,
      memberNumber ? `회원 번호: ${memberNumber}` : null,
      currentName ? `지금 이름: ${currentName}` : null,
      proof.trim() ? `확인 자료: ${proof.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitFeedback({ content, contact: reach }, accessToken)
      if (isStale()) return
      setSubmitted(true)
      haptics.success()
    } catch (error) {
      if (isStale()) return
      setSubmitError({
        message: getErrorMessage(error, '신청을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
        network: isNetworkError(error),
        retryable: isRetryableError(error),
      })
    } finally {
      if (!isStale()) setSubmitting(false)
    }
  }
  return {
    orgName,
    setOrgName,
    proof,
    setProof,
    contact,
    setContact,
    submitting,
    submitted,
    validation,
    submitError,
    handleSubmit,
  }
}
