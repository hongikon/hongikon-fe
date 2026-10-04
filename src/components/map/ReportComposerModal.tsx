import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
  Platform,
  Linking,
  AccessibilityInfo,
  Animated,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { SHEET_MAX_WIDTH } from '../../constants/layout'
import ScreenHeader from '../common/ScreenHeader'
import Button from '../common/Button'
import ReportGuidelines from './ReportGuidelines'
import TextField from '../common/TextField'
import * as haptics from '../../lib/haptics'
import { REPORT_CATEGORIES } from '../../constants/reportCategories'
import {
  REPORT_CONTENT_MAX_LENGTH,
  REPORT_CUSTOM_CATEGORY_MAX_LENGTH,
  REPORT_DEFAULT_DURATION_HOURS,
  REPORT_TITLE_MAX_LENGTH,
} from '../../constants/report'
import ReportScheduleFields, {
  initialReportSchedule,
  resolveSchedule,
  type ReportSchedule,
} from './ReportScheduleFields'
import { formatClock, formatDay, scheduleError } from '../../utils/reportSchedule'
import { useAuth } from '../../contexts/AuthContext'
import {
  REPORT_IMAGE_MAX_BYTES,
  ReportImageUploadError,
  createReport,
  reportImageContentType,
  uploadReportImage,
  type PickedReportImage,
} from '../../apis/reports'
import { getServerBuildingId } from '../../apis/buildings'
import { ApiError, isNetworkError, isRetryableError } from '../../apis/client'
import { BUILDINGS } from '../../constants/buildings'
import RetryableError from '../common/RetryableError'
import { REPORT_MAX_IMAGES, promptLogin } from '../../utils/reports'
import { ToastViewport, useToast } from '../common/Toast'
import { chipStyles } from './chipStyles'
import { useAttentionFlash } from '../../hooks/useAttentionFlash'
import WheelPicker, { type WheelItem } from '../common/WheelPicker'
import type { Report, ReportCategory } from '../../types'

/** 길게 누른 지점. 좌표는 건물로 스냅하지 않은 원본이다. */
export interface ReportTarget {
  lat: number
  lng: number
  /** 근처 건물 이름. 스냅이 아니라 참고용이라 없을 수 있다. */
  buildingName: string | null
}

interface ReportComposerModalProps {
  target: ReportTarget | null
  onClose: () => void
  onCreated: (report: Report) => void
}

/** 층 다이얼 상한(캠퍼스 최고층 건물 + 여유). */
const MAX_FLOOR = 30

const FLOOR_LEVEL_ITEMS: readonly WheelItem<boolean>[] = [
  { value: false, label: '지상' },
  { value: true, label: '지하' },
]
const FLOOR_NUMBERS = Array.from({ length: MAX_FLOOR }, (_, index) => index + 1)
/** 층 표시: 지상 3층 = '3F', 지하 1층 = 'B1'. */
function formatFloor(basement: boolean, floorNumber: number): string {
  return basement ? `B${floorNumber}` : `${floorNumber}F`
}

/** 채워야 올릴 수 있는 항목. 화면 위→아래 순서다(빠진 첫 항목으로 스크롤한다). 층은 다이얼이라 늘 유효하다. */
type RequiredField = 'building' | 'category' | 'title' | 'schedule'

/** 빠진 칸으로 스크롤한 뒤 입력칸에 포커스를 줄 때까지(ms). 스크롤 애니메이션과 겹치지 않게 조금 기다린다. */
const FOCUS_AFTER_SCROLL_MS = 320

/**
 * 등록 실패를 사용자가 다음에 뭘 해야 하는지 알 수 있는 문구로 바꾼다.
 * (서버 원문은 개발용이라 그대로 보여주지 않는다.)
 */
function reportSubmitErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return '인터넷 연결이 불안정해 제보를 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
  if (error instanceof ApiError) {
    // 시작·종료 시각 규칙(예정 제보)에 걸리면 서버가 해요체 문구를 준다 — 그대로 보여 준다.
    if (error.status === 400 && error.serverMessage && /시각|진행 시간|진행 기간/.test(error.serverMessage)) {
      return error.serverMessage
    }
    if (error.status === 400) return '제보 내용이 올바르지 않아요. 위치(건물·층)와 제목을 다시 확인해 주세요.'
    if (error.status === 401) return '로그인이 만료됐어요. 다시 로그인한 뒤 제보해 주세요.'
    if (error.status === 403) return '이 계정으로는 제보를 올릴 수 없어요.'
    if (error.status === 429) return '제보를 너무 자주 올렸어요. 잠시 후 다시 시도해 주세요.'
    if (error.status >= 500) return '서버에 일시적인 문제가 있어 제보를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'
  }
  if (error instanceof Error && error.message) return error.message
  return '제보를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'
}

function formatCoord(value: number): string {
  return value.toFixed(5)
}

