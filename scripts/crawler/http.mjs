// 재시도 + 타임아웃 + 요청 간 딜레이를 붙인 fetch 래퍼.
// Node 18+ 내장 fetch / AbortSignal.timeout 만 사용한다.

import { MAX_RETRIES, REQUEST_DELAY_MS, REQUEST_TIMEOUT_MS, USER_AGENT } from './config.mjs'

const NO_RETRY_MARK = '재시도하지 않음'

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * URL 하나를 텍스트로 가져온다.
 * 5xx/네트워크 오류는 지수 백오프로 재시도하고, 4xx 는 재시도해도 소용없으므로 즉시 포기한다.
 */
export async function fetchText(url, { retries = MAX_RETRIES } = {}) {
  let lastError = new Error(`요청 실패 — ${url}`)

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status} (${NO_RETRY_MARK}) — ${url}`)
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} — ${url}`)
      }

      return await response.text()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (lastError.message.includes(NO_RETRY_MARK) || attempt === retries) break
      await sleep(REQUEST_DELAY_MS * 2 ** attempt)
    }
  }

  throw new Error(`수집 실패 — ${lastError.message}`)
}

/** 목록/상세 요청 사이에 넣는 고정 딜레이. */
export function politeDelay() {
  return sleep(REQUEST_DELAY_MS)
}
