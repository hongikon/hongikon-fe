// 앱 상수(제휴업체·편의시설·건물)를 백엔드로 옮기는 1회용 동기화 SQL 과, 같은 데이터를
// `GET /map/data` 응답 모양으로 담은 JSON(로컬 확인용 fixture)을 만든다.
//
//   npx tsx scripts/generate-map-data-sync.ts --sql <출력.sql> [--json <출력.json>]
//
// 규칙(지도 데이터 서버 이전 계약, 2026-10-06):
// - 한 트랜잭션. buildings 는 code 기준 UPDATE 만 한다 — reports·news 가 buildings.id 를 참조하므로
//   행을 지우거나 id 를 바꾸지 않는다. 앱 건물 이름은 아래 표(서버 짧은 이름 → code)로 code 를 찾는다.
//   못 찾는 건물이 하나라도 있으면 SQL 을 만들지 않고 실패한다.
// - partners / partner_affiliations 는 전부 지우고 앱 목록을 code(=앱 slug id)와 함께 다시 넣는다.
//   partner_affiliations.benefit 은 `affiliationBenefits` 의 예외 혜택만, 나머지는 NULL(=업체 기본 혜택).
// - campus_facilities 는 전부 지우고 앱 목록을 code(=앱 id)로 다시 넣는다.
// - 좌표·혜택은 사용자가 확인한 값이라 손대지 않고 그대로 옮긴다(숫자는 JS 표기 그대로 적는다).
//
// 이 스크립트는 상수 파일이 있던 커밋에서만 돌아간다(상수는 서버 이전 뒤 삭제됐다).

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { BUILDINGS } from '../src/constants/buildings'
import { FACILITIES } from '../src/constants/facilities'
import { PARTNERS } from '../src/constants/partners'

// ── 인자 ────────────────────────────────────────────────────────────
function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const sqlOut = argValue('--sql')
const jsonOut = argValue('--json')
if (!sqlOut) {
  throw new Error('사용법: npx tsx scripts/generate-map-data-sync.ts --sql <출력.sql> [--json <출력.json>]')
}

// ── 서버 건물 짧은 이름 → code (운영 `GET /buildings`, 2026-10-06 확인) ──────
// 서버 이름은 뉴스 장소 매칭(NewsLocationMatcher)이 부분 문자열로 쓰므로 바꾸지 않는다.
const SERVER_BUILDING_CODES: ReadonlyArray<readonly [string, string]> = [
  ['홍문관', 'hongik_r'],
  ['제1공학관', 'hongik_k'],
  ['체육관', 'hongik_gym'],
  ['제3공학관', 'hongik_j'],
  ['와우관', 'hongik_l'],
  ['운동장', 'hongik_field'],
  ['과학관', 'hongik_i'],
  ['중앙도서관', 'hongik_h'],
  ['학생회관', 'hongik_g'],
  ['제2공학관', 'hongik_p'],
  ['정보통신센터', 'hongik_q'],
  ['제4강의동', 'hongik_z4'],
  ['문헌관', 'hongik_mh'],
  ['미술학관', 'hongik_f'],
  ['제1강의동', 'hongik_z1'],
  ['조형관', 'hongik_e'],
  ['강당', 'hongik_s'],
  ['미술종합강의동', 'hongik_u'],
  ['제4공학관', 'hongik_t'],
  ['인문사회관 B동', 'hongik_b'],
  ['제3강의동', 'hongik_z3'],
  ['인문사회관 A동', 'hongik_a'],
  ['이천득관', 'hongik_z2'],
  ['제2기숙사', 'hongik_dorm2'],
  ['인문사회관 C동', 'hongik_c'],
  ['인문사회관 D동', 'hongik_d'],
  ['제3기숙사', 'hongik_dorm3'],
]

/** 앱 이름이 서버 이름과 같거나 "서버 이름 + 공백"으로 시작하면 같은 건물. 여럿이면 더 긴 서버 이름. */
function buildingCodeFor(appName: string): string | null {
  const candidates = SERVER_BUILDING_CODES.filter(([name]) => appName === name || appName.startsWith(`${name} `))
  if (candidates.length === 0) return null
  return candidates.reduce((best, c) => (c[0].length > best[0].length ? c : best))[1]
}

