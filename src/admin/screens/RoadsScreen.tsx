import { StyleSheet, Text, View } from 'react-native'
import { Field, FormErrors, OptionChips, TextRow, formStyles } from '../MapForm'
import { adminText, Button, Card, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'
import { RoadNetworkMap } from '../components/roads/RoadNetworkMap'
import { RestrictionCard } from '../components/roads/RestrictionCard'
import { useRoadsAdmin } from '../hooks/roads/useRoadsAdmin'
import { CAUSE_LABELS, KIND_LABELS, PURPOSE_LABELS } from '../utils/roads/roadMap'
import type { WalkClosureCause, WalkRestrictionKind, WalkRestrictionPurpose } from '../types'

const KINDS: readonly WalkRestrictionKind[] = ['EDGE', 'ENTRANCE', 'BUILDING_PASS']
const PURPOSES: readonly WalkRestrictionPurpose[] = ['CLOSURE', 'RULE']
const CAUSES: readonly WalkClosureCause[] = ['CONSTRUCTION', 'EVENT', 'OTHER']
const ZOOMS = ['1x', '2x', '3x'] as const

/**
 * 길 관리(11-22). 길찾기가 피할 곳을 막고 푼다 — 막힌 길 구간, 닫힌 출입구, 지나가면 안 되는 건물.
 * 시설 '이용 불가'는 시설 관리에서 따로 한다(시설은 표시만, 길은 길찾기 계산이 바뀐다).
 */
export default function RoadsScreen() {
  const r = useRoadsAdmin()
  const { draft } = r

  return (
    <View>
      <ScreenHeader
        title="길 관리"
        subtitle="두 가지를 관리합니다. 임시 통제(공사·행사)는 기간 동안 길찾기가 피하고 앱 길찾기 지도에 금지 표시가 뜹니다. 상시 길 규칙은 기간 없이 길찾기가 늘 지킵니다."
        right={<Button label="새로고침" icon="refresh" onPress={r.reload} small />}
      />
      {r.notice ? <Text style={[adminText.muted, styles.notice]}>{r.notice}</Text> : null}
      {r.error ? <InlineError message={r.error} onRetry={r.reload} /> : null}
      {r.loading && !r.roadMap ? <Loading /> : null}

      {r.roadMap ? (
        <Card style={styles.card}>
          <View style={styles.mapHeader}>
            <Text style={adminText.strong}>경로망 지도</Text>
            <Text style={adminText.muted}>
              회색 선 = 길(점선은 계단) · 파란 점 = 출입구 · 빨간 점선과 금지 표시 = 임시 통제 · 짙은 회색 점선 = 상시 길 규칙. 눌러서 고릅니다.
            </Text>
            <OptionChips
              options={ZOOMS}
              isSelected={(z) => z === `${r.zoom}x`}
              onToggle={(z) => r.setZoom(Number(z[0]))}
              accessibilityLabel="지도 확대"
            />
          </View>
          <RoadNetworkMap
            map={r.roadMap}
            closure={r.blocked.closure}
            rule={r.blocked.rule}
            selected={draft.target}
            pressRef={r.mapPressRef}
            onPress={r.onMapPress}
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={adminText.strong}>새로 넣기</Text>
        <Field
          label="종류"
          hint={
            draft.purpose === 'CLOSURE'
              ? '공사·행사처럼 이유가 있어 잠시 막습니다. 기간 동안 길찾기가 피하고, 앱 길찾기 지도에 금지 표시와 이유가 뜹니다.'
              : '운영자가 정한 늘 지키는 길 규칙입니다(안 쓰는 문, 지나가지 않는 건물). 기간이 없고 앱에는 금지로 보이지 않습니다.'
          }
        >
          <OptionChips
            options={PURPOSES.map((p) => PURPOSE_LABELS[p])}
            isSelected={(label) => label === PURPOSE_LABELS[draft.purpose]}
            onToggle={(label) => r.setPurpose(PURPOSES.find((p) => PURPOSE_LABELS[p] === label) ?? 'CLOSURE')}
            accessibilityLabel="통제 종류"
          />
        </Field>
        {draft.purpose === 'CLOSURE' ? (
          <Field label="이유">
            <OptionChips
              options={CAUSES.map((c) => CAUSE_LABELS[c])}
              isSelected={(label) => label === CAUSE_LABELS[draft.cause]}
              onToggle={(label) => r.update({ cause: CAUSES.find((c) => CAUSE_LABELS[c] === label) ?? 'OTHER' })}
              accessibilityLabel="통제 이유"
            />
          </Field>
        ) : null}
        <Field label="무엇을">
          <OptionChips
            options={KINDS.map((k) => KIND_LABELS[k])}
            isSelected={(label) => label === KIND_LABELS[draft.kind]}
            onToggle={(label) => r.setKind(KINDS.find((k) => KIND_LABELS[k] === label) ?? 'EDGE')}
            accessibilityLabel="막을 종류"
          />
        </Field>
        {draft.kind === 'EDGE' ? (
          <Field label="길 구간" hint="위 지도에서 막을 선을 누르세요.">
            <Text style={adminText.body}>{draft.target ? `고른 구간: ${draft.target.replace('|', ' – ')}` : '아직 고르지 않았어요.'}</Text>
          </Field>
        ) : null}
        {draft.kind === 'ENTRANCE' ? (
          <Field label="출입구" hint="지도에서 파란 점을 누르거나 이름으로 찾습니다.">
            <TextRow value={r.entranceQuery} onChangeText={r.setEntranceQuery} placeholder="예: 문헌관, R동 1층" accessibilityLabel="출입구 검색" />
            <OptionChips
              options={r.entranceOptions.map((e) => `${e.name} · ${e.label}`)}
              isSelected={(text) => draft.target !== null && text.endsWith(` · ${draft.target}`)}
              onToggle={(text) => r.update({ target: text.split(' · ').pop() ?? null })}
              accessibilityLabel="출입구"
            />
          </Field>
        ) : null}
        {draft.kind === 'BUILDING_PASS' ? (
          <Field label="건물" hint="출발·도착이 아니면 길찾기가 이 건물 안을 지나가지 않습니다.">
            <TextRow value={r.buildingQuery} onChangeText={r.setBuildingQuery} placeholder="건물 이름 검색" accessibilityLabel="건물 검색" />
            <OptionChips
              options={r.buildingOptions.map((b) => b.name)}
              isSelected={(name) => r.buildingOptions.find((b) => b.name === name)?.code === draft.target}
              onToggle={(name) => r.update({ target: r.buildingOptions.find((b) => b.name === name)?.code ?? null })}
              accessibilityLabel="건물"
            />
          </Field>
        ) : null}
        <Field label={draft.purpose === 'CLOSURE' ? '안내 문구 (앱에 보임)' : '메모 (운영자용)'}>
          <TextRow
            value={draft.reason}
            onChangeText={(reason) => r.update({ reason })}
            maxLength={100}
            placeholder={draft.purpose === 'CLOSURE' ? '예: 보도블록 공사로 통행 금지' : '예: 사람들이 다니는 길이 아님'}
            accessibilityLabel="사유"
          />
        </Field>
        {draft.purpose === 'CLOSURE' ? (
        <View style={formStyles.row}>
          <View style={formStyles.half}>
            <Field label="시작 (선택)" hint="이때부터 막습니다. 비우면 지금부터. 날짜만 쓰면 그날 0시.">
              <TextRow value={draft.startsAt} onChangeText={(startsAt) => r.update({ startsAt })} maxLength={16} placeholder="2026-12-01 09:00" keyboardType="numbers-and-punctuation" accessibilityLabel="통행 제한 시작" />
            </Field>
          </View>
          <View style={formStyles.half}>
            <Field label="끝 (선택)" hint="지나면 저절로 풀립니다. 비우면 직접 풀 때까지. 날짜만 쓰면 그날 끝까지.">
              <TextRow value={draft.endsAt} onChangeText={(endsAt) => r.update({ endsAt })} maxLength={16} placeholder="2026-12-01 18:00" keyboardType="numbers-and-punctuation" accessibilityLabel="통행 제한 끝" />
            </Field>
          </View>
        </View>
        ) : null}
        <FormErrors errors={r.errors} />
        <View style={styles.actions}>
          <Button
            label={draft.purpose === 'CLOSURE' ? '통제 넣기' : '규칙 넣기'}
            icon={draft.purpose === 'CLOSURE' ? 'ban' : 'git-branch-outline'}
            variant="primary"
            onPress={r.save}
            loading={r.saving}
            small
          />
        </View>
      </Card>

      <Text style={[adminText.strong, styles.listTitle]}>임시 통제 (공사·행사) {r.closures.length}곳</Text>
      {!r.loading && r.closures.length === 0 ? <EmptyState message="임시 통제가 없습니다." /> : null}
      <View style={styles.list}>
        {r.closures.map((restriction) => (
          <RestrictionCard
            key={restriction.id}
            restriction={restriction}
            confirming={r.confirmingId === restriction.id}
            removing={r.removingId === restriction.id}
            onAskRemove={() => r.setConfirmingId(restriction.id)}
            onCancelRemove={() => r.setConfirmingId(null)}
            onRemove={() => r.remove(restriction)}
          />
        ))}
      </View>

      <Text style={[adminText.strong, styles.listTitle, styles.sectionGap]}>상시 길 규칙 {r.rules.length}개</Text>
      <Text style={[adminText.muted, styles.listHint]}>길찾기가 늘 지키는 규칙입니다. 앱 사용자에게는 금지 표시로 보이지 않습니다.</Text>
      {!r.loading && r.rules.length === 0 ? <EmptyState message="상시 규칙이 없습니다." /> : null}
      <View style={styles.list}>
        {r.rules.map((restriction) => (
          <RestrictionCard
            key={restriction.id}
            restriction={restriction}
            confirming={r.confirmingId === restriction.id}
            removing={r.removingId === restriction.id}
            onAskRemove={() => r.setConfirmingId(restriction.id)}
            onCancelRemove={() => r.setConfirmingId(null)}
            onRemove={() => r.remove(restriction)}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { marginBottom: 12 },
  card: { gap: 12, marginBottom: 16 },
  mapHeader: { gap: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  listTitle: { marginBottom: 8 },
  sectionGap: { marginTop: 24 },
  listHint: { marginBottom: 8 },
  list: { gap: 10 },
})
