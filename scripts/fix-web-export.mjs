// `expo export -p web` 결과물(dist/)을 Netlify 에 올리기 전에 손본다. package.json 의 build:web 이 부른다.
//
// 1) 아이콘 폰트 경로에서 node_modules 빼기
//    Expo 는 @expo/vector-icons 의 .ttf 를 dist/assets/node_modules/.pnpm/.../node_modules/... 에 둔다.
//    그런데 Netlify 는 배포할 때 node_modules 라는 이름의 폴더를 올리지 않는다 — 폰트 요청이 SPA 대체
//    규칙에 걸려 index.html 이 돌아오고(HTTP 200, text/html), 웹판 아이콘이 전부 네모로 깨졌다.
//    경로의 node_modules → nm, .pnpm → pnpm 으로 옮기고 번들 안의 URL 문자열도 같이 바꾼다.
//
// 2) 파비콘 주소에 버전 붙이기 (3) 이용약관·개인정보 처리방침 정적 페이지는 맨 아래)
//    브라우저는 /favicon.ico 를 오래 캐시해서, 브랜드 아이콘으로 바꾼 뒤에도 옛 아이콘이 계속 보였다.
//    파일 내용 해시를 쿼리로 붙여 아이콘이 바뀔 때만 새로 받게 한다.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

// 2) 파비콘 캐시 무효화 + PNG/애플 터치 아이콘
//    크롬은 PNG 아이콘을 .ico 보다 우선하고, 사파리는 북마크·홈 화면에 apple-touch-icon 을 쓴다(없으면 기본 글자 아이콘).
//    새 주소로 걸어 두면 옛 파비콘을 캐시한 브라우저도 새로 받는다.
const favicon = join(DIST, 'favicon.ico')
const indexHtml = join(DIST, 'index.html')
if (existsSync(favicon) && existsSync(indexHtml)) {
  copyFileSync('assets/favicon.png', join(DIST, 'favicon.png'))
  copyFileSync('assets/icon.png', join(DIST, 'apple-touch-icon.png'))
  const version = createHash('sha256')
    .update(readFileSync(favicon))
    .update(readFileSync('assets/favicon.png'))
    .update(readFileSync('assets/icon.png'))
    .digest('hex')
    .slice(0, 8)
  const links =
    `<link rel="icon" type="image/png" sizes="196x196" href="/favicon.png?v=${version}"/>` +
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${version}"/>`
  const html = readFileSync(indexHtml, 'utf8')
    .replace(/<link rel="icon" href="\/favicon\.ico"\/>/g, `<link rel="icon" href="/favicon.ico?v=${version}" sizes="any"/>${links}`)
  if (!html.includes('apple-touch-icon')) {
    console.error('[fix-web-export] index.html 에서 파비콘 링크를 찾지 못함 — Expo 템플릿이 바뀌었는지 확인')
    process.exit(1)
  }
  writeFileSync(indexHtml, html)
}

// 3) 이용약관·개인정보 처리방침 정적 페이지(/terms, /privacy)
//    스토어 심사·외부 링크용. 앱을 띄우지 않고(자바스크립트 없이) 바로 읽히게 정적 HTML 로 만든다.
//    원문은 앱 안 화면과 같은 src/constants/legalText.ts 하나 — 따로 고치다 내용이 갈라지지 않게 한다.
const legalSource = readFileSync('src/constants/legalText.ts', 'utf8')
function legalText(name) {
  const match = legalSource.match(new RegExp('export const ' + name + ' = `([\\s\\S]*?)`'))
  if (!match) {
    console.error(`[fix-web-export] legalText.ts 에서 ${name} 을 찾지 못함`)
    process.exit(1)
  }
  return match[1]
}
const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function legalPage(title, body) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} | 홍익온</title>
<link rel="icon" type="image/png" href="/favicon.png" />
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #fff; color: #111; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  header img { width: 28px; height: 28px; border-radius: 7px; }
  header span { font-weight: 700; color: #05014A; }
  h1 { font-size: 24px; margin: 16px 0 24px; }
  .body { white-space: pre-wrap; line-height: 1.75; font-size: 15px; color: #333; word-break: keep-all; overflow-wrap: anywhere; }
  footer { margin-top: 40px; font-size: 13px; color: #888; }
  footer a { color: #05014A; }
</style>
</head>
<body>
<main>
  <header><img src="/favicon.png" alt="" /><span>홍익온</span></header>
  <h1>${title}</h1>
  <div class="body">${escapeHtml(body)}</div>
  <footer><a href="/terms">이용약관</a> · <a href="/privacy">개인정보 처리방침</a> · <a href="/">홍익온 열기</a></footer>
</main>
</body>
</html>
`
}

for (const [slug, title, name] of [
  ['privacy', '개인정보 처리방침', 'PRIVACY_TEXT'],
  ['terms', '이용약관', 'TERMS_TEXT'],
]) {
  mkdirSync(join(DIST, slug), { recursive: true })
  writeFileSync(join(DIST, slug, 'index.html'), legalPage(title, legalText(name)))
}

console.log(`[fix-web-export] 에셋 ${renames.size}개 경로 변경, 파일 ${rewritten}개 참조 수정, 파비콘 버전 적용, /terms·/privacy 생성`)
