import { INFO_SUGGESTION_PREFIXES, type InfoSuggestType } from '../../constants/feedback'
import type { PartnerAffiliation } from '../../types'

export const MAX_CONTENT_LENGTH = 1000 // 서버 FeedbackCreateRequest.content 상한

/** 위쪽 종류 칩. 배열 순서가 칩 순서다. */
export const TYPES: readonly { value: InfoSuggestType; label: string }[] = [
  { value: 'partner', label: '제휴·혜택' },
  { value: 'exhibition', label: '전시' },
  { value: 'event', label: '행사' },
  { value: 'facility', label: '시설 정보' },
  { value: 'other', label: '기타' },
]

export const INTRO: Record<InfoSuggestType, string> = {
  partner: '학생 할인·서비스를 주는 가게를 알려 주시거나, 앱에 나온 제휴 정보가 다르면 알려 주세요.',
  exhibition: '졸업전·과 전시처럼 앞으로 열리거나 열리고 있는 전시를 알려 주세요.',
  event: '축제·설명회처럼 해마다 열리거나 열릴 예정인 행사를 알려 주세요.',
  facility: '편의시설의 위치·층·운영시간이 틀렸거나, 새로 생긴 시설이 있으면 알려 주세요.',
  other: '앱에 실렸으면 하는 정보나 고쳐야 할 내용을 자유롭게 알려 주세요.',
}

export type Kind = 'new' | 'fix'

/** 지도에서 핀으로 찍은 위치. 좌표는 제보 내용에 그대로 담아 운영진이 바로 지도에 넣을 수 있게 한다. */
export interface InfoSuggestLocation {
  lat: number
  lng: number
  /** 핀 근처 건물 이름(없을 수 있음) */
  buildingName: string | null
}

export interface Draft {
  type: InfoSuggestType
  kind: Kind
  name: string
  address: string
  affiliation: PartnerAffiliation | null
  /** '직접 입력' 칩을 고르면 문자열(동아리·학과 학생회 등 목록에 없는 소속), 아니면 null. */
  affiliationCustom: string | null
  detail: string
  source: string
  period: string
  building: string | null
  floor: string
  facilityKind: string | null
  contact: string
  /** 행사·전시가 온라인으로만 열린다(장소 칸 대신). */
  online: boolean
}

export type InfoSuggestPrefill = Partial<Pick<Draft, 'type' | 'kind' | 'name' | 'address' | 'affiliation'>>

export const EMPTY_DRAFT: Draft = {
  type: 'partner',
  kind: 'new',
  name: '',
  address: '',
  affiliation: null,
  affiliationCustom: null,
  detail: '',
  source: '',
  period: '',
  building: null,
  floor: '',
  facilityKind: null,
  contact: '',
  online: false,
}

/** 비어 있으면 안 되는 칸. 보내기를 눌렀을 때 빨간 테두리와 안내가 붙는다. */
export type RequiredField = 'name' | 'location' | 'place' | 'period' | 'facilityKind' | 'building' | 'detail'

export const REQUIRED_HINT: Record<RequiredField, string> = {
  name: '이름을 알려 주세요.',
  location: '주소를 적거나 지도에서 위치를 찍어 주세요.',
  place: '건물을 고르거나, 장소를 적거나, 지도에서 위치를 찍어 주세요. 온라인 행사면 온라인을 골라 주세요.',
  period: '언제 열리는지 알려 주세요.',
  facilityKind: '어떤 시설인지 골라 주세요.',
  building: '건물을 골라 주세요.',
  detail: '내용을 적어 주세요.',
}

export function formatLocation(location: InfoSuggestLocation): string {
  const coord = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
  return location.buildingName ? `${location.buildingName} 근처 (${coord})` : coord
}

export function formatCoord(location: InfoSuggestLocation): string {
  return `${location.lat.toFixed(7)}, ${location.lng.toFixed(7)}${location.buildingName ? ` (${location.buildingName} 근처)` : ''}`
}

