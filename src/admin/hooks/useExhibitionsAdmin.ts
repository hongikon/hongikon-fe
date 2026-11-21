import { useMemo, useState } from 'react'
import { kstTodayIndex } from '../../utils/map/exhibitions'
import { createAdminExhibition, deleteAdminExhibition, fetchAdminExhibitions, fetchAdminFacilities, updateAdminExhibition } from '../api'
import { mapLoadErrorMessage, mapWriteErrorMessage } from '../MapForm'
import type { AdminExhibition, AdminFacility } from '../types'
import {
  buildExhibitionInput,
  emptyExhibitionDraft,
  exhibitionDraftFrom,
  groupExhibitions,
  VENUE_KIND,
  venueLabel,
} from '../utils/exhibitionDraft'
import { useAdminLoad } from './useAdminLoad'
import { useItemEditor } from './useItemEditor'

/**
 * 전시 관리 화면의 상태: 전시·전시장 목록 불러오기와 진행 단계별 묶기, 추가·수정 폼, 삭제 확인.
 */
export function useExhibitionsAdmin() {
  const [venues, setVenues] = useState<AdminFacility[]>([])
  const list = useAdminLoad(
    (signal) =>
      Promise.all([fetchAdminExhibitions(signal), fetchAdminFacilities(signal)]).then(([exhibitionList, facilityList]) => {
        setVenues(facilityList.filter((facility) => facility.kind === VENUE_KIND))
        return exhibitionList
      }),
    (err) => mapLoadErrorMessage(err, '전시를 불러오지 못했습니다.'),
    [],
  )
  const exhibitions = list.data

  const editor = useItemEditor({
    setItems: list.setData,
    build: buildExhibitionInput,
    draftKey: (draft) => draft.id,
    itemKey: (exhibition: AdminExhibition) => exhibition.id,
    create: createAdminExhibition,
    update: updateAdminExhibition,
    remove: (exhibition) => deleteAdminExhibition(exhibition.id),
    savedNotice: (saved) => `'${saved.title}' 전시를 저장했습니다.`,
    removedNotice: (exhibition) => `'${exhibition.title}' 전시를 지웠습니다.`,
    saveErrorMessage: (err) => mapWriteErrorMessage(err, '저장하지 못했습니다.'),
    onRemoveError: (err) => list.setError(mapWriteErrorMessage(err, '삭제하지 못했습니다.')),
  })

  const today = kstTodayIndex()
  const grouped = useMemo(() => groupExhibitions(exhibitions ?? [], today), [exhibitions, today])

  const venueById = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues])
  const venueName = (id: string) => {
    const venue = venueById.get(id)
    return venue ? venueLabel(venue) : `${id} (전시장 정보 없음)`
  }
  const venueOptions = useMemo(() => venues.map((venue) => ({ id: venue.id, label: venueLabel(venue) })), [venues])

  /** 전시장이 하나뿐이면 미리 골라 둔다. */
  const openNew = () => editor.openNew(emptyExhibitionDraft(venues.length === 1 ? venues[0].id : null))
  const openEdit = (exhibition: AdminExhibition) => editor.openEdit(exhibitionDraftFrom(exhibition))

  return {
    exhibitions,
    venues,
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    today,
    grouped,
    venueName,
    venueOptions,
    editor,
    openNew,
    openEdit,
  }
}
