import { SUBSCRIBABLE_ITEMS } from '../../constants/news'
import { type ReportAlertPrefs } from './reportAlertSync'
import { type Settings } from './storage'

/** 앱이 그릴 수 있는 게시판(TREE_DATA 리프). 서버에서만 온 모르는 sourceId 를 거르는 데 쓴다. */
export const KNOWN_BOARD_IDS: ReadonlySet<string> = new Set(SUBSCRIBABLE_ITEMS.map((item) => item.id))

export function toReportAlertPrefs(s: Settings): ReportAlertPrefs {
  return { reportStatus: s.reportStatusAlert, newReports: s.newReportAlert }
}

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}
