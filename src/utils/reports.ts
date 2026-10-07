import { Alert, Platform } from 'react-native'
import type { ReportCategory, ReportListItem } from '../types'
import { parseServerTime } from './serverTime'
import { formatDay, formatServerSchedule, formatStartShort, isSameKstDay, isUpcomingReport } from './reportSchedule'
import { returnToOpenReportAfterAuth } from '../lib/mapIntents'

/**
 * 로그인이 필요한 동작(제보 작성·신고)을 막았을 때 띄운다.
 *
 * `react-native-web` 의 `Alert.alert` 는 버튼을 넘겨도 완전히 빈 함수라 웹에서는
 * 아무 반응이 없다(react-native-web/src/exports/Alert). `window.confirm` 으로 대신한다.
 */
export function promptLogin(message: string, logout: () => void): void {
  // 지도에서 보던 제보가 있으면 로그인하거나 둘러보기로 돌아왔을 때 그 제보를 다시 띄운다.
  const goLogin = () => {
    returnToOpenReportAfterAuth()
    logout()
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`로그인이 필요해요\n\n${message}`)) {
      goLogin()
    }
    return
  }

  Alert.alert('로그인이 필요해요', message, [
    { text: '취소', style: 'cancel' },
    { text: '로그인하러 가기', onPress: goLogin },
  ])
}

/** 서버가 제보에 붙여 주는 사진 최대 장수. */
export const REPORT_MAX_IMAGES = 3

/**
 * 제보 사진 보기 URL 목록(등록 순서, 최대 3장). 여러 장 기능 전 서버는 `imageUrls` 없이 `imageUrl` 1장만 준다.
 */
export function reportImageUrls(report: { imageUrl?: string | null; imageUrls?: readonly string[] | null }): string[] {
  const urls = Array.isArray(report.imageUrls) ? report.imageUrls.filter((url) => !!url) : []
  if (urls.length > 0) return urls.slice(0, REPORT_MAX_IMAGES)
  return report.imageUrl ? [report.imageUrl] : []
}

/** 지도에 찍을 제보 마커 하나. WebView 로 넘기는 최소 정보만 담는다. */
export interface ReportMarker {
  id: number
  category: ReportCategory
  lat: number
  lng: number
  label: string
  /** 아직 시작 전(예정). 지도에서 속이 빈 배지와 시작 시각으로 따로 보인다. */
  upcoming?: boolean
  /** HOT(최근 60분 🔥 가 몰림). 지도에서 배지 오른쪽 위에 🔥 원이 붙는다. 커뮤니티 기능 전 서버는 없음. */
  hot?: boolean
}

const KST_OFFSET_MINUTES = 9 * 60

/**
 * 서버 시각(UTC, 존 없음 — `parseServerTime` 참고)을 KST 기준 `H시 M분` 으로 바꾼다.
 *
 * `Intl.DateTimeFormat` 의 timeZone 옵션을 쓰지 않는다. Hermes 의 Intl 지원은
 * 빌드 설정에 따라 갈려서, 기기에 따라 시간이 틀어지거나 던질 수 있다.
 * 고정 오프셋(+9)은 한국이 서머타임을 쓰지 않아 언제나 맞는다.
 */
export function formatKstTime(iso: string): string {
  const shifted = new Date(parseServerTime(iso) + KST_OFFSET_MINUTES * 60 * 1000)
  const hours = shifted.getUTCHours()
  const minutes = shifted.getUTCMinutes()
  return minutes === 0 ? `${hours}시` : `${hours}시 ${minutes}분`
}

/**
 * '방금 전' · '12분 전' · '3시간 전' · '하루 전' · '5일 전'.
 * 여러 날 이어지는 제보(축제·공사)는 며칠 전에 올라온 것일 수 있어 하루를 넘겨도 날 수를 센다
 * (예전엔 하루만 넘으면 일주일 전 제보도 '하루 전'이라 방금 올라온 것처럼 보였다).
 */
export function formatElapsed(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - parseServerTime(iso)) / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return days === 1 ? '하루 전' : `${days}일 전`
}

/**
 * 배너에 쓰는 신선도 한 줄. 예: '12분 전 등록 · 18시까지'
 * 제보는 지금 벌어지는 일이라, 언제 올라왔고 언제 끝나는지가 본문만큼 중요하다.
 */
export function formatFreshness(report: Pick<ReportListItem, 'createdAt' | 'endsAt'> & { startsAt?: string }): string {
  // 예정 제보는 언제 시작하는지가 먼저다. 예: '예정 · 10/3(토) 11:00 ~ 15:00'
  if (report.startsAt && isUpcomingReport({ startsAt: report.startsAt })) {
    return `예정 · ${formatServerSchedule(report.startsAt, report.endsAt)}`
  }
  // 여러 날 제보는 끝나는 날짜도 적는다. 예: '2시간 전 등록 · 10/5(월) 18시까지'
  const endMs = parseServerTime(report.endsAt)
  const endText = isSameKstDay(endMs, Date.now()) ? formatKstTime(report.endsAt) : `${formatDay(endMs)} ${formatKstTime(report.endsAt)}`
  return `${formatElapsed(report.createdAt)} 등록 · ${endText}까지`
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
  return reports.filter((report) => parseServerTime(report.endsAt) > now)
}

export function toReportMarkers(reports: readonly ReportListItem[]): ReportMarker[] {
  const now = Date.now()
  return reports.map((report) => {
    const upcoming = isUpcomingReport(report, now)
    return {
      id: report.id,
      category: report.category,
      lat: report.lat,
      lng: report.lng,
      // 예정 제보는 이름 앞에 시작 시각을 붙인다(예: '내일 11:00 · 붕어빵 트럭').
      label: upcoming ? `${formatStartShort(parseServerTime(report.startsAt), now)} · ${report.title}` : report.title,
      upcoming,
      hot: !upcoming && report.hot === true,
    }
  })
}
