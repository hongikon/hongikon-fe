import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ENTRANCE_BOUNDARY_TOLERANCE_M, type CheckIssue, type CheckResult } from '../../utils/pathSurveyV3/check'
import { isValidTolerance, MAX_TOLERANCE_M } from '../../utils/pathSurveyV3/transfer'
import { Btn, Section, ui } from '../pathSurvey/ui'
import { Collapsible } from './controls'

const SEVERITY_COLOR = { error: '#DC2626', warning: '#D97706', info: '#64748B' } as const

const INFO_TITLES: Record<string, string> = {
  outdoor_in_boundary: '건물 경계 안의 외부 점',
  unknown_building: '서버 목록에 없는 건물',
  label_not_on_server: '서버에 없는 출입구 이름',
  isolated: '간선이 없는 점',
  dead_end: '막다른 점',
}

function IssueRow({ issue, onPress }: { issue: CheckIssue; onPress: (issue: CheckIssue) => void }) {
  const canGo = !!issue.nodeId || !!issue.edgeId
  return (
    <Pressable
      onPress={canGo ? () => onPress(issue) : undefined}
      style={[ui.listRow, styles.row, { borderLeftColor: SEVERITY_COLOR[issue.severity] }]}
      accessibilityRole={canGo ? 'button' : 'text'}
    >
      <Text style={ui.rowText}>{issue.message}</Text>
    </Pressable>
  )
}

/** Keeps its own text so that a half typed number is not applied. */
function ToleranceSetting({ value, onChange }: { value: number; onChange: (meters: number) => void }) {
  const [text, setText] = useState(String(value))
  const parsed = text.trim() === '' ? NaN : Number(text)
  const valid = isValidTolerance(parsed)
  return (
    <Collapsible title={`설정: 출입구 경계 허용 오차 ${value}m`}>
      <Text style={ui.hint}>{'출입구가 건물 경계에서 이 거리보다 멀면 경고가 나와요. 출입구가 아닌 내부 점은 경계 밖이면 항상 경고예요. 오류나 내보내기에는 영향이 없어요.'}</Text>
      <TextInput
        value={text}
        onChangeText={(next) => {
          setText(next)
          const meters = next.trim() === '' ? NaN : Number(next)
          if (isValidTolerance(meters)) onChange(meters)
        }}
        keyboardType="numeric"
        style={ui.input}
        accessibilityLabel="출입구 경계 허용 오차(미터)"
      />
      {valid ? null : <Text style={ui.warn}>{`0 에서 ${MAX_TOLERANCE_M} 사이 숫자로 적어 주세요. 지금은 ${value}m 로 점검해요.`}</Text>}
      {value !== ENTRANCE_BOUNDARY_TOLERANCE_M ? (
        <Btn
          label={`기본값 ${ENTRANCE_BOUNDARY_TOLERANCE_M}m 로`}
          onPress={() => {
            setText(String(ENTRANCE_BOUNDARY_TOLERANCE_M))
            onChange(ENTRANCE_BOUNDARY_TOLERANCE_M)
          }}
        />
      ) : null}
    </Collapsible>
  )
}

/** Check results. Pressing a row moves the map to that point or edge and selects it. */
export default function CheckPanel({
  check,
  tolerance,
  onTolerance,
  onGo,
}: {
  check: CheckResult
  tolerance: number
  onTolerance: (meters: number) => void
  onGo: (issue: CheckIssue) => void
}) {
  const summary = useMemo(() => check.infos.find((i) => i.code === 'components'), [check])
  const infoGroups = useMemo(() => {
    const groups = new Map<string, CheckIssue[]>()
    for (const issue of check.infos) {
      if (issue.code === 'components') continue
      groups.set(issue.code, [...(groups.get(issue.code) ?? []), issue])
    }
    return [...groups]
  }, [check])

  return (
    <View style={styles.wrap}>
      <Section title={`오류 ${check.errors.length}`} help="오류가 있으면 경로망 내보내기를 할 수 없어요. 백업은 언제든 할 수 있어요.">
        {check.errors.length === 0 ? <Text style={ui.empty}>{'오류가 없어요.'}</Text> : null}
        {check.errors.map((issue, i) => (
          <IssueRow key={`${issue.code}:${issue.nodeId}:${issue.edgeId}:${i}`} issue={issue} onPress={onGo} />
        ))}
      </Section>
      <Section title={`경고 ${check.warnings.length}`}>
        {check.warnings.length === 0 ? <Text style={ui.empty}>{'경고가 없어요.'}</Text> : null}
        {check.warnings.map((issue, i) => (
          <IssueRow key={`${issue.code}:${issue.nodeId}:${issue.edgeId}:${i}`} issue={issue} onPress={onGo} />
        ))}
      </Section>
      <ToleranceSetting value={tolerance} onChange={onTolerance} />
      <Section title={`참고 ${check.infos.length - (summary ? 1 : 0)}`} help={summary?.message}>
        {infoGroups.map(([code, issues]) => (
          <Collapsible key={code} title={`${INFO_TITLES[code] ?? code} ${issues.length}`}>
            {issues.map((issue, i) => (
              <IssueRow key={`${issue.nodeId}:${i}`} issue={issue} onPress={onGo} />
            ))}
          </Collapsible>
        ))}
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  row: { borderLeftWidth: 4, paddingVertical: 8 },
})
