import { useMemo } from 'react'
import { type CheckIssue, type CheckResult } from '../../utils/pathSurveyV3/check'

/** CheckPanel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useCheckPanel({ check }: Pick<{
  check: CheckResult
  tolerance: number
  onTolerance: (meters: number) => void
  onGo: (issue: CheckIssue) => void
}, 'check'>) {
  const summary = useMemo(() => check.infos.find((i) => i.code === 'components'), [check])
  const infoGroups = useMemo(() => {
    const groups = new Map<string, CheckIssue[]>()
    for (const issue of check.infos) {
      if (issue.code === 'components') continue
      groups.set(issue.code, [...(groups.get(issue.code) ?? []), issue])
    }
    return [...groups]
  }, [check])
  return { summary, infoGroups }
}
