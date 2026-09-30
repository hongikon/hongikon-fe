// `expo export -p web` 결과물(dist/)을 Netlify 에 올리기 전에 손본다. package.json 의 build:web 이 부른다.
//
// 1) 아이콘 폰트 경로에서 node_modules 빼기
//    Expo 는 @expo/vector-icons 의 .ttf 를 dist/assets/node_modules/.pnpm/.../node_modules/... 에 둔다.
//    그런데 Netlify 는 배포할 때 node_modules 라는 이름의 폴더를 올리지 않는다 — 폰트 요청이 SPA 대체
//    규칙에 걸려 index.html 이 돌아오고(HTTP 200, text/html), 웹판 아이콘이 전부 네모로 깨졌다.
//    경로의 node_modules → nm, .pnpm → pnpm 으로 옮기고 번들 안의 URL 문자열도 같이 바꾼다.
//
// 2) 파비콘 주소에 버전 붙이기
//    브라우저는 /favicon.ico 를 오래 캐시해서, 브랜드 아이콘으로 바꾼 뒤에도 옛 아이콘이 계속 보였다.
//    파일 내용 해시를 쿼리로 붙여 아이콘이 바뀔 때만 새로 받게 한다.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

const DIST = 'dist'
const ASSETS = join(DIST, 'assets')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const toUrl = (path) => '/' + relative(DIST, path).split(sep).join('/')

// 1) node_modules 가 들어간 에셋 경로 옮기기
const renames = new Map() // 옛 URL → 새 URL
const vendorRoot = join(ASSETS, 'node_modules')
if (existsSync(vendorRoot)) {
  for (const oldPath of walk(vendorRoot)) {
    const rel = relative(ASSETS, oldPath)
      .split(sep)
      .map((segment) => (segment === 'node_modules' ? 'nm' : segment === '.pnpm' ? 'pnpm' : segment))
      .join(sep)
    const newPath = join(ASSETS, rel)
    mkdirSync(dirname(newPath), { recursive: true })
    renameSync(oldPath, newPath)
    renames.set(toUrl(oldPath), toUrl(newPath))
  }
  rmSync(vendorRoot, { recursive: true, force: true })
}

let rewritten = 0
if (renames.size > 0) {
  for (const file of walk(DIST).filter((f) => /\.(js|html|css|json)$/.test(f))) {
    let text = readFileSync(file, 'utf8')
    let changed = false
    for (const [from, to] of renames) {
      if (text.includes(from)) {
        text = text.split(from).join(to)
        changed = true
      }
    }
    if (changed) {
      writeFileSync(file, text)
      rewritten++
    }
  }
}

// 남은 참조가 있으면 배포해 봐야 또 깨지므로 빌드를 실패시킨다.
const leftovers = walk(DIST)
  .filter((f) => /\.(js|html|css)$/.test(f))
  .filter((f) => readFileSync(f, 'utf8').includes('/assets/node_modules/'))
if (leftovers.length > 0) {
  console.error(`[fix-web-export] /assets/node_modules/ 참조가 남아 있음: ${leftovers.join(', ')}`)
  process.exit(1)
}

// 2) 파비콘 캐시 무효화
const favicon = join(DIST, 'favicon.ico')
const indexHtml = join(DIST, 'index.html')
if (existsSync(favicon) && existsSync(indexHtml)) {
  const version = createHash('sha256').update(readFileSync(favicon)).digest('hex').slice(0, 8)
  const html = readFileSync(indexHtml, 'utf8').replace(/href="\/favicon\.ico"/g, `href="/favicon.ico?v=${version}"`)
  writeFileSync(indexHtml, html)
}

console.log(`[fix-web-export] 에셋 ${renames.size}개 경로 변경, 파일 ${rewritten}개 참조 수정, 파비콘 버전 적용`)
