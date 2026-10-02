#!/usr/bin/env node
/**
 * EAS Update(OTA) 를 실행 환경에 맞는 값으로 올린다.
 *
 *   pnpm update:production -m "공지 목록 버그 수정"
 *   pnpm update:preview -m "..."
 *
 * 왜 `eas update` 를 바로 치지 않나:
 * - OTA 번들의 `Constants.expoConfig` 는 업데이트를 올린 그 순간의 app.config.ts 결과로 바뀐다.
 *   APP_VARIANT 없이 올리면 extra.appVariant 가 'development' 로 실려 운영 앱에 개발자 도구가 켜진다.
 * - EXPO_PUBLIC_* 는 번들에 박히는데, EAS 환경 변수에 없으면 로컬 .env 값(예: localhost)이 실린다.
 *
 * 그래서 eas.json 의 같은 이름 빌드 프로필 env(extends 포함)를 그대로 process.env 에 넣고
 * `eas update --channel <프로필> --environment <프로필>` 을 실행한다. 빌드와 OTA 가 같은 값을 쓴다.
 * 나머지 인자(-m, --platform 등)는 그대로 넘긴다.
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ALLOWED = ['production', 'preview']
const [profileName, ...rest] = process.argv.slice(2)

if (!ALLOWED.includes(profileName)) {
  console.error(`사용법: node scripts/eas-update.mjs <${ALLOWED.join('|')}> -m "메시지"`)
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'))

function resolveProfile(name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`eas.json extends 순환: ${name}`)
  seen.add(name)
  const profile = eas.build?.[name]
  if (!profile) throw new Error(`eas.json 에 build.${name} 프로필이 없다`)
  const parent = profile.extends ? resolveProfile(profile.extends, seen) : {}
  return { ...parent, ...profile, env: { ...parent.env, ...profile.env } }
}

const profile = resolveProfile(profileName)
const channel = profile.channel
const environment = profile.environment ?? profileName
if (!channel) throw new Error(`build.${profileName}.channel 이 비어 있다`)
if (profile.env.APP_VARIANT !== profileName) {
  throw new Error(`build.${profileName}.env.APP_VARIANT 가 '${profileName}' 이 아니다`)
}

if (!rest.some((a) => a === '-m' || a === '--message' || a.startsWith('--message=') || a === '--auto')) {
  console.error('업데이트 메시지를 붙여 주세요: -m "무엇을 고쳤는지"')
  process.exit(1)
}

console.log(`[eas-update] channel=${channel} environment=${environment}`)
for (const [k, v] of Object.entries(profile.env)) console.log(`[eas-update]   ${k}=${v}`)

const args = ['update', '--channel', channel, '--environment', environment, ...rest]
const result = spawnSync('eas', args, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...profile.env },
})
process.exit(result.status ?? 1)
