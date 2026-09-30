// src/constants/partners.ts 의 PARTNERS 를 백엔드 스키마(MySQL)용 INSERT 문으로 변환한다.
//
//   node scripts/generate-partners-seed.mjs [출력경로]   (기본: partners_seed.sql)
//
// partners.id 는 AUTO_INCREMENT 라 슬러그 id 는 버리고, 각 업체 INSERT 직후
// LAST_INSERT_ID() 를 @pid 에 담아 partner_affiliations 에 연결한다.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcPath = resolve(root, 'src/constants/partners.ts')
const outPath = resolve(root, process.argv[2] ?? 'partners_seed.sql')

// partners.ts 는 타입 import 하나뿐이라 트랜스파일하면 의존성 없이 바로 평가된다.
const { outputText } = ts.transpileModule(readFileSync(srcPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const { PARTNERS } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

// schema.sql 의 컬럼 길이. 넘으면 INSERT 가 실패하거나 잘리므로 미리 경고한다.
const LIMITS = { name: 100, category: 30, benefit: 255, address: 255, map_icon: 20, link_label: 50, link_url: 500, affiliation: 50 }

// MySQL 기본 모드는 백슬래시도 이스케이프 문자로 해석하므로 함께 처리한다.
const sql = (v) =>
  v === undefined || v === null ? 'NULL' : `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`

const skipped = []
const warnings = []
const lines = [
  '-- 자동 생성: scripts/generate-partners-seed.mjs',
  `-- 원본: src/constants/partners.ts (${PARTNERS.length}개 항목)`,
  `-- 생성 시각: ${new Date().toISOString()}`,
  '',
  'SET NAMES utf8mb4;',
  'START TRANSACTION;',
  '',
]
let partnerRows = 0
let affiliationRows = 0

for (const p of PARTNERS) {
  const label = `${p.id ?? '(id 없음)'} ${p.name ?? ''}`.trim()
  if (!p.name || !p.category || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
    skipped.push(`${label} — name/category/lat/lng 누락`)
    continue
  }

  const row = {
    name: p.name,
    category: p.category,
    benefit: p.benefit,
    address: p.address,
    map_icon: p.mapIcon,
    link_label: p.link?.label,
    link_url: p.link?.url,
  }
  for (const [col, max] of Object.entries(LIMITS)) {
    if (typeof row[col] === 'string' && row[col].length > max)
      warnings.push(`${label} — ${col} 길이 ${row[col].length} > ${max}`)
  }

  lines.push(
    `-- ${p.id}`,
    'INSERT INTO partners (name, category, latitude, longitude, benefit, address, road_address, hours, contact, map_icon, link_label, link_url)',
    `VALUES (${sql(row.name)}, ${sql(row.category)}, ${p.lat}, ${p.lng}, ${sql(row.benefit)}, ${sql(row.address)}, NULL, NULL, NULL, ${sql(row.map_icon)}, ${sql(row.link_label)}, ${sql(row.link_url)});`,
    'SET @pid = LAST_INSERT_ID();',
  )
  partnerRows++

  const affiliations = p.affiliations ?? []
  if (affiliations.length === 0) warnings.push(`${label} — affiliations 비어 있음 (partner_affiliations row 없음)`)
  const exceptions = new Map((p.affiliationBenefits ?? []).map((e) => [e.affiliation, e.benefit]))
  for (const a of exceptions.keys()) {
    if (!affiliations.includes(a)) warnings.push(`${label} — affiliationBenefits 의 '${a}' 가 affiliations 에 없음 (무시됨)`)
  }

  const values = affiliations.map((a) => {
    const ex = exceptions.get(a)
    if (typeof ex === 'string' && ex.length > LIMITS.benefit)
      warnings.push(`${label} — ${a} 예외 benefit 길이 ${ex.length} > ${LIMITS.benefit}`)
    return `(@pid, ${sql(a)}, ${ex === undefined || ex === p.benefit ? 'NULL' : sql(ex)})`
  })
  if (values.length) {
    lines.push(`INSERT INTO partner_affiliations (partner_id, affiliation, benefit) VALUES\n  ${values.join(',\n  ')};`)
    affiliationRows += values.length
  }
  lines.push('')
}

lines.push('COMMIT;', '')
writeFileSync(outPath, lines.join('\n'), 'utf8')

console.log(`원본 항목: ${PARTNERS.length}`)
console.log(`partners INSERT: ${partnerRows}개`)
console.log(`partner_affiliations INSERT: ${lines.filter((l) => l.startsWith('INSERT INTO partner_affiliations')).length}개 문 / ${affiliationRows}개 row`)
console.log(`스킵: ${skipped.length}개`)
skipped.forEach((s) => console.log('  - ' + s))
console.log(`경고: ${warnings.length}개`)
warnings.forEach((w) => console.log('  - ' + w))
console.log(`출력: ${outPath}`)
