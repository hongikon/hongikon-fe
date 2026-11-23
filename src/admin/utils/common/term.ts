/**
 * 이용 불가·통행 제한 기간 입력(11-22). 관리자는 '2026-12-01' 또는 '2026-12-01 09:00' 으로 쓴다.
 * 서버에는 KST 'yyyy-MM-ddTHH:mm' 로 보낸다. 날짜만 쓰면 시작은 그날 00:00, 끝은 그날 23:59(그날 하루 내내).
 */

export type TermEdge = 'start' | 'end'

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/

/** 빈 글자면 null(지금부터 / 풀 때까지), 모양이 틀리면 'invalid', 아니면 'yyyy-MM-ddTHH:mm'. */
export function parseTermInput(value: string, edge: TermEdge): string | null | 'invalid' {
  const text = value.trim()
  if (!text) return null
  const m = PATTERN.exec(text)
  if (!m) return 'invalid'
  const [, y, mo, d, h, mi] = m
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) return 'invalid'
  if (h !== undefined && (Number(h) > 23 || Number(mi) > 59)) return 'invalid'
  const time = h !== undefined ? `${h}:${mi}` : edge === 'start' ? '00:00' : '23:59'
  return `${y}-${mo}-${d}T${time}`
}

/** 서버 값('yyyy-MM-ddTHH:mm') → 입력칸 글자. 하루 끝(23:59)·시작(00:00)은 날짜만 보여 준다. */
export function termToInput(value: string | null | undefined, edge: TermEdge): string {
  if (!value) return ''
  const [date, time = ''] = value.split('T')
  const hm = time.slice(0, 5)
  if ((edge === 'start' && hm === '00:00') || (edge === 'end' && hm === '23:59') || !hm) return date
  return `${date} ${hm}`
}

/** 기기 시각을 'yyyy-MM-ddTHH:mm' 로(관리자는 한국에서 쓴다 — 비교용). */
export function nowTerm(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`
}

/** 시작·끝 검증 문구들. 통과하면 빈 배열. */
export function termErrors(from: string | null | 'invalid', until: string | null | 'invalid', now: Date): string[] {
  const errors: string[] = []
  if (from === 'invalid') errors.push('시작은 2026-12-01 또는 2026-12-01 09:00 처럼 입력해 주세요.')
  if (until === 'invalid') errors.push('끝은 2026-12-01 또는 2026-12-01 18:00 처럼 입력해 주세요.')
  if (errors.length) return errors
  if (until && until < nowTerm(now)) errors.push('끝이 이미 지났어요. 앞으로의 시각을 고르거나 비워 주세요.')
  if (from && until && until <= from) errors.push('끝이 시작보다 뒤여야 해요.')
  return errors
}

/** 목록에 보이는 기간: '12-01 09:00 ~ 12-01 18:00', '지금 ~ 12-01', '12-03 ~ 풀 때까지'. */
export function termLabel(from: string | null | undefined, until: string | null | undefined): string {
  const short = (v: string, edge: TermEdge) => termToInput(v, edge).slice(5)
  return `${from ? short(from, 'start') : '지금'} ~ ${until ? short(until, 'end') : '풀 때까지'}`
}

/** 지금 기간의 어디인지(관리 목록 배지). */
export function termPhase(from: string | null | undefined, until: string | null | undefined, now: Date): 'upcoming' | 'active' | 'ended' {
  const t = nowTerm(now)
  if (from && t < from) return 'upcoming'
  if (until && t > until) return 'ended'
  return 'active'
}
