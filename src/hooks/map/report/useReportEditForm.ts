import { useEffect, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { updateReport, uploadReportImage } from '../../../apis/reports'
import { useAuth } from '../../../contexts/AuthContext'
import * as haptics from '../../../lib/haptics'
import type { Report, ReportCategory, ReportListItem } from '../../../types'
import { acceptEditPhotos, initialEditPhotos, saveErrorMessage, type PhotoItem } from '../../../utils/map/reportEdit'
import type { ReportDayHours } from '../../../utils/reportSchedule'
import { REPORT_MAX_IMAGES } from '../../../utils/reports'
import { parseServerTime } from '../../../utils/serverTime'

/**
 * 내 제보 고치기 창의 입력값과 동작. 열 때(닫힘 → 열림, 또는 다른 제보)만 그 제보 값으로 새로 채우고,
 * 저장하면 새 사진을 올린 뒤 `PATCH` 로 보낸다.
 */
export function useReportEditForm(report: ReportListItem | null, onSaved: (report: Report) => void) {
  const { accessToken } = useAuth()
  const [category, setCategory] = useState<ReportCategory>('EVENT')
  const [customLabel, setCustomLabel] = useState('')
  const [title, setTitle] = useState('')
  const [placeLabel, setPlaceLabel] = useState('')
  const [floor, setFloor] = useState(1)
  const [content, setContent] = useState('')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [schedule, setSchedule] = useState<{ startsAt: string; endsAt: string; days?: ReportDayHours[] | null }>({
    startsAt: '',
    endsAt: '',
  })
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 열 때(닫힘 → 열림, 또는 다른 제보)만 새로 채운다. 시트는 1분마다 다시 그려 report 객체가 새로 오는데, 그때마다 채우면
  // 쓰던 내용이 지워진다.
  const openId = report?.id ?? null
  useEffect(() => {
    if (!report) return
    setCategory(report.category)
    setCustomLabel(report.customCategoryLabel ?? '')
    setTitle(report.title)
    setPlaceLabel(report.placeLabel ?? '')
    setFloor(report.floor ?? 1)
    setContent(report.content ?? '')
    setPhotos(initialEditPhotos(report, REPORT_MAX_IMAGES))
    setSchedule({ startsAt: report.startsAt, endsAt: report.endsAt, days: report.days ?? null })
    setScheduleOpen(false)
    setSaving(false)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  const inBuilding = !!report && report.buildingId !== null && report.buildingId !== undefined
  const trimmedTitle = title.trim()
  const trimmedPlace = placeLabel.trim()
  const isEtc = category === 'ETC'
  const problem =
    trimmedTitle.length === 0
      ? '제목을 입력해 주세요.'
      : !inBuilding && trimmedPlace.length === 0
        ? '캠퍼스 밖 제보는 장소를 적어 주세요.'
        : null
  const startMs = parseServerTime(schedule.startsAt)
  const endMs = parseServerTime(schedule.endsAt)

  const pickPhotos = async () => {
    setError(null)
    const remaining = REPORT_MAX_IMAGES - photos.length
    if (remaining <= 0) return
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        ...(remaining > 1 ? { allowsMultipleSelection: true, selectionLimit: remaining, orderedSelection: true } : {}),
      })
      if (result.canceled) return
      const { accepted, rejected } = acceptEditPhotos(result.assets, remaining)
      if (accepted.length) setPhotos((prev) => [...prev, ...accepted].slice(0, REPORT_MAX_IMAGES))
      if (rejected) setError(`JPEG·PNG 이고 5MB 이하인 사진만 붙일 수 있어 ${rejected}장은 뺐어요.`)
    } catch {
      setError('사진을 불러오지 못했어요.')
    }
  }

  const save = async () => {
    if (!report || saving || problem || !accessToken) return
    setSaving(true)
    setError(null)
    try {
      const imageKeys: string[] = []
      for (const photo of photos) {
        if (photo.kind === 'new') imageKeys.push(await uploadReportImage(photo.picked, accessToken))
      }
      const saved = await updateReport(
        report.id,
        {
          floor: inBuilding ? floor : undefined,
          category,
          customCategoryLabel: isEtc && customLabel.trim() ? customLabel.trim() : undefined,
          title: trimmedTitle,
          content: content.trim() || undefined,
          placeLabel: trimmedPlace || undefined,
          // 서버는 남긴 사진을 앞에, 새 사진을 뒤에 둔다 — 화면도 같은 순서다(새 사진은 늘 뒤에 붙는다).
          keepImageIndexes: photos.flatMap((photo) => (photo.kind === 'existing' ? [photo.index] : [])),
          imageKeys: imageKeys.length ? imageKeys : undefined,
          startsAt: schedule.startsAt,
          endsAt: schedule.endsAt,
          ...(schedule.days && schedule.days.length >= 2 ? { days: schedule.days } : {}),
        },
        accessToken,
      )
      haptics.success()
      onSaved(saved)
    } catch (caught) {
      setError(saveErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return {
    category,
    setCategory,
    customLabel,
    setCustomLabel,
    title,
    setTitle,
    placeLabel,
    setPlaceLabel,
    floor,
    setFloor,
    content,
    setContent,
    photos,
    setPhotos,
    schedule,
    setSchedule,
    scheduleOpen,
    setScheduleOpen,
    saving,
    error,
    inBuilding,
    isEtc,
    problem,
    startMs,
    endMs,
    pickPhotos,
    save,
  }
}
