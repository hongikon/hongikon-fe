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
  /**
   * 토큰을 막 재발급받아 다시 보냈는데도 401 이 났다. 새 토큰이 무효일 리 없으니 토큰 문제가 아니라
   * 서버 쪽 사정(예: 없는 경로를 Spring `/error` 가 401 로 돌려주는 경우)이다.
   */
  afterTokenRefresh?: boolean
  /**
   * 400/409/422 응답 본문 `{ "message": "..." }` 의 문구. 서버가 사용자에게 보여 주려고 쓴 짧은 한국어 안내
   * (예: "자기 자신의 관리자 권한은 해제할 수 없어요.")만 담는다 — HTML·긴 원문은 버린다.
   * `message` 는 그대로 상태 코드별 문구라, 서버 문구를 보여 줄지는 호출부가 고른다.
   */
  serverMessage?: string

  constructor(status: number, message: string, devDetail?: string, serverMessage?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    if (__DEV__ && devDetail) this.devDetail = devDetail
    if (serverMessage) this.serverMessage = serverMessage
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
          ? '서버 응답이 늦어지고 있어요. 잠시 뒤 다시 시도해 주세요.'
          : '서버에 연결할 수 없어요. 네트워크 상태를 확인해 주세요.'),
    )
    this.name = 'NetworkError'
    this.kind = kind
  }
}

/** 호출부가 스스로 취소(화면 이탈 등)한 요청. 사용자에게 오류로 보여주지 않는다. */
export class RequestCancelledError extends Error {
  constructor() {
    super('요청이 취소됐어요.')
    this.name = 'RequestCancelledError'
  }
}

/** 백엔드 주소 미설정. 네트워크 문제가 아니라 빌드 설정 문제라 따로 구분한다. */
class ConfigError extends Error {
  constructor() {
    super('서버 주소가 설정되지 않아 연결할 수 없어요. 앱을 최신 버전으로 업데이트해 주세요.')
    this.name = 'ConfigError'
    if (__DEV__) console.warn('EXPO_PUBLIC_API_BASE_URL 이 비어 있다. .env 를 확인할 것.')
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
  if (status === 400 || status === 422) return '요청 내용을 확인한 뒤 다시 시도해 주세요.'
  if (status === 401) return '로그인이 만료됐어요. 다시 로그인해 주세요.'
  if (status === 403) return '이 작업을 할 권한이 없어요.'
  if (status === 404) return '요청한 정보를 찾을 수 없어요.'
  if (status === 408) return '서버 응답이 늦어지고 있어요. 잠시 뒤 다시 시도해 주세요.'
  if (status === 409) return '이미 처리된 요청이에요.'
  if (status === 413) return '보내는 파일이 너무 커요. 더 작은 파일로 다시 시도해 주세요.'
  if (status === 429) return '요청이 너무 잦아요. 잠시 뒤 다시 시도해 주세요.'
  if (status === 502 || status === 503 || status === 504) {
    return '서버와 연결이 원활하지 않아요. 잠시 뒤 다시 시도해 주세요.'
  }
  if (status >= 500) return '서버에 일시적인 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.'
  return `요청을 처리하지 못했어요 (${status})`
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
  /**
   * 401 이어도 앱 전역 재발급(`setTokenRefresher`)을 쓰지 않는다. 로그아웃 정리처럼 저장소 토큰을 이미 지워
   * 재발급이 의미 없거나, 호출부가 직접 재발급을 다루는 경우에 쓴다.
   */
  skipTokenRefresh?: boolean
  /** 추가 요청 헤더(예: 조회 수 중복 방지용 `X-Install-Id`). Authorization·Content-Type 은 여기서 덮어쓰지 않는다. */
  headers?: Record<string, string>
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

/** 서버 안내 문구를 믿고 꺼낼 상태 코드(입력·상태 검증 실패). */
// 403(정지 회원 안내)·404(서버가 직접 준 "없는 제보" — 경로 자체가 없으면 문구가 없다)·429(빈도 제한 안내)도 서버 문구를 읽는다.
const SERVER_MESSAGE_STATUSES = new Set([400, 403, 404, 409, 422, 429])
const SERVER_MESSAGE_MAX_LENGTH = 200

/** 실패 응답 본문에서 개발용 원문과(개발 빌드만) 사용자용 서버 문구(`{ message }`, 일부 상태 코드만)를 꺼낸다. */
async function readFailureBody(response: Response): Promise<{ devDetail?: string; serverMessage?: string }> {
  const wantsMessage = SERVER_MESSAGE_STATUSES.has(response.status)
  if (!__DEV__ && !wantsMessage) return {}
  const text = await response.text().catch(() => '')
  let serverMessage: string | undefined
  if (wantsMessage && text) {
    try {
      const parsed: unknown = JSON.parse(text)
      const message = parsed && typeof parsed === 'object' ? (parsed as { message?: unknown }).message : undefined
      if (
        typeof message === 'string' &&
        message.trim() &&
        message.length <= SERVER_MESSAGE_MAX_LENGTH &&
        !/[<>]/.test(message)
      ) {
        serverMessage = message.trim()
      }
    } catch {
      // JSON 이 아니면(프록시 HTML 등) 서버 문구는 없다.
    }
  }
  return { devDetail: __DEV__ ? text.slice(0, DEV_DETAIL_MAX_LENGTH) || undefined : undefined, serverMessage }
}

interface SendOptions {
  method: HttpMethod
  headers: Record<string, string>
  /** 문자열/FormData 라 재시도 때 그대로 다시 보낼 수 있다. */
  body?: BodyInit
  timeoutMs: number
  retries: number
  signal?: AbortSignal
  /** 304(Not Modified)도 성공으로 돌려준다. 조건부 요청(If-None-Match)을 보낸 호출부만 켠다. */
  allowNotModified?: boolean
}

/**
 * 제한 시간·재시도·오류 분류를 한 곳에서 처리한다.
 * 성공한 Response 만 돌려주고, 실패는 전부 ApiError / NetworkError / RequestCancelledError 로 바꾼다.
 */
async function send(path: string, options: SendOptions): Promise<Response> {
  const url = buildUrl(path)
  const { method, headers, body, timeoutMs, retries, signal, allowNotModified } = options

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
    } else if (response.ok || (allowNotModified && response.status === 304)) {
      emitOutcome('reachable')
      return response
    } else {
      const { status } = response
      emitOutcome(status === 502 || status === 503 || status === 504 ? 'unreachable' : 'reachable')
      retryAfterMs = status === 429 || status === 503 ? parseRetryAfter(response.headers.get('Retry-After')) : null
      const { devDetail, serverMessage } = await readFailureBody(response)
      failure = new ApiError(status, friendlyMessageForStatus(status), devDetail, serverMessage)
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
    throw new ApiError(response.status, '서버 응답을 해석하지 못했어요. 잠시 뒤 다시 시도해 주세요.', text.slice(0, DEV_DETAIL_MAX_LENGTH))
  }
}

/**
 * 액세스 토큰이 만료돼 401 이 났을 때 새 토큰을 받아 주는 함수. AuthContext 가 등록한다.
 * 받으면 새 액세스 토큰, 못 받으면(리프레시 토큰도 만료 등) null.
 */
export type TokenRefresher = (expiredAccessToken: string) => Promise<string | null>

let tokenRefresher: TokenRefresher | null = null

export function setTokenRefresher(refresher: TokenRefresher | null): void {
  tokenRefresher = refresher
}

/**
 * 토큰을 붙인 요청이 401 이면 한 번만 재발급받아 같은 요청을 다시 보낸다.
 * 액세스 토큰 수명이 30분이라, 이게 없으면 앱을 켜 둔 채 30분이 지나면 로그인이 필요한 기능이 전부 실패했다.
 * 401 은 서버가 요청을 처리하기 전(인증 필터)에 거절한 것이라 POST 를 다시 보내도 중복 처리되지 않는다.
 */
async function withTokenRefresh<T>(
  accessToken: string | null | undefined,
  run: (token: string | null | undefined) => Promise<T>,
  skipTokenRefresh = false,
): Promise<T> {
  try {
    return await run(accessToken)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !accessToken || !tokenRefresher || skipTokenRefresh) {
      throw error
    }
    const fresh = await tokenRefresher(accessToken)
    if (!fresh) throw error
    devLog('액세스 토큰 재발급 후 다시 요청')
    try {
      return await run(fresh)
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) retryError.afterTokenRefresh = true
      throw retryError
    }
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
  return withTokenRefresh(accessToken, async (token) => {
    const response = await send(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      timeoutMs: options.timeoutMs ?? UPLOAD_TIMEOUT_MS,
      retries: Math.max(0, options.retries ?? 0),
      signal: options.signal,
    })
    return parseJson<T>(response)
  })
}

