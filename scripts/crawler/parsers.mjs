// 게시판마다 쓰는 CMS 가 달라서 파서를 묶어두고 골라 쓴다.
//
// 게시판 설정의 parser 키가 여기 이름을 가리킨다. 값이 없으면 hongik 을 쓴다.
// 새 CMS 가 생기면 파일을 하나 만들고 여기에 한 줄 추가하면 된다.

import { buildArchListUrl, parseArchList, parseArchView } from './parse-list-arch.mjs'
import { buildImwebListUrl, parseImwebList } from './parse-list-imweb.mjs'
import { parseList } from './parse-list.mjs'
import { parseView } from './parse-view.mjs'

/** 본부·학과 게시판이 쓰는 .do CMS. 시작 위치와 건수를 직접 넘긴다. */
function buildHongikListUrl(listUrl, { page, pageSize }) {
  const url = new URL(listUrl)
  url.searchParams.set('mode', 'list')
  url.searchParams.set('article.offset', String(page * pageSize))
  url.searchParams.set('articleLimit', String(pageSize))
  return url.toString()
}

export const PARSERS = {
  hongik: {
    buildListUrl: buildHongikListUrl,
    parseList,
    parseView,
  },
  arch: {
    buildListUrl: buildArchListUrl,
    parseList: parseArchList,
    parseView: parseArchView,
  },
  imweb: {
    buildListUrl: buildImwebListUrl,
    parseList: parseImwebList,
    /** 상세는 지원하지 않는다. 이유는 parse-list-imweb.mjs 주석 참고. */
    parseView: null,
  },
}

const DEFAULT_PARSER = 'hongik'

export function getParser(board) {
  const parser = PARSERS[board.parser ?? DEFAULT_PARSER]
  if (!parser) {
    throw new Error(`알 수 없는 파서: ${board.parser} (${board.source})`)
  }
  return parser
}
