import { API_BASE_URL, apiRequest } from './client'

/**
 * 물어보기 서버에 묻는 자격. 웹 /dev/ask 는 운영진 암호키(devKey), 앱 '물어보기' 탭(BETA)은 로그인 토큰(accessToken).
 * 토큰이면 401 에 앱 전역 재발급을 쓰고, 암호키면 쓰지 않는다(키가 틀린 건 로그인 만료가 아니다).
 */
export type AskAuth = { devKey: string } | { accessToken: string }

function authOptions(auth: AskAuth): { headers?: Record<string, string>; accessToken?: string; skipTokenRefresh: boolean } {
  return 'devKey' in auth
    ? { headers: { 'X-Ask-Dev-Key': auth.devKey }, skipTokenRefresh: true }
    : { accessToken: auth.accessToken, skipTokenRefresh: false }
}

function authHeaders(auth: AskAuth): Record<string, string> {
  return 'devKey' in auth ? { 'X-Ask-Dev-Key': auth.devKey } : { Authorization: `Bearer ${auth.accessToken}` }
}

/** 앱 탭 상태(GET /ask/status). remaining 은 오늘 이 계정이 더 물을 수 있는 수, soldOut 은 전체 하루 상한이 찼는지. */
export interface AskStatus {
  enabled: boolean
  loggedIn: boolean
  limit: number
  remaining: number
  soldOut: boolean
}

export function getAskStatus(accessToken: string | null, signal?: AbortSignal): Promise<AskStatus> {
  return apiRequest<AskStatus>('/ask/status', { accessToken, signal })
}

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
  /**
   * 답 아래 소제목별 목록·표 — 서버가 구조로 준다(표는 열 4개·행 12개까지). 없으면(옛 서버) 앱이 answer 글을 잘라 그린다.
   * answer 는 이때 요약 1~3문장만 담는다.
   */
  sections?: { title: string; items: string[]; ordered: boolean; table: { head: string[]; rows: string[][] } | null }[]
  /** 이 답의 서버 기록 id — '해결됐나요' 응답을 붙일 때 쓴다(기록이 꺼졌으면 없음). */
  logId?: number | null
}

/**
 * 물어보기 서버 답(POST /ask/route, 개발 중 — 웹 /dev/ask 에서만). 서버가 질문에 맞는 안내를 고르고 그 안내 원문 안에서만 답을 쓴다.
 * hint 는 앱 낱말 찾기가 고른 안내(참고용). auth 는 /dev 암호키(서버는 그 SHA-256 만 비교한다) 또는 앱 로그인 토큰.
 * 실패하면 부르는 쪽이 낱말 찾기로 돌아간다. 답 쓰기는 안내를 더 찾아보느라 여러 번 부를 수 있어 넉넉히 기다린다.
 */
export function routeAsk(
  question: string,
  history: AskRouteTurn[],
  auth: AskAuth,
  hint?: string,
  signal?: AbortSignal,
  conversationId?: string,
): Promise<AskRouteResult> {
  return apiRequest<AskRouteResult>('/ask/route', {
    method: 'POST',
    body: { question, hint, history, conversationId },
    ...authOptions(auth),
    timeoutMs: 45_000,
    retries: 0,
    signal,
  })
}

/** 흘려받기 진행 이벤트(서버가 실제로 한 일만). done 은 routeAsk 응답과 같은 모양. */
export type AskStreamEvent =
  | { event: 'retrieved'; data: { count: number } }
  | { event: 'picked'; data: { titles: string[] } }
  | { event: 'search' | 'noticeSearch' | 'facilitySearch'; data: { query: string } }
  | { event: 'read'; data: { titles: string[] } }
  | { event: 'noticeRead'; data: { title: string } }
  | { event: 'cafeteria'; data: { date: string } }
  | { event: 'thinking'; data: { afterTools: boolean } }
  | { event: 'writing' | 'reset'; data: Record<string, never> }
  | { event: 'delta'; data: { text: string } }

/**
 * 물어보기 답 흘려받기(POST /ask/route/stream, SSE). 진행·답 글자를 onEvent 로 넘기고 마지막 결과를 돌려준다.
 * 웹 fetch 의 ReadableStream 이 없거나(일부 네이티브) 연결이 안 되면 throw — 부르는 쪽이 routeAsk 나 낱말 찾기로 돌아간다.
 * signal 로 학생이 멈춤을 누르면 바로 끊는다(서버는 끊긴 연결에 더 보내지 않는다).
 */
export async function streamAsk(
  question: string,
  history: AskRouteTurn[],
  auth: AskAuth,
  hint: string | undefined,
  onEvent: (event: AskStreamEvent) => void,
  signal?: AbortSignal,
  conversationId?: string,
): Promise<AskRouteResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
  const stop = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', stop)
  try {
    const response = await fetch(`${API_BASE_URL}/ask/route/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...authHeaders(auth) },
      body: JSON.stringify({ question, hint, history, conversationId }),
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
    signal?.removeEventListener('abort', stop)
  }
}

/** '해결 안 됨'의 이유(한 번 누름, 11-06). 서버 AskFeedbackReason 과 같은 이름. */
export type AskFeedbackReason = 'WRONG' | 'OUTDATED' | 'OFF_TOPIC' | 'NOT_ENOUGH'

/** 이유 버튼 글자(순서대로 보인다). */
export const ASK_FEEDBACK_REASONS: { code: AskFeedbackReason; label: string }[] = [
  { code: 'WRONG', label: '틀린 정보예요' },
  { code: 'OUTDATED', label: '지난 정보예요' },
  { code: 'OFF_TOPIC', label: '물어본 것과 달라요' },
  { code: 'NOT_ENOUGH', label: '내용이 부족해요' },
]

/** 서버 답 기록에 '궁금한 점이 해결됐나요?' 응답(과 이유)을 붙인다(POST /ask/route/feedback). 실패해도 화면에는 영향이 없다. */
export function sendAskFeedback(
  logId: number,
  conversationId: string,
  resolved: boolean,
  auth: AskAuth,
  reason?: AskFeedbackReason,
): Promise<void> {
  return apiRequest<void>('/ask/route/feedback', {
    method: 'POST',
    body: { logId, conversationId, resolved, reason },
    ...authOptions(auth),
    retries: 0,
  })
}

/**
 * 앱 안내 흐름 답의 '해결됐나요' 응답(POST /ask/feedback, 익명 — 사람·계정을 보내지 않는다).
 * clientId 는 응답 한 번마다 만든 임의 값이라 이유를 고르며 다시 보내면 서버가 같은 행을 고친다. 실패해도 화면에는 영향이 없다.
 */
export function sendFlowFeedback(input: {
  question: string
  flowId: string
  nodeId: string
  resolved: boolean
  clientId: string
  reason?: AskFeedbackReason
}): Promise<void> {
  return apiRequest<void>('/ask/feedback', {
    method: 'POST',
    body: { ...input, question: input.question.slice(0, 200), outcome: 'FLOW' },
    skipTokenRefresh: true,
    retries: 0,
  })
}
