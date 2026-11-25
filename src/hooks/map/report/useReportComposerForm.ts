import { useEffect, useMemo, useState } from 'react'
import type { WheelItem } from '../../../utils/common/wheelPicker'
import type { ReportTarget } from '../../../components/map/report/ReportComposerModal'
import { initialReportSchedule, resolveSchedule, type ReportSchedule } from '../../../utils/map/report/reportScheduleState'
import { CAMPUS_CENTER } from '../../../constants/map'
import { REPORT_DEFAULT_DURATION_HOURS, REPORT_OFF_CAMPUS_MAX_METERS } from '../../../constants/report'
import { useMapData } from '../../../lib/mapData'
import type { ReportCategory } from '../../../types'
import { haversineMeters } from '../../../utils/common/geo'
import {
  BASEMENT_NUMBERS,
  FLOOR_NUMBERS,
  MAX_BASEMENT,
  buildingFloorDialItems,
  composerMissingFields,
  defaultBuildingFloor,
  formatFloor,
} from '../../../utils/map/report/reportComposer'
import { scheduleError } from '../../../utils/map/report/reportSchedule'

/**
 * 제보 작성창의 입력값: 장소·층·카테고리·제목·설명·시간과, 그걸로 계산한 빠진 필수 항목.
 * 사진·등록 상태는 `useReportImages`·`useReportSubmission` 이 맡는다.
 */
