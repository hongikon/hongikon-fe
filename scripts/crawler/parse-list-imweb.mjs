// 도시공학과(urban.hongik.ac.kr) 게시판 파서. Imweb 으로 만든 사이트다.
//
// 목록(2026.08 확인):
//   <ul class="li_body ...">
//     <li class="tit">
//       <a class="list_text_title _fade_link" href="/114/?...&bmode=view&idx=172857723&t=board">
//         <span>제목</span></a></li>
//     <li class="name">운영자</li>
//     <li class="time" title="2026-08-04 10:01">1일전</li>
//     <li class="read"><span>조회수</span>9</li>
//
// 목록은 '1일전' 같은 상대 시간을 보여주지만 time 의 title 속성에 실제 일시가 들어 있다.
//
// 상세는 파싱하지 않는다. 한 건이 340KB 가 넘고 본문 영역 경계가 뚜렷하지 않아
// 얻는 것에 비해 깨지기 쉽다. 이 게시판은 미리보기 없이 목록 정보만 채운다.

import { decodeEntities, matchGroup, stripTagsInline, toAbsoluteUrl } from './html.mjs'

const ROW_SPLIT = /<ul class="li_body/i
const VIEW_HREF = /<a[^>]*class="list_text_title[^"]*"[^>]*href="([^"]+)"/i
const ARTICLE_IDX = /idx=(\d+)/
const TITLE_LINK = /<a[^>]*class="list_text_title[^"]*"[^>]*>([\s\S]*?)<\/a>/i
const TIME_TITLE = /<li class="time"[^>]*title="(\d{4})-(\d{2})-(\d{2})/i
const READ_COUNT = /<li class="read"[^>]*>[\s\S]*?<\/span>\s*([\d,]+)/i

/** Imweb 은 page 파라미터 하나로 넘긴다. 페이지 크기는 사이트가 정한다. */
export function buildImwebListUrl(listUrl, { page }) {
  const url = new URL(listUrl)
  url.searchParams.set('page', String(page + 1))
  return url.toString()
}

function parseCount(raw) {
  if (!raw) return null

  const parsed = Number(raw.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function parseRow(row, listUrl) {
  const href = matchGroup(row, VIEW_HREF)
  if (!href) return null

  const articleNo = matchGroup(decodeEntities(href), ARTICLE_IDX)
  if (!articleNo) return null

  const title = stripTagsInline(matchGroup(row, TITLE_LINK))
  if (!title) return null

  const date = row.match(TIME_TITLE)

  return {
    articleNo,
    postNo: '',
    title,
    boardCategory: '',
    date: date ? `${date[1]}.${date[2]}.${date[3]}` : '',
    views: parseCount(matchGroup(row, READ_COUNT)),
    hasAttachment: false,
    link: toAbsoluteUrl(href, listUrl),
  }
}

export function parseImwebList(html, listUrl) {
  const seen = new Set()

  return html
    .split(ROW_SPLIT)
    .slice(1)
    .reduce((items, row) => {
      const item = parseRow(row, listUrl)
      if (!item || seen.has(item.articleNo)) return items

      seen.add(item.articleNo)
      return [...items, item]
    }, [])
}
