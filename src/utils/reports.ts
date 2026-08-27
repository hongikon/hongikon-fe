import { Alert, Platform } from 'react-native'
import { reportCategoryMeta } from '../constants/reportCategories'
import type { ReportCategory, ReportListItem } from '../types'

/**
 * 로그인이 필요한 동작(제보 작성·신고)을 막았을 때 띄운다.
 *
 * `react-native-web` 의 `Alert.alert` 는 버튼을 넘겨도 완전히 빈 함수라 웹에서는
 * 아무 반응이 없다(react-native-web/src/exports/Alert). `window.confirm` 으로 대신한다.
 */
export function promptLogin(message: string, logout: () => void): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`로그인이 필요해요\n${message}`)) {
      logout()
    }
    return
  }

  Alert.alert('로그인이 필요해요', message, [
    { text: '취소', style: 'cancel' },
    { text: '로그인하러 가기', onPress: () => logout() },
  ])
}

/** 지도에 찍을 제보 마커 하나. WebView 로 넘기는 최소 정보만 담는다. */
export interface ReportMarker {
  id: number
  category: ReportCategory
  lat: number
  lng: number
  color: string
  label: string
}

const KST_OFFSET_MINUTES = 9 * 60

/**
 * UTC ISO 문자열을 KST 기준 `H시 M분` 으로 바꾼다.
 *
 * `Intl.DateTimeFormat` 의 timeZone 옵션을 쓰지 않는다. Hermes 의 Intl 지원은
 * 빌드 설정에 따라 갈려서, 기기에 따라 시간이 틀어지거나 던질 수 있다.
 * 고정 오프셋(+9)은 한국이 서머타임을 쓰지 않아 언제나 맞는다.
 */
export function formatKstTime(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + KST_OFFSET_MINUTES * 60 * 1000)
  const hours = shifted.getUTCHours()
  const minutes = shifted.getUTCMinutes()
  return minutes === 0 ? `${hours}시` : `${hours}시 ${minutes}분`
}

/** '방금 전' · '12분 전' · '3시간 전'. 하루가 넘으면 날짜 대신 '하루 전' 으로 끊는다. */
export function formatElapsed(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return '하루 전'
}

/**
 * 배너에 쓰는 신선도 한 줄. 예: '12분 전 등록 · 18시까지'
 * 제보는 지금 벌어지는 일이라, 언제 올라왔고 언제 끝나는지가 본문만큼 중요하다.
 */
export function formatFreshness(report: Pick<ReportListItem, 'createdAt' | 'endsAt'>): string {
  return `${formatElapsed(report.createdAt)} 등록 · ${formatKstTime(report.endsAt)}까지`
}

/**
 * 지도에 올릴 제보만 남긴다.
 *
 * `GET /reports` 목록 항목(`ReportListItem`)에는 `status`가 없다 — 서버가 이미
 * ACTIVE·live 조건으로 쿼리해 내려주기 때문이다. 그래서 여기서 다시 걸러 낼 상태 값 자체가 없다.
 * 다만 종료 시각은 캐시된 응답을 잠깐 더 들고 있는 사이 지날 수 있어 여기서도 본다.
 */
export function visibleReports(
  reports: readonly ReportListItem[],
  now: number = Date.now(),
): ReportListItem[] {
  return reports.filter((report) => new Date(report.endsAt).getTime() > now)
}

export function toReportMarkers(reports: readonly ReportListItem[]): ReportMarker[] {
  return reports.map((report) => ({
    id: report.id,
    category: report.category,
    lat: report.lat,
    lng: report.lng,
    color: reportCategoryMeta(report.category).color,
    label: report.title,
  }))
}
