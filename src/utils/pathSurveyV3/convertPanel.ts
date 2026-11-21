import { floorChipLabel } from './buildings'

export function floorText(floors: number[] | undefined): string {
  if (!floors?.length) return ''
  return floors.length === 1 ? ` ${floorChipLabel(floors[0])}층` : ` ${floorChipLabel(floors[0])}~${floorChipLabel(floors[floors.length - 1])}층`
}
