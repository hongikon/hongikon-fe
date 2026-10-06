import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { isCancelledError } from '../../apis/client'
import { formatFloor } from '../../utils/floors'
import {
  daysUntilStart,
  dDayLabel,
  exhibitionPhase,
  formatExhibitionPeriod,
  kstTodayIndex,
  kstTodayYmd,
  ymdToDayIndex,
  type ExhibitionPhase,
} from '../../utils/exhibitions'
import {
  createAdminExhibition,
  deleteAdminExhibition,
  fetchAdminExhibitions,
  fetchAdminFacilities,
  updateAdminExhibition,
} from '../api'
import type { AdminExhibition, AdminExhibitionInput, AdminFacility } from '../types'
import { Field, formStyles, mapLoadErrorMessage, mapWriteErrorMessage, optional, OptionChips, TextRow, tooLong } from '../MapForm'
import { adminText, Badge, Button, Card, ConfirmBar, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'

/**
 * 전시 관리. 지도 '전시' 칩의 전시장(현대미술관 1관·2관, 박물관 …)마다 지금 전시·다음 전시를 넣는다(`/admin/map/exhibitions`).
 * 앱 지도에는 서버가 끝나지 않았고 60일 안에 시작하는 전시만 내려 준다. 날짜는 한국 날짜로 양끝을 포함한다.
 */

const VENUE_KIND = '행사·전시'

interface ExhibitionDraft {
  id: number | null
  facilityId: string | null
  title: string
  startsOn: string
  endsOn: string
  hours: string
  description: string
  linkLabel: string
  linkUrl: string
}

function emptyDraft(facilityId: string | null): ExhibitionDraft {
  return { id: null, facilityId, title: '', startsOn: '', endsOn: '', hours: '', description: '', linkLabel: '', linkUrl: '' }
}

function draftFrom(exhibition: AdminExhibition): ExhibitionDraft {
  return {
    id: exhibition.id,
    facilityId: exhibition.facilityId,
    title: exhibition.title,
    startsOn: exhibition.startsOn,
    endsOn: exhibition.endsOn,
    hours: exhibition.hours ?? '',
    description: exhibition.description ?? '',
    linkLabel: exhibition.link?.label ?? '',
    linkUrl: exhibition.link?.url ?? '',
  }
}

function buildInput(draft: ExhibitionDraft): { input: AdminExhibitionInput } | { errors: string[] } {
  const errors: string[] = []
  if (!draft.facilityId) errors.push('전시장을 골라 주세요.')
  const title = draft.title.trim()
  if (!title) errors.push('전시 제목을 입력해 주세요.')
  for (const [value, max, label] of [
    [draft.title, 200, '전시 제목'],
    [draft.hours, 100, '관람 시간'],
    [draft.description, 2000, '설명'],
    [draft.linkLabel, 50, '링크 이름'],
    [draft.linkUrl, 500, '링크 주소'],
  ] as const) {
    const error = tooLong(value, max, label)
    if (error) errors.push(error)
  }
  const startsOn = draft.startsOn.trim()
  const endsOn = draft.endsOn.trim()
  const start = ymdToDayIndex(startsOn)
  const end = ymdToDayIndex(endsOn)
  if (start === null) errors.push('시작일을 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요(예: 2026-10-12).')
  if (end === null) errors.push('종료일을 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요(예: 2026-10-16).')
  if (start !== null && end !== null && end < start) errors.push('종료일은 시작일과 같거나 뒤여야 해요.')
  const linkUrl = draft.linkUrl.trim()
  const linkLabel = draft.linkLabel.trim()
  if (linkUrl && !linkUrl.startsWith('https://')) errors.push('링크 주소는 https:// 로 시작해야 해요.')
  if (linkUrl && !linkLabel) errors.push('링크 이름을 입력해 주세요(버튼에 보이는 글자).')
  if (!linkUrl && linkLabel) errors.push('링크 주소를 입력해 주세요.')
  if (errors.length || !draft.facilityId) return { errors }
  return {
    input: {
      facilityId: draft.facilityId,
      title,
      startsOn,
      endsOn,
      hours: optional(draft.hours),
      description: optional(draft.description),
      link: linkUrl ? { label: linkLabel, url: linkUrl } : undefined,
    },
  }
}

function venueLabel(venue: AdminFacility): string {
  const floor = typeof venue.floor === 'number' ? ` ${formatFloor(venue.floor)}` : ''
  return `${venue.buildingName}${floor}${venue.note ? ` ${venue.note}` : ''}`
}

const PHASE_SECTIONS: { phase: ExhibitionPhase; title: string; empty: string }[] = [
  { phase: 'current', title: '진행 중', empty: '지금 열려 있는 전시가 없습니다.' },
  { phase: 'upcoming', title: '예정', empty: '예정된 전시가 없습니다.' },
  { phase: 'past', title: '지난 전시', empty: '지난 전시가 없습니다.' },
]

export default function ExhibitionsScreen() {
  const [exhibitions, setExhibitions] = useState<AdminExhibition[] | null>(null)
  const [venues, setVenues] = useState<AdminFacility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [draft, setDraft] = useState<ExhibitionDraft | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    Promise.all([fetchAdminExhibitions(controller.signal), fetchAdminFacilities(controller.signal)])
      .then(([exhibitionList, facilityList]) => {
        setExhibitions(exhibitionList)
        setVenues(facilityList.filter((facility) => facility.kind === VENUE_KIND))
      })
      .catch((err: unknown) => {
        if (isCancelledError(err)) return
        setError(mapLoadErrorMessage(err, '전시를 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  const today = kstTodayIndex()
  const grouped = useMemo(() => {
    const groups: Record<ExhibitionPhase, AdminExhibition[]> = { current: [], upcoming: [], past: [] }
    for (const exhibition of exhibitions ?? []) groups[exhibitionPhase(exhibition, today)].push(exhibition)
    groups.current.sort((a, b) => a.endsOn.localeCompare(b.endsOn))
    groups.upcoming.sort((a, b) => a.startsOn.localeCompare(b.startsOn))
    groups.past.sort((a, b) => b.endsOn.localeCompare(a.endsOn))
    return groups
  }, [exhibitions, today])

  const venueById = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues])
  const venueName = (id: string) => {
    const venue = venueById.get(id)
    return venue ? venueLabel(venue) : `${id} (전시장 정보 없음)`
  }
  const venueOptions = useMemo(() => venues.map((venue) => ({ id: venue.id, label: venueLabel(venue) })), [venues])

  const openNew = () => {
    setDraft(emptyDraft(venues.length === 1 ? venues[0].id : null))
    setFormErrors([])
    setNotice(null)
  }
  const openEdit = (exhibition: AdminExhibition) => {
    setDraft(draftFrom(exhibition))
    setFormErrors([])
    setNotice(null)
    setConfirmDelete(null)
  }
  const update = (patch: Partial<ExhibitionDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))

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
      const saved = draft.id !== null ? await updateAdminExhibition(draft.id, result.input) : await createAdminExhibition(result.input)
      setExhibitions((prev) => {
        const list = prev ?? []
        return draft.id !== null ? list.map((item) => (item.id === draft.id ? saved : item)) : [...list, saved]
      })
      setNotice(`'${saved.title}' 전시를 저장했습니다.`)
      setDraft(null)
    } catch (err) {
      setFormErrors([mapWriteErrorMessage(err, '저장하지 못했습니다.')])
    } finally {
      setSaving(false)
    }
  }

  const remove = async (exhibition: AdminExhibition) => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteAdminExhibition(exhibition.id)
      setExhibitions((prev) => (prev ? prev.filter((item) => item.id !== exhibition.id) : prev))
      setNotice(`'${exhibition.title}' 전시를 지웠습니다.`)
      setConfirmDelete(null)
      if (draft?.id === exhibition.id) setDraft(null)
    } catch (err) {
      setError(mapWriteErrorMessage(err, '삭제하지 못했습니다.'))
    } finally {
      setDeleting(false)
    }
  }

  const renderItem = (exhibition: AdminExhibition, phase: ExhibitionPhase) => (
    <Card key={exhibition.id}>
      <View style={styles.itemHeader}>
        {phase === 'current' ? <Badge label="진행 중" tone="info" /> : null}
        {phase === 'upcoming' ? <Badge label={dDayLabel(daysUntilStart(exhibition, today))} tone="warning" /> : null}
        {phase === 'past' ? <Badge label="종료" /> : null}
        <Text style={[adminText.strong, styles.itemTitle]}>{exhibition.title}</Text>
      </View>
      <Text style={adminText.body}>
        {venueName(exhibition.facilityId)} · {formatExhibitionPeriod(exhibition)}
      </Text>
      {exhibition.hours ? <Text style={[adminText.muted, styles.meta]}>관람 시간 {exhibition.hours}</Text> : null}
      {exhibition.description ? (
        <Text style={[adminText.muted, styles.meta]} numberOfLines={2}>
          {exhibition.description}
        </Text>
      ) : null}
      {exhibition.link ? (
        <Text style={[adminText.muted, styles.meta]} numberOfLines={1}>
          링크: {exhibition.link.label} · {exhibition.link.url}
        </Text>
      ) : null}
      {confirmDelete === exhibition.id ? (
        <ConfirmBar
          message={`정말 삭제할까요? '${exhibition.title}' 전시가 지도에서 바로 사라지고 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          danger
          busy={deleting}
          onConfirm={() => void remove(exhibition)}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : (
        <View style={styles.itemActions}>
          <Button label="수정" icon="create-outline" onPress={() => openEdit(exhibition)} small />
          <Button label="삭제" icon="trash-outline" variant="ghost" onPress={() => setConfirmDelete(exhibition.id)} small />
        </View>
      )}
    </Card>
  )

  return (
    <View>
      <ScreenHeader
        title="전시 관리"
        subtitle="지도 '전시' 칩의 전시장마다 보이는 지금 전시·다음 전시입니다. 앱에는 끝나지 않았고 60일 안에 시작하는 전시만 나옵니다. 날짜는 한국 날짜이고 시작일·종료일을 모두 포함합니다."
        right={draft ? null : <Button label="전시 추가" icon="add" variant="primary" onPress={openNew} small />}
      />

      {notice ? <Text style={[adminText.muted, styles.notice]}>{notice}</Text> : null}

      {draft ? (
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
            <TextRow value={draft.title} onChangeText={(title) => update({ title })} maxLength={200} placeholder="예: 회화과 졸업작품전" accessibilityLabel="전시 제목" />
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
            <TextRow value={draft.description} onChangeText={(description) => update({ description })} maxLength={2000} multiline placeholder="전시 소개" accessibilityLabel="설명" />
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

      {error ? <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} style={styles.error} /> : null}
      {!exhibitions ? (
        loading ? <Loading /> : null
      ) : exhibitions.length === 0 ? (
        <EmptyState message="등록된 전시가 없습니다." />
      ) : (
        PHASE_SECTIONS.map(({ phase, title, empty }) => (
          <View key={phase} style={styles.section}>
            <Text style={[adminText.strong, styles.sectionTitle]}>
              {title} <Text style={adminText.muted}>{grouped[phase].length}건</Text>
            </Text>
            {grouped[phase].length === 0 ? (
              <Text style={adminText.muted}>{empty}</Text>
            ) : (
              <View style={styles.list}>{grouped[phase].map((exhibition) => renderItem(exhibition, phase))}</View>
            )}
          </View>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { marginBottom: 12 },
  formCard: { gap: 14, marginBottom: 16 },
  error: { marginBottom: 12 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, marginBottom: 8 },
  list: { gap: 12 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  itemTitle: { fontSize: 15 },
  meta: { marginTop: 4, fontSize: 12 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
})
