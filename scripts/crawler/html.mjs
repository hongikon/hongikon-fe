// HTML 문자열을 다루는 순수 유틸. 외부 의존성 없음.

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** &amp; &#39; &#x27; 같은 엔티티를 실제 문자로 되돌린다. */
export function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
}

/** 태그를 제거하고 공백을 정리한 순수 텍스트를 만든다. 문단 구분은 줄바꿈으로 남긴다. */
export function stripTags(value) {
  const withBreaks = value
    .replace(/<\s*(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')

  return decodeEntities(withBreaks)
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 한 줄짜리 텍스트(제목 등)용. 줄바꿈까지 공백으로 눌러버린다. */
export function stripTagsInline(value) {
  return stripTags(value).replace(/\s+/g, ' ').trim()
}

/**
 * 게시판 링크는 대부분 "?mode=view&..." 형태의 상대 경로다.
 * 목록 URL 을 기준으로 절대 URL 로 바꾼다.
 */
export function toAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(decodeEntities(href), baseUrl).toString()
  } catch {
    return ''
  }
}

/** start 마커 뒤부터 end 마커 직전까지 잘라낸다. start 를 못 찾으면 빈 문자열. */
export function sliceBetween(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker)
  if (start === -1) return ''

  const from = start + startMarker.length
  const end = html.indexOf(endMarker, from)
  return end === -1 ? html.slice(from) : html.slice(from, end)
}

/** 첫 번째 캡처 그룹을 꺼내고, 없으면 fallback. */
export function matchGroup(html, pattern, fallback = '') {
  return html.match(pattern)?.[1] ?? fallback
}
