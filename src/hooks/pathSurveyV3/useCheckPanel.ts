import { useMemo } from 'react'
import { type CheckIssue, type CheckResult } from '../../utils/pathSurveyV3/check'

/** State, effects and handlers of CheckPanel. The screen file only renders. */
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