/**
 * 제보 작성창. 지도를 길게 눌러 좌표가 잡힌 뒤에만 열린다.
 *
 * 층은 지상/지하 · 1~30 다이얼로 고른다. 필수 항목(제목·시간 등)이 비면 '제보 올리기'는 흐리게 보이지만 누를 수 있고,
 * 누르면 빠진 칸을 깜빡이며 안내한다(`checkRequired`).
 */
export default function ReportComposerModal({
  target,
  onClose,
  onCreated,
}: ReportComposerModalProps) {
  const { accessToken, logout } = useAuth()
  const toast = useToast()
  const [category, setCategory] = useState<ReportCategory>('EVENT')
  // '+' 로 확정한 카테고리 라벨. 체크(확정) 전까지는 반영되지 않는다.
  const [customLabel, setCustomLabel] = useState('')
  // 입력 칸이 열려 있는 동안의 작업본. 확정해야 customLabel 로 옮겨간다 —
  // 취소를 누르면 이미 확정해 둔 라벨을 건드리지 않고 이 작업본만 버린다.
  const [customLabelDraft, setCustomLabelDraft] = useState('')
  const [customInputOpen, setCustomInputOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  /** 언제: 시작(지금/날짜·시간)과 끝(진행 시간/종료 시각). */
  const [schedule, setSchedule] = useState<ReportSchedule>(() => initialReportSchedule(REPORT_DEFAULT_DURATION_HOURS))
  /** 화면의 '지금'. 열려 있는 동안 30초마다 갱신해 지난 시각 칩을 막고 '지금 ~' 요약을 맞춘다. */
  const [now, setNow] = useState(() => Date.now())
  /** 접수된 예정 제보의 시작(ms). 완료 화면 문구에 쓴다. 지금 시작이면 null. */
  const [submittedStartMs, setSubmittedStartMs] = useState<number | null>(null)
  /** 붙인 사진(최대 3장, 고른 순서 = 보이는 순서). */
  const [images, setImages] = useState<PickedReportImage[]>([])
  /**
   * 이미 올린 사진의 키(uri → key). 제보 등록만 실패하거나 중간 장에서 업로드가 끊겨 다시 시도할 때
   * 올라간 사진을 또 올리지 않게 한다. 서버가 사진을 거절(400)하면 비운다(서버가 지웠을 수 있다).
   */
  const uploadedKeysRef = useRef<Map<string, string>>(new Map())
  /** 사진 업로드가 실패해 "사진 없이 올리기"를 보여줄지. */
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false)
  /** 서버에 사진 기능이 아직 없어 사진을 빼고 올렸다 — 완료 화면에서 알려준다. */
  const [photoSkipped, setPhotoSkipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 거절된 권한. 있으면 오류 안내 옆에 "설정 열기"를 보여준다. */
  const [blockedPermission, setBlockedPermission] = useState<'camera' | 'library' | null>(null)
  /**
   * 등록 요청이 연결 문제 등으로 실패했을 때의 안내. 입력 검증 오류(`error`)와 나눈 이유는
   * "다시 시도" 버튼이 여기에만 붙어야 해서다. 제보 등록은 POST 라 자동으로 다시 보내지
   * 않고(중복 등록 방지), 사용자가 버튼을 눌렀을 때만 작성 내용 그대로 다시 보낸다.
   */
  const [submitError, setSubmitError] = useState<{
    message: string
    network: boolean
    retryable: boolean
  } | null>(null)
  // 등록 성공. 바로 닫지 않고 "검토 후 반영" 안내를 먼저 보여준다.
  // 올린 제보가 지도에 안 보이는 것을 실패로 오해하지 않게 하려는 것이다.
  const [submitted, setSubmitted] = useState(false)

  // 서버는 제보를 건물·층 단위로 받는다(둘 다 필수). 핀 근처 건물이 없으면 올릴 수 없다.
  const building = useMemo(
    () => (target?.buildingName ? BUILDINGS.find((b) => b.name === target.buildingName) ?? null : null),
    [target?.buildingName],
  )
  // 층은 다이얼 두 개(지상/지하 · 1~30)로 고른다. 표시는 '3F'·'B1', 서버에는 정수(지하는 음수, B1 = -1)로 보낸다.
  const [basement, setBasement] = useState(false)
  const [floorNumber, setFloorNumber] = useState(1)
  const floor = basement ? -floorNumber : floorNumber
  const floorItems = useMemo<WheelItem<number>[]>(
    () => FLOOR_NUMBERS.map((value) => ({ value, label: formatFloor(basement, value) })),
    [basement],
  )

  const trimmedTitle = title.trim()
  const trimmedCustomLabel = customLabel.trim()
  const { startMs: shownStartMs, endMs: shownEndMs } = resolveSchedule(schedule, now)
  const scheduleProblem = scheduleError(shownStartMs, shownEndMs, now)

  /**
   * 아직 채우지 않은 필수 항목과 그 아래 띄울 짧은 안내(화면 순서). 비어 있지 않으면 '제보 올리기'를 흐리게
   * 보여 주되 누를 수는 있게 두고, 누르면 빠진 칸을 깜빡이며 첫 칸으로 데려간다.
   * - 직접 입력 칸을 열어 두고 ✓ 로 적용하지 않으면 카테고리가 이전 값으로 올라가므로 빠진 것으로 본다.
   */
  const missing: { field: RequiredField; message: string }[] = []
  if (building === null) {
    missing.push({ field: 'building', message: '건물 가까이에 핀을 놓아야 제보할 수 있어요.' })
  }
  if (customInputOpen) {
    missing.push({
      field: 'category',
      message: customLabelDraft.trim()
        ? '✓ 를 눌러 직접 입력한 카테고리를 적용해 주세요.'
        : '카테고리 이름을 입력하거나 닫아 주세요.',
    })
  }
  if (trimmedTitle.length === 0) missing.push({ field: 'title', message: '제목을 입력해 주세요.' })
  if (scheduleProblem !== null) missing.push({ field: 'schedule', message: scheduleProblem })
  const missingMessage = (field: RequiredField) => missing.find((item) => item.field === field)?.message ?? null

  /**
   * 빠진 채 '제보 올리기'를 누른 항목별 깜빡임 번호(0 = 표시 안 함). 누를 때마다 올려 효과를 다시 틀고,
   * 그 항목이 채워지면 0 으로 돌려 빨간 안내를 바로 지운다.
   */
  const [flash, setFlash] = useState<Partial<Record<RequiredField, number>>>({})
  const flashSeqRef = useRef(0)
  const missingKey = missing.map((item) => item.field).join(',')
  useEffect(() => {
    const stillMissing = new Set(missingKey.split(','))
    setFlash((prev) => {
      const entries = Object.entries(prev) as [RequiredField, number][]
      if (entries.every(([field]) => stillMissing.has(field))) return prev
      return Object.fromEntries(entries.filter(([field]) => stillMissing.has(field)))
    })
  }, [missingKey])
  /** 깜빡인 뒤에도 그 항목이 아직 비어 있으면 안내를 보여 준다. */
  const flaggedMessage = (field: RequiredField) => (flash[field] ? missingMessage(field) : null)

  const scrollRef = useRef<ScrollView>(null)
  const customInputRef = useRef<TextInput>(null)
  const titleInputRef = useRef<TextInput>(null)
  /**
   * 빠진 칸으로 스크롤할 때 쓰는 항목 제목(라벨)과 스크롤 영역, 지금 스크롤 위치.
   * onLayout 의 y 는 웹(react-native-web)에서 위쪽 내용 높이가 바뀌어도(직접 입력 칸이 열림 등) 다시 오지 않아
   * 누른 순간 화면 위치를 재서(measureInWindow) 스크롤 안 위치로 바꾼다.
   */
  const scrollAreaRef = useRef<View>(null)
  const scrollYRef = useRef(0)
  const categoryLabelRef = useRef<Text>(null)
  const titleLabelRef = useRef<Text>(null)
  const scheduleLabelRef = useRef<Text>(null)
  const sectionLabelRefs: Partial<Record<RequiredField, RefObject<Text | null>>> = {
    category: categoryLabelRef,
    title: titleLabelRef,
    schedule: scheduleLabelRef,
  }
  const scrollToSection = (field: RequiredField) => {
    const label = sectionLabelRefs[field]?.current
    const area = scrollAreaRef.current
    if (!label || !area) {
      scrollRef.current?.scrollTo({ y: 0, animated: true })
      return
    }
    area.measureInWindow((_areaX, areaY) => {
      label.measureInWindow((_labelX, labelY) => {
        const y = scrollYRef.current + (labelY - areaY) - 8
        scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true })
      })
    })
  }
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
  }, [])
  const buildingFlash = useAttentionFlash(flash.building, building === null, COLORS.warningSoft)

  /**
   * 필수 항목을 확인한다. 빠졌으면 빠진 칸마다 테두리를 깜빡이고 안내를 띄우며, 첫 칸으로 스크롤해 포커스를 주고
   * (시간은 요약 카드만 깜빡이고 시트는 열지 않는다) 진동·스크린리더로 한 번 알린다.
   */
  const checkRequired = (): boolean => {
    if (missing.length === 0) return true
    flashSeqRef.current += 1
    const seq = flashSeqRef.current
    setFlash(Object.fromEntries(missing.map((item) => [item.field, seq])))
    haptics.warning()
    const first = missing[0]
    AccessibilityInfo.announceForAccessibility(first.message)
    scrollToSection(first.field)
    const input = first.field === 'title' ? titleInputRef : first.field === 'category' ? customInputRef : null
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
    if (input) focusTimerRef.current = setTimeout(() => input.current?.focus(), FOCUS_AFTER_SCROLL_MS)
    return false
  }

  const reset = () => {
    setCategory('EVENT')
    setCustomLabel('')
    setCustomLabelDraft('')
    setCustomInputOpen(false)
    setTitle('')
    setContent('')
    setSchedule(initialReportSchedule(REPORT_DEFAULT_DURATION_HOURS))
    setNow(Date.now())
    setSubmittedStartMs(null)
    setFloorNumber(1)
    setBasement(false)
    setImages([])
    uploadedKeysRef.current = new Map()
    setPhotoUploadFailed(false)
    setPhotoSkipped(false)
    setError(null)
    setBlockedPermission(null)
    setSubmitError(null)
    setSubmitting(false)
    setSubmitted(false)
    setFlash({})
  }

  /** '+' 칩을 누르면 입력 칸을 연다. 이미 직접 입력을 확정해 뒀으면 그 값부터 고쳐 쓰게 한다. */
  const handleOpenCustomInput = () => {
    setCustomLabelDraft(customLabel)
    setCustomInputOpen(true)
  }

  const handleConfirmCustomLabel = () => {
    const trimmedDraft = customLabelDraft.trim()
    if (!trimmedDraft) return
    setCustomLabel(trimmedDraft)
    setCategory('ETC')
    setCustomInputOpen(false)
  }

  const handleCancelCustomInput = () => {
    setCustomInputOpen(false)
  }

  const handleSelectPresetCategory = (key: ReportCategory) => {
    setCategory(key)
    // 프리셋 '기타'와 직접 입력이 둘 다 category: 'ETC' 라, 직접 입력 라벨이
    // 남아 있으면 프리셋 '기타'를 골라도 직접 입력 칩이 계속 활성으로 보인다.
    setCustomLabel('')
    setCustomInputOpen(false)
  }

  const isCustomActive = category === 'ETC' && trimmedCustomLabel.length > 0

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
  useEffect(() => {
    if (target === null || submitted) return
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [target, submitted])

  const handleClose = () => {
    cancelPendingSubmit()
    reset()
    onClose()
  }

  /**
   * 사진은 최대 3장. 앨범은 남은 장수만큼 한 번에 여러 장 고르고(고른 순서 유지), 카메라는 한 번에 1장씩 더한다.
   * 권한은 버튼을 누른 그때만 묻는다(카메라·앨범 각각). 거절된 뒤엔 휴대폰 설정으로 보내는 버튼을 보여준다.
   */
  const handlePickImage = async (source: 'camera' | 'library') => {
    setError(null)
    setBlockedPermission(null)
    const remaining = REPORT_MAX_IMAGES - images.length
    if (remaining <= 0) {
      setError(`사진은 ${REPORT_MAX_IMAGES}장까지 붙일 수 있어요.`)
      return
    }
    try {
      // Android 앨범은 시스템 사진 선택기(Photo Picker, 없으면 문서 선택기)로 열려 권한이 필요 없다.
      // 저장소·READ_MEDIA_* 권한은 Play 정책 때문에 매니페스트에서 막아 두었으니(app.json blockedPermissions)
      // Android 12 이하에서 사진 권한을 물으면 늘 거절로 돌아와 앨범을 못 연다 — 그래서 묻지 않는다.
      const skipPermission = source === 'library' && Platform.OS === 'android'
      const permission = skipPermission
        ? { granted: true }
        : source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setBlockedPermission(source)
        setError(
          source === 'camera'
            ? '카메라 권한이 꺼져 있어 사진을 찍을 수 없어요.'
            : '사진 접근 권한이 꺼져 있어 사진을 고를 수 없어요.',
        )
        return
      }

      // 남은 자리가 1장이면 단일 선택으로 연다(Android 사진 선택기는 여러 장 모드에서 상한 1을 받지 않는다).
      const multiple = source === 'library' && remaining > 1
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        // JPEG 로 다시 압축해 용량을 줄인다(서버 상한 장당 5MB).
        quality: 0.7,
        allowsEditing: false,
        // iOS 앨범의 HEIC 사진을 JPEG 로 받아 온다(서버는 JPEG·PNG 만 받음).
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        ...(multiple ? { allowsMultipleSelection: true, selectionLimit: remaining, orderedSelection: true } : {}),
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options)
      if (result.canceled || result.assets.length === 0) return

      // 웹은 selectionLimit 를 지원하지 않아 더 많이 고를 수 있다 — 앞에서부터 남은 장수만 쓴다.
      const existing = new Set(images.map((item) => item.uri))
      const accepted: PickedReportImage[] = []
      let unsupported = 0
      let tooLarge = 0
      let overflow = 0
      for (const asset of result.assets) {
        const picked: PickedReportImage = { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize }
        if (existing.has(picked.uri)) continue
        if (reportImageContentType(picked) === null) {
          unsupported += 1
          continue
        }
        if (picked.fileSize && picked.fileSize > REPORT_IMAGE_MAX_BYTES) {
          tooLarge += 1
          continue
        }
        if (accepted.length >= remaining) {
          overflow += 1
          continue
        }
        existing.add(picked.uri)
        accepted.push(picked)
      }
      if (accepted.length > 0) {
        setImages((prev) => [...prev, ...accepted].slice(0, REPORT_MAX_IMAGES))
        setPhotoUploadFailed(false)
      }
      const single = result.assets.length === 1
      if (unsupported > 0) {
        setError(single ? '이 형식의 사진은 올릴 수 없어요. 다른 사진을 골라 주세요.' : `JPEG·PNG 가 아닌 사진 ${unsupported}장은 뺐어요.`)
      } else if (tooLarge > 0) {
        setError(single ? '사진 용량이 너무 커요. 5MB 이하 사진을 골라 주세요.' : `5MB 가 넘는 사진 ${tooLarge}장은 뺐어요.`)
      } else if (overflow > 0) {
        setError(`사진은 ${REPORT_MAX_IMAGES}장까지라 ${overflow}장은 뺐어요.`)
      }
    } catch {
      // 시뮬레이터처럼 카메라가 없는 기기 등
      setError(source === 'camera' ? '이 기기에서는 카메라를 쓸 수 없어요. 앨범에서 골라 주세요.' : '사진을 불러오지 못했어요.')
    }
  }

  const handleRemoveImage = (uri: string) => {
    setImages((prev) => prev.filter((item) => item.uri !== uri))
    setPhotoUploadFailed(false)
    setError(null)
  }

  /** 사진을 올려 키를 받는다. 같은 사진을 이미 올렸으면 그 키를 쓴다. */
  const ensureImageKey = async (picked: PickedReportImage, token: string, signal?: AbortSignal): Promise<string> => {
    const cached = uploadedKeysRef.current.get(picked.uri)
    if (cached) return cached
    const key = await uploadReportImage(picked, token, signal)
    uploadedKeysRef.current.set(picked.uri, key)
    return key
  }

  /** 사진 업로드가 실패했을 때 사진을 빼고 바로 올린다. */
  const handleSubmitWithoutPhoto = () => {
    if (!checkRequired()) return
    setImages([])
    uploadedKeysRef.current = new Map()
    void submit([])
  }

  const handleSubmit = () => {
    if (submitting || !checkRequired()) return
    void submit(images)
  }

  const submit = async (picked: readonly PickedReportImage[]) => {
    if (!target || !building || submitting || trimmedTitle.length === 0) return

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
    setError(null)
    setSubmitError(null)
    setPhotoUploadFailed(false)

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

    const imageKeys: string[] = []
    try {
      // 사진을 한 장씩 차례로 S3 에 올려 키를 받는다(동시에 올리면 느린 와이파이에서 모두 시간 초과 나기 쉽다).
      // 실패하면 제보는 만들지 않고 작성 내용은 그대로 남긴다(다시 시도 / 사진 없이 올리기). 이미 올린 장은
      // 다시 시도할 때 키를 재사용한다. 서버에 사진 기능이 아직 없으면 사진만 빼고 계속 올린다.
      for (let index = 0; index < picked.length; index += 1) {
        try {
          imageKeys.push(await ensureImageKey(picked[index], accessToken, abort.signal))
        } catch (caught) {
          if (!(caught instanceof ReportImageUploadError)) throw caught
          if (isStale()) return
          if (caught.kind !== 'unavailable') {
            setPhotoUploadFailed(true)
            setSubmitError({
              message: picked.length > 1 ? `${index + 1}번째 사진: ${caught.message}` : caught.message,
              network: false,
              retryable: caught.kind === 'failed',
            })
            return
          }
          imageKeys.length = 0
          setPhotoSkipped(true)
          break
        }
        // 올리는 사이 창을 닫았으면 남은 사진도, 제보 등록도 하지 않는다. 예전엔 실패했을 때만 확인해 닫은 뒤에도
        // 나머지를 올리고 제보까지 만들었다 — 사용자는 취소했다고 여겨 다시 써 올리면 같은 제보가 두 번 생긴다.
        if (isStale()) return
      }

      if (isStale()) return
      // 앱 건물 이름 → 서버 건물 id. 서버는 buildingId·floor 를 필수로 받는다(없으면 400).
      const buildingId = await getServerBuildingId(building.name)
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
          floor,
          lat: target.lat,
          lng: target.lng,
          category,
          customCategoryLabel: isCustomActive ? trimmedCustomLabel : undefined,
          title: trimmedTitle,
          content: content.trim() || undefined,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
        accessToken,
      )
      // 서버에는 이미 올라갔으니 창을 닫았어도 지도 목록은 새로 받게 알린다.
      onCreated(report)
      uploadedKeysRef.current = new Map()
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
      // 사진 문제로 보는 건 서버 문구가 없거나(구버전·프록시) 문구가 사진 이야기일 때만이다 — 서버의 사진 거절 문구는
      // 모두 '사진'을 담는다(BE ReportImageService). 그 밖의 400(건물·시각·제목 등)은 아래 일반 안내로 알리고 올린 사진 키는
      // 남겨 둔다 — 예전엔 사진만 붙어 있으면 모든 400 을 사진 문제로 보여 엉뚱한 안내와 함께 다시 올려야 했다.
      const photoRejected =
        caught instanceof ApiError && (!caught.serverMessage || caught.serverMessage.includes('사진'))
      if (imageKeys.length > 0 && caught instanceof ApiError && caught.status === 400 && photoRejected) {
        uploadedKeysRef.current = new Map()
        setPhotoUploadFailed(true)
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

  return (
    <Modal transparent visible={target !== null} animationType="slide" onRequestClose={handleClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <SafeAreaView style={styles.sheet} edges={['bottom']}>
              <View style={styles.handle} />
              <ScreenHeader title="제보하기" onBack={handleClose} backIcon="close" />

              {submitted ? (
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
                  <Text style={styles.successTitle}>제보가 접수됐어요</Text>
                  <Text style={styles.successText}>
                    {submittedStartMs !== null
                      ? `운영진이 확인하면 ${formatDay(submittedStartMs)} ${formatClock(submittedStartMs)}부터 지도에 보여요.`
                      : '운영진이 확인한 뒤 지도에 올라가요.'}
                    {'\n'}잘못된 정보나 광고는 올라가지 않을 수 있어요.
                  </Text>
                  {photoSkipped && (
                    <Text style={styles.successText}>사진 첨부는 아직 준비 중이라 사진 없이 올렸어요.</Text>
                  )}
                  <Button label="확인" onPress={handleClose} style={styles.successBtn} />
                </View>
              ) : (
                <>
                  <View ref={scrollAreaRef} style={styles.scrollArea} collapsable={false}>
                    <ScrollView
                      ref={scrollRef}
                      style={styles.scrollArea}
                      onScroll={(event) => {
                        scrollYRef.current = event.nativeEvent.contentOffset.y
                      }}
                      scrollEventThrottle={32}
                      contentContainerStyle={styles.body}
                      keyboardShouldPersistTaps="handled"
                    >
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={15} color={COLORS.primary} />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {target?.buildingName
                            ? `${target.buildingName} 근처`
                            : target
                              ? `${formatCoord(target.lat)}, ${formatCoord(target.lng)}`
                              : ''}
                        </Text>
                      </View>

                      {building === null ? (
                        <Animated.View style={[styles.errorBox, styles.buildingBox, buildingFlash]}>
                          <Ionicons name="information-circle" size={15} color={COLORS.warningIcon} />
                          <Text style={styles.errorText}>
                            제보는 건물·층 단위로 올라가요. 창을 닫고 지도에서 핀을 건물 가까이로 옮겨 주세요.
                          </Text>
                        </Animated.View>
                      ) : (
                        <>
                          <Text style={styles.sectionLabel}>몇 층인가요?</Text>
                          <View style={styles.floorWheels}>
                            <WheelPicker
                              items={FLOOR_LEVEL_ITEMS}
                              value={basement}
                              onChange={setBasement}
                              visibleRows={3}
                              accessibilityLabel="지상 또는 지하"
                              style={styles.floorWheel}
                            />
                            <WheelPicker
                              items={floorItems}
                              value={floorNumber}
                              onChange={setFloorNumber}
                              visibleRows={3}
                              accessibilityLabel={basement ? '지하 몇 층' : '몇 층'}
                              style={styles.floorWheel}
                            />
                          </View>
                        </>
                      )}

                      <Text ref={categoryLabelRef} style={styles.sectionLabel}>
                        무슨 일인가요?
                      </Text>
                      <View style={styles.chipWrap}>
                        {REPORT_CATEGORIES.map((meta) => {
                          const isActive = category === meta.key && !isCustomActive
                          return (
                            <TouchableOpacity
                              key={meta.key}
                              activeOpacity={0.75}
                              onPress={() => handleSelectPresetCategory(meta.key)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isActive }}
                              accessibilityLabel={meta.label}
                              style={[
                                chipStyles.chip,
                                isActive && { backgroundColor: meta.color, borderColor: meta.color },
                              ]}
                            >
                              <Ionicons
                                name={meta.icon}
                                size={13}
                                color={isActive ? COLORS.white : meta.color}
                              />
                              <Text style={[chipStyles.label, isActive && chipStyles.labelActive]}>
                                {meta.label}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}

                        {!customInputOpen && (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={handleOpenCustomInput}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isCustomActive }}
                            accessibilityLabel={
                              isCustomActive ? `${trimmedCustomLabel}, 직접 입력한 카테고리` : '카테고리 직접 입력'
                            }
                            style={[
                              chipStyles.chip,
                              isCustomActive
                                ? styles.customChipActive
                                : styles.customChipAdd,
                            ]}
                          >
                            <Ionicons
                              name={isCustomActive ? 'pencil' : 'add'}
                              size={13}
                              color={isCustomActive ? COLORS.white : COLORS.primary}
                            />
                            <Text
                              style={[
                                chipStyles.label,
                                isCustomActive ? chipStyles.labelActive : styles.customChipAddText,
                              ]}
                            >
                              {isCustomActive ? trimmedCustomLabel : '직접 입력'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {customInputOpen && (
                        <View style={styles.customInputRow}>
                          <TextField
                            ref={customInputRef}
                            flashKey={flash.category}
                            invalid={customInputOpen}
                            style={styles.customInput}
                            placeholder="예: 분실물, 설문조사"
                            accessibilityLabel="직접 입력할 카테고리"
                            value={customLabelDraft}
                            onChangeText={setCustomLabelDraft}
                            maxLength={REPORT_CUSTOM_CATEGORY_MAX_LENGTH}
                            autoFocus
                            onSubmitEditing={handleConfirmCustomLabel}
                            returnKeyType="done"
                          />
                          <TouchableOpacity
                            onPress={handleConfirmCustomLabel}
                            disabled={!customLabelDraft.trim()}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="직접 입력한 카테고리 적용"
                            accessibilityState={{ disabled: !customLabelDraft.trim() }}
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={26}
                              color={customLabelDraft.trim() ? COLORS.primary : COLORS.iconMuted}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleCancelCustomInput}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="직접 입력 취소"
                          >
                            <Ionicons name="close-circle" size={26} color={COLORS.iconMuted} />
                          </TouchableOpacity>
                        </View>
                      )}
                      {flaggedMessage('category') !== null && (
                        <Text style={styles.fieldHint}>{flaggedMessage('category')}</Text>
                      )}

                      <Text ref={titleLabelRef} style={styles.sectionLabel}>
                        제목
                      </Text>
                      <TextField
                        ref={titleInputRef}
                        flashKey={flash.title}
                        invalid={trimmedTitle.length === 0}
                        placeholder="예 : 컴퓨터공학과 간식행사"
                        accessibilityLabel="제목"
                        value={title}
                        onChangeText={setTitle}
                        maxLength={REPORT_TITLE_MAX_LENGTH}
                      />
                      <View style={styles.belowField}>
                        {flaggedMessage('title') !== null && (
                          <Text style={[styles.fieldHint, styles.belowFieldHint]}>{flaggedMessage('title')}</Text>
                        )}
                        <Text style={[styles.counter, styles.belowFieldCounter]}>
                          {title.length} / {REPORT_TITLE_MAX_LENGTH}
                        </Text>
                      </View>

                      <Text style={styles.sectionLabel}>설명 (선택)</Text>
                      <TextField
                        areaHeight={100}
                        placeholder="예 : 학생회비 납부한 컴퓨터공학과 학생만 수령 가능"
                        accessibilityLabel="설명"
                        value={content}
                        onChangeText={setContent}
                        maxLength={REPORT_CONTENT_MAX_LENGTH}
                        multiline
                      />
                      <Text style={styles.counter}>
                        {content.length} / {REPORT_CONTENT_MAX_LENGTH}
                      </Text>

                      <View style={styles.photoHeader}>
                        <Text style={[styles.sectionLabel, styles.photoHeaderLabel]}>사진 (선택)</Text>
                        <Text
                          style={styles.photoCount}
                          accessibilityLabel={`사진 ${images.length}장, 최대 ${REPORT_MAX_IMAGES}장`}
                        >
                          {images.length}/{REPORT_MAX_IMAGES}
                        </Text>
                      </View>
                      {images.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.photoThumbRow}
                        >
                          {images.map((item, index) => (
                            <View key={item.uri} style={styles.photoPreviewWrap}>
                              <Image
                                source={{ uri: item.uri }}
                                style={styles.photoPreview}
                                accessibilityLabel={`첨부한 사진 ${index + 1}`}
                              />
                              {index === 0 && images.length > 1 && (
                                <View style={styles.photoCoverBadge} pointerEvents="none">
                                  <Text style={styles.photoCoverText}>대표</Text>
                                </View>
                              )}
                              <TouchableOpacity
                                style={styles.photoRemove}
                                onPress={() => handleRemoveImage(item.uri)}
                                disabled={submitting}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                accessibilityRole="button"
                                accessibilityLabel={`첨부한 사진 ${index + 1} 빼기`}
                              >
                                <Ionicons name="close" size={16} color={COLORS.white} />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </ScrollView>
                      )}
                      {images.length < REPORT_MAX_IMAGES && (
                        <View style={styles.photoBtnRow}>
                          {Platform.OS !== 'web' && (
                            <TouchableOpacity
                              style={[styles.photoBtn, styles.photoBtnHalf]}
                              onPress={() => handlePickImage('camera')}
                              disabled={submitting}
                              accessibilityRole="button"
                              accessibilityLabel="카메라로 찍기"
                            >
                              <Ionicons name="camera-outline" size={18} color={COLORS.primary} />
                              <Text style={styles.photoBtnText}>카메라로 찍기</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.photoBtn, styles.photoBtnHalf]}
                            onPress={() => handlePickImage('library')}
                            disabled={submitting}
                            accessibilityRole="button"
                            accessibilityLabel="앨범에서 고르기"
                          >
                            <Ionicons name="images-outline" size={18} color={COLORS.primary} />
                            <Text style={styles.photoBtnText}>앨범에서 고르기</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {images.length === 0 && (
                        <Text style={styles.hint}>최대 {REPORT_MAX_IMAGES}장까지 붙일 수 있어요. 촬영 위치 정보는 지우고 올려요.</Text>
                      )}

                      <Text ref={scheduleLabelRef} style={styles.sectionLabel}>
                        언제인가요?
                      </Text>
                      <ReportScheduleFields
                        value={schedule}
                        onChange={setSchedule}
                        now={now}
                        disabled={submitting}
                        flashKey={flash.schedule}
                        invalid={scheduleProblem !== null}
                      />
                      {scheduleProblem !== null && (
                        <View style={styles.errorBox}>
                          <Ionicons name="warning" size={16} color={COLORS.warningIcon} />
                          <Text style={styles.errorText}>{scheduleProblem}</Text>
                        </View>
                      )}

                      {submitError !== null && (
                        <RetryableError
                          style={styles.submitErrorBox}
                          message={submitError.message}
                          isNetworkError={submitError.network}
                          onRetry={submitError.retryable ? handleSubmit : undefined}
                          retrying={submitting}
                        />
                      )}
                      {photoUploadFailed && images.length > 0 && (
                        <TouchableOpacity
                          style={styles.skipPhotoBtn}
                          onPress={handleSubmitWithoutPhoto}
                          disabled={submitting}
                          accessibilityRole="button"
                          accessibilityLabel="사진 없이 올리기"
                        >
                          <Text style={styles.skipPhotoText}>사진 없이 올리기</Text>
                        </TouchableOpacity>
                      )}

                      {error !== null && (
                        <View style={styles.errorBox}>
                          <Ionicons name="warning" size={16} color={COLORS.warningIcon} />
                          <Text style={styles.errorText}>{error}</Text>
                          {blockedPermission !== null && (
                            <TouchableOpacity
                              onPress={() => Linking.openSettings().catch(() => {})}
                              accessibilityRole="button"
                              accessibilityLabel="휴대폰 설정 열기"
                            >
                              <Text style={styles.settingsLink}>설정 열기</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </ScrollView>
                  </View>

                  <View style={styles.footer}>
                    {/* 올리기 전에 볼 수 있게 버튼 바로 위에 접어 둔다(누르면 펼쳐짐). */}
                    <ReportGuidelines />
                    {/* 필수 항목이 비면 흐리게만 보이고 누를 수 있다 — 누르면 빠진 칸을 알려 준다. */}
                    <Button
                      label="제보 올리기"
                      onPress={handleSubmit}
                      dimmed={missing.length > 0}
                      loading={submitting}
                      accessibilityHint={
                        missing.length > 0 ? '아직 채우지 않은 항목이 있어요. 누르면 빠진 곳을 알려 줘요.' : undefined
                      }
                    />
                  </View>
                </>
              )}
            </SafeAreaView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      {/* Modal 은 루트 위에 따로 떠서 루트 토스트가 가려진다 — 여기 하나 둔다(구서버 "1장만 첨부" 안내). */}
      <ToastViewport />
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    height: '90%',
    // 넓은 화면(폴드 펼침·웹)에선 아래에서 올라오는 시트를 가운데 한 폭으로 모은다.
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 2,
  },
  scrollArea: { flex: 1 },
  body: { padding: 16, paddingBottom: 24 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
  },
  locationText: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textPrimary },
  sectionLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 18,
    marginBottom: 8,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  floorWheels: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  floorWheel: { width: 104 },
  fieldHint: { marginTop: 6, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.danger },
  belowField: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  belowFieldHint: { flex: 1, marginTop: 4 },
  belowFieldCounter: { marginLeft: 'auto' },
  // 깜빡일 때만 보이는 테두리(평소엔 바탕색과 같다).
  buildingBox: { borderWidth: 1, borderColor: COLORS.warningSoft },
  customChipAdd: { borderStyle: 'dashed', borderColor: COLORS.primary },
  customChipAddText: { color: COLORS.primary },
  customChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  customInput: { flex: 1, height: 40, fontSize: 14 },
  counter: {
    alignSelf: 'flex-end',
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  hint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
  photoBtn: {
    height: 46,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.chipBorder,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary },
  photoBtnRow: { flexDirection: 'row', gap: 8 },
  photoBtnHalf: { flex: 1 },
  settingsLink: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.primary },
  photoHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  photoHeaderLabel: { flex: 1 },
  photoCount: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginBottom: 8 },
  // 지우기 버튼(위·오른쪽으로 6 나감)이 잘리지 않게 위·오른쪽 여백을 둔다.
  photoThumbRow: { flexDirection: 'row', gap: 10, paddingTop: 6, paddingRight: 6, marginBottom: 10 },
  photoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoPreview: { width: 96, height: 96, borderRadius: 12, backgroundColor: COLORS.fill },
  photoCoverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoCoverText: { fontFamily: FONTS.semibold, fontSize: 10.5, color: COLORS.white },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { ...TYPE.headline, color: COLORS.textPrimary },
  successText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  successBtn: { marginTop: 12 },
  submitErrorBox: { marginTop: 16 },
  skipPhotoBtn: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 6 },
  skipPhotoText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.primary, textDecorationLine: 'underline' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.warningSoft,
  },
  errorText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18, color: COLORS.warning },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
})
