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

const BACKSLASH = String.fromCharCode(92)
const NEWLINE = String.fromCharCode(10)
const NON_ASCII = new RegExp(`[${String.fromCodePoint(0x80)}-${String.fromCodePoint(0x10ffff)}]`, 'u')
// General punctuation dashes, arrows, box drawing through dingbats, emoji.
const DECORATIVE = new RegExp(
  `[${[[0x2010, 0x2015], [0x2190, 0x21ff], [0x2500, 0x27bf], [0x1f000, 0x1faff]].map(([x, y]) => `${String.fromCodePoint(x)}-${String.fromCodePoint(y)}`).join('')}]`,
  'u',
)

/** Removes string and template text, keeps comments and code, including code inside template expressions. */
function outsideStrings(source) {
  let out = ''
  let i = 0
  // Each entry is the brace depth of an open template expression.
  const expressions = []
  const scanTemplate = () => {
    while (i < source.length) {
      if (source[i] === BACKSLASH) i += 2
      else if (source[i] === '`') {
        i += 1
        return
      } else if (source[i] === '$' && source[i + 1] === '{') {
        i += 2
        expressions.push(0)
        return
      } else i += 1
    }
  }
  while (i < source.length) {
    const c = source[i]
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      const end = source.indexOf(NEWLINE, i)
      const stop = end < 0 ? source.length : end
      out += source.slice(i, stop)
      i = stop
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end < 0 ? source.length : end + 2
      out += source.slice(i, stop)
      i = stop
    } else if (c === "'" || c === '"') {
      i += 1
      while (i < source.length && source[i] !== c) i += source[i] === BACKSLASH ? 2 : 1
      i += 1
    } else if (c === '`') {
      i += 1
      scanTemplate()
    } else if (expressions.length && c === '{') {
      expressions[expressions.length - 1] += 1
      i += 1
    } else if (expressions.length && c === '}') {
      i += 1
      if (expressions[expressions.length - 1] === 0) {
        expressions.pop()
        scanTemplate()
      } else expressions[expressions.length - 1] -= 1
    } else {
      out += c
      i += 1
    }
  }
  return out
}

test('the scanner itself sees through nested templates and still finds Korean in comments', () => {
  const korean = String.fromCodePoint(0xd55c)
  const nested = ['const x = `a${y ? `', korean, '${z}` : `', korean, '`}b`'].join('')
  assert.ok(!NON_ASCII.test(outsideStrings(nested)))
  assert.ok(!NON_ASCII.test(outsideStrings(`const s = '${korean}'`)))
  assert.ok(NON_ASCII.test(outsideStrings(`// ${korean}`)))
  assert.ok(NON_ASCII.test(outsideStrings(`/* ${korean} */`)))
  assert.ok(NON_ASCII.test(outsideStrings(`const ${korean} = 1`)))
})

test('v3 files: code and comments are ASCII, no arrows or dashes anywhere', () => {
  assert.ok(files.length > 5)
  const bad = []
  for (const path of files) {
    const source = readFileSync(path, 'utf8')
    if (NON_ASCII.test(outsideStrings(source))) bad.push(`${path}: non ASCII outside a string`)
    if (DECORATIVE.test(source)) bad.push(`${path}: decorative character`)
  }
  assert.deepEqual(bad, [])
})
