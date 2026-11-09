import type { AppNotice } from '../constants/appNotices'
import type { ServerNotice } from '../apis/notices'
import { parseServerTime } from './serverTime'
import { kstTodayYmd } from './exhibitions'

/** 서버 공지(GET /notices)를 앱 공지 모양으로 바꾸고 앱에 적힌 공지와 섞는다(lib/appNotices). react-native 없이 테스트한다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 서버 공지 id 는 앱에 적힌 공지 id('1'~)와 겹치지 않게 's' 를 붙인다('다시 보지 않기' 기록도 이 id 로 남는다). */
export function fromServerNotice(notice: ServerNotice): AppNotice | null {
  const publishedMs = parseServerTime(notice.publishedAt)
  if (!Number.isFinite(publishedMs) || !notice.title || !notice.body) return null
  const untilMs = notice.popup ? parseServerTime(notice.popup.until) : NaN
  return {
    id: `s${notice.id}`,
    title: notice.title,
    date: kstDotDate(publishedMs),
    body: notice.body,
    publishedMs,
    popup:
      notice.popup && notice.popup.text && Number.isFinite(untilMs)
        ? {
            until: kstDotDate(untilMs).replace(/\./g, '-'),
            untilMs,
            slides: [{ icon: 'megaphone-outline', badge: '공지', title: notice.title, text: notice.popup.text }],
            linkLabel: '공지 자세히 보기',
          }
        : undefined,
  }
}

/** 'YYYY.MM.DD'(KST) */
function kstDotDate(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, '.')
}

/** 줄 세우는 시각 — 서버 공지는 게시 시각, 앱에 적힌 공지는 date 의 KST 자정. */
export function noticeSortMs(notice: AppNotice): number {
  if (notice.publishedMs !== undefined) return notice.publishedMs
  const ms = Date.parse(`${notice.date.replace(/\./g, '-')}T00:00:00+09:00`)
  return Number.isFinite(ms) ? ms : 0
}

/** 최신순으로 섞는다. 같은 시각이면 서버 공지가 앞(나중에 쓴 것). */
export function mergeNotices(local: AppNotice[], server: AppNotice[]): AppNotice[] {
  return [...server, ...local]
    .map((notice, index) => ({ notice, index }))
    .sort((a, b) => noticeSortMs(b.notice) - noticeSortMs(a.notice) || a.index - b.index)
    .map(({ notice }) => notice)
}

/**
 * 지금 띄울 공지 — 최신순 목록에서 팝업 기간이 지나지 않은 첫 공지. 앱에 적힌 공지는 popup.until(KST, 그날까지),
 * 서버 공지는 popup.untilMs(그 시각 전까지).
 */
export function currentPopupNotice(notices: AppNotice[], now: number = Date.now()): AppNotice | null {
  const today = kstTodayYmd(now)
  return (
    notices.find((notice) => {
      const popup = notice.popup
      if (popup === undefined) return false
      return popup.untilMs !== undefined ? now < popup.untilMs : today <= popup.until
    }) ?? null
  )
}
