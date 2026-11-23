import { floorChipLabel, shortBuildingName, type BuildingIndex } from './buildings'
import type { LevelRef } from './types'

export const levelName = (index: BuildingIndex, level: LevelRef) => `${shortBuildingName(index.byCode.get(level.building), level.building)} ${floorChipLabel(level.floor)}층`
