// 앱 안 '오픈소스 라이선스' 화면(src/components/settings/LicensesModal.tsx)이 읽는 목록을 만든다.
// 패키지를 더하거나 올린 뒤 `pnpm licenses:generate` 로 다시 만들고 함께 커밋한다.
//
// 웹의 /licenses/ 정적 페이지(scripts/fix-web-export.mjs)와 같은 collectLicenses() 를 써서 두 목록이 갈라지지 않게 한다.
// MIT 처럼 같은 전문이 수백 번 겹쳐 앱 번들이 커지므로, 전문은 texts 에 한 번씩만 두고 패키지는 그 번호(t)만 든다.
import { readFileSync, writeFileSync } from 'node:fs'
import { collectLicenses } from './static-pages.mjs'

const OUT = 'src/constants/openSourceLicenses.json'

const fonts = [
  {
    name: 'Pretendard',
    versions: [],
    license: 'SIL Open Font License 1.1',
    author: 'Kil Hyung-jin',
    homepage: 'https://github.com/orioncactus/pretendard',
    text: readFileSync('assets/fonts/Pretendard-LICENSE.txt', 'utf8').trim(),
  },
]

const texts = []
const textIndex = new Map()
function textId(text) {
  if (!text) return -1
  if (!textIndex.has(text)) {
    textIndex.set(text, texts.length)
    texts.push(text)
  }
  return textIndex.get(text)
}

const compact = ({ name, versions, license, author, homepage, text }) => ({
  n: name,
  v: versions.join(', '),
  l: license,
  a: author,
  h: /^https?:\/\//.test(homepage) ? homepage : '',
  t: textId(text),
})

const data = {
  fonts: fonts.map(compact),
  packages: collectLicenses().map(compact),
  texts,
}

writeFileSync(OUT, JSON.stringify(data) + '\n')
console.log(`[generate-licenses] ${OUT}: 패키지 ${data.packages.length}개, 글꼴 ${data.fonts.length}개, 전문 ${texts.length}종`)
