/** 로그인 백엔드(hongikon-be) 주소. .env 의 EXPO_PUBLIC_API_BASE_URL 로 채운다. */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** 있으면 Authorization: Bearer 로 붙인다. */
  accessToken?: string | null
}

/**
 * 백엔드 호출 공통 래퍼.
 * EXPO_PUBLIC_API_BASE_URL 이 비어 있으면(백엔드 주소 미설정) 바로 에러로 안내한다.
 */
/**
 * 파일 업로드 전용. `apiRequest` 와 나눈 이유는 Content-Type 때문이다.
 * multipart 는 경계 문자열(boundary)을 런타임이 직접 붙여야 해서, 헤더를
 * 손으로 지정하면 오히려 깨진다.
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  accessToken: string,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('백엔드 서버 주소가 설정되지 않았습니다. .env 의 EXPO_PUBLIC_API_BASE_URL을 확인해주세요.')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    })
  } catch {
    throw new Error('사진을 올리지 못했습니다. 네트워크 상태를 확인해주세요.')
  }

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new ApiError(response.status, message || `사진 업로드가 실패했습니다 (${response.status})`)
  }

  return (await response.json()) as T
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('백엔드 서버 주소가 설정되지 않았습니다. .env 의 EXPO_PUBLIC_API_BASE_URL을 확인해주세요.')
  }

  const { method = 'GET', body, accessToken } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.')
  }

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new ApiError(response.status, message || `요청이 실패했습니다 (${response.status})`)
  }

  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}
