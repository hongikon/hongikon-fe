import { useCallback, useEffect, useState } from 'react'
import { listGraphVersions, routeGraphErrorMessage, type GraphVersion, type GraphVersionList } from '../../apis/routeGraph'
import type { RouteAlternative } from '../../apis/routes'
import type { Building } from '../../types'
import { type PushOutcome } from '../../utils/pathSurveyV3/serverSave'
import type { RouteLine } from '../../screens/pathSurveyV3/ServerPanel'
import { activateGraphVersion, getGraphVersion, previewGraphRoutes, type GraphReport } from '../../apis/routeGraph'
import { applyConfirmText } from '../../utils/pathSurveyV3/serverSave'
import { confirmAction } from '../../utils/pathSurvey/ui'
import { PREVIEW_ACTIVE_COLOR, PREVIEW_VERSION_COLOR } from '../../utils/pathSurveyV3/serverPanel'

/** ServerPanel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useServerPanel({ devKey, onRouteLines, onNotice, tick, onLoadVersion, onUpload }: Pick<{
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
}, 'devKey' | 'onRouteLines' | 'onNotice' | 'tick' | 'onLoadVersion' | 'onUpload'>) {
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

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label)
    try {
      await work()
    } catch (e) {
      onNotice(routeGraphErrorMessage(e, `${label}에 실패했어요.`))
    } finally {
      setBusy('')
    }
  }

  const upload = () =>
    run('올리기', async () => {
      const outcome = await onUpload(name)
      if (outcome.kind === 'uploaded') {
        const { version, skipped } = outcome
        setShown(version)
        setTestId(version.id)
        setName('')
        onNotice(
          `초안 #${version.id} 으로 올렸어요(정점 ${version.vertexCount}, 간선 ${version.edgeCount}${skipped ? `, 펼치지 못한 것 ${skipped}` : ''}). ` +
            '아래 결과와 길 시험을 보고 운영에 적용하세요.',
        )
      } else if (outcome.kind === 'same') {
        if (outcome.versionId !== null) setTestId(outcome.versionId)
        onNotice(`마지막 초안${outcome.versionId === null ? '' : ` #${outcome.versionId}`} 과 내용이 같아 올리지 않았어요. 그 버전으로 시험하세요.`)
      } else if (outcome.kind === 'noRoute') onNotice('올릴 경로망이 없어요(간선으로 이어진 점이 없어요). 서버 저장 안 함.')
      else if (outcome.kind === 'busy') onNotice('저장 버튼으로 올리는 중이에요. 끝난 뒤 다시 눌러 주세요.')
      else if (outcome.kind === 'blocked') onNotice('이 탭은 저장을 멈춘 상태라 서버에도 올리지 않아요. 새로고침해 주세요.')
      else if (outcome.kind === 'failed') onNotice(`서버에 올리지 못했어요. ${outcome.text}`)
    })

  /** Reads the check report first; without it the question warns but still lets the person apply. */
  const activate = (id: number) =>
    run('적용', async () => {
      const target = list?.versions.find((v) => v.id === id)
      if (!list || !target) return
      let report: GraphReport | null = null
      try {
        report = (await getGraphVersion(devKey!, id)).report
      } catch {
        // applyConfirmText puts the missing report first.
      }
      if (!confirmAction(applyConfirmText(target, report, list.versions, list.activeSource))) return
      const version = await activateGraphVersion(devKey!, id)
      await refresh()
      onNotice(`#${version.id} 을 운영에 적용했어요. 앱 길찾기가 바로 이 경로망을 써요.`)
    })

  const restore = (id: number) =>
    run('불러오기', async () => {
      await onLoadVersion(id)
    })

  const show = (id: number) =>
    run('결과 보기', async () => {
      setShown(await getGraphVersion(devKey!, id))
    })

  const test = () =>
    run('길 시험', async () => {
      if (testId === null || from.building?.id === undefined || to.building?.id === undefined) return
      const result = await previewGraphRoutes(devKey!, testId, {
        from: from.building.id,
        fromFloor: from.floor,
        to: to.building.id,
        toFloor: to.floor,
      })
      setPreview(result)
      const line = (r: RouteAlternative | undefined, color: string, dashed: boolean): RouteLine[] =>
        r ? [{ points: r.points.map((p) => [p.lat, p.lng] as [number, number]), color, dashed }] : []
      onRouteLines([...line(result.active[0], PREVIEW_ACTIVE_COLOR, true), ...line(result.version[0], PREVIEW_VERSION_COLOR, false)])
    })
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
    upload,
    activate,
    restore,
    show,
    test,
  }
}
