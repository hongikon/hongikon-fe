// 게시판 목록(mode=list) HTML 을 행 단위로 파싱한다.
//
// 실제 마크업(2026.08 확인):
//   <tr class="b-top-box ">
//     <td class="b-num-box"> 225 </td>
//     <td class="b-td-left">
//       <a href="?mode=view&articleNo=154811&...">
//         <span class="b-title">제목</span>
//       </a>
//       <div class="b-m-con">
//         <span class="hit">조회수 13</span>
//         <span class="b-date">2026.08.04</span>
//         <span class="b-file">첨부파일</span>
//       </div>
//     </td>
//   </tr>

import { matchGroup, stripTagsInline, toAbsoluteUrl } from './html.mjs'

// 학과 게시판은 "?mode=view&...", 대학공지는 "/kr/newscenter/notice.do?mode=view&..." 로
// 경로가 달라서 mode=view 를 담은 href 면 무엇이든 받는다.
const VIEW_HREF = /href="([^"]*mode=view[^"]*)"/i
const ARTICLE_NO = /articleNo=(\d+)/
const TITLE_SPAN = /<span class="b-title">([\s\S]*?)<\/span>/i
const NUM_CELL = /<td class="b-num-box">([\s\S]*?)<\/td>/i
const DATE_SPAN = /<span class="b-date">\s*(\d{4}\.\d{2}\.\d{2})/i
const DATE_FALLBACK = /(\d{4})\.(\d{2})\.(\d{2})/
const HIT_SPAN = /<span class="hit">\s*조회수\s*([\d,]+)/i
const FILE_SPAN = /<span class="b-file">/i
// 대학공지처럼 행마다 분류가 붙는 게시판에만 존재한다.
const MINI_CATE = /<span class="b-mini-cate">([\s\S]*?)<\/span>/i

function parseCount(raw) {
  if (!raw) return null

  const parsed = Number(raw.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function parseDate(row) {
  const exact = matchGroup(row, DATE_SPAN)
  if (exact) return exact

  const loose = row.match(DATE_FALLBACK)
  return loose ? `${loose[1]}.${loose[2]}.${loose[3]}` : ''
}

/** 한 행을 게시글 요약으로 바꾼다. 상세 링크가 없는 행(헤더 등)은 null. */
function parseRow(row, listUrl) {
  const href = matchGroup(row, VIEW_HREF)
  if (!href) return null

  const articleNo = matchGroup(href, ARTICLE_NO)
  if (!articleNo) return null

  const title = stripTagsInline(matchGroup(row, TITLE_SPAN))
  if (!title) return null

  return {
    articleNo,
    postNo: stripTagsInline(matchGroup(row, NUM_CELL)),
    title,
    /** 게시판이 행에 붙여준 분류. 없는 게시판이면 빈 문자열. */
    boardCategory: stripTagsInline(matchGroup(row, MINI_CATE)),
    date: parseDate(row),
    views: parseCount(matchGroup(row, HIT_SPAN)),
    hasAttachment: FILE_SPAN.test(row),
    link: toAbsoluteUrl(href, listUrl),
  }
}

/**
 * 게시판 표만 잘라낸다. 대학공지 페이지에는 표 바깥에도 mode=view 링크가 있어서
 * 범위를 좁히지 않으면 관계없는 글이 섞여 들어온다.
 */
function selectBoardTable(html, tableSummary) {
  if (!tableSummary) return html

  const start = html.indexOf(`<table summary="${tableSummary}"`)
  if (start === -1) return html

  const end = html.indexOf('</table>', start)
  return end === -1 ? html.slice(start) : html.slice(start, end)
}

/**
 * 목록 HTML 에서 게시글 요약 배열을 만든다.
 * 같은 articleNo 가 두 번 나오면(상단고정 + 일반 목록) 처음 것만 남긴다.
 */
export function parseList(html, listUrl, tableSummary = '') {
  const rows = selectBoardTable(html, tableSummary).split(/<tr[\s>]/i).slice(1)
  const seen = new Set()

  return rows.reduce((items, row) => {
    const item = parseRow(row, listUrl)
    if (!item || seen.has(item.articleNo)) return items

    seen.add(item.articleNo)
    return [...items, item]
  }, [])
}
