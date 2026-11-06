import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { CheckIssue, CheckResult } from '../../utils/pathSurveyV3/check'
import { Section, ui } from '../pathSurvey/ui'
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

/** Check results. Pressing a row moves the map to that point or edge and selects it. */
export default function CheckPanel({ check, onGo }: { check: CheckResult; onGo: (issue: CheckIssue) => void }) {
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
