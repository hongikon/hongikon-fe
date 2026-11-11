/**
 * 근처 제휴 알림(광고성 정보) 수신 동의 안내 문구와 2년 재확인 계산(정보통신망법 제50조 제8항, 시행령 제62조의3).
 * 화면·저장과 떼어 둔 순수 함수(테스트용). 띄우는 쪽은 `consentNotice.ts`.
 *
 * - 동의·거부·철회 결과 안내: 전송자 이름, 의사를 표시한 날짜, 처리 결과를 알린다.
 * - 2년마다 재확인: 전송자 이름, 수신에 동의한 날짜와 동의 사실, 유지하거나 철회하는 방법을 알린다.
 */

export const SENDER_NAME = '홍익온'

export type ConsentChange = 'consent' | 'withdraw' | 'nightConsent' | 'nightWithdraw'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 한국 시간 "2026년 11월 11일". */
export function kstDateLabel(ms: number): string {
  const d = new Date(ms + KST_OFFSET_MS)
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
}

/** 서버가 주는 동의 시각(KST ISO-8601, 오프셋이 없을 수 있다)을 ms 로. 못 읽으면 null. */
export function parseConsentAt(iso: string | null | undefined): number | null {
  if (!iso) return null
  const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}+09:00`
  const ms = Date.parse(withZone)
  return Number.isFinite(ms) ? ms : null
}

const WHAT: Record<ConsentChange, string> = {
  consent: '근처 제휴 알림(광고성 정보) 수신에 동의했어요.',
  withdraw: '근처 제휴 알림(광고성 정보) 수신을 거부했어요.',
  nightConsent: '밤 9시~다음 날 아침 8시 근처 제휴 알림(광고성 정보) 수신에 동의했어요.',
  nightWithdraw: '밤 9시~다음 날 아침 8시 근처 제휴 알림(광고성 정보) 수신 동의를 철회했어요.',
}

const RESULT: Record<ConsentChange, string> = {
  consent: '동의 처리를 마쳤어요.',
  withdraw: '수신 거부 처리를 마쳤어요. 이제 근처 제휴 알림을 보내지 않아요.',
  nightConsent: '동의 처리를 마쳤어요.',
  nightWithdraw: '철회 처리를 마쳤어요. 이 시간에는 보내지 않아요.',
}

const HOW_TO_OPT_OUT = '수신 거부: 홍익온 앱 설정 > 근처 제휴 알림에서 언제든 무료로 할 수 있어요.'

/** 동의·거부·철회 처리 결과 안내. */
export function consentResultNotice(change: ConsentChange, atMs: number): { title: string; message: string } {
  return {
    title: '광고성 정보 수신 처리 결과',
    message: [
      `전송자: ${SENDER_NAME}`,
      `일자: ${kstDateLabel(atMs)}`,
      `내용: ${WHAT[change]}`,
      `처리 결과: ${RESULT[change]}`,
      ...(change === 'withdraw' ? [] : ['', HOW_TO_OPT_OUT]),
    ].join('\n'),
  }
}

/** 2년마다 수신 동의 재확인 안내. */
export function consentReconfirmNotice(consentAtMs: number): { title: string; message: string } {
  return {
    title: '광고성 정보 수신 동의 확인',
    message: [
      `전송자: ${SENDER_NAME}`,
      `${kstDateLabel(consentAtMs)}에 근처 제휴 알림(광고성 정보) 수신에 동의하셨어요.`,
      '',
      '계속 받으려면 "계속 받기"를, 원하지 않으면 "수신 거부"를 눌러 주세요. 나중에도 홍익온 앱 설정 > 근처 제휴 알림에서 수신 거부할 수 있어요.',
    ].join('\n'),
  }
}

/** 달력 기준 n 년 뒤(2월 29일은 2월 28일로). */
function addYears(ms: number, years: number): number {
  const d = new Date(ms + KST_OFFSET_MS)
  const target = new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay))
  return target.getTime() - KST_OFFSET_MS
}

/**
 * 재확인 안내를 띄울 차례면 그 기준 시각(동의일로부터 2·4·6…년 되는 날), 아니면 null.
 * `lastNoticeAt`: 이 동의로 마지막 안내를 띄운 시각(없으면 null). 그 뒤로 새 2년이 지났을 때만 다시 띄운다.
 */
export function reconfirmDueAt(consentAtMs: number, nowMs: number, lastNoticeAt: number | null): number | null {
  let due: number | null = null
  for (let years = 2; ; years += 2) {
    const at = addYears(consentAtMs, years)
    if (at > nowMs) break
    due = at
  }
  if (due === null) return null
  return lastNoticeAt !== null && lastNoticeAt >= due ? null : due
}
