import { StyleSheet, Text, View } from 'react-native'
import { kstTodayYmd } from '../../../utils/map/exhibitions'
import { Field, FormActions, FormErrors, formStyles, OptionChips, TextRow } from '../../MapForm'
import { adminText, Card } from '../../ui'
import type { ExhibitionDraft } from '../../utils/exhibitions/exhibitionDraft'

interface Props {
  draft: ExhibitionDraft
  update: (patch: Partial<ExhibitionDraft>) => void
  /** 전시장('행사·전시' 시설) 칩. 비었으면 시설이 없거나 불러오지 못한 것. */
  venues: readonly unknown[]
  venueOptions: { id: string; label: string }[]
  formErrors: readonly string[]
  saving: boolean
  onCancel: () => void
  onSave: () => void
}

/** 전시 추가·수정 폼. 전시장은 편의시설 관리의 '행사·전시' 시설 중에서 고른다. */
export function ExhibitionForm({ draft, update, venues, venueOptions, formErrors, saving, onCancel, onSave }: Props) {
  return (
    <Card style={styles.formCard}>
      <Text style={adminText.strong}>{draft.id !== null ? `수정: ${draft.title || draft.id}` : '새 전시'}</Text>
      <Field label="전시장 (필수)" hint="편의시설 관리에서 종류가 '행사·전시'인 시설만 고를 수 있습니다.">
        {venues.length === 0 ? (
          <Text style={adminText.muted}>행사·전시 시설이 없거나 불러오지 못했습니다.</Text>
        ) : (
          <OptionChips
            options={venueOptions.map((option) => option.label)}
            isSelected={(label) => venueOptions.find((option) => option.label === label)?.id === draft.facilityId}
            onToggle={(label) => update({ facilityId: venueOptions.find((option) => option.label === label)?.id ?? null })}
            accessibilityLabel="전시장"
          />
        )}
      </Field>
      <Field label="전시 제목 (필수)">
        <TextRow value={draft.title} onChangeText={(title) => update({ title })} maxLength={150} placeholder="예: 회화과 졸업작품전" accessibilityLabel="전시 제목" />
      </Field>
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <Field label="시작일 (필수)" hint={`YYYY-MM-DD · 오늘 ${kstTodayYmd()}`}>
            <TextRow value={draft.startsOn} onChangeText={(startsOn) => update({ startsOn })} maxLength={10} placeholder="2026-10-12" keyboardType="numbers-and-punctuation" accessibilityLabel="시작일" />
          </Field>
        </View>
        <View style={formStyles.half}>
          <Field label="종료일 (필수)" hint="이날까지 포함합니다.">
            <TextRow value={draft.endsOn} onChangeText={(endsOn) => update({ endsOn })} maxLength={10} placeholder="2026-10-16" keyboardType="numbers-and-punctuation" accessibilityLabel="종료일" />
          </Field>
        </View>
      </View>
      <Field label="관람 시간">
        <TextRow value={draft.hours} onChangeText={(hours) => update({ hours })} maxLength={100} placeholder="예: 10:00~18:00 (일 휴관)" accessibilityLabel="관람 시간" />
      </Field>
      <Field label="설명" hint="앱에서는 두 줄까지 보이고 '자세히 보기'로 펼칩니다.">
        <TextRow value={draft.description} onChangeText={(description) => update({ description })} maxLength={1000} multiline placeholder="전시 소개" accessibilityLabel="설명" />
      </Field>
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <Field label="링크 이름">
            <TextRow value={draft.linkLabel} onChangeText={(linkLabel) => update({ linkLabel })} maxLength={50} placeholder="예: 전시 안내" accessibilityLabel="링크 이름" />
          </Field>
        </View>
        <View style={formStyles.half}>
          <Field label="링크 주소">
            <TextRow value={draft.linkUrl} onChangeText={(linkUrl) => update({ linkUrl })} maxLength={500} placeholder="https://" keyboardType="url" accessibilityLabel="링크 주소" />
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
