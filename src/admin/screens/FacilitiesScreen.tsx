import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { isCancelledError } from '../../apis/client'
import { FACILITY_KINDS } from '../../constants/facilityKinds'
import { formatFloor } from '../../utils/floors'
import { normalize } from '../../utils/normalize'
import type { FacilityKind } from '../../types'
import {
  createAdminFacility,
  deleteAdminFacility,
  fetchAdminBuildings,
  fetchAdminFacilities,
  updateAdminFacility,
} from '../api'
import type { AdminBuildingOption, AdminFacility, AdminFacilityInput } from '../types'
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
 * 편의시설 관리. 지도 "편의 시설" 갈래(프린터·열람실 …)와 '전시' 칩에 나오는 시설을 추가·수정·삭제한다(`/admin/map/facilities`).
 * 시설은 건물을 가리키고 지도 핀은 그 건물 좌표에 찍힌다. 건물 밖(야외 흡연구역 등)처럼 현장에서 잰 좌표가 있을 때만 위도·경도를 넣는다.
 */

const KIND_KEYS: readonly FacilityKind[] = FACILITY_KINDS.map((meta) => meta.key)

interface FacilityDraft {
  originalCode: string | null
  code: string
  kind: FacilityKind | null
  buildingCode: string | null
  floor: string
  note: string
  lat: string
  lng: string
}

function emptyDraft(): FacilityDraft {
  return { originalCode: null, code: '', kind: null, buildingCode: null, floor: '', note: '', lat: '', lng: '' }
}

function draftFrom(facility: AdminFacility): FacilityDraft {
  return {
    originalCode: facility.id,
    code: facility.id,
    kind: facility.kind,
    buildingCode: facility.buildingCode,
    floor: facility.floor === undefined || facility.floor === null ? '' : String(facility.floor),
    note: facility.note ?? '',
    lat: facility.lat === undefined || facility.lat === null ? '' : String(facility.lat),
    lng: facility.lng === undefined || facility.lng === null ? '' : String(facility.lng),
  }
}

function buildInput(draft: FacilityDraft): { input: AdminFacilityInput } | { errors: string[] } {
  const errors: string[] = []
  if (!draft.kind) errors.push('시설 종류를 골라 주세요.')
  if (!draft.buildingCode) errors.push('건물을 골라 주세요.')
  const code = draft.code.trim()
  if (code.length > 100) errors.push('코드는 100자까지 쓸 수 있어요.')
  let floor: number | undefined
  if (draft.floor.trim()) {
    const value = Number(draft.floor.trim())
    if (!Number.isInteger(value)) errors.push('층은 정수로 입력해 주세요(지하는 음수, B1 = -1).')
    else floor = value
  }
  const noteError = tooLong(draft.note, 255, '위치 설명')
  if (noteError) errors.push(noteError)
  const lat = parseCoordinate(draft.lat, LAT_RANGE, '위도')
  const lng = parseCoordinate(draft.lng, LNG_RANGE, '경도')
  if (typeof lat === 'string') errors.push(lat)
  if (typeof lng === 'string') errors.push(lng)
  if ((lat === null) !== (lng === null)) errors.push('위도·경도는 둘 다 넣거나 둘 다 비워 주세요.')
  if (errors.length || !draft.kind || !draft.buildingCode) return { errors }
  return {
    input: {
      id: draft.originalCode ?? (code || undefined),
      kind: draft.kind,
      buildingCode: draft.buildingCode,
      floor,
      note: optional(draft.note),
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
    },
  }
}

function matches(facility: AdminFacility, query: string): boolean {
  if (!query) return true
  return [facility.kind, facility.buildingName, facility.buildingCode, facility.id, facility.note ?? ''].some((field) =>
    normalize(field).includes(query),
  )
}

