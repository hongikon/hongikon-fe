import { useEffect, useRef, useState } from 'react'
import { isNetworkError, isRetryableError } from '../../../apis/client'
import { getServerBuildingId } from '../../../apis/buildings'
import { ReportImageUploadError, createReport, type PickedReportImage } from '../../../apis/reports'
import { useToast } from '../../../components/common/Toast'
import type { ReportTarget } from '../../../components/map/report/ReportComposerModal'
import { resolveSchedule, scheduleDaysFor } from '../../../utils/map/reportScheduleState'
import { useAuth } from '../../../contexts/AuthContext'
import * as haptics from '../../../lib/haptics'
import type { Report } from '../../../types'
import { isPhotoRejection, reportSubmitErrorMessage } from '../../../utils/map/reportComposer'
import { scheduleError } from '../../../utils/reportSchedule'
import { promptLogin } from '../../../utils/reports'
import type { ReportComposerForm } from './useReportComposerForm'
import type { ReportImages } from './useReportImages'

/**
 * 등록 요청이 연결 문제 등으로 실패했을 때의 안내. 입력 검증 오류(사진 `error`)와 나눈 이유는
 * "다시 시도" 버튼이 여기에만 붙어야 해서다. 제보 등록은 POST 라 자동으로 다시 보내지
 * 않고(중복 등록 방지), 사용자가 버튼을 눌렀을 때만 작성 내용 그대로 다시 보낸다.
 */
export interface ReportSubmitError {
  message: string
  network: boolean
  retryable: boolean
}

interface Options {
  target: ReportTarget | null
  form: ReportComposerForm
  images: ReportImages
  /** 빠진 필수 항목이 있으면 안내하고 false. */
  checkRequired: () => boolean
  /** 깜빡임 안내를 지운다(처음 상태로 돌릴 때). */
  resetFlash: () => void
  onClose: () => void
  onCreated: (report: Report) => void
}

/**
 * 제보 작성창의 등록 흐름: 사진 업로드 → `POST /reports` → "접수됐어요" 화면. 창을 닫으면 진행 중인 요청을
 * 끊고(세대를 올려 늦게 끝난 결과를 버린다), 새 위치로 열 때마다 처음 상태로 시작한다.
 */
