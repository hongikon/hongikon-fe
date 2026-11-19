import { useMemo } from 'react'
import { ApiError, getErrorMessage } from '../../apis/client'
import { createAdminNotice, deleteAdminNotice, fetchAdminNotices, updateAdminNotice } from '../api'
import type { AdminNotice } from '../types'
import { buildNoticeInput, emptyNoticeDraft, groupNotices, noticeDraftFrom, noticeSavedMessage } from '../utils/noticeDraft'
import { useAdminLoad } from './useAdminLoad'
import { useItemEditor } from './useItemEditor'

/** 앱 공지 API 가 아직 배포되지 않은 서버(404·405, 서버 문구 없음). */
function isMissing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405) && !error.serverMessage
}

function writeErrorMessage(error: unknown, fallback: string): string {
  if (isMissing(error)) return '서버에 앱 공지 기능이 아직 배포되지 않았습니다.'
  if (error instanceof ApiError && error.serverMessage) return error.serverMessage
  return getErrorMessage(error, fallback)
}

/**
 * 앱 공지 관리 화면의 상태: 공지 목록 불러오기와 예약·게시 중 묶기, 쓰기·수정 폼, 삭제 확인.
 */
export function useNoticesAdmin() {
  const list = useAdminLoad(
    (signal) => fetchAdminNotices(signal),
    (err) => (isMissing(err) ? '서버에 앱 공지 기능이 아직 배포되지 않았습니다.' : getErrorMessage(err, '공지를 불러오지 못했습니다.')),
    [],
  )
  const notices = list.data

  const editor = useItemEditor({
    setItems: list.setData,
    build: buildNoticeInput,
    draftKey: (draft) => draft.id,
    itemKey: (notice: AdminNotice) => notice.id,
    create: createAdminNotice,
    update: updateAdminNotice,
    remove: (notice) => deleteAdminNotice(notice.id),
    // 새 공지는 목록 맨 앞에 넣는다.
    prependNew: true,
    savedNotice: (saved) => noticeSavedMessage(saved, Date.now()),
    removedNotice: (notice) => `'${notice.title}' 공지를 지웠습니다.`,
    saveErrorMessage: (err) => writeErrorMessage(err, '저장하지 못했습니다.'),
    onRemoveError: (err) => list.setError(writeErrorMessage(err, '삭제하지 못했습니다.')),
  })

  // 예약 공지가 게시 시각을 지나도 다시 불러오기 전까지 서버 status 는 그대로라, 상태는 그릴 때 시각으로 가른다.
  const now = Date.now()
  const grouped = useMemo(() => groupNotices(notices ?? [], now), [notices, now])

  const openNew = () => editor.openNew(emptyNoticeDraft(Date.now()))
  const openEdit = (notice: AdminNotice) => editor.openEdit(noticeDraftFrom(notice))

  return { notices, loading: list.loading, error: list.error, reload: list.reload, now, grouped, editor, openNew, openEdit }
}