/**
 * 백엔드 호출 공통 래퍼.
 * EXPO_PUBLIC_API_BASE_URL 이 비어 있으면(백엔드 주소 미설정) 바로 에러로 안내한다.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken, timeoutMs, retries, signal, skipTokenRefresh } = options

  return withTokenRefresh(accessToken, async (token) => {
    const headers: Record<string, string> = { ...(options.headers ?? {}), Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await send(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
      retries: Math.max(0, retries ?? (IDEMPOTENT_METHODS.has(method) ? DEFAULT_RETRIES : 0)),
      signal,
    })
    const result = await parseJson<T>(response)
    // send() 는 응답 머리(헤더)를 받으면 끊기 신호 연결을 푼다. 그 뒤 본문을 읽는 사이 호출부가 끊어도(필터를 바꿈 등)
    // 요청은 그대로 성공으로 끝나, 결과를 따로 거르지 않는 화면(관리 탭 목록 등)에 이전 조건의 목록이 덮어써졌다.
    if (signal?.aborted) throw new RequestCancelledError()
    return result
  }, skipTokenRefresh)
}

/**
 * 응답 헤더가 필요한 GET(ETag 등). `apiRequest` 와 같은 제한 시간·재시도·오류 분류를 쓰되,
 * 본문을 해석하지 않은 Response 를 그대로 돌려준다. 304 는 성공으로 돌려주며 본문이 없다.
 * 토큰을 붙이지 않는 공개 조회 전용이다.
 */
export async function apiGetRaw(
  path: string,
  options: Pick<ApiRequestOptions, 'timeoutMs' | 'retries' | 'signal' | 'headers'> = {},
): Promise<{ status: number; headers: Headers; json: <T>() => Promise<T> }> {
  const response = await send(path, {
    method: 'GET',
    headers: { ...(options.headers ?? {}), Accept: 'application/json' },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: Math.max(0, options.retries ?? 0),
    signal: options.signal,
    allowNotModified: true,
  })
  return {
    status: response.status,
    headers: response.headers,
    json: async <T,>() => {
      const result = await parseJson<T>(response)
      if (options.signal?.aborted) throw new RequestCancelledError()
      return result
    },
  }
}
