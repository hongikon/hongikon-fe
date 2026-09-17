/** 로그인 백엔드(hongikon-be) 주소. .env 의 EXPO_PUBLIC_API_BASE_URL 로 채운다. */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

/** 일반 요청 제한 시간. 캠퍼스 와이파이가 붙었다 끊겼다 할 때 무한정 멈춰 있지 않게 한다. */
const DEFAULT_TIMEOUT_MS = 10_000
/** 사진 업로드는 느린 망에서 10초를 쉽게 넘겨 따로 넉넉히 준다. */
const UPLOAD_TIMEOUT_MS = 30_000
/** 자동 재시도 횟수(첫 시도 제외). 총 3번까지 시도한다. */
const DEFAULT_RETRIES = 2
const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 4_000
/** 서버가 Retry-After 로 오래 기다리라고 해도 화면이 그만큼 멈춰 있으면 안 되어 상한을 둔다. */
const RETRY_AFTER_MAX_MS = 5_000
/** 개발용으로만 남기는 서버 응답 원문 길이 상한. */
const DEV_DETAIL_MAX_LENGTH = 300

/** 네트워크가 불안정할 때 흔히 나오는 "잠깐 뒤에 다시 하면 되는" 상태 코드. */
const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504])
/**
 * 같은 요청을 여러 번 보내도 결과가 같은 메서드만 기본 재시도한다.
 * POST 는 응답만 못 받았을 뿐 서버에선 이미 처리됐을 수 있어(제보 중복 등록,
 * 1회용 로그인 코드 재사용) 호출부가 명시적으로 허락할 때만 다시 보낸다.
 */
const IDEMPOTENT_METHODS = new Set<HttpMethod>(['GET', 'PUT', 'DELETE'])

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * 서버가 응답은 했지만 실패한 경우.
 * `message` 는 사용자에게 그대로 보여줘도 되는 한국어 문구다. 서버 원문(HTML 오류
 * 페이지·스택 트레이스·내부 경로가 섞일 수 있다)은 개발 빌드에서만 `devDetail` 에 남긴다.
 */
export class ApiError extends Error {
  status: number
  /** 개발 빌드에서만 채워진다. 화면에 노출하지 않는다. */
  devDetail?: string

  constructor(status: number, message: string, devDetail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    if (__DEV__ && devDetail) this.devDetail = devDetail
  }
}

/**
 * 응답 자체를 받지 못한 경우(오프라인, DNS 실패, 시간 초과).
 * 서버 오류와 따로 둬야 화면이 "연결 불량 → 다시 시도" 안내를 고를 수 있다.
 */
export class NetworkError extends Error {
  kind: 'offline' | 'timeout'

  constructor(kind: 'offline' | 'timeout', message?: string) {
    super(
      message ??
        (kind === 'timeout'
          ? '서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.'
          : '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.'),
    )
    this.name = 'NetworkError'
    this.kind = kind
  }
}

/** 호출부가 스스로 취소(화면 이탈 등)한 요청. 사용자에게 오류로 보여주지 않는다. */
export class RequestCancelledError extends Error {
  constructor() {
    super('요청이 취소되었습니다.')
    this.name = 'RequestCancelledError'
  }
}

/** 백엔드 주소 미설정. 네트워크 문제가 아니라 빌드 설정 문제라 따로 구분한다. */
class ConfigError extends Error {
  constructor() {
    super('백엔드 서버 주소가 설정되지 않았습니다. .env 의 EXPO_PUBLIC_API_BASE_URL을 확인해주세요.')
    this.name = 'ConfigError'
  }
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError
}

export function isCancelledError(error: unknown): error is RequestCancelledError {
  return error instanceof RequestCancelledError
}

