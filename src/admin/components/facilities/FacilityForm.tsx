import { StyleSheet, Text, View } from 'react-native'
import { Field, FormActions, FormErrors, formStyles, OptionChips, TextRow } from '../../MapForm'
import type { AdminBuildingOption } from '../../types'
import { adminText, Card } from '../../ui'
import { buildingNameOf, FACILITY_KIND_KEYS, type FacilityDraft } from '../../utils/facilityDraft'

interface Props {
  draft: FacilityDraft
  update: (patch: Partial<FacilityDraft>) => void
  /** 전체 건물(이름 ↔ 코드). 비었으면 불러오지 못한 것. */
  buildings: AdminBuildingOption[]
  /** 검색어로 거른 건물 칩(고른 건물은 늘 남는다). */
  buildingOptions: AdminBuildingOption[]
  buildingQuery: string
  onChangeBuildingQuery: (text: string) => void
  formErrors: readonly string[]
  saving: boolean
  onCancel: () => void
  onSave: () => void
}

/** 편의시설 추가·수정 폼. 건물은 검색해서 칩으로 고른다. */
export function FacilityForm({
  draft,
  update,
  buildings,
  buildingOptions,
  buildingQuery,
  onChangeBuildingQuery,
  formErrors,
  saving,
  onCancel,
  onSave,
}: Props) {
  return (
    <Card style={styles.formCard}>
      <Text style={adminText.strong}>{draft.originalCode ? `수정: ${draft.originalCode}` : '새 편의시설'}</Text>
      <Field
        label="코드"
        hint={draft.originalCode ? '코드는 바꿀 수 없습니다.' : '비워 두면 서버가 만듭니다(f-로 시작).'}
      >
        <TextRow
          value={draft.code}
          onChangeText={(code) => update({ code })}
          placeholder="예: hi-r-9f-printer"
          maxLength={100}
          editable={!draft.originalCode}
          accessibilityLabel="코드"
        />
      </Field>
      <Field label="종류 (필수)">
        <OptionChips
          options={FACILITY_KIND_KEYS}
          isSelected={(value) => draft.kind === value}
          onToggle={(value) => update({ kind: value })}
          accessibilityLabel="시설 종류"
        />
      </Field>
      <Field label="건물 (필수)" hint={draft.buildingCode ? `고른 건물: ${buildingNameOf(buildings, draft.buildingCode)}` : undefined}>
        <TextRow value={buildingQuery} onChangeText={onChangeBuildingQuery} placeholder="건물 이름 검색 (예: 홍문관, R동)" accessibilityLabel="건물 검색" />
        {buildings.length === 0 ? (
          <Text style={adminText.muted}>건물 목록을 불러오지 못했습니다. 다시 시도해 주세요.</Text>
        ) : (
          <OptionChips
            options={buildingOptions.map((b) => b.name)}
            isSelected={(name) => buildingNameOf(buildings, draft.buildingCode) === name}
            onToggle={(name) => update({ buildingCode: buildings.find((b) => b.name === name)?.code ?? null })}
            accessibilityLabel="건물"
          />
        )}
      </Field>
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <Field label="층" hint="지하는 음수(B1 = -1), 홍문관 로비층 L 은 0. 모르면 비웁니다.">
            <TextRow value={draft.floor} onChangeText={(floor) => update({ floor })} placeholder="예: 3" keyboardType="numbers-and-punctuation" accessibilityLabel="층" />
          </Field>
        </View>
        <View style={formStyles.half}>
          <Field label="위치 설명">
            <TextRow value={draft.note} onChangeText={(note) => update({ note })} maxLength={255} placeholder="예: PC실 · 915호" accessibilityLabel="위치 설명" />
          </Field>
        </View>
      </View>
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <Field label="위도 (선택)">
            <TextRow value={draft.lat} onChangeText={(lat) => update({ lat })} keyboardType="decimal-pad" accessibilityLabel="위도" />
          </Field>
        </View>
        <View style={formStyles.half}>
          <Field label="경도 (선택)">
            <TextRow value={draft.lng} onChangeText={(lng) => update({ lng })} keyboardType="decimal-pad" accessibilityLabel="경도" />
          </Field>
        </View>
      </View>
      <FormErrors errors={formErrors} />
      <FormActions saving={saving} onCancel={onCancel} onSave={onSave} />
    </Card>
  )
}

const styles = StyleSheet.create({
  formCard: { gap: 14, marginBottom: 16 },
})
