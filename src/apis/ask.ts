import { API_BASE_URL, apiRequest } from './client'

/** 직전 대화 한 턴. 질문, 그때 열린 안내(흐름/단계), 서버가 써 준 답(있으면). */
export interface AskRouteTurn {
  question: string
  nodeId?: string
  /** 서버가 써 준 답(1000자까지). '그래서 어떻게 해?' 같은 이어 묻기를 풀 때 쓴다. */
  answer?: string
}

export interface AskRouteResult {
  /** 대표 안내 '흐름 id/단계 id' 또는 'none'(맞는 안내 없음). 되묻기 단계면 앱이 버튼으로 되묻는다. */
  nodeId: string
  /** 답의 근거 안내들(대표 포함). */
  nodeIds: string[]
  /** 안내 원문 안에서만 쓴 답. 되묻기·none·답 쓰기 실패면 null — 앱이 원문 안내를 그대로 보인다. */
  answer: string | null
  /** 원문에서 확인한 답이면 true, 확인되지 않아 담당 부서를 안내한 답이면 false. */
  found: boolean | null
  catalogVersion: string
  /** 답의 근거로 쓴 학교 공지·학식(제목·원문 링크·게시일/날짜). */
  references?: { title: string; url: string | null; date: string | null }[]
  /** 답 카드 아래 버튼 — 근거 안내의 학교 페이지·담당 전화·위치(서버가 정한다). 없으면(옛 서버) 앱이 자기 안내 데이터에서 찾는다. */
  pages?: { title: string; url: string }[]
  phones?: { label: string; phone: string }[]
  facilityId?: string | null
}

/**
 * 물어보기 서버 답(POST /ask/route, 개발 중 — 웹 /dev/ask 에서만). 서버가 질문에 맞는 안내를 고르고 그 안내 원문 안에서만 답을 쓴다.
 * hint 는 앱 낱말 찾기가 고른 안내(참고용). devKey 는 /dev 게이트에 입력한 암호키(서버는 그 SHA-256 만 비교한다).
 * 실패하면 부르는 쪽이 낱말 찾기로 돌아간다. 답 쓰기는 안내를 더 찾아보느라 여러 번 부를 수 있어 넉넉히 기다린다.
 */
export function routeAsk(question: string, history: AskRouteTurn[], devKey: string, hint?: string): Promise<AskRouteResult> {
  return apiRequest<AskRouteResult>('/ask/route', {
    method: 'POST',
    body: { question, hint, history },
    headers: { 'X-Ask-Dev-Key': devKey },
    timeoutMs: 45_000,
    retries: 0,
    skipTokenRefresh: true,
  })
}

/** 흘려받기 진행 이벤트(서버가 실제로 한 일만). done 은 routeAsk 응답과 같은 모양. */
export type AskStreamEvent =
  | { event: 'picked'; data: { titles: string[] } }
  | { event: 'search' | 'noticeSearch'; data: { query: string } }
  | { event: 'read'; data: { titles: string[] } }
  | { event: 'noticeRead'; data: { title: string } }
  | { event: 'cafeteria'; data: { date: string } }
  | { event: 'writing' | 'reset'; data: Record<string, never> }
  | { event: 'delta'; data: { text: string } }

/**
 * 물어보기 답 흘려받기(POST /ask/route/stream, SSE). 진행·답 글자를 onEvent 로 넘기고 마지막 결과를 돌려준다.
 * 웹 fetch 의 ReadableStream 이 없거나(일부 네이티브) 연결이 안 되면 throw — 부르는 쪽이 routeAsk 나 낱말 찾기로 돌아간다.
 */
export async function streamAsk(
  question: string,
  history: AskRouteTurn[],
  devKey: string,
  hint: string | undefined,
  onEvent: (event: AskStreamEvent) => void,
): Promise<AskRouteResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
  try {
    const response = await fetch(`${API_BASE_URL}/ask/route/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-Ask-Dev-Key': devKey },
      body: JSON.stringify({ question, hint, history }),
      signal: controller.signal,
    })
    if (!response.ok || !response.body) throw new Error(`ask stream ${response.status}`)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let end = buffer.indexOf('\n\n')
      while (end >= 0) {
        const frame = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        end = buffer.indexOf('\n\n')
        let name = 'message'
        let data = ''
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) name = line.slice(6).trim()
          else if (line.startsWith('data:')) data += line.slice(5)
        }
        if (!data) continue
        const parsed = JSON.parse(data)
        if (name === 'done') return parsed as AskRouteResult
        if (name === 'error') throw new Error(parsed?.message ?? 'ask stream error')
        onEvent({ event: name, data: parsed } as AskStreamEvent)
      }
    }
    throw new Error('ask stream ended without result')
  } finally {
    clearTimeout(timer)
  }
}
