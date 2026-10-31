/**
 * 공지 링크 미리보기 카드(11-01). 카카오톡 등 메신저가 `hongikon.com/news/{id}` 를 읽으러 오면, 앱(SPA) 페이지에
 * 그 공지의 제목·출처·본문 앞부분과 그림(og:*)을 넣어 돌려준다. 그대로면 모든 링크가 "홍익온" 카드로만 보였다.
 *
 * - 메신저·검색 봇(User-Agent)일 때만 공지 API 를 부른다. 사람이 여는 페이지는 손대지 않는다(느려지지 않게).
 * - API 가 실패하거나 늦으면(2.5초) 원래 페이지를 그대로 돌려준다.
 * - 아래 순수 함수(`newsMetaTags`·`injectMeta`)는 Node 에서도 돌아 로컬에서 확인한다.
 */

const API_ORIGIN = 'https://api.hongikon.com'
const SITE_ORIGIN = 'https://hongikon.com'
const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`
/** 앱 공유 문구(`src/utils/shareNews.ts`)와 같은 길이. */
const EXCERPT_CHARS = 70

/** 미리보기를 만드는 봇. 사람 브라우저는 여기 걸리지 않는다. */
const PREVIEW_BOT =
  /kakaotalk-scrap|kakaostory|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|line\/|yeti|daumoa|applebot|googlebot|bingbot|skypeuripreview|iframely|embedly|pinterest/i

export interface NewsForPreview {
  id: string | number
  title: string
  content?: string | null
  preview?: string | null
  category?: string | null
  departmentName?: string | null
  sourceId?: string | null
  publishedAt?: string | null
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function excerpt(text: string): string | null {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  const chars = Array.from(flat)
  if (chars.length <= EXCERPT_CHARS) return flat
  const cut = chars.slice(0, EXCERPT_CHARS).join('')
  const space = cut.lastIndexOf(' ')
  return `${(space >= EXCERPT_CHARS * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** 앱 공유 문구 둘째 줄과 같은 "출처 · 날짜 · 분야". */
export function newsMetaLine(news: NewsForPreview): string {
  const source = news.departmentName || news.sourceId || '홍익대학교'
  const date = news.publishedAt ? news.publishedAt.slice(0, 10).replace(/-/g, '.') : ''
  return [source, date, news.category ?? ''].filter(Boolean).join(' · ')
}

export function newsMetaTags(news: NewsForPreview): string {
  const url = `${SITE_ORIGIN}/news/${encodeURIComponent(String(news.id))}`
  const body = excerpt(news.content ?? news.preview ?? '')
  const description = body ? `${newsMetaLine(news)} — ${body}` : newsMetaLine(news)
  const tags: [string, string, string][] = [
    ['property', 'og:type', 'article'],
    ['property', 'og:site_name', '홍익온'],
    ['property', 'og:title', `[홍익온 공지] ${news.title}`],
    ['property', 'og:description', description],
    ['property', 'og:url', url],
    ['property', 'og:image', OG_IMAGE],
    ['property', 'og:locale', 'ko_KR'],
    ['name', 'twitter:card', 'summary'],
    ['name', 'description', description],
  ]
  return tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}"/>`).join('')
}

/** `<title>` 을 공지 제목으로 바꾸고 `</head>` 앞에 미리보기 태그를 넣는다. */
export function injectMeta(html: string, news: NewsForPreview): string {
  const titled = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(news.title)} | 홍익온</title>`)
  return titled.replace('</head>', `${newsMetaTags(news)}</head>`)
}

export function isPreviewBot(userAgent: string): boolean {
  return PREVIEW_BOT.test(userAgent)
}

export default async (request: Request, context: { next: () => Promise<Response> }): Promise<Response | undefined> => {
  if (!isPreviewBot(request.headers.get('user-agent') ?? '')) return undefined
  const id = new URL(request.url).pathname.match(/^\/news\/(\d+)\/?$/)?.[1]
  if (!id) return undefined
  const [page, news] = await Promise.all([
    context.next(),
    fetch(`${API_ORIGIN}/news/${id}`, { signal: AbortSignal.timeout(2500) })
      .then((res) => (res.ok ? (res.json() as Promise<NewsForPreview>) : null))
      .catch(() => null),
  ])
  const type = page.headers.get('content-type') ?? ''
  if (!news?.title || !type.includes('text/html')) return page
  const headers = new Headers(page.headers)
  headers.delete('content-length')
  return new Response(injectMeta(await page.text(), news), { status: page.status, headers })
}

export const config = { path: '/news/*' }