export default function FacilitiesScreen() {
  const [facilities, setFacilities] = useState<AdminFacility[] | null>(null)
  const [buildings, setBuildings] = useState<AdminBuildingOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [buildingQuery, setBuildingQuery] = useState('')
  const [draft, setDraft] = useState<FacilityDraft | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    Promise.all([fetchAdminFacilities(controller.signal), fetchAdminBuildings(controller.signal)])
      .then(([facilityList, buildingList]) => {
        setFacilities(facilityList)
        setBuildings(buildingList)
      })
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(mapLoadErrorMessage(err, '편의시설을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  const normalizedQuery = normalize(query)
  const shown = useMemo(
    () => (facilities ?? []).filter((facility) => matches(facility, normalizedQuery)),
    [facilities, normalizedQuery],
  )

  const buildingName = (code: string | null) => buildings.find((b) => b.code === code)?.name ?? code ?? ''
  const buildingOptions = useMemo(() => {
    const q = normalize(buildingQuery)
    const filtered = q ? buildings.filter((b) => normalize(b.name).includes(q) || normalize(b.code).includes(q)) : buildings
    // 고른 건물은 걸러져도 남겨 무엇을 골랐는지 보이게 한다.
    const selected = draft?.buildingCode ? buildings.find((b) => b.code === draft.buildingCode) : undefined
    return selected && !filtered.includes(selected) ? [selected, ...filtered] : filtered
  }, [buildings, buildingQuery, draft?.buildingCode])

  const openNew = () => {
    setDraft(emptyDraft())
    setFormErrors([])
    setNotice(null)
    setBuildingQuery('')
  }
  const openEdit = (facility: AdminFacility) => {
    setDraft(draftFrom(facility))
    setFormErrors([])
    setNotice(null)
    setConfirmDelete(null)
    setBuildingQuery('')
  }
  const update = (patch: Partial<FacilityDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))

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
        ? await updateAdminFacility(draft.originalCode, result.input)
        : await createAdminFacility(result.input)
      setFacilities((prev) => {
        const list = prev ?? []
        return draft.originalCode ? list.map((item) => (item.id === draft.originalCode ? saved : item)) : [...list, saved]
      })
      setNotice(`${saved.buildingName} ${saved.kind}을(를) 저장했습니다.`)
      setDraft(null)
    } catch (err) {
      setFormErrors([mapWriteErrorMessage(err, '저장하지 못했습니다.')])
    } finally {
      setSaving(false)
    }
  }

  const remove = async (facility: AdminFacility) => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteAdminFacility(facility.id)
      setFacilities((prev) => (prev ? prev.filter((item) => item.id !== facility.id) : prev))
      setNotice(`${facility.buildingName} ${facility.kind}을(를) 지웠습니다.`)
      setConfirmDelete(null)
      if (draft?.originalCode === facility.id) setDraft(null)
    } catch (err) {
      setError(mapWriteErrorMessage(err, '삭제하지 못했습니다.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <View>
      <ScreenHeader
        title="편의시설 관리"
        subtitle="지도 '편의 시설'과 '전시' 칩에 나오는 시설입니다. 핀은 고른 건물 좌표에 찍히고, 현장에서 잰 좌표가 있을 때만 위도·경도를 넣습니다."
        right={draft ? null : <Button label="시설 추가" icon="add" variant="primary" onPress={openNew} small />}
      />

      {notice ? <Text style={[adminText.muted, styles.notice]}>{notice}</Text> : null}

      {draft ? (
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
              options={KIND_KEYS}
              isSelected={(value) => draft.kind === value}
              onToggle={(value) => update({ kind: value })}
              accessibilityLabel="시설 종류"
            />
          </Field>
          <Field label="건물 (필수)" hint={draft.buildingCode ? `고른 건물: ${buildingName(draft.buildingCode)}` : undefined}>
            <TextRow value={buildingQuery} onChangeText={setBuildingQuery} placeholder="건물 이름 검색 (예: 홍문관, R동)" accessibilityLabel="건물 검색" />
            {buildings.length === 0 ? (
              <Text style={adminText.muted}>건물 목록을 불러오지 못했습니다. 다시 시도해 주세요.</Text>
            ) : (
              <OptionChips
                options={buildingOptions.map((b) => b.name)}
                isSelected={(name) => buildingName(draft.buildingCode) === name}
                onToggle={(name) => update({ buildingCode: buildings.find((b) => b.name === name)?.code ?? null })}
                accessibilityLabel="건물"
              />
            )}
          </Field>
          <View style={formStyles.row}>
            <View style={formStyles.half}>
              <Field label="층" hint="지하는 음수(B1 = -1). 모르면 비웁니다.">
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
          <TextRow value={query} onChangeText={setQuery} placeholder="종류·건물·코드·위치 설명으로 찾기" accessibilityLabel="편의시설 검색" />
        </View>
        {facilities ? <Text style={adminText.muted}>{shown.length}건</Text> : null}
      </View>

      {error ? <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} style={styles.error} /> : null}
      {!facilities ? (
        loading ? <Loading /> : null
      ) : shown.length === 0 ? (
        <EmptyState message={query ? '찾는 시설이 없습니다.' : '등록된 편의시설이 없습니다.'} />
      ) : (
        <View style={styles.list}>
          {shown.map((facility) => (
            <Card key={facility.id}>
              <View style={styles.itemHeader}>
                <Badge label={facility.kind} tone="info" />
                <Text style={[adminText.strong, styles.itemTitle]}>
                  {facility.buildingName}
                  {typeof facility.floor === 'number' ? ` ${formatFloor(facility.floor)}` : ''}
                </Text>
              </View>
              {facility.note ? <Text style={adminText.body}>{facility.note}</Text> : null}
              <Text style={[adminText.muted, styles.meta]}>
                {facility.id}
                {typeof facility.lat === 'number' && typeof facility.lng === 'number' ? ` · ${facility.lat}, ${facility.lng}` : ' · 건물 좌표 사용'}
              </Text>
              {confirmDelete === facility.id ? (
                <ConfirmBar
                  message={`${facility.buildingName} ${facility.kind}을(를) 지도에서 지울까요? 되돌릴 수 없습니다.`}
                  confirmLabel="삭제"
                  danger
                  busy={deleting}
                  onConfirm={() => void remove(facility)}
                  onCancel={() => setConfirmDelete(null)}
                />
              ) : (
                <View style={styles.itemActions}>
                  <Button label="수정" icon="create-outline" onPress={() => openEdit(facility)} small />
                  <Button label="삭제" icon="trash-outline" variant="ghost" onPress={() => setConfirmDelete(facility.id)} small />
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  searchInput: { flex: 1 },
  error: { marginBottom: 12 },
  list: { gap: 12 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  itemTitle: { fontSize: 15 },
  meta: { marginTop: 4, fontSize: 12 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
})
