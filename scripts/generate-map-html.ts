// 네이버 지도 인증은 도메인 기반이라, WebView에 인라인 HTML을 넣는 방식으로는
// iOS(WKWebView)에서 origin이 비어 인증에 실패한다(2026-08-10 확인).
// 그래서 지도 페이지를 실제 도메인(Netlify)에 정적으로 배포해 WebView가 원격 URL로
// 불러오게 한다. 이 스크립트는 그 배포용 HTML을 앱과 동일한 buildMapHTML로 생성한다.
//
// public/ 에 쓰는 이유: Expo web export(`expo export -p web`)는 public/ 안의
// 파일을 그대로 dist/ 로 복사한다. pnpm build:web 을 실행할 때마다 map.html이
// 자동으로 배포물에 포함되어, 별도 폴더를 수동으로 옮길 필요가 없다.
//
// 사용법: npx tsx scripts/generate-map-html.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildMapHTML } from '../src/utils/mapHtml'
import { BUILDINGS } from '../src/constants/buildings'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(SCRIPT_DIR, '..', 'public')
const OUT_FILE = join(OUT_DIR, 'map.html')

const html = buildMapHTML(BUILDINGS)

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
