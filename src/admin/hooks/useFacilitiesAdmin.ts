import { useMemo, useState } from 'react'
import { normalize } from '../../utils/common/normalize'
import { createAdminFacility, deleteAdminFacility, fetchAdminBuildings, fetchAdminFacilities, updateAdminFacility } from '../api'
import { mapLoadErrorMessage, mapWriteErrorMessage } from '../MapForm'
import type { AdminBuildingOption, AdminFacility } from '../types'
import { buildFacilityInput, emptyFacilityDraft, facilityDraftFrom, facilityMatches, filterBuildingOptions } from '../utils/facilityDraft'
import { useAdminLoad } from './useAdminLoad'
import { useItemEditor } from './useItemEditor'

/**
 * 편의시설 관리 화면의 상태: 시설·건물 목록 불러오기와 검색, 추가·수정 폼(건물 검색 포함), 삭제 확인.
 */
export function useFacilitiesAdmin() {
  const [buildings, setBuildings] = useState<AdminBuildingOption[]>([])
  const list = useAdminLoad(
    (signal) =>
      Promise.all([fetchAdminFacilities(signal), fetchAdminBuildings(signal)]).then(([facilityList, buildingList]) => {
        setBuildings(buildingList)
        return facilityList
      }),
    (err) => mapLoadErrorMessage(err, '편의시설을 불러오지 못했습니다.'),
    [],
  )
  const facilities = list.data
  const [query, setQuery] = useState('')
  const [buildingQuery, setBuildingQuery] = useState('')

  const editor = useItemEditor({
    setItems: list.setData,
    build: buildFacilityInput,
    draftKey: (draft) => draft.originalCode || null,
    itemKey: (facility: AdminFacility) => facility.id,
    create: createAdminFacility,
    update: updateAdminFacility,
    remove: (facility) => deleteAdminFacility(facility.id),
    savedNotice: (saved) => `${saved.buildingName} ${saved.kind}을(를) 저장했습니다.`,
    removedNotice: (facility) => `${facility.buildingName} ${facility.kind}을(를) 지웠습니다.`,
    saveErrorMessage: (err) => mapWriteErrorMessage(err, '저장하지 못했습니다.'),
    onRemoveError: (err) => list.setError(mapWriteErrorMessage(err, '삭제하지 못했습니다.')),
  })

  const normalizedQuery = normalize(query)
  const shown = useMemo(
    () => (facilities ?? []).filter((facility) => facilityMatches(facility, normalizedQuery)),
    [facilities, normalizedQuery],
  )

  const selectedBuildingCode = editor.draft?.buildingCode
  const buildingOptions = useMemo(
    () => filterBuildingOptions(buildings, buildingQuery, selectedBuildingCode),
    [buildings, buildingQuery, selectedBuildingCode],
  )

  const openNew = () => {
    editor.openNew(emptyFacilityDraft())
    setBuildingQuery('')
  }
  const openEdit = (facility: AdminFacility) => {
    editor.openEdit(facilityDraftFrom(facility))
    setBuildingQuery('')
  }

  return {
    facilities,
    buildings,
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    query,
    setQuery,
    shown,
    buildingQuery,
    setBuildingQuery,
    buildingOptions,
    editor,
    openNew,
    openEdit,
  }
}
