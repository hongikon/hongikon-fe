import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import {
  activateGraphVersion,
  getGraphVersion,
  listGraphVersions,
  previewGraphRoutes,
  routeGraphErrorMessage,
  type GraphReport,
  type GraphVersion,
  type GraphVersionList,
} from '../../apis/routeGraph'
import type { RouteAlternative } from '../../apis/routes'
import type { Building } from '../../types'
import { buildFloorOptions } from '../../utils/floors'
import { shortBuildingName } from '../../utils/routeLabels'
import { serverTimeText as timeText, type PushOutcome } from '../../utils/pathSurveyV3/serverSave'
import { Btn, confirmAction, Row, Section, ui } from '../pathSurvey/ui'
import { Chip } from './controls'

/** Route test colors: chosen version = orange solid, production = navy dashed. */
export const PREVIEW_VERSION_COLOR = '#E8590C'
export const PREVIEW_ACTIVE_COLOR = '#1F3A68'

export interface RouteLine {
  points: [number, number][]
  color: string
  dashed: boolean
}

const STATUS_TEXT = { DRAFT: '초안', ACTIVE: '운영 중', ARCHIVED: '지난 버전' } as const

const minutes = (seconds: number) => `${(seconds / 60).toFixed(1)}분`

function ReportView({ report }: { report: GraphReport }) {
  const { checks, comparison } = report
  return (
    <View style={styles.box}>
      <Text style={ui.hint}>{`정점 ${checks.vertices}, 간선 ${checks.edges}`}</Text>
      {checks.detachedVertices > 0 ? (
        <Text style={ui.error}>{`큰 길망과 떨어진 점 ${checks.detachedVertices}개(길찾기에 안 쓰임): ${checks.detachedSample.join(', ')}`}</Text>
      ) : (
        <Text style={ui.hint}>{'떨어진 점 없음'}</Text>
      )}
      {checks.unresolvedBuildingCodes.length > 0 ? (
        <Text style={ui.error}>{`서버 건물로 이어지지 않는 건물 code: ${checks.unresolvedBuildingCodes.join(', ')}`}</Text>
      ) : null}
      {checks.buildingsWithoutEntrances.length > 0 ? (
        <Text style={ui.hint}>{`경로망 출입구가 없는 건물(가까운 길까지 직선): ${checks.buildingsWithoutEntrances.join(', ')}`}</Text>
      ) : null}
      <Text style={[ui.hint, styles.gap]}>
        {`운영(${comparison.against === 'file' ? '저장소 기본' : `#${comparison.against.slice(1)}`}) 대비 건물 쌍 ${comparison.pairs}: ` +
          `같음 ${comparison.same}, 빨라짐 ${comparison.faster}, 느려짐 ${comparison.slower}`}
      </Text>
      {comparison.becameEstimate > 0 ? <Text style={ui.error}>{`길이 끊겨 직선 어림이 된 쌍 ${comparison.becameEstimate}`}</Text> : null}
      {comparison.becameReal > 0 ? <Text style={ui.hint}>{`새로 실측 길이 생긴 쌍 ${comparison.becameReal}`}</Text> : null}
      {comparison.biggest.map((c, i) => (
        <Text key={i} style={[ui.hint, c.draftEstimate && !c.activeEstimate ? styles.bad : null]}>
          {`${shortBuildingName(c.from)} > ${shortBuildingName(c.to)}: ${c.activeEstimate ? '어림 ' : ''}${minutes(c.activeSeconds)} > ` +
            `${c.draftEstimate ? '어림 ' : ''}${minutes(c.draftSeconds)}`}
        </Text>
      ))}
    </View>
  )
}

function RouteText({ title, color, routes }: { title: string; color: string; routes: RouteAlternative[] }) {
  return (
    <View style={styles.box}>
      <Text style={[styles.routeTitle, { color }]}>{title}</Text>
      {routes.map((r, i) => (
        <Text key={i} style={ui.hint}>
          {`${i + 1}. ${r.minutes}분 ${r.distanceMeters}m${r.isEstimate ? ' (직선 어림)' : ''}: ${(r.steps ?? []).join(' > ') || '안내 없음'}`}
        </Text>
      ))}
    </View>
  )
}

