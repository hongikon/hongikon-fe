import { StyleSheet, Text, View } from 'react-native'
import { PARTNER_AFFILIATIONS } from '../../../constants/partnerAffiliations'
import { Field, FormActions, FormErrors, formStyles, OptionChips, TextRow } from '../../MapForm'
import { adminText, Card } from '../../ui'
import { PARTNER_CATEGORY_KEYS, type PartnerDraft } from '../../utils/partnerDraft'

interface Props {
  draft: PartnerDraft
  update: (patch: Partial<PartnerDraft>) => void
  formErrors: readonly string[]
  saving: boolean
  onCancel: () => void
  onSave: () => void
}

/** 제휴업체 추가·수정 폼. 코드는 새로 추가할 때만 고칠 수 있다. */
export function PartnerForm({ draft, update, formErrors, saving, onCancel, onSave }: Props) {
  return (
    <Card style={styles.formCard}>
      <Text style={adminText.strong}>{draft.originalCode ? `수정: ${draft.originalCode}` : '새 제휴업체'}</Text>
      <Field
        label="코드"
        hint={draft.originalCode ? '코드는 바꿀 수 없습니다.' : '비워 두면 서버가 만듭니다(p-로 시작). 영문 소문자·숫자·하이픈 권장.'}
      >
        <TextRow
          value={draft.code}
          onChangeText={(code) => update({ code })}
          placeholder="예: cafe-sunny-house"
          maxLength={100}
          editable={!draft.originalCode}
          accessibilityLabel="코드"
        />
      </Field>
      <Field label="이름 (필수)">
        <TextRow value={draft.name} onChangeText={(name) => update({ name })} maxLength={100} accessibilityLabel="이름" />
      </Field>
      <Field label="업종 (필수)">
        <OptionChips
          options={PARTNER_CATEGORY_KEYS}
          isSelected={(value) => draft.category === value}
          onToggle={(value) => update({ category: value })}
          accessibilityLabel="업종"
        />
      </Field>
      <Field label="제휴 소속" hint="비워 두면 소속 필터에 걸리지 않고 업종 필터로만 보입니다.">
        <OptionChips
          options={PARTNER_AFFILIATIONS}
          isSelected={(value) => draft.affiliations.includes(value)}
          onToggle={(value) =>
            update({
              affiliations: draft.affiliations.includes(value)
                ? draft.affiliations.filter((item) => item !== value)
                : [...draft.affiliations, value],
            })
          }
          accessibilityLabel="제휴 소속"
        />
      </Field>
      <Field label="지도 아이콘" hint="'의료/미용' 중 병원·검진센터만 병원 아이콘으로 바꿉니다.">
        <OptionChips
          options={['병원'] as const}
          isSelected={() => draft.hospitalIcon}
          onToggle={() => update({ hospitalIcon: !draft.hospitalIcon })}
          accessibilityLabel="지도 아이콘"
        />
      </Field>
      {/* 근처 알림 대상은 11-09부터 앱이 소속 필터(고른 소속·총학생회)로 정한다 — 업체별 표시(nearbyAlert)는 쓰지 않아 칸을 뺐다. 값은 저장할 때 그대로 둔다. */}
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <Field label="위도 (필수)">
            <TextRow value={draft.lat} onChangeText={(lat) => update({ lat })} placeholder="37.55…" keyboardType="decimal-pad" accessibilityLabel="위도" />
          </Field>
        </View>
        <View style={formStyles.half}>
          <Field label="경도 (필수)">
            <TextRow value={draft.lng} onChangeText={(lng) => update({ lng })} placeholder="126.92…" keyboardType="decimal-pad" accessibilityLabel="경도" />
          </Field>
        </View>
      </View>
      <Field label="혜택">
        <TextRow value={draft.benefit} onChangeText={(benefit) => update({ benefit })} maxLength={255} multiline accessibilityLabel="혜택" />
      </Field>
      {draft.affiliations.length > 0 ? (
        <Field label="소속별 예외 혜택" hint="그 소속만 혜택이 다를 때만 적습니다. 비우면 위 혜택을 따릅니다.">
          <View style={styles.exceptions}>
            {draft.affiliations.map((affiliation) => (
              <View key={affiliation} style={styles.exceptionRow}>
                <Text style={[adminText.muted, styles.exceptionLabel]}>{affiliation}</Text>
                <View style={styles.exceptionInput}>
                  <TextRow
                    value={draft.exceptions[affiliation] ?? ''}
                    onChangeText={(text) => update({ exceptions: { ...draft.exceptions, [affiliation]: text } })}
                    maxLength={255}
                    accessibilityLabel={`${affiliation} 예외 혜택`}
                  />
                </View>
              </View>
            ))}
          </View>
        </Field>
      ) : null}
      <Field label="주소">
        <TextRow value={draft.address} onChangeText={(address) => update({ address })} maxLength={255} accessibilityLabel="주소" />
      </Field>
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <Field label="영업시간">
            <TextRow value={draft.hours} onChangeText={(hours) => update({ hours })} maxLength={100} accessibilityLabel="영업시간" />
          </Field>
        </View>
        <View style={formStyles.half}>
          <Field label="연락처">
            <TextRow value={draft.contact} onChangeText={(contact) => update({ contact })} maxLength={50} accessibilityLabel="연락처" />
          </Field>
        </View>
      </View>
      <View style={formStyles.row}>
        <View style={formStyles.half}>
          <Field label="링크 이름">
            <TextRow value={draft.linkLabel} onChangeText={(linkLabel) => update({ linkLabel })} maxLength={50} placeholder="예: 쿠폰 발급 페이지 열기" accessibilityLabel="링크 이름" />
          </Field>
        </View>
        <View style={formStyles.half}>
          <Field label="링크 주소">
            <TextRow value={draft.linkUrl} onChangeText={(linkUrl) => update({ linkUrl })} maxLength={500} placeholder="https://" keyboardType="url" accessibilityLabel="링크 주소" />
          </Field>
        </View>
      </View>
      <Field label="이용 방법(학생증 제시가 아닐 때만)" hint="비우면 소속별 기본 안내(학생증 제시 등)가 나와요. 단계는 ' / ' 로 나눠 적어요.">
        <TextRow value={draft.usageNote} onChangeText={(usageNote) => update({ usageNote })} maxLength={255} placeholder="예: 게시물 QR코드 스캔 / 인증코드 입력 / 이용권 구매" accessibilityLabel="이용 방법" />
      </Field>
      <Field label="제휴 종료일(기간 한정일 때만)" hint="이 날까지 지도에 보이고 다음 날부터 자동으로 빠져요. 비우면 기한 없이 보여요.">
        <TextRow value={draft.endsOn} onChangeText={(endsOn) => update({ endsOn })} maxLength={10} placeholder="2026-12-31" keyboardType="numbers-and-punctuation" accessibilityLabel="제휴 종료일" />
      </Field>
      <FormErrors errors={formErrors} />
      <FormActions saving={saving} onCancel={onCancel} onSave={onSave} />
    </Card>
  )
}

const styles = StyleSheet.create({
  formCard: { gap: 14, marginBottom: 16 },
  exceptions: { gap: 8 },
  exceptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  exceptionLabel: { width: 140 },
  exceptionInput: { flex: 1, minWidth: 180 },
})
