// 건축대(arch.hongik.ac.kr) 게시판 파서.
//
// 본부·학과 게시판과는 아예 다른 PHP CMS 라 마크업이 하나도 겹치지 않는다.
//
// 목록(2026.08 확인):
//   <div class="board_listS01"><ul>
//     <li><a href="/kor/news/notice.php?m=v&idx=1139&pNo=1&code=notice">
//       <div class="info_bx"><span>No.436</span><span>2026.08.03</span></div>
//       <div class="txt_bx"><p>제목</p></div>
//     </a></li>
//
// 상세:
//   <div class="v_tit"><strong>제목</strong>
//     <ul class="info2"><li>작성일  2026. 08. 03</li><li>조회수  60</li></ul></div>
//   <div class="v_con"> 본문 </div>
//   <div class="paging">   ← 본문 끝 경계

import { matchGroup, sliceBetween, stripTags, stripTagsInline, toAbsoluteUrl } from './html.mjs'

/**
 * 공지(notice.php)는 board_listS01, 행사(event.php)는 썸네일이 붙은 board_listS02 를 쓴다.
 * 제목이 놓이는 자리가 서로 달라서 둘 다 본다.
 */
const LIST_BLOCK = /<div class="board_listS0[12]">([\s\S]*?)<\/ul>/i

const VIEW_HREF = /href="([^"]*m=v[^"]*)"/i
const ARTICLE_IDX = /idx=(\d+)/
/** board_listS01: <div class="txt_bx"><p>제목</p></div> */
const TITLE_P = /<div class="txt_bx">[\s\S]*?<p>([\s\S]*?)<\/p>/i
/** board_listS02: <div class="info_bx"><strong>제목</strong>... */
const TITLE_STRONG = /<strong>([\s\S]*?)<\/strong>/i
const POST_NO = /<span>\s*No\.\s*(\d+)/i
const DATE = /(\d{4})\.\s*(\d{2})\.\s*(\d{2})/

const CONTENT_START = '<div class="v_con">'
const CONTENT_END = '<div class="paging">'
const VIEW_TITLE = /<div class="v_tit">[\s\S]*?<strong>([\s\S]*?)<\/strong>/i
const VIEW_DATE = /작성일\s*([\d.\s]+)</i
const VIEW_HIT = /조회수\s*([\d,]+)/i

/** 이 CMS 는 페이지 크기가 고정이고 pNo 로만 넘긴다. */
export function buildArchListUrl(listUrl, { page }) {
  const url = new URL(listUrl)
  url.searchParams.set('pNo', String(page + 1))
  return url.toString()
}

function parseCount(raw) {
  if (!raw) return null

  const parsed = Number(raw.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

/** '2026. 08. 03' 처럼 사이에 공백이 낀 형태도 'YYYY.MM.DD' 로 맞춘다. */
function parseDate(text) {
  const found = text.match(DATE)
  return found ? `${found[1]}.${found[2]}.${found[3]}` : ''
}

function parseRow(row, listUrl) {
  const href = matchGroup(row, VIEW_HREF)
  if (!href) return null

  const articleNo = matchGroup(href, ARTICLE_IDX)
  if (!articleNo) return null

  const title = stripTagsInline(matchGroup(row, TITLE_P) || matchGroup(row, TITLE_STRONG))
  if (!title) return null

  return {
    articleNo,
    postNo: matchGroup(row, POST_NO),
    title,
    boardCategory: '',
    date: parseDate(row),
    views: null,
    hasAttachment: false,
    link: toAbsoluteUrl(href, listUrl),
  }
}

export function parseArchList(html, listUrl) {
  const block = matchGroup(html, LIST_BLOCK)
  if (!block) return []

  const seen = new Set()

  return block
    .split('<li>')
    .slice(1)
    .reduce((items, row) => {
      const item = parseRow(row, listUrl)
      if (!item || seen.has(item.articleNo)) return items

      seen.add(item.articleNo)
      return [...items, item]
    }, [])
}

export function parseArchView(html) {
  const contentHtml = sliceBetween(html, CONTENT_START, CONTENT_END)

  return {
    title: stripTagsInline(matchGroup(html, VIEW_TITLE)),
    // 이 게시판은 작성 부서를 따로 보여주지 않는다.
    writer: '',
    date: parseDate(matchGroup(html, VIEW_DATE)),
    views: parseCount(matchGroup(html, VIEW_HIT)),
    content: stripTags(contentHtml),
    images: [],
    attachments: [],
  }
}