/** Building and floor picker (same floor list as the app floor dial). */
function EndPicker({
  label,
  buildings,
  building,
  floor,
  onPick,
}: {
  label: string
  buildings: readonly Building[]
  building: Building | null
  floor: number | null
  onPick: (building: Building | null, floor: number | null) => void
}) {
  const floors = building ? buildFloorOptions(building) : []
  return (
    <View style={styles.gap}>
      <Text style={ui.hint}>{label}</Text>
      <View style={styles.chips}>
        {buildings.map((b) => (
          <Chip key={b.id ?? b.name} label={shortBuildingName(b.name)} on={building === b} onPress={() => onPick(building === b ? null : b, null)} />
        ))}
      </View>
      {floors.length > 0 ? (
        <View style={styles.chips}>
          <Chip label="층 안 고름" on={floor === null} onPress={() => onPick(building, null)} />
          {floors.map((f) => (
            <Chip key={f.value} label={f.label} on={floor === f.value} onPress={() => onPick(building, f.value)} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

/**
 * Server tab (11-10): upload the current survey as a draft (the server checks it and compares with production), test routes,
 * then apply it to production (the app route finder uses it at once, no deploy). Applying an older version rolls back, and the
 * backup sent with each upload can be loaded on another computer. Only the /dev gate key is checked.
 * Uploading goes through the screen (`onUpload`), the same path as the save button, so both share the same-content skip and state.
 */
export default function ServerPanel({
  devKey,
  buildings,
  onLoadVersion,
  onRouteLines,
  onNotice,
  onUpload,
  tick,
}: {
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
}) {
  const [list, setList] = useState<GraphVersionList | null>(null)
  const [busy, setBusy] = useState('')
  const [name, setName] = useState('')
  const [shown, setShown] = useState<GraphVersion | null>(null)
  const [testId, setTestId] = useState<number | null>(null)
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

  if (!devKey) {
    return (
      <Section title="서버" help="서버에 올리려면 /dev 암호키가 필요해요.">
        <Text style={ui.error}>{'이 탭에서 암호키를 읽지 못했어요. 탭을 닫고 /dev/path-survey-v3 에서 암호키를 다시 입력해 주세요.'}</Text>
      </Section>
    )
  }

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

  const activate = (id: number) => {
    if (!confirmAction(`#${id} 경로망을 운영에 적용할까요? 바로 앱 길찾기가 이 경로망을 써요. 예전 버전을 다시 적용하면 되돌릴 수 있어요.`)) return
    run('적용', async () => {
      const version = await activateGraphVersion(devKey, id)
      await refresh()
      onNotice(`#${version.id} 을 운영에 적용했어요. 앱 길찾기가 바로 이 경로망을 써요.`)
    })
  }

  const restore = (id: number) =>
    run('불러오기', async () => {
      await onLoadVersion(id)
    })

  const show = (id: number) =>
    run('결과 보기', async () => {
      setShown(await getGraphVersion(devKey, id))
    })

  const test = () =>
    run('길 시험', async () => {
      if (testId === null || from.building?.id === undefined || to.building?.id === undefined) return
      const result = await previewGraphRoutes(devKey, testId, {
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

  const activeText = !list
    ? '…'
    : list.activeSource === 'file'
      ? `저장소 기본(내보낸 시각 ${timeText(list.bundledExportedAt)})`
      : `#${list.activeSource.slice(1)}`

  return (
    <View>
      <Section title="운영 경로망" help="앱 길찾기가 지금 쓰는 경로망이에요. 아래에서 올린 초안을 적용하면 배포 없이 바로 바뀌어요.">
        <Row>
          <Text style={[ui.hint, styles.grow]}>{activeText}</Text>
          <Btn label="새로고침" onPress={refresh} disabled={!!busy} />
        </Row>
      </Section>

      <Section
        title="지금 조사 자료 올리기"
        help="초안으로만 올라가요(앱에는 아직 안 쓰임). 서버가 검사하고 운영 경로망과 건물 쌍마다 비교해요(수 초). 백업도 함께 올라가 다른 컴퓨터에서 불러올 수 있어요."
      >
        <TextInput value={name} onChangeText={setName} placeholder="이름(예: 체육관 주변 보강)" style={ui.memoInput} />
        <Btn label={busy === '올리기' ? '올리는 중…' : '서버에 올리기'} onPress={upload} disabled={!!busy} />
      </Section>

      <Section
        title="버전"
        help="결과: 검사·비교 / 시험: 아래 길 시험 대상 / 적용: 운영에 쓰기 / 불러오기: 그 버전의 백업으로 지금 조사 자료를 덮어써요(확인 후, 저장 지점을 먼저 남겨요)."
      >
        {(list?.versions ?? []).map((v) => (
          <View key={v.id} style={styles.version}>
            <Text style={[ui.hint, v.status === 'ACTIVE' ? styles.active : null]}>
              {`#${v.id} ${STATUS_TEXT[v.status]} · ${v.sourceName ?? '이름 없음'} · 정점 ${v.vertexCount} 간선 ${v.edgeCount} · ${timeText(v.createdAt)}`}
            </Text>
            <Row>
              <Btn label="결과" onPress={() => show(v.id)} disabled={!!busy} />
              <Btn label={testId === v.id ? '시험 대상' : '시험'} kind={testId === v.id ? 'active' : 'default'} onPress={() => setTestId(v.id)} />
              {v.status !== 'ACTIVE' ? <Btn label="적용" onPress={() => activate(v.id)} disabled={!!busy} /> : null}
              <Btn label="불러오기" onPress={() => restore(v.id)} disabled={!!busy} />
            </Row>
          </View>
        ))}
        {list && list.versions.length === 0 ? <Text style={ui.hint}>{'아직 올린 버전이 없어요.'}</Text> : null}
      </Section>

      {shown?.report ? (
        <Section title={`#${shown.id} 결과`}>
          <ReportView report={shown.report} />
        </Section>
      ) : null}

      <Section title="길 시험" help="고른 버전(주황 실선)과 지금 운영(남색 점선)으로 같은 출발·도착을 찾아 지도에 겹쳐 그려요. 층은 앱 층 다이얼과 같아요.">
        <Text style={ui.hint}>{testId === null ? '위 버전 목록에서 시험할 버전을 고르세요.' : `시험 대상 #${testId}`}</Text>
        <EndPicker label="출발" buildings={buildings} building={from.building} floor={from.floor} onPick={(building, floor) => setFrom({ building, floor })} />
        <EndPicker label="도착" buildings={buildings} building={to.building} floor={to.floor} onPick={(building, floor) => setTo({ building, floor })} />
        <Row>
          <Btn
            label={busy === '길 시험' ? '찾는 중…' : '길 찾기'}
            onPress={test}
            disabled={!!busy || testId === null || !from.building || !to.building || from.building === to.building}
          />
          <Btn
            label="선 지우기"
            onPress={() => {
              setPreview(null)
              onRouteLines([])
            }}
          />
        </Row>
        {preview ? (
          <>
            <RouteText title={`#${testId} (주황)`} color={PREVIEW_VERSION_COLOR} routes={preview.version} />
            <RouteText title="운영 (남색 점선)" color={PREVIEW_ACTIVE_COLOR} routes={preview.active} />
          </>
        ) : null}
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 4, paddingVertical: 4 },
  gap: { marginTop: 8, gap: 4 },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  version: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D7DCE3' },
  active: { fontWeight: '700', color: PREVIEW_ACTIVE_COLOR },
  bad: { color: '#C92A2A' },
  routeTitle: { fontWeight: '700', fontSize: 13 },
})