/**
 * 사용자가 "다시 시도"를 눌러 볼 만한 실패인지. 로그인 만료·입력 오류 같은 4xx 는
 * 몇 번을 다시 보내도 결과가 같으니 버튼을 띄우지 않는다.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) return true
  if (error instanceof ApiError) return RETRYABLE_STATUSES.has(error.status) || error.status >= 500
  return false
}

/**
 * 화면에 띄울 문구를 고른다. 이 모듈이 만든 오류만 문구를 믿고, 그 밖의 예외
 * (런타임 TypeError 등 영어 원문)는 호출부가 준 기본 문구로 바꾼다.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof ApiError ||
    error instanceof NetworkError ||
    error instanceof ConfigError
  ) {
    return error.message
  }
  return fallback
}

/** 상태 코드별 사용자 문구. 서버 본문 대신 이걸 보여준다. */
function friendlyMessageForStatus(status: number): string {
  if (status === 400 || status === 422) return '요청 내용을 확인한 뒤 다시 시도해주세요.'
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해주세요.'
  if (status === 403) return '이 작업을 할 권한이 없습니다.'
  if (status === 404) return '요청한 정보를 찾을 수 없습니다.'
  if (status === 408) return '서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.'
  if (status === 409) return '이미 처리된 요청입니다.'
  if (status === 413) return '보내는 파일이 너무 큽니다. 더 작은 파일로 다시 시도해주세요.'
  if (status === 429) return '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.'
  if (status === 502 || status === 503 || status === 504) {
    return '서버와 연결이 원활하지 않습니다. 잠시 후 다시 시도해주세요.'
  }
  if (status >= 500) return '서버에 일시적인 문제가 생겼습니다. 잠시 후 다시 시도해주세요.'
  return `요청을 처리하지 못했습니다 (${status})`
}

/**
 * 요청 한 건의 결과를 연결 상태 감시(`src/lib/connectivity.ts`)에 알린다.
 * client 가 그 모듈을 직접 import 하면 순환 참조가 생겨(그쪽이 핑에 apiRequest 를 쓴다)
 * 구독 방식으로 뒤집었다.
 * - reachable: 서버가 응답했다(상태 코드와 무관)
 * - unreachable: 응답을 못 받았거나 게이트웨이/프록시가 백엔드에 닿지 못했다(502/503/504)
 */
export type RequestOutcome = 'reachable' | 'unreachable'
type OutcomeListener = (outcome: RequestOutcome) => void
const outcomeListeners = new Set<OutcomeListener>()

export function subscribeRequestOutcome(listener: OutcomeListener): () => void {
  outcomeListeners.add(listener)
  return () => {
    outcomeListeners.delete(listener)
  }
}

function emitOutcome(outcome: RequestOutcome): void {
  outcomeListeners.forEach((listener) => {
    try {
      listener(outcome)
    } catch {
      // 감시 쪽 오류가 실제 요청 결과를 망치면 안 된다.
    }
  })
}

export interface ApiRequestOptions {
  method?: HttpMethod
  body?: unknown
  /** 있으면 Authorization: Bearer 로 붙인다. */
  accessToken?: string | null
  /** 요청 한 번의 제한 시간(ms). 재시도마다 새로 잰다. */
  timeoutMs?: number
  /**
   * 자동 재시도 횟수. 생략하면 멱등 메서드(GET/PUT/DELETE)는 2, 그 외는 0.
   * POST/PATCH 에 양수를 주는 건 "중복 처리돼도 괜찮다"는 호출부의 명시적 선언이다.
   */
  retries?: number
  /** 화면을 떠나는 등 호출부가 더는 결과가 필요 없을 때 끊는다. */
  signal?: AbortSignal
}

/**
 * path 는 반드시 API_BASE_URL 뒤에 붙는 상대 경로여야 한다.
 * `//evil.com`, `https://...` 같은 값이 섞이면 토큰이 다른 호스트로 새어 나갈 수 있어 막는다.
 */
function buildUrl(path: string): string {
  if (!API_BASE_URL) throw new ConfigError()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://') || path.includes('\\')) {
    throw new Error('잘못된 요청 경로입니다.')
  }
  return `${API_BASE_URL}${path}`
}

/** 로그에는 쿼리 문자열(검색어·식별자 등)을 빼고 경로만 남긴다. */
function pathForLog(path: string): string {
  return path.split('?')[0]
}

function devLog(message: string): void {
  if (__DEV__) console.warn(`[api] ${message}`)
}

/** 지수 백오프 + full jitter. 여러 기기가 동시에 끊겼다 붙을 때 한꺼번에 몰리지 않게 흩는다. */
function backoffDelay(attempt: number): number {
  const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt)
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2))
}

/** Retry-After 는 초 단위 숫자 또는 HTTP 날짜. 해석 못 하면 null, 해석되면 상한 안으로 자른다. */
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.min(ms, RETRY_AFTER_MAX_MS)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RequestCancelledError())
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new RequestCancelledError())
    }
    signal?.addEventListener('abort', onAbort)
  })
}

