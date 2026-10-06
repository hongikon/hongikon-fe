import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { isCancelledError } from '../../apis/client'
import { PARTNER_AFFILIATIONS } from '../../constants/partnerAffiliations'
import { PARTNER_CATEGORIES } from '../../constants/partnerCategories'
import { normalize } from '../../utils/normalize'
import type { PartnerAffiliation, PartnerCategory } from '../../types'
import { createAdminPartner, deleteAdminPartner, fetchAdminPartners, updateAdminPartner } from '../api'
import type { AdminPartner, AdminPartnerInput } from '../types'
import {
  Field,
  formStyles,
  LAT_RANGE,
  LNG_RANGE,
  mapLoadErrorMessage,
  mapWriteErrorMessage,
  optional,
  OptionChips,
  parseCoordinate,
  TextRow,
  tooLong,
} from '../MapForm'
import { adminText, Badge, Button, Card, ConfirmBar, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'

/**
 * 제휴업체 관리. 지도 "제휴 업체" 갈래와 제휴 검색에 나오는 업체를 추가·수정·삭제한다(`/admin/map/partners`).
 * 저장하면 서버가 지도 데이터(`GET /map/data`)를 바로 새로 만들어, 앱은 다음 확인 때(실행·포그라운드 복귀) 받아 간다.
 * 좌표·혜택은 확인된 값만 넣는다 — 추정해서 채우지 않는다.
 */

const CATEGORY_KEYS: readonly PartnerCategory[] = PARTNER_CATEGORIES.map((meta) => meta.key)

interface PartnerDraft {
  /** 수정 중이면 원래 code, 새로 추가면 null. */
  originalCode: string | null
  code: string
  name: string
  category: PartnerCategory | null
  affiliations: PartnerAffiliation[]
  hospitalIcon: boolean
  lat: string
  lng: string
  benefit: string
  /** 소속별 예외 혜택(비우면 기본 혜택을 따른다). */
  exceptions: Partial<Record<PartnerAffiliation, string>>
  address: string
  hours: string
  contact: string
  linkLabel: string
  linkUrl: string
}

function emptyDraft(): PartnerDraft {
  return {
    originalCode: null,
    code: '',
    name: '',
    category: null,
    affiliations: [],
    hospitalIcon: false,
    lat: '',
    lng: '',
    benefit: '',
    exceptions: {},
    address: '',
    hours: '',
    contact: '',
    linkLabel: '',
    linkUrl: '',
  }
}

function draftFrom(partner: AdminPartner): PartnerDraft {
  const exceptions: PartnerDraft['exceptions'] = {}
  for (const item of partner.affiliationBenefits ?? []) exceptions[item.affiliation] = item.benefit
  return {
    originalCode: partner.id,
    code: partner.id,
    name: partner.name,
    category: partner.category,
    affiliations: [...(partner.affiliations ?? [])],
    hospitalIcon: partner.mapIcon === '병원',
    // 좌표는 받은 숫자를 그대로 글자로 — 고치지 않으면 같은 값이 다시 저장된다.
    lat: String(partner.lat),
    lng: String(partner.lng),
    benefit: partner.benefit ?? '',
    exceptions,
    address: partner.address ?? '',
    hours: partner.hours ?? '',
    contact: partner.contact ?? '',
    linkLabel: partner.link?.label ?? '',
    linkUrl: partner.link?.url ?? '',
  }
}

/** 화면 검증. 통과하면 요청 본문, 아니면 오류 문구 목록. */
function buildInput(draft: PartnerDraft): { input: AdminPartnerInput } | { errors: string[] } {
  const errors: string[] = []
  const name = draft.name.trim()
  if (name.length < 1 || name.length > 100) errors.push('이름은 1~100자로 입력해 주세요.')
  if (!draft.category) errors.push('업종을 골라 주세요.')
  const lat = parseCoordinate(draft.lat, LAT_RANGE, '위도')
  const lng = parseCoordinate(draft.lng, LNG_RANGE, '경도')
  if (lat === null || lng === null) errors.push('위도·경도를 모두 입력해 주세요.')
  if (typeof lat === 'string') errors.push(lat)
  if (typeof lng === 'string') errors.push(lng)
  const code = draft.code.trim()
  if (code.length > 100) errors.push('코드는 100자까지 쓸 수 있어요.')
  for (const [text, max, label] of [
    [draft.benefit, 255, '혜택'],
    [draft.address, 255, '주소'],
    [draft.hours, 100, '영업시간'],
    [draft.contact, 50, '연락처'],
    [draft.linkLabel, 50, '링크 이름'],
    [draft.linkUrl, 500, '링크 주소'],
  ] as const) {
    const message = tooLong(text, max, label)
    if (message) errors.push(message)
  }
  const linkUrl = draft.linkUrl.trim()
  const linkLabel = draft.linkLabel.trim()
  if (linkUrl && !linkUrl.startsWith('https://')) errors.push('링크 주소는 https:// 로 시작해야 해요.')
  if (linkUrl && !linkLabel) errors.push('링크 이름을 입력해 주세요(버튼에 보이는 글자).')
  if (!linkUrl && linkLabel) errors.push('링크 주소를 입력해 주세요.')
  const exceptions = draft.affiliations
    .map((affiliation) => ({ affiliation, benefit: (draft.exceptions[affiliation] ?? '').trim() }))
    .filter((item) => item.benefit)
  for (const item of exceptions) {
    if (item.benefit.length > 255) errors.push(`${item.affiliation} 예외 혜택은 255자까지 쓸 수 있어요.`)
  }
  if (errors.length || !draft.category || typeof lat !== 'number' || typeof lng !== 'number') {
    return { errors }
  }
  return {
    input: {
      id: draft.originalCode ?? (code || undefined),
      name,
      category: draft.category,
      affiliations: draft.affiliations,
      mapIcon: draft.hospitalIcon ? '병원' : undefined,
      lat,
      lng,
      benefit: optional(draft.benefit),
      affiliationBenefits: exceptions.length ? exceptions : undefined,
      address: optional(draft.address),
      hours: optional(draft.hours),
      contact: optional(draft.contact),
      link: linkUrl ? { label: linkLabel, url: linkUrl } : undefined,
    },
  }
}

function matches(partner: AdminPartner, query: string): boolean {
  if (!query) return true
  return [partner.name, partner.id, partner.category, partner.benefit ?? '', partner.address ?? '', ...(partner.affiliations ?? [])].some(
    (field) => normalize(field).includes(query),
  )
}

export default function PartnersScreen() {
  const [partners, setPartners] = useState<AdminPartner[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<PartnerDraft | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchAdminPartners(controller.signal)
      .then(setPartners)
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(mapLoadErrorMessage(err, '제휴업체를 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  const normalizedQuery = normalize(query)
  const shown = useMemo(
    () => (partners ?? []).filter((partner) => matches(partner, normalizedQuery)),
    [partners, normalizedQuery],
  )

  const openNew = () => {
    setDraft(emptyDraft())
    setFormErrors([])
    setNotice(null)
  }
  const openEdit = (partner: AdminPartner) => {
    setDraft(draftFrom(partner))
    setFormErrors([])
    setNotice(null)
    setConfirmDelete(null)
  }
  const update = (patch: Partial<PartnerDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))

  const save = async () => {
    if (!draft || saving) return
    const result = buildInput(draft)
    if ('errors' in result) {
      setFormErrors(result.errors)
      return
    }
    setSaving(true)
    setFormErrors([])
    try {
      const saved = draft.originalCode
        ? await updateAdminPartner(draft.originalCode, result.input)
        : await createAdminPartner(result.input)
      setPartners((prev) => {
        const list = prev ?? []
        return draft.originalCode ? list.map((item) => (item.id === draft.originalCode ? saved : item)) : [...list, saved]
      })
      setNotice(`'${saved.name}'을(를) 저장했습니다.`)
      setDraft(null)
    } catch (err) {
      setFormErrors([mapWriteErrorMessage(err, '저장하지 못했습니다.')])
    } finally {
      setSaving(false)
    }
  }

  const remove = async (partner: AdminPartner) => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteAdminPartner(partner.id)
      setPartners((prev) => (prev ? prev.filter((item) => item.id !== partner.id) : prev))
      setNotice(`'${partner.name}'을(를) 지웠습니다.`)
      setConfirmDelete(null)
      if (draft?.originalCode === partner.id) setDraft(null)
    } catch (err) {
      setError(mapWriteErrorMessage(err, '삭제하지 못했습니다.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <View>
      <ScreenHeader
        title="제휴업체 관리"
        subtitle="지도 '제휴 업체'와 제휴 검색에 나오는 업체입니다. 좌표·혜택은 확인된 값만 넣습니다. 저장하면 앱에는 다음 실행이나 앱으로 돌아올 때 반영됩니다."
        right={draft ? null : <Button label="업체 추가" icon="add" variant="primary" onPress={openNew} small />}
      />

      {notice ? <Text style={[adminText.muted, styles.notice]}>{notice}</Text> : null}

      {draft ? (
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
              options={CATEGORY_KEYS}
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
          {formErrors.length ? (
            <View style={formStyles.errors} accessibilityRole="alert">
              {formErrors.map((message) => (
                <Text key={message} style={formStyles.errorText}>
                  {message}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={formStyles.actions}>
            <Button label="취소" onPress={() => setDraft(null)} disabled={saving} small />
            <Button label="저장" variant="primary" onPress={save} loading={saving} small />
          </View>
        </Card>
      ) : null}

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextRow value={query} onChangeText={setQuery} placeholder="이름·코드·소속·혜택·주소로 찾기" accessibilityLabel="제휴업체 검색" />
        </View>
        {partners ? <Text style={adminText.muted}>{shown.length}곳</Text> : null}
      </View>

      {error ? <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} style={styles.error} /> : null}
      {!partners ? (
        loading ? <Loading /> : null
      ) : shown.length === 0 ? (
        <EmptyState message={query ? '찾는 업체가 없습니다.' : '등록된 제휴업체가 없습니다.'} />
      ) : (
        <View style={styles.list}>
          {shown.map((partner) => (
            <Card key={partner.id}>
              <View style={styles.itemHeader}>
                <Text style={[adminText.strong, styles.itemTitle]}>{partner.name}</Text>
                <Badge label={partner.category} tone="info" />
                {partner.mapIcon ? <Badge label={`아이콘: ${partner.mapIcon}`} /> : null}
              </View>
              {partner.affiliations?.length ? <Text style={adminText.muted}>{partner.affiliations.join(' · ')}</Text> : null}
              {partner.benefit ? <Text style={adminText.body}>{partner.benefit}</Text> : null}
              {partner.affiliationBenefits?.map((item) => (
                <Text key={item.affiliation} style={adminText.muted}>
                  {item.affiliation}: {item.benefit}
                </Text>
              ))}
              {partner.address ? <Text style={adminText.muted}>{partner.address}</Text> : null}
              <Text style={[adminText.muted, styles.meta]}>
                {partner.id} · {partner.lat}, {partner.lng}
              </Text>
              {confirmDelete === partner.id ? (
                <ConfirmBar
                  message={`'${partner.name}'을(를) 지도에서 지울까요? 되돌릴 수 없습니다.`}
                  confirmLabel="삭제"
                  danger
                  busy={deleting}
                  onConfirm={() => void remove(partner)}
                  onCancel={() => setConfirmDelete(null)}
                />
              ) : (
                <View style={styles.itemActions}>
                  <Button label="수정" icon="create-outline" onPress={() => openEdit(partner)} small />
                  <Button label="삭제" icon="trash-outline" variant="ghost" onPress={() => setConfirmDelete(partner.id)} small />
                </View>
              )}
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { marginBottom: 12 },
  formCard: { gap: 14, marginBottom: 16 },
  exceptions: { gap: 8 },
  exceptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  exceptionLabel: { width: 140 },
  exceptionInput: { flex: 1, minWidth: 180 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  searchInput: { flex: 1 },
  error: { marginBottom: 12 },
  list: { gap: 12 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  itemTitle: { fontSize: 15 },
  meta: { marginTop: 4, fontSize: 12 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
})