// ── 검증 도우미 ─────────────────────────────────────────────────────
const errors: string[] = []
const warnings: string[] = []

function checkLength(label: string, column: string, value: string | undefined | null, max: number): void {
  if (typeof value === 'string' && value.length > max) errors.push(`${label} — ${column} 길이 ${value.length} > ${max}`)
}

/** 숫자는 JS 표기(String) 그대로 적는다. 사용자 확인 값이라 반올림하지 않는다. */
function num(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'NULL'
  if (!Number.isFinite(value)) throw new Error(`유한하지 않은 숫자: ${value}`)
  return String(value)
}

/**
 * MySQL 문자열 리터럴. 기본 sql_mode 는 백슬래시를 이스케이프 문자로 읽으므로 먼저 두 배로 하고,
 * 작은따옴표는 '' 로 바꾼다. NUL 은 데이터에 있을 리 없어 들어 있으면 실패시킨다.
 */
function str(value: string | undefined | null): string {
  if (value === undefined || value === null) return 'NULL'
  if (value.includes('\0')) throw new Error(`NUL 문자가 든 문자열: ${JSON.stringify(value)}`)
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

/** JSON 컬럼 값. JSON.stringify 결과(항상 유효한 JSON)를 문자열 리터럴로 감싼다. */
function json(value: unknown): string {
  if (value === undefined || value === null) return 'NULL'
  return str(JSON.stringify(value))
}

/** DECIMAL(10,7) 컬럼은 소수 7자리를 넘으면 반올림해 저장한다 — 값이 바뀌니 알린다. */
function warnPrecision(label: string, lat: number | undefined, lng: number | undefined): void {
  const decimals = (n: number | undefined) => (n === undefined ? 0 : (String(n).split('.')[1] ?? '').length)
  if (decimals(lat) > 7 || decimals(lng) > 7) {
    warnings.push(`${label} — 좌표 소수 7자리 초과(${lat}, ${lng}): DECIMAL(10,7) 컬럼에 반올림 저장됨`)
  }
}

// ── 건물 ───────────────────────────────────────────────────────────
const usedCodes = new Map<string, string>()
const buildingRows = BUILDINGS.map((building, index) => {
  const code = buildingCodeFor(building.name)
  if (!code) {
    errors.push(`건물 '${building.name}' — 서버 code 를 찾지 못함`)
    return null
  }
  const other = usedCodes.get(code)
  if (other) errors.push(`건물 '${building.name}' — code ${code} 가 '${other}' 와 겹침`)
  usedCodes.set(code, building.name)

  const label = `건물 ${building.name}`
  checkLength(label, 'display_name', building.name, 100)
  checkLength(label, 'color', building.color, 9)
  checkLength(label, 'map_category', building.category, 20)
  checkLength(label, 'type', building.type, 50)
  checkLength(label, 'hours', building.hours, 100)
  checkLength(label, 'contact', building.contact, 50)
  checkLength(label, 'link_label', building.link?.label, 50)
  checkLength(label, 'link_url', building.link?.url, 500)
  warnPrecision(label, building.lat, building.lng)
  return { building, code, sortOrder: index + 1 }
})
const unusedCodes = SERVER_BUILDING_CODES.filter(([, code]) => !usedCodes.has(code)).map(([name, code]) => `${name}(${code})`)
if (unusedCodes.length) warnings.push(`앱에 대응 건물이 없는 서버 건물: ${unusedCodes.join(', ')} — 그대로 둔다`)

const codeByBuildingName = new Map<string, string>()
for (const row of buildingRows) if (row) codeByBuildingName.set(row.building.name, row.code)

// ── 제휴업체 ────────────────────────────────────────────────────────
const partnerCodes = new Set<string>()
for (const partner of PARTNERS) {
  const label = `제휴업체 ${partner.id} ${partner.name}`
  if (partnerCodes.has(partner.id)) errors.push(`${label} — id 중복`)
  partnerCodes.add(partner.id)
  checkLength(label, 'code', partner.id, 100)
  checkLength(label, 'name', partner.name, 100)
  checkLength(label, 'category', partner.category, 30)
  checkLength(label, 'benefit', partner.benefit, 255)
  checkLength(label, 'address', partner.address, 255)
  checkLength(label, 'hours', partner.hours, 100)
  checkLength(label, 'contact', partner.contact, 50)
  checkLength(label, 'map_icon', partner.mapIcon, 20)
  checkLength(label, 'link_label', partner.link?.label, 50)
  checkLength(label, 'link_url', partner.link?.url, 500)
  warnPrecision(label, partner.lat, partner.lng)
  const affiliations = partner.affiliations ?? []
  if (new Set(affiliations).size !== affiliations.length) errors.push(`${label} — affiliations 중복`)
  for (const exception of partner.affiliationBenefits ?? []) {
    checkLength(label, `${exception.affiliation} 예외 benefit`, exception.benefit, 255)
    if (!affiliations.includes(exception.affiliation)) {
      errors.push(`${label} — affiliationBenefits 의 '${exception.affiliation}' 가 affiliations 에 없음(옮기면 사라짐)`)
    }
    if (exception.benefit === partner.benefit) {
      warnings.push(`${label} — '${exception.affiliation}' 예외 혜택이 기본 혜택과 같아 NULL 로 넣음`)
    }
  }
}

// ── 편의시설 ────────────────────────────────────────────────────────
const facilityCodes = new Set<string>()
for (const facility of FACILITIES) {
  const label = `편의시설 ${facility.id}`
  if (facilityCodes.has(facility.id)) errors.push(`${label} — id 중복`)
  facilityCodes.add(facility.id)
  if (!codeByBuildingName.has(facility.buildingName)) errors.push(`${label} — 건물 '${facility.buildingName}' 을 찾지 못함`)
  if (facility.floor !== undefined && !Number.isInteger(facility.floor)) errors.push(`${label} — floor ${facility.floor} 가 정수가 아님(INT 컬럼)`)
  if ((facility.lat === undefined) !== (facility.lng === undefined)) errors.push(`${label} — lat/lng 중 하나만 있음`)
  checkLength(label, 'code', facility.id, 100)
  checkLength(label, 'kind', facility.kind, 20)
  checkLength(label, 'note', facility.note, 255)
  warnPrecision(label, facility.lat, facility.lng)
}

if (errors.length) {
  console.error(`동기화 SQL 을 만들지 않았습니다 — 오류 ${errors.length}개:`)
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
}

// ── SQL ─────────────────────────────────────────────────────────────
const lines: string[] = [
  '-- 자동 생성: hongikon-fe scripts/generate-map-data-sync.ts',
  `-- 원본: src/constants/buildings.ts(+buildingBoundaries.ts) ${BUILDINGS.length}동, partners.ts ${PARTNERS.length}곳, facilities.ts ${FACILITIES.length}건`,
  '-- 선행: db/alter_map_data_v1.sql (display_name·extra_boundaries·entrances·sort_order, partners.code, campus_facilities)',
  '-- 건물은 code 기준 UPDATE 만 한다(reports·news 가 buildings.id 를 참조). name(서버 짧은 이름)은 그대로 둔다.',
  '',
  'SET NAMES utf8mb4;',
  'START TRANSACTION;',
  '',
  '-- ===== buildings (UPDATE by code) =====',
]

for (const row of buildingRows) {
  if (!row) continue
  const { building: b, code, sortOrder } = row
  lines.push(
    `UPDATE buildings SET display_name = ${str(b.name)}, latitude = ${num(b.lat)}, longitude = ${num(b.lng)}, ` +
      `color = ${str(b.color)}, map_category = ${str(b.category)}, type = ${str(b.type)}, ` +
      `floors = ${num(b.floors)}, basement_floors = ${num(b.basementFloors)}, hours = ${str(b.hours)}, ` +
      `description = ${str(b.description)}, contact = ${str(b.contact)}, facilities = ${json(b.facilities)}, ` +
      `link_label = ${str(b.link?.label)}, link_url = ${str(b.link?.url)}, boundary = ${json(b.boundary)}, ` +
      `extra_boundaries = ${json(b.extraBoundaries)}, entrances = ${json(b.entrances)}, sort_order = ${sortOrder} ` +
      `WHERE code = ${str(code)};`,
  )
}

lines.push(
  '',
  '-- ===== partners / partner_affiliations (전부 지우고 다시 넣기) =====',
  'DELETE FROM partner_affiliations;',
  'DELETE FROM partners;',
  '',
)
let affiliationRowCount = 0
PARTNERS.forEach((p, index) => {
  lines.push(
    'INSERT INTO partners (code, name, category, latitude, longitude, benefit, address, road_address, hours, contact, map_icon, link_label, link_url, sort_order) VALUES ' +
      `(${str(p.id)}, ${str(p.name)}, ${str(p.category)}, ${num(p.lat)}, ${num(p.lng)}, ${str(p.benefit)}, ${str(p.address)}, NULL, ` +
      `${str(p.hours)}, ${str(p.contact)}, ${str(p.mapIcon)}, ${str(p.link?.label)}, ${str(p.link?.url)}, ${index + 1});`,
  )
  const exceptions = new Map((p.affiliationBenefits ?? []).map((e) => [e.affiliation as string, e.benefit]))
  for (const affiliation of p.affiliations ?? []) {
    const exception = exceptions.get(affiliation)
    const benefit = exception === undefined || exception === p.benefit ? null : exception
    lines.push(
      `INSERT INTO partner_affiliations (partner_id, affiliation, benefit) SELECT id, ${str(affiliation)}, ${str(benefit)} FROM partners WHERE code = ${str(p.id)};`,
    )
    affiliationRowCount++
  }
})

lines.push('', '-- ===== campus_facilities (전부 지우고 다시 넣기) =====', 'DELETE FROM campus_facilities;', '')
FACILITIES.forEach((f, index) => {
  const buildingCode = codeByBuildingName.get(f.buildingName) as string
  lines.push(
    'INSERT INTO campus_facilities (code, kind, building_id, floor, note, latitude, longitude, sort_order, created_at, updated_at) VALUES ' +
      `(${str(f.id)}, ${str(f.kind)}, (SELECT id FROM buildings WHERE code = ${str(buildingCode)}), ${num(f.floor)}, ${str(f.note)}, ` +
      `${num(f.lat)}, ${num(f.lng)}, ${index + 1}, NOW(6), NOW(6));`,
  )
})

lines.push(
  '',
  'COMMIT;',
  '',
  '-- 확인(기대값):',
  `--   SELECT COUNT(*) FROM buildings WHERE display_name IS NOT NULL;  -- ${buildingRows.length}`,
  `--   SELECT COUNT(*) FROM partners;                                   -- ${PARTNERS.length}`,
  `--   SELECT COUNT(*) FROM partner_affiliations;                       -- ${affiliationRowCount}`,
  `--   SELECT COUNT(*) FROM campus_facilities;                          -- ${FACILITIES.length}`,
  '',
)

writeFileSync(resolve(sqlOut), lines.join('\n'), 'utf8')

// ── /map/data 모양 fixture ─────────────────────────────────────────
// 서버 응답처럼 값이 없는 필드는 뺀다. 건물 id 는 운영 DB 의 buildings.id 가 시드 순서(=앱 순서)로
// 1~27 이라 같은 값을 넣는다(로컬 확인용).
if (jsonOut) {
  const fixture = {
    version: 'fixture',
    buildings: buildingRows.map((row) => (row ? { id: row.sortOrder, code: row.code, ...row.building } : null)),
    facilities: FACILITIES,
    partners: PARTNERS,
  }
  writeFileSync(resolve(jsonOut), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')
}

console.log(`건물 UPDATE: ${buildingRows.length}동`)
console.log(`partners INSERT: ${PARTNERS.length}곳 / partner_affiliations: ${affiliationRowCount}행`)
console.log(`campus_facilities INSERT: ${FACILITIES.length}건`)
console.log(`경고: ${warnings.length}개`)
warnings.forEach((w) => console.log(`  - ${w}`))
console.log(`SQL: ${resolve(sqlOut)}`)
if (jsonOut) console.log(`fixture: ${resolve(jsonOut)}`)
