// 네이버 지도 인증은 도메인 기반이라, WebView에 인라인 HTML을 넣는 방식으로는
// iOS(WKWebView)에서 origin이 비어 인증에 실패한다(2026-08-10 확인).
// 그래서 지도 페이지를 실제 도메인(Netlify)에 정적으로 배포해 WebView가 원격 URL로
// 불러오게 한다. 이 스크립트는 그 배포용 HTML을 앱과 동일한 buildMapHTML로 생성한다.
//
// public/ 에 쓰는 이유: Expo web export(`expo export -p web`)는 public/ 안의
// 파일을 그대로 dist/ 로 복사한다. pnpm build:web 을 실행할 때마다 map.html이
// 자동으로 배포물에 포함되어, 별도 폴더를 수동으로 옮길 필요가 없다.
//
// 건물 데이터는 서버 지도 데이터(`GET /map/data`)에서 받아 HTML 에 구워 넣는다. 앱은 지도 데이터가 바뀌면
// `setBuildings` 메시지로 건물을 다시 보내지만, 그 메시지를 모르는 예전 앱은 구운 건물을 계속 쓴다.
// 그래서 건물이 비어 있으면 문서를 만들지 않는다.
//
// 사용법: npx tsx --env-file=.env scripts/generate-map-html.ts [--from <map-data.json>]
//   --from 을 주면 서버 대신 그 파일(`GET /map/data` 응답과 같은 모양)을 읽는다.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildMapHTML } from '../src/utils/mapHtml'
import { normalizeMapData } from '../src/apis/mapData'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(SCRIPT_DIR, '..', 'public')
const OUT_FILE = join(OUT_DIR, 'map.html')

async function loadMapData(): Promise<unknown> {
  const fromIndex = process.argv.indexOf('--from')
  if (fromIndex >= 0) {
    const file = process.argv[fromIndex + 1]
    if (!file) throw new Error('--from 뒤에 지도 데이터 JSON 파일 경로를 주세요.')
    return JSON.parse(readFileSync(resolve(file), 'utf8'))
  }
  const base = process.env.EXPO_PUBLIC_API_BASE_URL
  if (!base) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL 이 비어 있습니다. `npx tsx --env-file=.env scripts/generate-map-html.ts` 로 실행하거나 --from 을 주세요.',
    )
  }
  const response = await fetch(`${base}/map/data`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`지도 데이터를 받지 못했습니다: ${base}/map/data → HTTP ${response.status}`)
  return response.json()
}

async function main(): Promise<void> {
  const mapData = normalizeMapData(await loadMapData())
  if (mapData.buildings.length === 0) {
    throw new Error('지도 데이터에 건물이 없습니다. 빈 건물로 만든 map.html 은 예전 앱에서 건물 탭이 모두 사라집니다.')
  }
  console.log(`건물 ${mapData.buildings.length}동 (version ${mapData.version || '없음'})`)

  const html = buildMapHTML(mapData.buildings)

  // 키가 빠진 문서를 만들어 배포하면, 네이버가 200 과 함께 "인증이 실패했습니다"
  // 타일을 배경으로 깔아 준다. 콘솔 에러도 navermap_authFailure 도 뜨지 않아
  // 원인 모를 회색 지도만 남는다(2026-08-13 실제로 이렇게 배포해 겪음).
  //
  // Expo 번들러와 달리 이 스크립트는 .env 를 자동으로 읽지 않는다. 반드시
  // `npx tsx --env-file=.env scripts/generate-map-html.ts` 로 실행해야 한다.
  if (/ncpKeyId=(?:["'&]|$)/m.test(html)) {
    throw new Error(
      'EXPO_PUBLIC_NAVER_MAP_CLIENT_ID 가 비어 있어, 지도 인증에 실패하는 문서가 만들어집니다.\n' +
        '`npx tsx --env-file=.env scripts/generate-map-html.ts` 로 실행하세요.',
    )
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, html)

  console.log(`생성됨: ${OUT_FILE}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
