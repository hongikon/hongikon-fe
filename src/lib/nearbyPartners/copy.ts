import { benefitFor, type BenefitSource } from './rules'
import type { PartnerAffiliation } from '../../types'

/**
 * 근처 제휴 알림 문구. 제목은 "○○에 계신가요?" — 알림 반경이 20m 라(10-29) 실제로 그 가게에 있을 때 온다.
 * 사용자가 직접 켠 혜택 안내라 "(광고)"를 붙이지 않는다(10-29 사용자 결정). 끄는 방법은 계속 적는다.
 */

/** 업체 이름이 길면 제목에서 자른다(알림 제목은 한 줄). */
const MAX_NAME_LENGTH = 20
const OPT_OUT_LINE = '알림 끄기: 설정 > 근처 제휴 알림'
/** 알림 본문에서 혜택 문구 최대 길이. 넘으면 자르고 전체는 업체 시트에서 본다. */
const MAX_BENEFIT_LENGTH = 60

function truncate(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text
}

export interface NearbyAlertContent {
  title: string
  body: string
}

/**
 * `othersCount`: 같은 반경 안에 함께 있는 다른 대상 업체 수(`rules.alertGroup`). 있으면 "N곳이 더 있어요" 줄을 붙인다.
 * 혜택 문구가 없으면 null(대상 업체 고르기에서 이미 빠지지만 한 번 더 막는다).
 */
/**
 * 알림 반경 안에 제휴가 2곳 이상 겹쳤을 때. 한 곳을 "○○에 계신가요?"로 단정하지 않고 몇 곳인지와 이름 두 개까지만 알린다 —
 * 누르면 그 목록에서 사용자가 고른다(10-30). `members` 는 앞세울 곳부터.
 */
export function nearbyGroupContent(members: readonly { name: string }[]): NearbyAlertContent {
  const names = members.slice(0, 2).map((member) => truncate(member.name, 12))
  const rest = members.length - names.length
  return {
    title: `근처에 제휴 가게가 ${members.length}곳 있어요`,
    body: `${names.join(' · ')}${rest > 0 ? ` 외 ${rest}곳` : ''} — 눌러서 혜택 보기\n${OPT_OUT_LINE}`,
  }
}

export function nearbyAlertContent(
  partner: BenefitSource & { name: string; affiliations?: readonly PartnerAffiliation[] },
  affiliations: readonly PartnerAffiliation[],
  othersCount = 0,
): NearbyAlertContent | null {
  const benefit = benefitFor(partner, affiliations)
  if (!benefit) return null
  // 혜택 뒤에 "외 N곳"을 붙이면 그 혜택이 모든 곳에 해당하는 것처럼 읽혀 따로 한 줄로 둔다.
  // 내 소속·총학생회 제휴가 아니면(현장 테스트 빌드에서만 대상이 된다) 어느 소속 제휴인지 앞에 붙인다.
  const own = partner.affiliations?.some((item) => item === '총학생회' || affiliations.includes(item)) ?? true
  const scope = own ? '' : `(${partner.affiliations!.join('·')} 제휴) `
  const others = othersCount > 0 ? `\n근처에 제휴업체 ${othersCount}곳이 더 있어요` : ''
  return {
    title: `${truncate(partner.name, MAX_NAME_LENGTH)}에 계신가요?`,
    body: `${scope}제휴 혜택: ${truncate(benefit, MAX_BENEFIT_LENGTH)}${others}\n${OPT_OUT_LINE}`,
  }
}
