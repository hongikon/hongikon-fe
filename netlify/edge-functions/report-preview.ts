/**
 * 제보 링크 미리보기 카드(11-22). 앱의 제보 공유 링크 `hongikon.com/r/{id}`(`src/utils/shareReport.ts`)를 메신저가 읽으러 오면
 * 그 제보의 제목과 '홍익대에서 올라온 제보 · 일시 · 장소'를 넣어 돌려준다. 예전엔 어떤 제보든 사이트 기본 "홍익온" 카드였다.
 *
 * - 공지 미리보기(`news-preview.ts`)와 같은 방식: 봇일 때만, 2.5초 안에, 기본 미리보기 태그는 지우고 바꾼다.
 * - 제보는 공개 목록(`GET /reports?include=upcoming` — 승인되고 지금 진행 중이거나 예정인 것)에서만 찾는다. 승인 전·끝난 제보는
 *   목록에 없어 사이트 기본 카드 그대로 둔다(숨긴 제보 내용이 미리보기로 새지 않게). 작성자 정보는 넣지 않는다.
 * - Deno 에서 도는 파일이라 다른 파일을 import 하지 않는다.
 */

const API_ORIGIN = 'https://api.hongikon.com'
const SITE_ORIGIN = 'https://hongikon.com'
const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`

const PREVIEW_BOT =
  /kakaotalk-scrap|kakaostory|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|line\/|yeti|daumoa|applebot|googlebot|bingbot|skypeuripreview|iframely|embedly|pinterest/i

export interface ReportForPreview {
  id: number | string
  title: string
  content?: string | null
  placeLabel?: string | null
  /** 서버 시각(UTC, 시간대 표시 없음) — 예: '2026-11-16T02:00:00' 은 한국 시간 11:00. */
  startsAt?: string | null
  endsAt?: string | null
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 서버 UTC 시각 → 한국 시간 { 날짜 '11/23(월)', 시각 '18:00' }. */
function kst(utc: string): { day: string; time: string } | null {
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(utc) ? utc : `${utc}Z`)
  if (Number.isNaN(ms)) return null
  const d = new Date(ms + 9 * 3600_000)
  const day = `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  return { day, time }
}

/** '11/23(월) 18:00~20:00' (하루) · '11/16(월) ~ 11/22(일)' (여러 날) · 시작만 있으면 '11/23(월) 18:00'. */
export function reportWhen(report: ReportForPreview): string {
  const start = report.startsAt ? kst(report.startsAt) : null
  if (!start) return ''
  const end = report.endsAt ? kst(report.endsAt) : null
  if (!end) return `${start.day} ${start.time}`
  if (end.day === start.day) return `${start.day} ${start.time}~${end.time}`
  return `${start.day} ~ ${end.day}`
}

/** 카드 설명 맨 앞 말머리. 제목만으로는 무슨 링크인지 몰라서(11-22 사용자). 앱 공유 문구 첫 줄과 같다. */
export const REPORT_LEAD_IN = '홍익대에서 올라온 제보'

export function reportDescription(report: ReportForPreview): string {
  const meta = [REPORT_LEAD_IN, reportWhen(report), report.placeLabel?.trim() || '홍익대학교 서울캠퍼스'].filter(Boolean).join(' · ')
  // 내용 첫 문장은 넣지 않는다 — 말머리·일시·장소만으로 카카오 카드 설명 두 줄이 차서, 붙이면 끝이 '…'로 잘렸다(11-22).
  return meta
}

export function reportMetaTags(report: ReportForPreview): string {
  const description = reportDescription(report)
  const tags: [string, string, string][] = [
    ['property', 'og:type', 'article'],
    ['property', 'og:site_name', '홍익온'],
    ['property', 'og:title', report.title],
    ['property', 'og:description', description],
    ['property', 'og:url', `${SITE_ORIGIN}/r/${encodeURIComponent(String(report.id))}`],
    ['property', 'og:image', OG_IMAGE],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:locale', 'ko_KR'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'description', description],
  ]
  return tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}"/>`).join('')
}

export function injectReportMeta(html: string, report: ReportForPreview): string {
  const stripped = html.replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>/g, '')
  const titled = stripped.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(report.title)} | 홍익온</title>`)
  return titled.replace('</head>', `${reportMetaTags(report)}</head>`)
}

export default async (request: Request, context: { next: () => Promise<Response> }): Promise<Response | undefined> => {
  if (!PREVIEW_BOT.test(request.headers.get('user-agent') ?? '')) return undefined
  const id = new URL(request.url).pathname.match(/^\/r\/(\d+)\/?$/)?.[1]
  if (!id) return undefined
  const [page, report] = await Promise.all([
    context.next(),
    fetch(`${API_ORIGIN}/reports?include=upcoming`, { signal: AbortSignal.timeout(2500) })
      .then((res) => (res.ok ? (res.json() as Promise<{ reports?: ReportForPreview[] }>) : null))
      .then((body) => body?.reports?.find((r) => String(r.id) === id) ?? null)
      .catch(() => null),
  ])
  const type = page.headers.get('content-type') ?? ''
  const headers = new Headers(page.headers)
  if (!report?.title || !type.includes('text/html')) {
    headers.set('x-hongikon-preview', !report?.title ? 'no-report' : `not-html:${type}`)
    return new Response(page.body, { status: page.status, headers })
  }
  headers.delete('content-length')
  headers.set('x-hongikon-preview', 'hit')
  return new Response(injectReportMeta(await page.text(), report), { status: page.status, headers })
}

export const config = { path: '/r/*' }