export function missingFields(draft: Draft, location: InfoSuggestLocation | null): RequiredField[] {
  const missing: RequiredField[] = []
  const blank = (value: string) => value.trim().length === 0
  switch (draft.type) {
    case 'partner':
      if (blank(draft.name)) missing.push('name')
      if (blank(draft.address) && !location) missing.push('location')
      break
    case 'exhibition':
    case 'event':
      if (blank(draft.name)) missing.push('name')
      // 장소가 없으면 운영진이 지도에 올릴 수 없다(장소 없는 행사 제보가 들어왔다, 10-05). 건물·주소·핀 중 하나,
      // 온라인 행사면 '온라인'을 고르면 된다.
      if (!draft.online && !draft.building && blank(draft.address) && !location) missing.push('place')
      if (blank(draft.period)) missing.push('period')
      break
    case 'facility':
      if (!draft.facilityKind) missing.push('facilityKind')
      if (!draft.building) missing.push('building')
      if (blank(draft.detail)) missing.push('detail')
      break
    case 'other':
      if (blank(draft.detail)) missing.push('detail')
      break
  }
  return missing
}

/** 관리자가 그대로 읽을 수 있는 줄글. 맨 앞 머리말로 관리자 화면이 종류를 가른다. */
export function buildContent(draft: Draft, location: InfoSuggestLocation | null): string {
  const t = (value: string) => value.trim()
  const line = (label: string, value: string | null | undefined) => (value && value.trim() ? `${label}: ${value.trim()}` : null)
  const prefix = INFO_SUGGESTION_PREFIXES[draft.type]
  let lines: (string | null)[]
  switch (draft.type) {
    case 'partner':
      // 정보 제보로 넓히기 전과 같은 모양(관리자가 익숙한 형식)
      lines = [
        `${prefix} ${draft.kind === 'new' ? '새 제휴 업체' : '제휴 정보 수정'}`,
        `가게: ${t(draft.name)}`,
        line('위치', draft.address),
        location ? `좌표: ${formatCoord(location)}` : null,
        line('소속', draft.affiliationCustom != null ? draft.affiliationCustom : draft.affiliation),
        line(draft.kind === 'new' ? '혜택' : '달라진 점', draft.detail),
        line('출처', draft.source),
      ]
      break
    case 'exhibition':
    case 'event': {
      const place = draft.online
        ? ['온라인', t(draft.address)].filter(Boolean).join(' · ')
        : [draft.building, t(draft.address)].filter(Boolean).join(' · ')
      lines = [
        prefix,
        line('이름', draft.name),
        line('장소', place),
        location && !draft.online ? `좌표: ${formatCoord(location)}` : null,
        line('기간', draft.period),
        line('내용', draft.detail),
      ]
      break
    }
    case 'facility':
      lines = [
        `${prefix} ${draft.kind === 'new' ? '새 시설' : '정보 수정'}`,
        line('시설', draft.facilityKind),
        line('건물', draft.building),
        line('층·호수', draft.floor),
        line(draft.kind === 'new' ? '새 정보' : '틀린 점', draft.detail),
      ]
      break
    case 'other':
      lines = [prefix, line('내용', draft.detail)]
      break
  }
  return lines
    .filter((value): value is string => value !== null)
    .join('\n')
    .slice(0, MAX_CONTENT_LENGTH)
}

/** 종류를 바꾼다. 이름·내용·연락처는 옮겨 가도 뜻이 통해 남기고, 종류마다 다른 칸만 비운다. */
export function retypeDraft(prev: Draft, type: InfoSuggestType): Draft {
  return { ...prev, type, kind: 'new', affiliation: null, affiliationCustom: null, source: '', period: '', facilityKind: null }
}

/** 건물 이름 거르기(공백·대소문자 무시). 고른 건물은 걸러져도 맨 앞에 남겨 무엇을 골랐는지 보이게 한다. */
export function filterBuildingNames(all: readonly string[], query: string, value: string | null): string[] {
  const q = query.replace(/\s/g, '').toLowerCase()
  const filtered = q ? all.filter((name) => name.replace(/\s/g, '').toLowerCase().includes(q)) : [...all]
  return value ? [value, ...filtered.filter((name) => name !== value)] : filtered
}
