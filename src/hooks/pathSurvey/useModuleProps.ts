import { useMemo, useState } from 'react'
import type { Building } from '../../types'
import { isHexColor, PALETTE, type SurveyModule, type SurveyPlace } from '../../utils/pathSurvey/store'
import { parseFloor } from '../../utils/pathSurvey/moduleProps'

/** ModuleProps 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useModuleProps({ module, customColors, buildings, onChange, onAddColor, onNotice }: Pick<{
  module: SurveyModule
  customColors: readonly string[]
  buildings: readonly Building[]
  onChange: (fn: (m: SurveyModule) => SurveyModule, record?: boolean) => void
  onAddColor: (color: string) => void
  onNotice: (text: string) => void
}, 'module' | 'customColors' | 'buildings' | 'onChange' | 'onAddColor' | 'onNotice'>) {
  const [colorText, setColorText] = useState('#')
  const [name, setName] = useState('')
  const [buildingId, setBuildingId] = useState<number | undefined>(undefined)
  const [floorText, setFloorText] = useState('')
  const [label, setLabel] = useState('')

  const suggestions = useMemo(() => {
    const q = name.trim()
    if (!q || buildings.some((b) => b.name === q)) return []
    return buildings.filter((b) => b.name.includes(q)).slice(0, 6)
  }, [name, buildings])

  const addColor = () => {
    const c = colorText.trim()
    if (!isHexColor(c)) return onNotice('색은 #RRGGBB 모양으로 적어 주세요 (예: #1E3A8A)')
    onAddColor(c)
    onChange((m) => ({ ...m, color: c.toUpperCase() }))
    setColorText('#')
  }

  const addPlace = () => {
    const buildingName = name.trim()
    const floor = parseFloor(floorText)
    if (!buildingName) return onNotice('건물을 고르거나 이름을 적어 주세요')
    if (floor === null) return onNotice('층은 1, 2, ... 또는 지하 B1(-1), B2(-2) 로 적어 주세요')
    const known = buildings.find((b) => b.name === buildingName)
    const place: SurveyPlace = { buildingName, floor }
    const id = buildingId ?? known?.id
    if (id !== undefined && known?.name === buildingName) place.buildingId = id
    if (label.trim()) place.label = label.trim()
    onChange((m) => ({ ...m, places: [...m.places, place] }))
    setName('')
    setBuildingId(undefined)
    setFloorText('')
    setLabel('')
  }

  const removePlace = (index: number) => {
    if (module.status === 'done' && module.places.length <= 1) {
      return onNotice('완료한 모듈은 장소가 1개 이상 있어야 해요. 먼저 "다시 편집"을 누르거나 다른 장소를 추가하세요.')
    }
    onChange((m) => ({ ...m, places: m.places.filter((_, i) => i !== index) }))
  }

  const colors = [...PALETTE, ...customColors]
  return {
    colorText,
    setColorText,
    name,
    setName,
    setBuildingId,
    floorText,
    setFloorText,
    label,
    setLabel,
    suggestions,
    addColor,
    addPlace,
    removePlace,
    colors,
  }
}
