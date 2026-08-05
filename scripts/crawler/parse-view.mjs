// 게시글 상세(mode=view) HTML 에서 본문/작성자/첨부파일을 뽑는다.
//
// 실제 마크업(2026.08 확인):
//   <li class="b-writer-date-box"><span>컴퓨터공학과</span><span>2026.08.04</span></li>
//   <li class="b-hit-box"><span>조회수 13</span></li>
//   <div class="m-file-box pc-hide"> ... <a class="btn-file hwp" href="?mode=download&...">파일명</a>
//   <div class="b-content-box"><div class="fr-view"> 본문 </div></div>
//   <div class="b-pager-box">   ← 본문 영역의 끝 경계

import { matchGroup, sliceBetween, stripTags, stripTagsInline, toAbsoluteUrl } from './html.mjs'

const CONTENT_START = '<div class="b-content-box">'
const CONTENT_END = '<div class="b-pager-box"'
const FILE_BOX_START = '<div class="m-file-box pc-hide">'
const FILE_BOX_END = '</ul>'

const TITLE_SPAN = /<span class="b-title">([\s\S]*?)<\/span>/i
const WRITER_DATE = /<li class="b-writer-date-box">([\s\S]*?)<\/li>/i
const HIT_BOX = /<li class="b-hit-box">[\s\S]*?조회수\s*([\d,]+)/i
const SPAN_TEXT = /<span>([\s\S]*?)<\/span>/gi
const DOWNLOAD_LINK =
  /<a[^>]*class="btn-file[^"]*"[^>]*href="([^"]*mode=download[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
const ATTACH_NO = /attachNo=(\d+)/
const DATE_ONLY = /^\d{4}\.\d{2}\.\d{2}$/
const CONTENT_IMAGE = /<img[^>]*\ssrc="([^"]+)"/gi

function parseWriterAndDate(html) {
  const block = matchGroup(html, WRITER_DATE)
  const spans = [...block.matchAll(SPAN_TEXT)]
    .map((match) => stripTagsInline(match[1]))
    .filter(Boolean)

  return {
    writer: spans.find((text) => !DATE_ONLY.test(text)) ?? '',
    date: spans.find((text) => DATE_ONLY.test(text)) ?? '',
  }
}

function parseViews(html) {
  const raw = matchGroup(html, HIT_BOX)
  if (!raw) return null

  const parsed = Number(raw.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 첨부파일 목록. 데스크톱/모바일 마크업이 같은 파일을 중복해서 담고 있으므로
 * 모바일 블록만 읽고 attachNo 로 한 번 더 중복을 제거한다.
 * 파일 자체는 내려받지 않고 메타데이터(이름 + URL)만 남긴다.
 */
function parseAttachments(html, pageUrl) {
  const block = sliceBetween(html, FILE_BOX_START, FILE_BOX_END)
  if (!block) return []

  const seen = new Set()

  return [...block.matchAll(DOWNLOAD_LINK)].reduce((files, match) => {
    const attachNo = matchGroup(match[1], ATTACH_NO)
    const name = stripTagsInline(match[2])
    if (!name || (attachNo && seen.has(attachNo))) return files

    if (attachNo) seen.add(attachNo)
    return [...files, { name, url: toAbsoluteUrl(match[1], pageUrl) }]
  }, [])
}

/**
 * 본문에 박힌 이미지 URL. 이 게시판에는 본문 전체가 이미지 한 장뿐인 공지가 흔한데,
 * 그런 글은 텍스트가 비므로 이미지라도 남겨야 내용이 사라지지 않는다.
 */
function parseContentImages(contentHtml, pageUrl) {
  const seen = new Set()

  return [...contentHtml.matchAll(CONTENT_IMAGE)].reduce((images, match) => {
    const url = toAbsoluteUrl(match[1].trim(), pageUrl)
    if (!url || seen.has(url)) return images

    seen.add(url)
    return [...images, url]
  }, [])
}

/** 상세 페이지 HTML → { title, writer, date, views, content, images, attachments } */
export function parseView(html, pageUrl) {
  const contentHtml = sliceBetween(html, CONTENT_START, CONTENT_END)
  const { writer, date } = parseWriterAndDate(html)

  return {
    title: stripTagsInline(matchGroup(html, TITLE_SPAN)),
    writer,
    date,
    views: parseViews(html),
    content: stripTags(contentHtml),
    images: parseContentImages(contentHtml, pageUrl),
    attachments: parseAttachments(html, pageUrl),
  }
}
