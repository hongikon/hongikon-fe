import { useCallback, useState } from 'react'
import type { PinnedNoticeSectionProps } from '../../components/news/PinnedNoticeSection'

/** PinnedNoticeSectionComponent 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function usePinnedNoticeSection() {
  const [expanded, setExpanded] = useState(true)
  const toggle = useCallback(() => setExpanded((v) => !v), [])
  return { expanded, toggle }
}