async function readDevDetail(response: Response): Promise<string | undefined> {
  if (!__DEV__) return undefined
  const text = await response.text().catch(() => '')
  return text.slice(0, DEV_DETAIL_MAX_LENGTH) || undefined
}

interface SendOptions {
  method: HttpMethod
  headers: Record<string, string>
  /** 문자열/FormData 라 재시도 때 그대로 다시 보낼 수 있다. */
  body?: BodyInit
  timeoutMs: number
  retries: number
  signal?: AbortSignal
}

/**
 * 제한 시간·재시도·오류 분류를 한 곳에서 처리한다.
 * 성공한 Response 만 돌려주고, 실패는 전부 ApiError / NetworkError / RequestCancelledError 로 바꾼다.
 */
async function send(path: string, options: SendOptions): Promise<Response> {
  const url = buildUrl(path)
  const { method, headers, body, timeoutMs, retries, signal } = options

  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new RequestCancelledError()

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    // AbortSignal.any 는 Hermes 에 없어 손으로 이어 붙인다.
    const forwardAbort = () => controller.abort()
    signal?.addEventListener('abort', forwardAbort)

    let response: Response | null = null
    let failure: ApiError | NetworkError
    let retryAfterMs: number | null = null

    try {
      response = await fetch(url, { method, headers, body, signal: controller.signal })
    } catch {
      response = null
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', forwardAbort)
    }

    if (response === null) {
      if (signal?.aborted && !timedOut) throw new RequestCancelledError()
      failure = new NetworkError(timedOut ? 'timeout' : 'offline')
      emitOutcome('unreachable')
    } else if (response.ok) {
      emitOutcome('reachable')
      return response
    } else {
      const { status } = response
      emitOutcome(status === 502 || status === 503 || status === 504 ? 'unreachable' : 'reachable')
      retryAfterMs = status === 429 || status === 503 ? parseRetryAfter(response.headers.get('Retry-After')) : null
      failure = new ApiError(status, friendlyMessageForStatus(status), await readDevDetail(response))
    }

    const canRetry =
      attempt < retries &&
      (failure instanceof NetworkError || RETRYABLE_STATUSES.has(failure.status))

    devLog(
      `${method} ${pathForLog(path)} 실패 (${failure instanceof ApiError ? failure.status : failure.kind}` +
        `, 시도 ${attempt + 1}/${retries + 1}${canRetry ? ', 재시도 예정' : ''})`,
    )

    if (!canRetry) throw failure

    await sleep(retryAfterMs ?? backoffDelay(attempt), signal)
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const text = await response.text().catch(() => {
    throw new NetworkError('offline')
  })
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    // 프록시가 200 으로 HTML 을 돌려주는 경우 등. 원문은 화면에 내보내지 않는다.
    throw new ApiError(response.status, '서버 응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.', text.slice(0, DEV_DETAIL_MAX_LENGTH))
  }
}

/**
 * 파일 업로드 전용. `apiRequest` 와 나눈 이유는 Content-Type 때문이다.
 * multipart 는 경계 문자열(boundary)을 런타임이 직접 붙여야 해서, 헤더를
 * 손으로 지정하면 오히려 깨진다.
 *
 * POST 라 기본적으로 자동 재시도하지 않는다. 실패하면 사용자가 "다시 시도"로 직접 올린다.
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  accessToken: string,
  options: Pick<ApiRequestOptions, 'timeoutMs' | 'retries' | 'signal'> = {},
): Promise<T> {
  const response = await send(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
    timeoutMs: options.timeoutMs ?? UPLOAD_TIMEOUT_MS,
    retries: Math.max(0, options.retries ?? 0),
    signal: options.signal,
  })
  return parseJson<T>(response)
}

/**
 * 백엔드 호출 공통 래퍼.
 * EXPO_PUBLIC_API_BASE_URL 이 비어 있으면(백엔드 주소 미설정) 바로 에러로 안내한다.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken, timeoutMs, retries, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await send(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: Math.max(0, retries ?? (IDEMPOTENT_METHODS.has(method) ? DEFAULT_RETRIES : 0)),
    signal,
  })
  return parseJson<T>(response)
}