export function useReportComposerForm(target: ReportTarget | null) {
  const [category, setCategory] = useState<ReportCategory>('EVENT')
  // '+' 로 확정한 카테고리 라벨. 체크(확정) 전까지는 반영되지 않는다.
  const [customLabel, setCustomLabel] = useState('')
  // 입력 칸이 열려 있는 동안의 작업본. 확정해야 customLabel 로 옮겨간다 —
  // 취소를 누르면 이미 확정해 둔 라벨을 건드리지 않고 이 작업본만 버린다.
  const [customLabelDraft, setCustomLabelDraft] = useState('')
  const [customInputOpen, setCustomInputOpen] = useState(false)
  const [title, setTitle] = useState('')
  /**
   * 장소 설명. 처음엔 핀 근처 건물로 "제4공학관(T동) 근처"를 보여 주고, 작성자가 고치면 그 글을 쓴다(10-06 요청).
   * 고치기 전에는 placeEdited=false 라 핀을 옮겨 다시 열어도 새 건물 이름으로 따라간다.
   */
  const [placeLabel, setPlaceLabel] = useState('')
  const [placeEdited, setPlaceEdited] = useState(false)
  const [content, setContent] = useState('')
  /** 언제: 시작(지금/날짜·시간)과 끝(진행 시간/종료 시각). */
  const [schedule, setSchedule] = useState<ReportSchedule>(() => initialReportSchedule(REPORT_DEFAULT_DURATION_HOURS))
  /** 화면의 '지금'. 열려 있는 동안 30초마다 갱신해 지난 시각 칩을 막고 '지금 ~' 요약을 맞춘다. */
  const [now, setNow] = useState(() => Date.now())

  // 서버는 제보를 건물·층 단위로 받는다(둘 다 필수). 핀 근처 건물이 없으면 올릴 수 없다.
  // 핀 근처 건물 이름은 지도 페이지가 찾아 준다 — 같은 이름의 건물을 지도 데이터에서 찾는다.
  const { buildings } = useMapData()
  const building = useMemo(
    () => (target?.buildingName ? buildings.find((b) => b.name === target.buildingName) ?? null : null),
    [buildings, target?.buildingName],
  )
  // 층은 다이얼 두 개(지상/지하 · 1~30)로 고른다. 표시는 '3F'·'B1', 서버에는 정수(지하는 음수, B1 = -1)로 보낸다.
  const [basement, setBasement] = useState(false)
  /** 핀 근처 건물로 만든 기본 장소 설명. 건물이 없으면 빈칸(좌표는 자리표시로만 보여 준다). */
  const defaultPlace = target?.buildingName ? `${target.buildingName} 근처` : ''
  const shownPlace = placeEdited ? placeLabel : defaultPlace
  /**
   * 학교 건물 근처가 아니지만 홍대 생활권(캠퍼스에서 2.5km) 안인 핀 — 건물·층 없이, 장소 설명을 꼭 적어 올린다(10-27).
   * 그보다 멀면(지도 범위 사각형의 모서리 등) 올릴 수 없다. 서버도 같은 규칙으로 거른다.
   */
  const offCampus =
    building === null &&
    target !== null &&
    haversineMeters(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, target.lat, target.lng) <= REPORT_OFF_CAMPUS_MAX_METERS
  const [floorNumber, setFloorNumber] = useState(1)
  /** 로비층(L)이 있는 건물(홍문관 R동)은 그 건물의 층 목록 하나로 고른다(`buildingFloorDialItems`). 없으면 null. */
  const buildingFloorItems = useMemo(() => buildingFloorDialItems(building), [building])
  const [buildingFloor, setBuildingFloor] = useState(1)
  // 건물이 바뀌어 고른 층이 그 건물 목록에 없으면 기본 층(1F)으로 맞춘다.
  useEffect(() => {
    if (buildingFloorItems && !buildingFloorItems.some((item) => item.value === buildingFloor)) {
      setBuildingFloor(defaultBuildingFloor(buildingFloorItems))
    }
  }, [buildingFloorItems, buildingFloor])
  const floor = buildingFloorItems ? buildingFloor : basement ? -floorNumber : floorNumber
  const floorItems = useMemo<WheelItem<number>[]>(
    () => (basement ? BASEMENT_NUMBERS : FLOOR_NUMBERS).map((value) => ({ value, label: formatFloor(basement, value) })),
    [basement],
  )
  // 지상 15층에서 지하로 바꾸면 B15 가 되지 않게 B10 으로 맞춘다.
  useEffect(() => {
    if (basement && floorNumber > MAX_BASEMENT) setFloorNumber(MAX_BASEMENT)
  }, [basement, floorNumber])

  const trimmedTitle = title.trim()
  const trimmedCustomLabel = customLabel.trim()
  const { startMs: shownStartMs, endMs: shownEndMs } = resolveSchedule(schedule, now)
  const scheduleProblem = scheduleError(shownStartMs, shownEndMs, now)

  const missing = composerMissingFields({
    hasBuilding: building !== null,
    offCampus,
    shownPlace,
    customInputOpen,
    customLabelDraft,
    trimmedTitle,
    scheduleProblem,
  })

  const resetForm = () => {
    setCategory('EVENT')
    setCustomLabel('')
    setCustomLabelDraft('')
    setCustomInputOpen(false)
    setTitle('')
    setPlaceLabel('')
    setPlaceEdited(false)
    setContent('')
    setSchedule(initialReportSchedule(REPORT_DEFAULT_DURATION_HOURS))
    setNow(Date.now())
    setFloorNumber(1)
    setBasement(false)
    setBuildingFloor(1)
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

  /** 장소 칸을 고치면 그때부터 핀 근처 건물 이름을 따라가지 않는다. */
  const handleChangePlace = (value: string) => {
    setPlaceEdited(true)
    setPlaceLabel(value)
  }

  const isCustomActive = category === 'ETC' && trimmedCustomLabel.length > 0

  return {
    category,
    customLabelDraft,
    setCustomLabelDraft,
    customInputOpen,
    title,
    setTitle,
    placeEdited,
    shownPlace,
    content,
    setContent,
    schedule,
    setSchedule,
    now,
    setNow,
    building,
    offCampus,
    basement,
    setBasement,
    floorNumber,
    setFloorNumber,
    buildingFloorItems,
    buildingFloor,
    setBuildingFloor,
    floor,
    floorItems,
    trimmedTitle,
    trimmedCustomLabel,
    isCustomActive,
    scheduleProblem,
    missing,
    resetForm,
    handleOpenCustomInput,
    handleConfirmCustomLabel,
    handleCancelCustomInput,
    handleSelectPresetCategory,
    handleChangePlace,
  }
}

export type ReportComposerForm = ReturnType<typeof useReportComposerForm>
