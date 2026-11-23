/** `scripts/generate-licenses.mjs` 가 만드는 한 줄. 전문은 texts[t] (없으면 -1). */
export interface LicenseEntry {
  n: string
  v: string
  l: string
  a: string
  h: string
  t: number
}

export interface LicenseData {
  fonts: LicenseEntry[]
  packages: LicenseEntry[]
  texts: string[]
}

export type Row = { kind: 'header'; title: string } | { kind: 'item'; key: string; entry: LicenseEntry }

/** 목록이 수백 KB 라 화면을 처음 열 때만 읽는다(앱 시작 때 파싱하지 않게). */
export let cached: LicenseData | null = null

export function loadLicenses(): LicenseData {
  if (!cached) cached = require('../../constants/openSourceLicenses.json') as LicenseData
  return cached
}
