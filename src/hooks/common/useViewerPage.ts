import { useState } from 'react'

/** ViewerPage 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useViewerPage() {
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  return { loading, setLoading, failed, setFailed }
}
