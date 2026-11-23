import { useMemo, useState } from 'react'
import { ApiError } from '../../../apis/client'
import { normalize } from '../../../utils/common/normalize'
import { createAdminPartner, deleteAdminPartner, fetchAdminPartners, updateAdminPartner } from '../../api'
import { mapLoadErrorMessage, mapWriteErrorMessage } from '../../utils/facilities/mapForm'
import type { AdminPartner } from '../../types'
import { buildPartnerInput, emptyPartnerDraft, partnerDraftFrom, partnerMatches } from '../../utils/partners/partnerDraft'
import { useAdminLoad } from '../common/useAdminLoad'
import { useItemEditor } from '../common/useItemEditor'

/**
 * 제휴업체 관리 화면의 상태: 목록 불러오기·검색, 추가·수정 폼, 이름을 그대로 입력해야 지워지는 삭제 확인.
 */
export function usePartnersAdmin() {
  const list = useAdminLoad(
    (signal) => fetchAdminPartners(signal),
    (err) => mapLoadErrorMessage(err, '제휴업체를 불러오지 못했습니다.'),
    [],
  )
  const partners = list.data
  const [query, setQuery] = useState('')
  /** 삭제 확인에 입력한 업체 이름. 업체 이름과 정확히 같아야(앞뒤 공백만 무시) 최종 삭제 버튼이 눌린다. */
  const [confirmName, setConfirmName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const editor = useItemEditor({
    setItems: list.setData,
    build: buildPartnerInput,
    draftKey: (draft) => draft.originalCode || null,
    itemKey: (partner: AdminPartner) => partner.id,
    create: createAdminPartner,
    update: updateAdminPartner,
    remove: (partner) => deleteAdminPartner(partner.id, confirmName.trim()),
    savedNotice: (saved) => `'${saved.name}'을(를) 저장했습니다.`,
    removedNotice: (partner) => `'${partner.name}'을(를) 지웠습니다.`,
    saveErrorMessage: (err) => mapWriteErrorMessage(err, '저장하지 못했습니다.'),
    onRemoveError: (err) =>
      setDeleteError(
        err instanceof ApiError && err.status === 400 ? '업체 이름이 일치하지 않아요.' : mapWriteErrorMessage(err, '삭제하지 못했습니다.'),
      ),
  })

  const normalizedQuery = normalize(query)
  const shown = useMemo(
    () => (partners ?? []).filter((partner) => partnerMatches(partner, normalizedQuery)),
    [partners, normalizedQuery],
  )

  const openNew = () => editor.openNew(emptyPartnerDraft())
  const openEdit = (partner: AdminPartner) => editor.openEdit(partnerDraftFrom(partner))

  const askDelete = (partner: AdminPartner | null) => {
    editor.setConfirmDelete(partner?.id ?? null)
    setConfirmName('')
    setDeleteError(null)
  }

  const changeConfirmName = (text: string) => {
    setConfirmName(text)
    setDeleteError(null)
  }

  const remove = async (partner: AdminPartner) => {
    if (editor.deleting || confirmName.trim() !== partner.name) return
    setDeleteError(null)
    await editor.remove(partner)
  }

  return {
    partners,
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    query,
    setQuery,
    shown,
    editor,
    openNew,
    openEdit,
    askDelete,
    confirmName,
    changeConfirmName,
    deleteError,
    remove,
  }
}
