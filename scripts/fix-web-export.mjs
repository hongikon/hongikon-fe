// `expo export -p web` 결과물(dist/)을 Netlify 에 올리기 전에 손본다. package.json 의 build:web 이 부른다.
//
// 1) 아이콘 폰트 경로에서 node_modules 빼기
//    Expo 는 @expo/vector-icons 의 .ttf 를 dist/assets/node_modules/.pnpm/.../node_modules/... 에 둔다.
//    그런데 Netlify 는 배포할 때 node_modules 라는 이름의 폴더를 올리지 않는다 — 폰트 요청이 SPA 대체
//    규칙에 걸려 index.html 이 돌아오고(HTTP 200, text/html), 웹판 아이콘이 전부 네모로 깨졌다.
//    경로의 node_modules → nm, .pnpm → pnpm 으로 옮기고 번들 안의 URL 문자열도 같이 바꾼다.
//
// 2) 파비콘 주소에 버전 붙이기 (3) 이용약관·개인정보 처리방침·지원·계정 삭제·라이선스 정적 페이지는 맨 아래)
//    브라우저는 /favicon.ico 를 오래 캐시해서, 브랜드 아이콘으로 바꾼 뒤에도 옛 아이콘이 계속 보였다.
//    파일 내용 해시를 쿼리로 붙여 아이콘이 바뀔 때만 새로 받게 한다.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { accountDeletionPage, legalPage, licensesPage, supportPage } from './static-pages.mjs'

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

// 3) 정적 안내 페이지(/terms, /privacy, /support, /account-deletion, /licenses)
//    스토어 심사·외부 링크용. 앱을 띄우지 않고(자바스크립트 없이) 바로 읽히게 정적 HTML 로 만든다(scripts/static-pages.mjs).
//    약관·처리방침 원문은 앱 안 화면과 같은 src/constants/legalText.ts 하나 — 따로 고치다 내용이 갈라지지 않게 한다.
//    Netlify 는 실제 파일이 있는 경로에 SPA 대체 규칙(/* → /index.html)을 적용하지 않는다(netlify.toml 에 명시 규칙도 있음).
const legalSource = readFileSync('src/constants/legalText.ts', 'utf8')
function constantText(source, name, file) {
  // 여는 따옴표(백틱 또는 ')와 같은 따옴표에서 끝낸다(본문의 다른 따옴표에서 잘리지 않게).
  const match = source.match(new RegExp('export const ' + name + " = ([`'])([\\s\\S]*?)\\1"))
  if (!match) {
    console.error(`[fix-web-export] ${file} 에서 ${name} 을 찾지 못함`)
    process.exit(1)
  }
  return match[2]
}
const unofficialNotice = constantText(readFileSync('src/constants/disclaimer.ts', 'utf8'), 'UNOFFICIAL_NOTICE', 'disclaimer.ts')

// 오픈소스 라이선스: 앱 안 화면과 같은 목록(src/constants/openSourceLicenses.json, `pnpm licenses:generate` 로 만들어 커밋).
// 배포 중에 `pnpm licenses list` 를 돌리지 않는다 — Netlify 가 캐시에서 되살린 node_modules 에는 pnpm 의
// 패키지 색인 파일이 없어 ERR_PNPM_MISSING_PACKAGE_INDEX_FILE 로 실패했고, 그 탓에 2026-10-02 부터
// 모든 배포가 멈춰 /support·/licenses·/account-deletion 이 올라가지 못했다(배포 로그로 확인, 2026-10-04).
const licenseData = JSON.parse(readFileSync('src/constants/openSourceLicenses.json', 'utf8'))
const expandLicense = ({ n, v, l, a, h, t }) => ({
  name: n,
  versions: v ? v.split(', ') : [],
  license: l,
  author: a,
  homepage: h,
  text: t >= 0 ? licenseData.texts[t] : '',
})
const packages = licenseData.packages.map(expandLicense)
const fonts = licenseData.fonts.map(expandLicense)

const pages = [
  ['privacy', legalPage('개인정보 처리방침', constantText(legalSource, 'PRIVACY_TEXT', 'legalText.ts'))],
  ['terms', legalPage('이용약관', constantText(legalSource, 'TERMS_TEXT', 'legalText.ts'))],
  ['support', supportPage(unofficialNotice)],
  ['account-deletion', accountDeletionPage()],
  ['licenses', licensesPage(packages, fonts)],
]
for (const [slug, html] of pages) {
  mkdirSync(join(DIST, slug), { recursive: true })
  writeFileSync(join(DIST, slug, 'index.html'), html)
}

console.log(
  `[fix-web-export] 에셋 ${renames.size}개 경로 변경, 파일 ${rewritten}개 참조 수정, 파비콘 버전 적용, ` +
    `정적 페이지 ${pages.map(([slug]) => '/' + slug).join('·')} 생성(라이선스 ${packages.length}개)`,
)
