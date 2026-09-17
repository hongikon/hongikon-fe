// assets/brand/*.svg(디자인 원본)로 앱 아이콘·스플래시·파비콘 PNG를 다시 만든다.
//
// 사용법: pnpm icons:generate
//
// 로고가 바뀌면 assets/brand/ 의 SVG만 교체하고 이 스크립트를 다시 돌린다.
// 산출물 규격:
//   icon.png                      1024 정사각, 알파 없음 — iOS가 모서리를 직접 깎으므로 둥근 모서리 없이 꽉 채운다
//   android-icon-background.png   432(=108dp) — 파란 배경 + 하단 띠·길
//   android-icon-foreground.png   432 — 말풍선만. 적응형 아이콘 마스크(안전영역 66dp)에 안 잘리게 축소
//   android-icon-monochrome.png   432 — 말풍선 실루엣(Android 13 테마 아이콘·알림 아이콘)
//   splash-icon.png               1024 투명 — 세로형 로고타입
//   favicon.png                   196 — 둥근 모서리 심볼

import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRAND = join(ROOT, 'assets/brand')
const OUT = join(ROOT, 'assets')

const BRAND_BLUE = '#1833DB'

const symbolSvg = readFileSync(join(BRAND, 'symbol.svg'), 'utf8')
const logotypeVerticalSvg = readFileSync(join(BRAND, 'logotype-vertical.svg'), 'utf8')

// symbol.svg 안 도형 순서(디자인 원본 기준):
// [0] 하단 어두운 띠  [1] 길  [2] 말풍선 꼬리 그림자  [3] 말풍선 흰 면  [4] 말풍선 옆면
const shapes = symbolSvg.match(/<path[\s\S]*?\/>/g)
if (!shapes || shapes.length !== 5) {
  throw new Error(`symbol.svg 구조가 예상과 다릅니다 (path ${shapes?.length ?? 0}개). 스크립트의 도형 인덱스를 확인하세요.`)
}
const [band, road, tailShadow, bubbleFace, bubbleSide] = shapes
const shadowGroup = `<g opacity="0.5" style="mix-blend-mode:multiply">${tailShadow}</g>`

// 말풍선 꼬리 끝. 축소해도 꼬리가 길 위에 그대로 닿도록 이 점을 기준으로 줄인다.
const TAIL_TIP = { x: 121.77, y: 302.21 }
const BUBBLE_SCALE = 0.7

const svg = (body, size = 400) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`

const scaledAroundTail = (body) =>
  `<g transform="translate(${TAIL_TIP.x} ${TAIL_TIP.y}) scale(${BUBBLE_SCALE}) translate(${-TAIL_TIP.x} ${-TAIL_TIP.y})">${body}</g>`

function render(svgText, width, outName, background) {
  const png = new Resvg(svgText, {
    fitTo: { mode: 'width', value: width },
    background,
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng()
  writeFileSync(join(OUT, outName), png)
  console.log(`✓ assets/${outName} (${width}px)`)
}

const background = `<rect width="400" height="400" fill="${BRAND_BLUE}"/>${band}${road}`

// iOS/기본 아이콘: 둥근 모서리 없이 꽉 채운 원본 구성
render(svg(`${background}${shadowGroup}${bubbleFace}${bubbleSide}`), 1024, 'icon.png', BRAND_BLUE)

// Android 적응형 아이콘
render(svg(background), 432, 'android-icon-background.png', BRAND_BLUE)
render(svg(scaledAroundTail(`${shadowGroup}${bubbleFace}${bubbleSide}`)), 432, 'android-icon-foreground.png')
render(
  svg(scaledAroundTail(`${bubbleFace}${bubbleSide}`.replace(/fill="[^"]*"/g, 'fill="white"').replace(/opacity="[^"]*"/g, ''))),
  432,
  'android-icon-monochrome.png',
)

// 파비콘: 디자인 원본 그대로(둥근 모서리 포함)
render(symbolSvg, 196, 'favicon.png')

// 스플래시: 세로형 로고타입을 정사각 캔버스 가운데에 여백을 두고 배치
const [, vbW, vbH] = logotypeVerticalSvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number)
const side = Math.max(vbW, vbH) * 1.25
const inner = logotypeVerticalSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
render(
  `<svg width="${side}" height="${side}" viewBox="0 0 ${side} ${side}" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${(side - vbW) / 2} ${(side - vbH) / 2})">${inner}</g></svg>`,
  1024,
  'splash-icon.png',
)
