// Project rule for the v3 survey: code and comments are ASCII only. Korean is allowed inside string
// literals because that is screen text. Arrows and dashes are not allowed anywhere.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../../', import.meta.url))
const walk = (dir) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        return statSync(path).isDirectory() ? walk(path) : [path]
      })

const files = [
  ...walk(join(root, 'src/utils/pathSurveyV3')),
  ...walk(join(root, 'src/screens/pathSurveyV3')),
  join(root, 'src/screens/DevPathSurveyV3Screen.tsx'),
  join(root, 'scripts/path-survey/v3-helpers.mjs'),
  ...readdirSync(join(root, 'scripts/path-survey'))
    .filter((name) => name.startsWith('test-v3-'))
    .map((name) => join(root, 'scripts/path-survey', name)),
].filter((path) => existsSync(path))

/** Removes string and template contents, keeps comments and code. Good enough for this code base. */
function outsideStrings(source) {
  let out = ''
  let i = 0
  while (i < source.length) {
    const c = source[i]
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      const stop = end < 0 ? source.length : end
      out += source.slice(i, stop)
      i = stop
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end < 0 ? source.length : end + 2
      out += source.slice(i, stop)
      i = stop
    } else if (c === "'" || c === '"' || c === '`') {
      i += 1
      while (i < source.length && source[i] !== c) i += source[i] === '\\' ? 2 : 1
      i += 1
    } else {
      out += c
      i += 1
    }
  }
  return out
}

test('v3 files: code and comments are ASCII, no arrows or dashes anywhere', () => {
  assert.ok(files.length > 5)
  const bad = []
  for (const path of files) {
    const source = readFileSync(path, 'utf8')
    if (/[^\x00-\x7F]/.test(outsideStrings(source))) bad.push(`${path}: non ASCII outside a string`)
    if (/[\u2010-\u2015\u2190-\u21FF\u2500-\u27BF\u{1F000}-\u{1FAFF}]/u.test(source)) bad.push(`${path}: decorative character`)
  }
  assert.deepEqual(bad, [])
})
