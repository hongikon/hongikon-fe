// .env 의 EXPO_PUBLIC_* 값을 Netlify 빌드 환경변수로 밀어 넣는다.
//
// `expo export -p web`(netlify.toml의 build.command)은 빌드 시점에
// EXPO_PUBLIC_ 접두사 값을 번들에 그대로 주입한다(mapHtml.ts 참고). 로컬
// .env에만 값이 있고 Netlify 빌드 환경에는 없으면, 배포된 웹판은 빈 키로
// 지도 인증에 실패한다.
//
// 기본적으로 EXPO_PUBLIC_ 접두사가 아닌 값(NAVER_MAP_CLIENT_SECRET 등)은
// 건너뛴다 — 코드에서 쓰지 않는 시크릿을 배포 환경에 올릴 이유가 없고,
// 접두사를 붙이면 다음 빌드부터 그대로 번들에 실린다(docs/worklog.md
// "시크릿 번들 노출" 항목 참고). 그래도 올려야 한다면 --all을 쓴다.
//
// 사용법 (최초 1회):
//   npx netlify login   — 브라우저 인증
//   npx netlify link    — 이 저장소를 Netlify 사이트(hongmap12)에 연결
// 이후:
//   node scripts/netlify-env-sync.mjs [--all] [--dry-run]
//
// CI 등 비대화형 환경에서는 NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID 를 미리 export.

import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_PATH = join(ROOT, '.env')

const args = process.argv.slice(2)
const includeAll = args.includes('--all')
const dryRun = args.includes('--dry-run')

if (!existsSync(ENV_PATH)) {
  console.error(`.env 파일이 없습니다: ${ENV_PATH}`)
  process.exit(1)
}

function parseEnv(text) {
  const vars = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

const allVars = parseEnv(readFileSync(ENV_PATH, 'utf8'))
const targetKeys = Object.keys(allVars).filter((key) =>
  includeAll ? true : key.startsWith('EXPO_PUBLIC_'),
)
const skippedKeys = Object.keys(allVars).filter((key) => !targetKeys.includes(key))

if (targetKeys.length === 0) {
  console.error('동기화할 EXPO_PUBLIC_* 값이 .env에 없습니다. (--all로 전체 대상 지정 가능)')
  process.exit(1)
}

console.log(`대상 키 (${targetKeys.length}개): ${targetKeys.join(', ')}`)
if (skippedKeys.length > 0) {
  console.log(`건너뜀 (--all 없이는 제외): ${skippedKeys.join(', ')}`)
}

if (dryRun) {
  console.log('\n--dry-run: 실제로 Netlify에 반영하지 않았습니다.')
  process.exit(0)
}

for (const key of targetKeys) {
  const value = allVars[key]
  console.log(`\n$ netlify env:set ${key} ****`)
  const result = spawnSync(
    'npx',
    ['--yes', 'netlify-cli', 'env:set', key, value, '--scope', 'builds', '--force'],
    { stdio: 'inherit', cwd: ROOT },
  )
  if (result.status !== 0) {
    console.error(
      `\n실패: ${key}. 로그인/사이트 연결 상태를 확인하세요: npx netlify status`,
    )
    process.exit(result.status ?? 1)
  }
}

console.log('\n완료. 확인: npx netlify env:list --scope builds')
