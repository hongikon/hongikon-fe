import { useState } from 'react'
import { ApiError } from '../../../apis/client'
import { communityErrorMessage, isCommunityApiMissing, setReportNotifications } from '../../../apis/community'
import { deleteReport, updateReportSchedule } from '../../../apis/reports'
import { useToast } from '../../../components/common/Toast'
import * as haptics from '../../../lib/haptics'
import type { Report, ReportListItem } from '../../../types'
import type { ReportDayHours } from '../../../utils/reportSchedule'
import type { ReportSheetPatch } from '../../../utils/map/reportSheet'

interface Options {
  /** 시트에 보이는 제보(덮어 둔 값까지 합친 것). */
  report: ReportListItem
  accessToken: string | null
  applyPatch: (next: ReportSheetPatch) => void
  /** 내 제보를 고치거나 지운 뒤 — 지도 목록을 다시 받는다. */
  onChanged?: () => void
  onClose: () => void
}

/**
 * 제보 시트의 내 제보 메뉴(⋯): 지우기·시간 고치기(공식 계정)·이 제보 알림 켜고 끄기, 그리고 수정 창 열림 상태.
 */
export function useReportOwnerActions({ report, accessToken, applyPatch, onChanged, onClose }: Options) {
  const toast = useToast()
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    if (!accessToken || deleting) return
    setDeleting(true)
    try {
      await deleteReport(report.id, accessToken)
      haptics.success()
      setOwnerMenuOpen(false)
      toast.show({ message: '제보를 지웠어요' })
      onChanged?.()
      onClose()
    } catch (caught) {
      toast.show({
        message: caught instanceof ApiError && caught.serverMessage ? caught.serverMessage : '제보를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.',
        tone: 'warning',
      })
    } finally {
      setDeleting(false)
    }
  }
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const handleSaveSchedule = async (next: { startsAt: string; endsAt: string; days?: ReportDayHours[] }) => {
    if (!accessToken) return
    setScheduleSaving(true)
    try {
      const saved = await updateReportSchedule(report.id, next, accessToken)
      applyPatch({ startsAt: saved.startsAt, endsAt: saved.endsAt, days: saved.days ?? null })
      setScheduleOpen(false)
      haptics.success()
      toast.show({ message: '제보 시간을 고쳤어요' })
    } catch (caught) {
      toast.show({
        message: caught instanceof ApiError && caught.serverMessage ? caught.serverMessage : '시간을 고치지 못했어요. 잠시 뒤 다시 시도해 주세요.',
        tone: 'warning',
      })
    } finally {
      setScheduleSaving(false)
    }
  }
  const handleToggleNotify = async () => {
    if (!accessToken || typeof report.notifyEnabled !== 'boolean') return
    const next = !report.notifyEnabled
    applyPatch({ notifyEnabled: next })
    try {
      const result = await setReportNotifications(report.id, next, accessToken)
      applyPatch({ notifyEnabled: result.enabled })
      haptics.success()
      toast.show({ message: result.enabled ? '이 제보 알림을 켰어요' : '이 제보 알림을 껐어요' })
    } catch (caught) {
      applyPatch({ notifyEnabled: !next })
      toast.show({
        message: isCommunityApiMissing(caught, true)
          ? '아직 이 기능을 쓸 수 없어요'
          : communityErrorMessage(caught, '알림 설정을 바꾸지 못했어요.'),
        tone: 'warning',
      })
    }
  }
  /** 수정 창에서 저장한 값을 시트에 덮어 두고 지도 목록을 다시 받게 알린다. */
  const handleEdited = (saved: Report) => {
    applyPatch({
      category: saved.category,
      customCategoryLabel: saved.customCategoryLabel,
      placeLabel: saved.placeLabel ?? null,
      title: saved.title,
      content: saved.content,
      floor: saved.floor,
      imageUrl: saved.imageUrl ?? null,
      imageUrls: saved.imageUrls,
      startsAt: saved.startsAt,
      endsAt: saved.endsAt,
      days: saved.days ?? null,
      editedAt: saved.editedAt ?? new Date().toISOString(),
    })
    setEditOpen(false)
    toast.show({ message: '제보를 고쳤어요' })
    onChanged?.()
  }

  return {
    ownerMenuOpen,
    setOwnerMenuOpen,
    editOpen,
    setEditOpen,
    deleting,
    handleDelete,
    scheduleOpen,
    setScheduleOpen,
    scheduleSaving,
    handleSaveSchedule,
    handleToggleNotify,
    handleEdited,
  }
}
