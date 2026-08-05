// 게시판 하나를 페이지 단위로 훑어 NewsItem 배열을 만든다.
// 파일 I/O 는 하지 않는다. 저장은 호출자(scripts/scrape-hongik-news.mjs)의 몫.

import { classify } from './classify.mjs'
import { DEFAULT_PAGES, PAGE_SIZE, PREVIEW_LENGTH } from './config.mjs'
import { fetchText, politeDelay } from './http.mjs'
import { getParser } from './parsers.mjs'

/** 본문 앞부분을 잘라 미리보기를 만든다. */
function toPreview(content) {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= PREVIEW_LENGTH) return oneLine

  return `${oneLine.slice(0, PREVIEW_LENGTH).trimEnd()}…`
}

/**
 * 이 글을 앱의 어느 구독 단위에 넣을지 정한다.
 *
 * - sourceId 가 고정된 게시판(학과 공지)은 그대로 쓴다.
 * - 행마다 분류가 다른 게시판(대학공지)은 분류 라벨을 매핑에서 찾는다.
 *   매핑에 없는 분류(예: 세종캠퍼스)는 null 을 돌려주고, 그 글은 수집하지 않는다.
 */
export function resolveSourceId(board, summary) {
  if (board.sourceId) return board.sourceId
  if (!board.sourceIdByCategory) return null

  return board.sourceIdByCategory[summary.boardCategory] ?? null
}

/**
 * 목록 요약(+선택적 상세)을 앱의 NewsItem 형태로 합친다.
 * views/images/attachments 는 값이 있을 때만 넣어 JSON 이 불필요하게 커지지 않게 한다.
 */
function toNewsItem(board, summary, detail, sourceId) {
  const views = summary.views ?? detail?.views ?? null
  const images = detail?.images ?? []
  const attachments = detail?.attachments ?? []
  // 대학공지는 상세에 '학사지원팀' 같은 담당 부서가 있어 그쪽이 더 정확하다.
  const writer = board.preferWriterAsSource ? detail?.writer : ''

  return {
    id: `${board.boardKey}-${summary.articleNo}`,
    category: classify(summary.title),
    title: summary.title,
    preview: detail ? toPreview(detail.content) : '',
    source: writer || board.source,
    sourceId,
    date: summary.date || detail?.date || '',
    link: summary.link,
    ...(views === null ? {} : { views }),
    ...(images.length === 0 ? {} : { images }),
    ...(attachments.length === 0 ? {} : { attachments }),
  }
}

/**
 * 상세 페이지 1건. 실패해도 전체 수집을 멈추지 않고 null 을 돌려준다.
 * 상세를 지원하지 않는 CMS 는 parseView 가 없어서 요청 자체를 하지 않는다.
 */
async function fetchDetail(summary, parseView, onWarn) {
  if (!parseView) return null

  try {
    await politeDelay()
    const html = await fetchText(summary.link)
    return parseView(html, summary.link)
  } catch (error) {
    onWarn(`상세 수집 실패 (articleNo=${summary.articleNo}): ${error.message}`)
    return null
  }
}

/**
 * 게시판 하나를 크롤링한다.
 *
 * @param {{ boardKey: string, sourceId: string, source: string, listUrl: string }} board
 * @param {{
 *   pages?: number,          // 훑을 목록 페이지 수
 *   pageSize?: number,       // 페이지당 건수
 *   withDetail?: boolean,    // 상세 페이지까지 받아 본문/첨부 채우기
 *   knownIds?: Set<string>,  // 이미 수집한 id. 들어있으면 건너뛴다
 *   stopOnKnown?: boolean,   // 새 글이 하나도 없는 페이지를 만나면 조기 종료
 *   onProgress?: (message: string) => void,
 *   onWarn?: (message: string) => void,
 * }} options
 * @returns {Promise<Array<object>>} NewsItem 배열 (최신순)
 */
export async function crawlBoard(board, options = {}) {
  const {
    pages = DEFAULT_PAGES,
    pageSize = PAGE_SIZE,
    withDetail = false,
    knownIds = new Set(),
    stopOnKnown = false,
    onProgress = () => {},
    onWarn = () => {},
  } = options

  // 게시판마다 가져올 상한이 다르다. 없으면 페이지 수로만 제한된다.
  const maxItems = board.maxItems ?? Number.POSITIVE_INFINITY
  const { buildListUrl, parseList, parseView } = getParser(board)

  const collected = []
  const skippedCategories = new Map()
  // 상단고정 공지는 페이지마다 다시 나오므로 실행 전체에 걸쳐 중복을 막는다.
  const seenInRun = new Set()

  for (let page = 0; page < pages; page += 1) {
    const url = buildListUrl(board.listUrl, { page, pageSize })
    onProgress(`목록 ${page + 1}/${pages} 페이지`)

    let summaries = []
    try {
      if (page > 0) await politeDelay()
      summaries = parseList(await fetchText(url), board.listUrl, board.tableSummary)
    } catch (error) {
      onWarn(`목록 수집 실패 (${url}): ${error.message}`)
      break
    }

    // 페이지 크기를 우리가 정하지 못하는 게시판이 있다(arch·imweb 은 10건 고정).
    // 요청한 수보다 적게 왔다고 끝으로 보면 첫 페이지에서 멈춘다.
    // 빈 페이지를 만나야 끝이다. 대신 게시판마다 요청이 한 번씩 더 나간다.
    if (summaries.length === 0) {
      onProgress('게시글이 없어 마지막 페이지로 판단하고 종료')
      break
    }

    // 대상 분류가 아닌 글(세종캠퍼스 등)은 상세를 받기 전에 먼저 걸러낸다.
    const eligible = summaries.reduce((kept, summary) => {
      const skip = (label) => {
        skippedCategories.set(label, (skippedCategories.get(label) ?? 0) + 1)
        return kept
      }

      // 대학이 분류를 잘못 붙인 세종 공지는 제목으로 한 번 더 거른다.
      if (board.excludeTitlePattern?.test(summary.title)) {
        return skip('제목 제외 규칙')
      }

      const sourceId = resolveSourceId(board, summary)
      if (sourceId === null) {
        return skip(summary.boardCategory || '(분류없음)')
      }

      return [...kept, { summary, sourceId }]
    }, [])

    const fresh = eligible.filter(({ summary }) => {
      const id = `${board.boardKey}-${summary.articleNo}`
      if (knownIds.has(id) || seenInRun.has(id)) return false

      seenInRun.add(id)
      return true
    })

    for (const { summary, sourceId } of fresh) {
      if (collected.length >= maxItems) break

      const detail = withDetail ? await fetchDetail(summary, parseView, onWarn) : null
      collected.push(toNewsItem(board, summary, detail, sourceId))
    }

    if (collected.length >= maxItems) {
      onProgress(`${maxItems}건 수집 완료`)
      break
    }

    // 페이지 전체가 제외 분류였다면 "새 글 없음"이 아니므로 계속 넘긴다.
    if (stopOnKnown && eligible.length > 0 && fresh.length === 0) {
      onProgress('새 글이 없어 조기 종료')
      break
    }
  }

  if (skippedCategories.size > 0) {
    const summary = [...skippedCategories]
      .map(([label, count]) => `${label} ${count}`)
      .join(', ')
    onProgress(`대상 분류가 아니라 제외: ${summary}`)
  }

  return collected
}
