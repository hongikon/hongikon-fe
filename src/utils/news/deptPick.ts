import { SUBSCRIBABLE_ITEMS, groupSubscribableItems, type SubscribableGroup } from '../../constants/news'
import { normalize } from '../normalize'

/**
 * 온보딩 '내 학과 고르기'의 계산. `components/onboarding/DeptPickStep` 이 쓰고 `scripts/test/news-dept-pick.test.ts` 가 확인한다.
 */

/**
 * 같은 '대학' 묶음이지만 일부 학생만 보는 국제협력본부·취업진로지원센터 게시판은 한 번에 켜지 않는다.
 * (채용정보는 하루 10~20건씩 올라와 원하는 사람만 고르게 한다.)
 */
const BULK_EXCLUDED_BOARD_IDS: readonly string[] = ['국제교류실', '글로벌역량지원사업', '취업진로공지', '채용정보']

/** '대학' 묶음(학사·장학 등 학교 전체 게시판 6개). "학교 공지 함께 받기"가 한 번에 켠다. */
export const UNIVERSITY_BOARD_IDS: readonly string[] = SUBSCRIBABLE_ITEMS.filter(
  (item) => item.group === '대학' && !BULK_EXCLUDED_BOARD_IDS.includes(item.id),
).map((item) => item.id)

/** 검색어(공백·대소문자 무시)가 이름이나 묶음 이름에 들어간 게시판만 묶음별로. 검색어가 없으면 전부. */
export function filterSubscribableGroups(query: string): SubscribableGroup[] {
  const keyword = normalize(query)
  const filtered = keyword
    ? SUBSCRIBABLE_ITEMS.filter(
        (item) => normalize(item.name).includes(keyword) || normalize(item.group).includes(keyword),
      )
    : SUBSCRIBABLE_ITEMS
  return groupSubscribableItems(filtered)
}

/** 학교 공지 게시판이 모두 켜져 있는지. */
export function universityAllSubscribed(subscribed: ReadonlySet<string>): boolean {
  return UNIVERSITY_BOARD_IDS.every((id) => subscribed.has(id))
}

/**
 * "학교 공지 함께 받기"를 누르면 토글할 게시판. 다 켜져 있으면 모두 끄고, 하나라도 꺼져 있으면 꺼진 것만 켠다.
 */
export function universityToggleIds(subscribed: ReadonlySet<string>): string[] {
  const allOn = universityAllSubscribed(subscribed)
  return UNIVERSITY_BOARD_IDS.filter((id) => allOn || !subscribed.has(id))
}
