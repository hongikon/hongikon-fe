/**
 * 공지 링크 미리보기 카드(11-01, 11-22 다듬음). 카카오톡 등 메신저가 `hongikon.com/news/{id}` 를 읽으러 오면, 앱(SPA) 페이지에
 * 그 공지의 제목·출처·본문 첫 문장과 그림(og:*)을 넣어 돌려준다. 그대로면 모든 링크가 "홍익온" 카드로만 보였다.
 *
 * - 메신저·검색 봇(User-Agent)일 때만 공지 API 를 부른다. 사람이 여는 페이지는 손대지 않는다(느려지지 않게).
 * - API 가 실패하거나 늦으면(2.5초) 원래 페이지를 그대로 돌려준다.
 * - 페이지에 이미 있는 사이트 기본 태그(`scripts/fix-web-export.mjs`)는 지우고 바꾼다. 예전엔 뒤에 덧붙이기만 해서
 *   메신저가 먼저 나온 기본 태그를 읽어 공지 대신 "홍익온" 카드가 떴다(11-22).
 * - 아래 순수 함수는 Node 에서도 돈다(`scripts/test/og-preview.test.ts`). Deno 에서 도는 파일이라 다른 파일을 import 하지 않는다.
 */

const API_ORIGIN = 'https://api.hongikon.com'
const SITE_ORIGIN = 'https://hongikon.com'
/** 사이트 기본 그림(1200×630)과 같은 그림. 공지마다 다른 그림은 만들지 않는다(11-22 사용자: 첫 번째 시안 하나로). */
const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`
/** 설명에 넣을 본문 첫 문장 최대 길이(글자). 카카오 카드 설명 두 줄 남짓. */
const LEAD_CHARS = 80

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

/** 문장 앞 번호·기호(①, 1., -, ※, ■ 등). */
const LEAD_MARK = /^(?:[①-⑳⑴-⒇❶-❿]|\d{1,2}[.)]|[-–•·※■□▶▷○●◎◆◇★☆>]+)\s*/
/** 본문 맨 앞 인사·자기소개 문장("안녕하세요.", "경영학부 행정실입니다."). 카드에 쓰면 정작 내용이 안 보인다. */
const GREETING = /^(?:안녕하(?:세요|십니까)|반갑습니다)|^\S{0,12}(?:\s\S{0,12})?\s?입니다[.!]?$/

/**
 * 본문 첫 문장(인사말·앞 번호 빼고). `max` 를 넘으면 낱말 사이에서 자르고 '…'. 본문이 없으면 null.
 * 예전엔 70자에서 그냥 잘라 "…업로드…"처럼 문장 가운데서 끊겼다.
 */
export function leadSentence(text: string, max = LEAD_CHARS): string | null {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  const sentences = flat
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.replace(LEAD_MARK, '').trim())
    .filter(Boolean)
  const first = sentences.find((s) => !GREETING.test(s))
  if (!first) return null
  const chars = Array.from(first)
  if (chars.length <= max) return first
  const cut = chars.slice(0, max).join('')
  const space = cut.lastIndexOf(' ')
  return `${(space >= max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,·:;(]+$/, '')}…`
}

/** '2026-11-20T…' → '11월 20일'. */
export function koreanDate(iso: string | null | undefined): string {
  const m = iso?.match(/^\d{4}-(\d{2})-(\d{2})/)
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : ''
}

/** "출처 · 날짜" (분야는 제목·본문에 이미 드러나 뺀다). */
export function newsMetaLine(news: NewsForPreview): string {
  const source = news.departmentName || news.sourceId || '홍익대학교'
  return [source, koreanDate(news.publishedAt)].filter(Boolean).join(' · ')
}

export function newsDescription(news: NewsForPreview): string {
  const lead = leadSentence(news.content ?? news.preview ?? '')
  return lead ? `${newsMetaLine(news)} — ${lead}` : newsMetaLine(news)
}

export function newsMetaTags(news: NewsForPreview): string {
  const url = `${SITE_ORIGIN}/news/${encodeURIComponent(String(news.id))}`
  const description = newsDescription(news)
  const tags: [string, string, string][] = [
    ['property', 'og:type', 'article'],
    ['property', 'og:site_name', '홍익온'],
    ['property', 'og:title', news.title],
    ['property', 'og:description', description],
    ['property', 'og:url', url],
    ['property', 'og:image', OG_IMAGE],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:locale', 'ko_KR'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'description', description],
  ]
  return tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}"/>`).join('')
}

/** 사이트 기본 미리보기 태그(og:*, twitter:*, description)를 지운다. */
export function stripPreviewTags(html: string): string {
  return html.replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>/g, '')
}

/** `<title>` 을 공지 제목으로 바꾸고, 기본 미리보기 태그를 지운 뒤 `</head>` 앞에 공지 태그를 넣는다. */
export function injectMeta(html: string, news: NewsForPreview): string {
  const titled = stripPreviewTags(html).replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(news.title)} | 홍익온</title>`)
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
  // 진단: 미리보기를 넣었는지(hit) 아니면 왜 원래 페이지를 돌려줬는지 응답 헤더에 남긴다.
  const headers = new Headers(page.headers)
  if (!news?.title || !type.includes('text/html')) {
    headers.set('x-hongikon-preview', !news?.title ? 'no-news' : `not-html:${type}`)
    return new Response(page.body, { status: page.status, headers })
  }
  headers.delete('content-length')
  headers.set('x-hongikon-preview', 'hit')
  return new Response(injectMeta(await page.text(), news), { status: page.status, headers })
}

export const config = { path: '/news/*' }