export function useReportSubmission({ target, form, images, checkRequired, resetFlash, onClose, onCreated }: Options) {
  const { accessToken, logout } = useAuth()
  const toast = useToast()
  /** 접수된 예정 제보의 시작(ms). 완료 화면 문구에 쓴다. 지금 시작이면 null. */
  const [submittedStartMs, setSubmittedStartMs] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<ReportSubmitError | null>(null)
  // 등록 성공. 바로 닫지 않고 "검토 후 반영" 안내를 먼저 보여준다.
  // 올린 제보가 지도에 안 보이는 것을 실패로 오해하지 않게 하려는 것이다.
  const [submitted, setSubmitted] = useState(false)

  const reset = () => {
    form.resetForm()
    setSubmittedStartMs(null)
    images.resetImages()
    setSubmitError(null)
    setSubmitting(false)
    setSubmitted(false)
    resetFlash()
  }

  /**
   * 요청 세대. 창을 닫을 때 올려, 닫은 뒤 늦게 끝난 등록 결과가 상태를 건드리지 못하게 한다
   * (안 그러면 다음에 연 빈 작성창에 이전 실패 안내나 "접수됐어요"가 뜬다).
   */
  const requestGenRef = useRef(0)
  /** 진행 중인 등록의 사진 업로드를 끊는 컨트롤러. 창을 닫을 때(세대를 올릴 때) 같이 끊는다. */
  const submitAbortRef = useRef<AbortController | null>(null)
  const cancelPendingSubmit = () => {
    requestGenRef.current += 1
    submitAbortRef.current?.abort()
    submitAbortRef.current = null
  }

  // 닫혀 있다가(null) 새 위치로 열릴 때마다 처음 상태로 시작한다. 이전 등록의 "접수됐어요" 화면이
  // 남아 있으면 안 된다. 렌더 중에 바로 맞춰야 열리는 첫 화면부터 깨끗하다.
  const [prevTarget, setPrevTarget] = useState(target)
  if (prevTarget !== target) {
    setPrevTarget(target)
    if (prevTarget === null && target !== null) reset()
  }
  useEffect(() => {
    if (target === null) cancelPendingSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  const { setNow } = form
  useEffect(() => {
    if (target === null || submitted) return
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [target, submitted, setNow])

  const handleClose = () => {
    cancelPendingSubmit()
    reset()
    onClose()
  }

  const submit = async (picked: readonly PickedReportImage[]) => {
    const { building, offCampus, trimmedTitle, schedule, floor, category, isCustomActive, trimmedCustomLabel } = form
    if (!target || (!building && !offCampus) || submitting || trimmedTitle.length === 0) return

    // 제보 등록은 로그인이 필요하다(`POST /reports` — 게스트는 401).
    if (!accessToken) {
      promptLogin('제보를 등록하려면 로그인해 주세요.', logout)
      return
    }

    const generation = ++requestGenRef.current
    const isStale = () => generation !== requestGenRef.current
    const abort = new AbortController()
    submitAbortRef.current = abort
    setSubmitting(true)
    images.setError(null)
    setSubmitError(null)
    images.setPhotoUploadFailed(false)

    // '지금'이면 누른 순간이 시작, 아니면 고른 시각. 서버에는 UTC ISO-8601 로 보낸다.
    const submitNow = Date.now()
    const resolved = resolveSchedule(schedule, submitNow)
    const problem = scheduleError(resolved.startMs, resolved.endMs, submitNow)
    if (problem) {
      setNow(submitNow)
      setSubmitting(false)
      setSubmitError({ message: problem, network: false, retryable: false })
      return
    }
    const startsAt = new Date(resolved.startMs)
    const endsAt = new Date(resolved.endMs)
    // 여러 날 정해진 시간에만 운영하면 날짜별 운영 시간(11-08). 첫날 시작·마지막 날 끝은 위 startsAt·endsAt 과 같다.
    const days = scheduleDaysFor(schedule, resolved)

    const imageKeys: string[] = []
    try {
      // 사진을 한 장씩 차례로 S3 에 올려 키를 받는다(동시에 올리면 느린 와이파이에서 모두 시간 초과 나기 쉽다).
      // 실패하면 제보는 만들지 않고 작성 내용은 그대로 남긴다(다시 시도 / 사진 없이 올리기). 이미 올린 장은
      // 다시 시도할 때 키를 재사용한다. 서버에 사진 기능이 아직 없으면 사진만 빼고 계속 올린다.
      for (let index = 0; index < picked.length; index += 1) {
        try {
          imageKeys.push(await images.ensureImageKey(picked[index], accessToken, abort.signal))
        } catch (caught) {
          if (!(caught instanceof ReportImageUploadError)) throw caught
          if (isStale()) return
          if (caught.kind !== 'unavailable') {
            images.setPhotoUploadFailed(true)
            setSubmitError({
              message: picked.length > 1 ? `${index + 1}번째 사진: ${caught.message}` : caught.message,
              network: false,
              retryable: caught.kind === 'failed',
            })
            return
          }
          imageKeys.length = 0
          images.setPhotoSkipped(true)
          break
        }
        // 올리는 사이 창을 닫았으면 남은 사진도, 제보 등록도 하지 않는다. 예전엔 실패했을 때만 확인해 닫은 뒤에도
        // 나머지를 올리고 제보까지 만들었다 — 사용자는 취소했다고 여겨 다시 써 올리면 같은 제보가 두 번 생긴다.
        if (isStale()) return
      }

      if (isStale()) return
      // 서버 건물 id. 캠퍼스 안 제보는 buildingId·floor 가 필수다(없으면 400). 지도 데이터(`GET /map/data`)의 건물에는
      // id 가 실려 오므로 그대로 쓰고, 혹시 없으면(id 를 싣지 않는 서버) 예전처럼 이름으로 서버 건물 목록에서 찾는다.
      // 캠퍼스 밖 제보는 건물·층 없이 보낸다.
      const buildingId = building ? building.id ?? (await getServerBuildingId(building.name)) : undefined
      if (buildingId === null) {
        throw new Error('이 건물은 아직 제보를 받을 수 없어요. 가까운 다른 건물로 위치를 옮겨 주세요.')
      }
      // 등록 요청은 보내고 나면 되돌릴 수 없다 — 보내기 직전이 닫힌 걸 알아챌 마지막 자리다.
      if (isStale()) return

      const report = await createReport(
        {
          // 새 서버는 imageKeys(최대 3장)를 쓰고, 1장만 받는 구버전 서버는 imageKey(첫 장)만 읽는다.
          imageKeys: imageKeys.length > 0 ? imageKeys : undefined,
          imageKey: imageKeys[0],
          buildingId,
          floor: building ? floor : undefined,
          lat: target.lat,
          lng: target.lng,
          category,
          customCategoryLabel: isCustomActive ? trimmedCustomLabel : undefined,
          // 지우고 비워 두면 보내지 않는다 — 앱이 좌표로 가까운 건물을 보여 준다.
          placeLabel: form.shownPlace.trim() || undefined,
          title: trimmedTitle,
          content: form.content.trim() || undefined,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          ...(days ? { days } : {}),
        },
        accessToken,
      )
      // 서버에는 이미 올라갔으니 창을 닫았어도 지도 목록은 새로 받게 알린다.
      onCreated(report)
      images.clearUploadedKeys()
      if (isStale()) return
      setSubmittedStartMs(schedule.startMode === 'scheduled' ? resolved.startMs : null)
      setSubmitted(true)
      haptics.success()
      // 응답에 imageUrls 가 없으면 사진 1장만 받는 구버전 서버다 — 첫 장(imageKey)만 붙었다.
      if (imageKeys.length > 1 && !Array.isArray(report.imageUrls)) {
        toast.show({
          message: `서버가 아직 사진 1장만 받아 첫 번째 사진만 올렸어요.`,
          tone: 'info',
          duration: 4000,
        })
      }
    } catch (caught) {
      if (isStale()) return
      // 서버가 사진 확인(업로드 여부·크기·형식)에서 거절했을 수 있다. 다음엔 새로 올리고, 사진 없이 올릴 길도 연다.
      // 그 밖의 400(건물·시각·제목 등)은 아래 일반 안내로 알리고 올린 사진 키는 남겨 둔다 — 예전엔 사진만 붙어 있으면
      // 모든 400 을 사진 문제로 보여 엉뚱한 안내와 함께 다시 올려야 했다.
      if (isPhotoRejection(caught, imageKeys.length)) {
        images.clearUploadedKeys()
        images.setPhotoUploadFailed(true)
        setSubmitError({
          message: '사진을 확인하지 못해 제보를 올리지 못했어요. 다시 시도하거나 사진 없이 올려 주세요.',
          network: false,
          retryable: true,
        })
        return
      }
      setSubmitError({
        message: reportSubmitErrorMessage(caught),
        network: isNetworkError(caught),
        retryable: isRetryableError(caught),
      })
    } finally {
      if (submitAbortRef.current === abort) submitAbortRef.current = null
      if (!isStale()) setSubmitting(false)
    }
  }

  /** 사진 업로드가 실패했을 때 사진을 빼고 바로 올린다. */
  const handleSubmitWithoutPhoto = () => {
    if (!checkRequired()) return
    images.setImages([])
    images.clearUploadedKeys()
    void submit([])
  }

  const handleSubmit = () => {
    if (submitting || !checkRequired()) return
    void submit(images.images)
  }

  return {
    submitting,
    submitError,
    submitted,
    submittedStartMs,
    handleClose,
    handleSubmit,
    handleSubmitWithoutPhoto,
  }
}
