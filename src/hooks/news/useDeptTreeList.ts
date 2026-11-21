import { useCallback, useState } from 'react'
import { useTabBarInset } from '../common/useTabBarInset'
import type { DeptTreeListProps } from '../../components/news/DeptTreeList'

/** DeptTreeList 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDeptTreeList() {
  const tabInset = useTabBarInset()
  // 펼침 상태는 이름으로 기억한다. 검색으로 목록이 걸러지면 순서가 밀려서
  // 인덱스로 기억하면 엉뚱한 단과대가 펼쳐진다.
  // 처음에는 전부 접어 둔다. 단과대가 많아 하나가 펼쳐져 있으면 나머지가 아래로 밀린다.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleNode = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])
  return { tabInset, expanded, toggleNode }
}
