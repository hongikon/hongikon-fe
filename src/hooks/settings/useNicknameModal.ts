import { useEffect, useRef, useState } from 'react'
import * as haptics from '../../lib/haptics'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import { clearAppNickname, nicknameErrorMessage, updateAppNickname } from '../../apis/users'
import { getErrorMessage, isNetworkError, isRetryableError } from '../../apis/client'
import { normalizeAppNickname, validateAppNickname } from '../../utils/settings/nickname'
import type { NicknameModalProps } from '../../components/settings/NicknameModal'

/** NicknameModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNicknameModal({ visible, profile, onClose, onSaved }: Pick<NicknameModalProps, 'visible' | 'profile' | 'onClose' | 'onSaved'>) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState<'save' | 'clear' | null>(null)
  const [submitError, setSubmitError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)
  /** 창을 닫은 뒤 늦게 끝난 요청이 다음에 연 창을 건드리지 못하게 한다(FeedbackModal 과 같은 방식). */
  const requestGenRef = useRef(0)

  useEffect(() => {
    if (visible) {
      setValue(profile.appNickname ?? '')
      setTouched(false)
      setSubmitError(null)
      setSaving(null)
    } else {
      requestGenRef.current += 1
    }
    // 열 때 한 번만 현재 값으로 채운다(profile 이 바뀌어도 입력 중인 값은 그대로 둔다).
  }, [visible])

  const normalized = normalizeAppNickname(value)
  const validation = normalized ? validateAppNickname(normalized) : null
  const unchanged = normalized === (profile.appNickname ?? '')
  const providerLabel = profile.socialType === 'APPLE' ? 'Apple' : '카카오'

  const run = async (kind: 'save' | 'clear') => {
    if (!accessToken) return
    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    setSaving(kind)
    setSubmitError(null)
    try {
      const updated =
        kind === 'clear' ? await clearAppNickname(accessToken) : await updateAppNickname(normalized, accessToken)
      if (isStale()) return
      haptics.success()
      toast.show({ message: kind === 'clear' || !updated.appNickname ? '닉네임을 지웠어요' : '닉네임을 바꿨어요' })
      onSaved(updated)
      onClose()
    } catch (error) {
      if (isStale()) return
      setSubmitError({
        message: nicknameErrorMessage(error) ?? getErrorMessage(error, '닉네임을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'),
        network: isNetworkError(error),
        retryable: isRetryableError(error),
      })
    } finally {
      if (!isStale()) setSaving(null)
    }
  }

  const handleSave = () => {
    // 저장 버튼은 저장 중에 막히지만, 키보드 완료(웹은 Enter)는 onSubmitEditing 으로 바로 들어온다. 두 번 보내면 뒤 요청이
    // 앞 요청을 지난 것으로 만들어 저장이 됐는데도 오류(이미 같은 닉네임 등)만 보이고 화면엔 예전 닉네임이 남았다.
    if (saving) return
    setTouched(true)
    if (!normalized) {
      // 빈 칸으로 저장하면 지우기와 같다.
      if (profile.appNickname) void run('clear')
      else onClose()
      return
    }
    if (validation || unchanged) return
    void run('save')
  }

  const canSave = !saving && !unchanged && !(normalized && validation)
  const preview = normalized && !validation ? normalized : profile.maskedDefaultName
  return {
    value,
    setValue,
    touched,
    setTouched,
    saving,
    submitError,
    setSubmitError,
    validation,
    providerLabel,
    run,
    handleSave,
    canSave,
    preview,
  }
}
