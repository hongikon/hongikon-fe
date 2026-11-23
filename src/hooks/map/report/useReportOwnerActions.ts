import { useState } from 'react'
import { ApiError } from '../../../apis/client'
import { communityErrorMessage, isCommunityApiMissing, setReportNotifications } from '../../../apis/community'
import { deleteReport, updateReportSchedule } from '../../../apis/reports'
import { useToast } from '../../../components/common/Toast'
import * as haptics from '../../../lib/haptics'
import type { Report, ReportListItem } from '../../../types'
import type { ReportDayHours } from '../../../utils/map/report/reportSchedule'
import type { ReportSheetPatch } from '../../../utils/map/report/reportSheet'
import { useMutation } from '../../query/useMutation'

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
 * 알림은 낙관적으로 바꾸고, 지우기·시간 고치기는 서버가 확인한 뒤 반영한다.
 */
export function useReportOwnerActions({ report, accessToken, applyPatch, onChanged, onClose }: Options) {
  const toast = useToast()
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  /** 지우기는 서버가 확인한 뒤 시트를 닫는다(먼저 닫으면 실패했을 때 되돌릴 화면이 없다). */
  const deleteMutation = useMutation(
    ({ reportId, token }: { reportId: number; token: string }) => deleteReport(reportId, token),
    {
      onSuccess: () => {
        haptics.success()
        setOwnerMenuOpen(false)
        toast.show({ message: '제보를 지웠어요' })
        onChanged?.()
        onClose()
      },
      onError: (caught) => {
        toast.show({
          message: caught instanceof ApiError && caught.serverMessage ? caught.serverMessage : '제보를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.',
          tone: 'warning',
        })
      },
    },
  )
  const deleting = deleteMutation.pending
  const handleDelete = async () => {
    if (!accessToken || deleting) return
    await deleteMutation.mutate({ reportId: report.id, token: accessToken })
  }
  const [scheduleOpen, setScheduleOpen] = useState(false)
  /** 시간 고치기(공식 계정)는 서버가 맞춘 시각을 받아 반영한다. */
  const scheduleMutation = useMutation(
    ({ reportId, next, token }: { reportId: number; next: { startsAt: string; endsAt: string; days?: ReportDayHours[] }; token: string }) =>
      updateReportSchedule(reportId, next, token),
    {
      onSuccess: (saved) => {
        applyPatch({ startsAt: saved.startsAt, endsAt: saved.endsAt, days: saved.days ?? null })
        setScheduleOpen(false)
        haptics.success()
        toast.show({ message: '제보 시간을 고쳤어요' })
      },
      onError: (caught) => {
        toast.show({
          message: caught instanceof ApiError && caught.serverMessage ? caught.serverMessage : '시간을 고치지 못했어요. 잠시 뒤 다시 시도해 주세요.',
          tone: 'warning',
        })
      },
    },
  )
  const scheduleSaving = scheduleMutation.pending
  const handleSaveSchedule = async (next: { startsAt: string; endsAt: string; days?: ReportDayHours[] }) => {
    if (!accessToken) return
    await scheduleMutation.mutate({ reportId: report.id, next, token: accessToken })
  }
  /** 이 제보 알림 켜고 끄기. 낙관적으로 먼저 바꾸고, 실패하면 되돌린다. */
  const notifyMutation = useMutation(
    ({ reportId, next, token }: { reportId: number; next: boolean; token: string }) => setReportNotifications(reportId, next, token),
    {
      onMutate: ({ next }) => applyPatch({ notifyEnabled: next }),
      onSuccess: (result) => {
        applyPatch({ notifyEnabled: result.enabled })
        haptics.success()
        toast.show({ message: result.enabled ? '이 제보 알림을 켰어요' : '이 제보 알림을 껐어요' })
      },
      onError: (caught, { next }) => {
        applyPatch({ notifyEnabled: !next })
        toast.show({
          message: isCommunityApiMissing(caught, true)
            ? '아직 이 기능을 쓸 수 없어요'
            : communityErrorMessage(caught, '알림 설정을 바꾸지 못했어요.'),
          tone: 'warning',
        })
      },
    },
  )
  const handleToggleNotify = async () => {
    if (!accessToken || typeof report.notifyEnabled !== 'boolean') return
    await notifyMutation.mutate({ reportId: report.id, next: !report.notifyEnabled, token: accessToken })
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
