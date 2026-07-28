// 홍익대 학과 공지 게시판을 긁어 NewsItem 형태의 JSON 으로 만든다.
//
// 게시판은 서버렌더링 HTML(.do?mode=list)이라 브라우저 없이 fetch + 정규식으로
// 파싱된다. 외부 패키지 없이 Node 내장 fetch(18+)만 쓴다.
//
// 실행:  node scripts/scrape-hongik-news.mjs
// 출력:  scripts/news.cs.json  (콘솔에도 요약 출력)
//
// 지금은 컴퓨터공학과 하나만 대상으로 한다. 게시판을 늘리려면 BOARDS 에
// { sourceId, source, listUrl } 를 추가하면 된다.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'news.cs.json')
const MAX_ITEMS = 30

/** 긁을 게시판. source/sourceId 는 앱의 NewsItem 및 TREE_DATA 와 맞춘다. */
const BOARDS = [
  {
    sourceId: '컴퓨터공학과',
    source: '컴퓨터공학과',
    listUrl: 'https://wwwce.hongik.ac.kr/wwwce/0401.do',
  },
]

/**
 * 제목 키워드로 카테고리를 추정한다. 게시판이 카테고리를 주지 않으므로
 * 어림짐작이며, 맞는 게 없으면 '공지'로 둔다. (앱 CategoryKey 와 동일 집합)
 */
const CATEGORY_RULES = [
  ['장학', /장학|장학금/],
  ['취업', /취업|채용|인턴|모집|기업|박람회|공고|연구원/],
  ['수강', /수강|성적|졸업|학점|교과|전공|시험|수업|계절학기/],
  ['행사', /축제|행사|전시|공연|대회|특강|세미나|워크숍/],
  ['상담', /상담|심리|건강/],
]

function classify(title) {
  for (const [key, re] of CATEGORY_RULES) {
    if (re.test(title)) return key
  }
  return '공지'
}

function unescapeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(value) {
  return unescapeHtml(value.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (HongikAlimi news bot)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

/** 목록 HTML 에서 게시글 한 건씩 뽑는다. 각 <tr> 안의 상세 링크 + 등록일. */
function parseBoard(html, board) {
  const rows = html.split(/<tr[\s>]/i).slice(1)
  const items = []
  const seen = new Set()

  for (const row of rows) {
    const link = row.match(/href="([^"]*mode=view[^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!link) continue
    const title = stripTags(link[2])
    if (!title) continue

    const articleNo = link[1].match(/articleNo=(\d+)/)?.[1]
    if (!articleNo || seen.has(articleNo)) continue
    seen.add(articleNo)

    const date = row.match(/(20\d\d)\.(\d\d)\.(\d\d)/)
    const href = unescapeHtml(link[1])

    items.push({
      id: `ce-${articleNo}`,
      category: classify(title),
      title,
      preview: '', // 목록 페이지엔 본문 미리보기가 없다. 필요하면 상세 페이지를 추가로 긁어야 한다.
      source: board.source,
      sourceId: board.sourceId,
      date: date ? `${date[1]}.${date[2]}.${date[3]}` : '',
      link: href.startsWith('?') ? `${board.listUrl}${href}` : href,
    })
  }
  return items
}

async function main() {
  const all = []
  for (const board of BOARDS) {
    process.stdout.write(`긁는 중: ${board.source} (${board.listUrl}) ... `)
    try {
      const html = await fetchHtml(`${board.listUrl}?article.offset=0&mode=list`)
      const items = parseBoard(html, board)
      console.log(`${items.length}건`)
      all.push(...items)
    } catch (error) {
      console.log(`실패 — ${error.message}`)
    }
  }

  const result = all.slice(0, MAX_ITEMS)
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf-8')

  console.log(`\n총 ${result.length}건 저장 → ${OUT_PATH}`)
  console.log('\n미리보기(최신 8건):')
  for (const item of result.slice(0, 8)) {
    console.log(`  [${item.category}] ${item.date}  ${item.title.slice(0, 40)}`)
  }
}

main().catch((error) => {
  console.error('스크래퍼 실패:', error)
  process.exit(1)
})
