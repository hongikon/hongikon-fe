import { PARTNER_CATEGORIES } from '../../constants/partnerCategories'
import type { PartnerAffiliation, PartnerCategory } from '../../types'
import { ymdToDayIndex } from '../../utils/exhibitions'
import { normalize } from '../../utils/normalize'
import type { AdminPartner, AdminPartnerInput } from '../types'
import { LAT_RANGE, LNG_RANGE, linkErrors, optional, parseCoordinate, tooLong, type BuildResult } from './mapFormRules'

/**
 * 제휴업체 관리(PartnersScreen)의 편집 초안 ↔ 서버 본문 변환과 검색. 순수 함수라 `pnpm test` 에서 바로 돈다.
 * 좌표·혜택은 확인된 값만 넣는다 — 추정해서 채우지 않는다.
 */

export const PARTNER_CATEGORY_KEYS: readonly PartnerCategory[] = PARTNER_CATEGORIES.map((meta) => meta.key)

export interface PartnerDraft {
  /** 수정 중이면 원래 code, 새로 추가면 null. */
  originalCode: string | null
  code: string
  name: string
  category: PartnerCategory | null
  affiliations: PartnerAffiliation[]
  hospitalIcon: boolean
  lat: string
  lng: string
  benefit: string
  /** 소속별 예외 혜택(비우면 기본 혜택을 따른다). */
  exceptions: Partial<Record<PartnerAffiliation, string>>
  address: string
  hours: string
  contact: string
  linkLabel: string
  linkUrl: string
  /** 제휴 종료일(YYYY-MM-DD). 비우면 기한 없음. */
  endsOn: string
  /** 이 업체만의 이용 방법. 비우면 소속별 기본 안내(학생증 제시 등). */
  usageNote: string
  /** 근처 제휴 알림 대상. 켠 업체만 앱이 근처에서 알린다(기본 꺼짐). */
  nearbyAlert: boolean
}

export function emptyPartnerDraft(): PartnerDraft {
  return {
    originalCode: null,
    code: '',
    name: '',
    category: null,
    affiliations: [],
    hospitalIcon: false,
    lat: '',
    lng: '',
    benefit: '',
    exceptions: {},
    address: '',
    hours: '',
    contact: '',
    linkLabel: '',
    linkUrl: '',
    endsOn: '',
    usageNote: '',
    nearbyAlert: false,
  }
}

export function partnerDraftFrom(partner: AdminPartner): PartnerDraft {
  const exceptions: PartnerDraft['exceptions'] = {}
  for (const item of partner.affiliationBenefits ?? []) exceptions[item.affiliation] = item.benefit
  return {
    originalCode: partner.id,
    code: partner.id,
    name: partner.name,
    category: partner.category,
    affiliations: [...(partner.affiliations ?? [])],
    hospitalIcon: partner.mapIcon === '병원',
    // 좌표는 받은 숫자를 그대로 글자로 — 고치지 않으면 같은 값이 다시 저장된다.
    lat: String(partner.lat),
    lng: String(partner.lng),
    benefit: partner.benefit ?? '',
    exceptions,
    address: partner.address ?? '',
    hours: partner.hours ?? '',
    contact: partner.contact ?? '',
    linkLabel: partner.link?.label ?? '',
    linkUrl: partner.link?.url ?? '',
    // 불러온 종료일을 그대로 다시 보낸다 — 빼고 저장하면 서버가 기한을 지운다.
    endsOn: partner.endsOn ?? '',
    usageNote: partner.usageNote ?? '',
    nearbyAlert: partner.nearbyAlert === true,
  }
}

/** 화면 검증. 통과하면 요청 본문, 아니면 오류 문구 목록. */
export function buildPartnerInput(draft: PartnerDraft): BuildResult<AdminPartnerInput> {
  const errors: string[] = []
  const name = draft.name.trim()
  if (name.length < 1 || name.length > 100) errors.push('이름은 1~100자로 입력해 주세요.')
  if (!draft.category) errors.push('업종을 골라 주세요.')
  const lat = parseCoordinate(draft.lat, LAT_RANGE, '위도')
  const lng = parseCoordinate(draft.lng, LNG_RANGE, '경도')
  if (lat === null || lng === null) errors.push('위도·경도를 모두 입력해 주세요.')
  if (typeof lat === 'string') errors.push(lat)
  if (typeof lng === 'string') errors.push(lng)
  const code = draft.code.trim()
  if (code.length > 100) errors.push('코드는 100자까지 쓸 수 있어요.')
  for (const [text, max, label] of [
    [draft.benefit, 255, '혜택'],
    [draft.address, 255, '주소'],
    [draft.hours, 100, '영업시간'],
    [draft.usageNote, 255, '이용 방법'],
    [draft.contact, 50, '연락처'],
    [draft.linkLabel, 50, '링크 이름'],
    [draft.linkUrl, 500, '링크 주소'],
  ] as const) {
    const message = tooLong(text, max, label)
    if (message) errors.push(message)
  }
  const linkUrl = draft.linkUrl.trim()
  const linkLabel = draft.linkLabel.trim()
  errors.push(...linkErrors(linkLabel, linkUrl))
  const endsOn = draft.endsOn.trim()
  if (endsOn && ymdToDayIndex(endsOn) === null) {
    errors.push('종료일을 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요(예: 2026-12-31).')
  }
  const exceptions = draft.affiliations
    .map((affiliation) => ({ affiliation, benefit: (draft.exceptions[affiliation] ?? '').trim() }))
    .filter((item) => item.benefit)
  for (const item of exceptions) {
    if (item.benefit.length > 255) errors.push(`${item.affiliation} 예외 혜택은 255자까지 쓸 수 있어요.`)
  }
  if (errors.length || !draft.category || typeof lat !== 'number' || typeof lng !== 'number') {
    return { errors }
  }
  return {
    input: {
      id: draft.originalCode ?? (code || undefined),
      name,
      category: draft.category,
      affiliations: draft.affiliations,
      mapIcon: draft.hospitalIcon ? '병원' : undefined,
      lat,
      lng,
      benefit: optional(draft.benefit),
      affiliationBenefits: exceptions.length ? exceptions : undefined,
      address: optional(draft.address),
      hours: optional(draft.hours),
      contact: optional(draft.contact),
      link: linkUrl ? { label: linkLabel, url: linkUrl } : undefined,
      endsOn: endsOn || undefined,
      usageNote: optional(draft.usageNote),
      // 늘 값을 보낸다. 서버는 빠지면 기존 값을 두지만, 화면에서 끈 것을 확실히 끄려면 false 도 보내야 한다.
      nearbyAlert: draft.nearbyAlert,
    },
  }
}

/** 검색어(normalize 한 값)가 이름·코드·업종·혜택·주소·소속 중 하나에 들어 있는지. */
export function partnerMatches(partner: AdminPartner, query: string): boolean {
  if (!query) return true
  return [partner.name, partner.id, partner.category, partner.benefit ?? '', partner.address ?? '', ...(partner.affiliations ?? [])].some(
    (field) => normalize(field).includes(query),
  )
}
