// 크롤러(scripts/scrape-hongik-news.mjs)가 만든 JSON 을 앱의 NewsItem 으로 옮긴다.
//
// JSON 은 우리가 생성하는 빌드타임 자산이지 사용자 입력이 아니므로 스키마 라이브러리까지
// 쓰지는 않는다. 다만 크롤링 대상 사이트가 바뀌면 조용히 깨질 수 있으니,
// 필수 필드가 빠졌거나 카테고리가 앱 정의와 어긋나는 항목은 걸러내거나 보정한다.

import rawNews from '../data/news.cs.json'
import { CATEGORY_COLORS } from './colors'
import type { CategoryKey } from './colors'
import type { NewsAttachment, NewsItem } from '../types'

const CATEGORY_KEYS = new Set<string>(Object.keys(CATEGORY_COLORS))
const FALLBACK_CATEGORY: CategoryKey = '공지'

/** JSON 에서 읽은, 아직 검증되지 않은 항목. */
interface RawNewsItem {
  id?: unknown
  category?: unknown
  title?: unknown
  preview?: unknown
  source?: unknown
  sourceId?: unknown
  date?: unknown
  link?: unknown
  views?: unknown
  images?: unknown
  attachments?: unknown
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** 크롤러의 카테고리 추정이 앱 정의를 벗어나면 '공지'로 떨어뜨린다. */
function toCategory(value: unknown): CategoryKey {
  return isNonEmptyString(value) && CATEGORY_KEYS.has(value)
    ? (value as CategoryKey)
    : FALLBACK_CATEGORY
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isNonEmptyString) : []
}

function toAttachments(value: unknown): NewsAttachment[] {
  if (!Array.isArray(value)) return []

  return value.reduce<NewsAttachment[]>((files, entry) => {
    const candidate = entry as Partial<NewsAttachment>
    if (!isNonEmptyString(candidate?.name) || !isNonEmptyString(candidate?.url)) {
      return files
    }

    return [...files, { name: candidate.name, url: candidate.url }]
  }, [])
}

/** 필수 필드가 온전한 항목만 NewsItem 으로 바꾼다. 아니면 null. */
function toNewsItem(raw: RawNewsItem): NewsItem | null {
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.title)) return null

  const images = toStringArray(raw.images)
  const attachments = toAttachments(raw.attachments)

  return {
    id: raw.id,
    category: toCategory(raw.category),
    title: raw.title,
    preview: isNonEmptyString(raw.preview) ? raw.preview : '',
    source: isNonEmptyString(raw.source) ? raw.source : '',
    sourceId: isNonEmptyString(raw.sourceId) ? raw.sourceId : '',
    date: isNonEmptyString(raw.date) ? raw.date : '',
    ...(isNonEmptyString(raw.link) ? { link: raw.link } : {}),
    ...(typeof raw.views === 'number' ? { views: raw.views } : {}),
    ...(images.length === 0 ? {} : { images }),
    ...(attachments.length === 0 ? {} : { attachments }),
  }
}

/** 크롤링으로 수집한 실제 공지. 갱신하려면 스크래퍼를 다시 돌리면 된다. */
export const CRAWLED_NEWS: NewsItem[] = (rawNews as RawNewsItem[])
  .map(toNewsItem)
  .filter((item): item is NewsItem => item !== null)

/** 크롤링이 덮은 학과 id. 같은 학과의 더미 데이터를 걸러내는 데 쓴다. */
export const CRAWLED_SOURCE_IDS = new Set(CRAWLED_NEWS.map((item) => item.sourceId))
