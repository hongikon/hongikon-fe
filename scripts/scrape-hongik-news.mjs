#!/usr/bin/env node
// 홍익대 공지 게시판들을 긁어 NewsItem 형태의 JSON 으로 만든다.
//
// 게시판은 서버렌더링 HTML(.do?mode=list)이라 브라우저 없이 fetch + 정규식으로 파싱된다.
// 외부 패키지 없이 Node 18+ 내장 fetch 만 쓴다. 파싱/요청 로직은 scripts/crawler/ 에 있다.
//
// 사용법:
//   node scripts/scrape-hongik-news.mjs                     기본(증분)
//   node scripts/scrape-hongik-news.mjs --detail            본문·첨부파일까지 수집
//   node scripts/scrape-hongik-news.mjs --pages=5 --limit=50
//   node scripts/scrape-hongik-news.mjs --full              기존 JSON 무시하고 전체 재수집
//   node scripts/scrape-hongik-news.mjs --max=1000 --out=src/data/news.cs.json
//
// 게시판별 수집 상한(maxItems)은 config.mjs 에서 정한다.
// --pages/--limit 은 그 상한에 닿기까지 몇 페이지를 어떤 크기로 훑을지를 정할 뿐이다.
//
// 기본은 증분 수집이다. 기존 JSON 에 있는 id 는 건너뛰고, 새 글이 없는 페이지를 만나면 멈춘다.
// 기본 출력 위치는 src/data/news.cs.json 으로, 앱이 그대로 import 한다.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BOARDS, DEFAULT_PAGES, PAGE_SIZE } from './crawler/config.mjs'
import { crawlBoard } from './crawler/crawl.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
/** 앱(src/constants/crawledNews.ts)이 그대로 import 하는 위치에 바로 쓴다. */
const DEFAULT_OUT = join(SCRIPT_DIR, '..', 'src', 'data', 'news.cs.json')

/** --key=value / --flag 형태의 인자를 파싱한다. */
function parseArgs(argv) {
  const flags = new Map(
    argv
      .filter((arg) => arg.startsWith('--'))
      .map((arg) => {
        const [key, value] = arg.slice(2).split('=')
        return [key, value ?? 'true']
      }),
  )

  const number = (key, fallback) => {
    if (!flags.has(key)) return fallback

    const parsed = Number(flags.get(key))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  return {
    pages: number('pages', DEFAULT_PAGES),
    pageSize: number('limit', PAGE_SIZE),
    max: number('max', Number.POSITIVE_INFINITY),
    withDetail: flags.get('detail') === 'true',
    full: flags.get('full') === 'true',
    out: flags.has('out') ? resolve(process.cwd(), flags.get('out')) : DEFAULT_OUT,
  }
}

/** 기존 결과를 읽는다. 없거나 깨졌으면 빈 배열로 시작한다. */
function readExisting(outPath) {
  try {
    const parsed = JSON.parse(readFileSync(outPath, 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`기존 파일을 읽지 못해 새로 시작합니다 (${outPath}): ${error.message}`)
    }
    return []
  }
}

/** 최신순 정렬. 날짜가 같으면 id 의 숫자 부분(articleNo)이 큰 쪽이 먼저. */
function sortLatestFirst(items) {
  const articleNo = (item) => Number(item.id.split('-').at(-1)) || 0

  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return articleNo(b) - articleNo(a)
  })
}

/** 같은 id 는 새로 수집한 쪽으로 덮어쓴다. */
function mergeById(existing, fresh) {
  const merged = new Map(existing.map((item) => [item.id, item]))
  for (const item of fresh) {
    merged.set(item.id, item)
  }
  return [...merged.values()]
}

function writeOutput(items, options) {
  const output = Number.isFinite(options.max) ? items.slice(0, options.max) : items

  mkdirSync(dirname(options.out), { recursive: true })
  writeFileSync(options.out, `${JSON.stringify(output, null, 2)}\n`, 'utf-8')
  return output.length
}

/**
 * 수집 결과를 모으고 게시판이 하나 끝날 때마다 파일에 쓴다.
 *
 * 전부 끝난 뒤 한 번만 쓰면, 오래 걸리는 실행 도중에는 앱이 계속 옛 데이터를 보고
 * 중간에 끊기면 그때까지 긁은 게 통째로 날아간다.
 * 게시판들이 동시에 끝날 수 있으므로 쓰기는 한 줄로 세워 파일이 깨지지 않게 한다.
 */
function createResultStore(existing, options) {
  let merged = existing
  let writeQueue = Promise.resolve(existing.length)

  return {
    save(items) {
      merged = mergeById(merged, items)
      const snapshot = sortLatestFirst(merged)
      writeQueue = writeQueue.then(() => writeOutput(snapshot, options))
      return writeQueue
    },
    flush: () => writeQueue,
  }
}

/**
 * 호스트가 같은 게시판끼리 묶는다.
 * 묶음 안에서는 순서대로, 묶음끼리는 동시에 돌린다.
 * 한 서버에 요청을 몰지 않으면서 전체 시간은 크게 줄어든다.
 */
function groupBoardsByHost(boards) {
  const groups = new Map()

  for (const board of boards) {
    const { host } = new URL(board.listUrl)
    groups.set(host, [...(groups.get(host) ?? []), board])
  }
  return [...groups.values()]
}

function describeRun(options, knownCount, hostCount) {
  const detail = options.withDetail ? ', 상세 포함' : ''
  const mode = options.full ? ', 전체 재수집' : `, 증분(기존 ${knownCount}건)`
  return `수집 시작 — 게시판 ${BOARDS.length}개 / 호스트 ${hostCount}개 동시${detail}${mode}`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const existing = options.full ? [] : readExisting(options.out)
  const knownIds = new Set(existing.map((item) => item.id))
  const store = createResultStore(existing, options)
  const groups = groupBoardsByHost(BOARDS)

  console.log(describeRun(options, knownIds.size, groups.length))

  let failed = 0

  const crawlGroup = async (group) => {
    for (const board of group) {
      const items = await crawlBoard(board, {
        pages: options.pages,
        pageSize: options.pageSize,
        withDetail: options.withDetail,
        knownIds,
        stopOnKnown: !options.full,
        onProgress: (message) => console.log(`  · [${board.source}] ${message}`),
        onWarn: (message) => {
          failed += 1
          console.warn(`  ! [${board.source}] ${message}`)
        },
      })

      console.log(`  → ${board.source}: 새 글 ${items.length}건`)
      await store.save(items)
    }
  }

  await Promise.all(groups.map(crawlGroup))

  const total = await store.flush()
  const saved = readExisting(options.out)

  console.log(`\n총 ${total}건 저장 → ${options.out}`)
  if (failed > 0) {
    console.warn(`실패한 요청 ${failed}건이 있습니다. 위 경고를 확인하세요.`)
  }

  console.log('\n미리보기(최신 5건):')
  for (const item of saved.slice(0, 5)) {
    const files = item.attachments?.length ? ` (첨부 ${item.attachments.length})` : ''
    console.log(`  [${item.category}] ${item.date}  ${item.title.slice(0, 42)}${files}`)
  }
}

main().catch((error) => {
  console.error('스크래퍼 실패:', error.message)
  process.exit(1)
})
