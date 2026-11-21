import { formatFloor } from '../../utils/common/floors'
import { exhibitionPhase, ymdToDayIndex, type ExhibitionPhase } from '../../utils/exhibitions'
import type { AdminExhibition, AdminExhibitionInput, AdminFacility } from '../types'
import { linkErrors, optional, tooLong, type BuildResult } from './mapFormRules'

/**
 * 전시 관리(ExhibitionsScreen)의 편집 초안 ↔ 서버 본문 변환과 진행 단계별 묶기. 순수 함수라 `pnpm test` 에서 바로 돈다.
 * 날짜는 한국 날짜로 양끝을 포함한다.
 */

/** 전시장으로 고를 수 있는 편의시설 종류. */
export const VENUE_KIND = '행사·전시'

export interface ExhibitionDraft {
  id: number | null
  facilityId: string | null
  title: string
  startsOn: string
  endsOn: string
  hours: string
  description: string
  linkLabel: string
  linkUrl: string
}

export function emptyExhibitionDraft(facilityId: string | null): ExhibitionDraft {
  return { id: null, facilityId, title: '', startsOn: '', endsOn: '', hours: '', description: '', linkLabel: '', linkUrl: '' }
}

export function exhibitionDraftFrom(exhibition: AdminExhibition): ExhibitionDraft {
  return {
    id: exhibition.id,
    facilityId: exhibition.facilityId,
    title: exhibition.title,
    startsOn: exhibition.startsOn,
    endsOn: exhibition.endsOn,
    hours: exhibition.hours ?? '',
    description: exhibition.description ?? '',
    linkLabel: exhibition.link?.label ?? '',
    linkUrl: exhibition.link?.url ?? '',
  }
}

/** 화면 검증. 통과하면 요청 본문, 아니면 오류 문구 목록. */
export function buildExhibitionInput(draft: ExhibitionDraft): BuildResult<AdminExhibitionInput> {
  const errors: string[] = []
  if (!draft.facilityId) errors.push('전시장을 골라 주세요.')
  const title = draft.title.trim()
  if (!title) errors.push('전시 제목을 입력해 주세요.')
  for (const [value, max, label] of [
    [draft.title, 150, '전시 제목'],
    [draft.hours, 100, '관람 시간'],
    [draft.description, 1000, '설명'],
    [draft.linkLabel, 50, '링크 이름'],
    [draft.linkUrl, 500, '링크 주소'],
  ] as const) {
    const error = tooLong(value, max, label)
    if (error) errors.push(error)
  }
  const startsOn = draft.startsOn.trim()
  const endsOn = draft.endsOn.trim()
  const start = ymdToDayIndex(startsOn)
  const end = ymdToDayIndex(endsOn)
  if (start === null) errors.push('시작일을 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요(예: 2026-10-12).')
  if (end === null) errors.push('종료일을 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요(예: 2026-10-16).')
  if (start !== null && end !== null && end < start) errors.push('종료일은 시작일과 같거나 뒤여야 해요.')
  const linkUrl = draft.linkUrl.trim()
  const linkLabel = draft.linkLabel.trim()
  errors.push(...linkErrors(linkLabel, linkUrl))
  if (errors.length || !draft.facilityId) return { errors }
  return {
    input: {
      facilityId: draft.facilityId,
      title,
      startsOn,
      endsOn,
      hours: optional(draft.hours),
      description: optional(draft.description),
      link: linkUrl ? { label: linkLabel, url: linkUrl } : undefined,
    },
  }
}

/** 전시장 이름: '건물 층 설명'. */
export function venueLabel(venue: AdminFacility): string {
  const floor = typeof venue.floor === 'number' ? ` ${formatFloor(venue.floor)}` : ''
  return `${venue.buildingName}${floor}${venue.note ? ` ${venue.note}` : ''}`
}

/**
 * 진행 중(끝나는 날 빠른 순)·예정(시작 빠른 순)·지난 전시(최근 끝난 순)로 묶는다. `today` 는 한국 날짜 일련번호(kstTodayIndex).
 */
export function groupExhibitions(
  exhibitions: readonly AdminExhibition[],
  today: number,
): Record<ExhibitionPhase, AdminExhibition[]> {
  const groups: Record<ExhibitionPhase, AdminExhibition[]> = { current: [], upcoming: [], past: [] }
  for (const exhibition of exhibitions) groups[exhibitionPhase(exhibition, today)].push(exhibition)
  groups.current.sort((a, b) => a.endsOn.localeCompare(b.endsOn))
  groups.upcoming.sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  groups.past.sort((a, b) => b.endsOn.localeCompare(a.endsOn))
  return groups
}
