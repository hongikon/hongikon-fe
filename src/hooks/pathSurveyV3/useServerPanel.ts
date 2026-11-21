import { useCallback, useEffect, useState } from 'react'
import { listGraphVersions, routeGraphErrorMessage, type GraphVersion, type GraphVersionList } from '../../apis/routeGraph'
import type { RouteAlternative } from '../../apis/routes'
import type { Building } from '../../types'
import { type PushOutcome } from '../../utils/pathSurveyV3/serverSave'
import type { RouteLine } from '../../screens/pathSurveyV3/ServerPanel'

/** ServerPanel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useServerPanel({ devKey, onRouteLines, onNotice, tick }: Pick<{
  devKey: string | undefined
  buildings: readonly Building[]
  /** Loads that version's backup through the screen (overwrite question, save point first, recorded as held). */
  onLoadVersion: (id: number) => Promise<void>
  onRouteLines: (lines: RouteLine[]) => void
  onNotice: (text: string) => void
  /** Uploads the current survey as a draft through the screen, with this name (blank: the save time). */
  onUpload: (name: string) => Promise<PushOutcome<GraphVersion>>
  /** Changes after every upload, also from the save button, so the list is fetched again. */
  tick: number
}, 'devKey' | 'onRouteLines' | 'onNotice' | 'tick'>) {
  const [list, setList] = useState<GraphVersionList | null>(null)
  const [busy, setBusy] = useState('')
  const [name, setName] = useState('')
  const [shown, setShown] = useState<GraphVersion | null>(null)
  const [testId, setTestId] = useState<number | null>(null)
  // Screen state only: the list opens folded every time.
  const [expanded, setExpanded] = useState(false)
  const [from, setFrom] = useState<{ building: Building | null; floor: number | null }>({ building: null, floor: null })
  const [to, setTo] = useState<{ building: Building | null; floor: number | null }>({ building: null, floor: null })
  const [preview, setPreview] = useState<{ version: RouteAlternative[]; active: RouteAlternative[] } | null>(null)

  const refresh = useCallback(async () => {
    if (!devKey) return
    try {
      setList(await listGraphVersions(devKey))
    } catch (e) {
      onNotice(routeGraphErrorMessage(e, '서버 경로망 목록을 받지 못했어요.'))
    }
  }, [devKey, onNotice])

  useEffect(() => {
    refresh()
  }, [refresh, tick])

  // Leaving the tab clears the test lines.
  useEffect(() => () => onRouteLines([]), [onRouteLines])
  return {
    list,
    busy,
    setBusy,
    name,
    setName,
    shown,
    setShown,
    testId,
    setTestId,
    expanded,
    setExpanded,
    from,
    setFrom,
    to,
    setTo,
    preview,
    setPreview,
    refresh,
  }
}
