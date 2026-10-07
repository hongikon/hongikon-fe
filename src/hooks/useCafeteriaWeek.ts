import { getCafeteriaWeek, type CafeteriaWeek } from '../apis/cafeteria'
import { kstTodayYmd } from '../utils/exhibitions'
import { useApiResource, type ApiResource } from './useApiResource'

/** 학식 메뉴는 하루 한두 번 바뀌므로 앱을 켜 둔 동안 이 시간 안에서는 다시 부르지 않는다. */
const CACHE_TTL_MS = 30 * 60 * 1000

/** 앱 메모리 캐시(세션 동안). 날짜가 바뀌면(자정 넘김) 새로 부른다. */
let cache: { date: string; at: number; week: CafeteriaWeek } | null = null
/** 시트를 연달아 열어도 요청은 한 번만 나가게 진행 중인 요청을 같이 쓴다. */
let inflight: { date: string; promise: Promise<CafeteriaWeek> } | null = null

function loadWeek(date: string): Promise<CafeteriaWeek> {
  if (cache && cache.date === date && Date.now() - cache.at < CACHE_TTL_MS) return Promise.resolve(cache.week)
  if (inflight && inflight.date === date) return inflight.promise
  // 시트를 닫아도(끊기 신호) 캐시를 채울 수 있게 요청 자체는 끊지 않는다. 결과를 버리는 건 useApiResource 가 한다.
  const promise = getCafeteriaWeek(date)
    .then((week) => {
      cache = { date, at: Date.now(), week }
      return week
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
    })
  inflight = { date, promise }
  return promise
}

/** 이번 주(월~금) 학식 메뉴. `enabled` 가 false 면 부르지 않는다. */
export function useCafeteriaWeek(enabled: boolean): ApiResource<CafeteriaWeek> & { today: string } {
  const today = kstTodayYmd()
  const resource = useApiResource(() => loadWeek(today), [today], {
    enabled,
    fallbackMessage: '메뉴를 불러오지 못했어요',
  })
  return { ...resource, today }
}
