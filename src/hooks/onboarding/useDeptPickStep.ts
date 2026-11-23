import { useCallback, useMemo, useState } from 'react'
import { useSettings } from '../../contexts/SettingsContext'
import { filterSubscribableGroups, universityAllSubscribed, universityToggleIds } from '../../utils/news/deptPick'
import type { DeptPickStepProps } from '../../components/onboarding/DeptPickStep'

/** DeptPickStep 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDeptPickStep() {
  const { settings, toggleSubscribedDept } = useSettings()
  const [query, setQuery] = useState('')
  const subscribed = settings.subscribedDepts
  const subscribedSet = useMemo(() => new Set(subscribed), [subscribed])

  const groups = useMemo(() => filterSubscribableGroups(query), [query])

  const universityAllOn = universityAllSubscribed(subscribedSet)

  const toggleUniversity = useCallback(() => {
    // 다 켜져 있으면 모두 끄고, 하나라도 꺼져 있으면 꺼진 것만 켠다.
    for (const id of universityToggleIds(subscribedSet)) toggleSubscribedDept(id)
  }, [subscribedSet, toggleSubscribedDept])

  const count = subscribed.length
  return {
    toggleSubscribedDept,
    query,
    setQuery,
    subscribedSet,
    groups,
    universityAllOn,
    toggleUniversity,
    count,
  }
}
