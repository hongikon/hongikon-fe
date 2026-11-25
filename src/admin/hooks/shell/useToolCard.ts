import { useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../../../apis/client'
import { isGatewayTimeout } from '../../api'

/** ToolCard 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useToolCard({ run, errorMessage, onFinished }: Pick<{
  title: string
  description: string
  confirmMessage: string
  actionLabel: string
  /** 성공 시 보여줄 문구를 돌려준다. */
  run: () => Promise<string>
  /** 작업별로 따로 풀어 쓸 오류 문구. null 이면 공통 처리. */
  errorMessage?: (error: unknown) => string | null
  onFinished: () => void
}, 'run' | 'errorMessage' | 'onFinished'>) {
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedAt = useRef(0)

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [running])

  const execute = () => {
    setConfirming(false)
    setRunning(true)
    setElapsed(0)
    setResult(null)
    setError(null)
    startedAt.current = Date.now()
    run()
      .then(setResult)
      .catch((err: unknown) => {
        const custom = errorMessage?.(err)
        if (custom) setError(custom)
        else if (isGatewayTimeout(err)) {
          // 응답만 못 받았을 뿐 서버에서는 계속 돌고 있을 수 있다. 다시 누르기 전에 상태부터 본다.
          setError('응답을 기다리다 연결이 끊겼습니다. 서버에서는 작업이 계속 진행 중일 수 있으니 잠시 뒤 대시보드에서 결과를 확인하세요.')
        } else setError(getErrorMessage(err, '작업을 실행하지 못했습니다.'))
      })
      .finally(() => {
        setRunning(false)
        onFinished()
      })
  }
  return { confirming, setConfirming, running, elapsed, result, error, execute }
}
