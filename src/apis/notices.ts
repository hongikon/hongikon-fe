import { apiRequest } from './client'

/** `GET /notices` 의 공지 하나. 시각은 UTC(존 없음) — parseServerTime 으로 읽는다. 백엔드 `NoticeResponse` 참고. */
export interface ServerNotice {
  id: number
  title: string
  body: string
  publishedAt: string
  /** 지금 앱을 켤 때 띄울 공지에만 붙는다. */
  popup?: { text: string; until: string }
}

/** 관리자 페이지에서 쓴 공지 중 게시 시각이 지난 것(최근 50개, 최근 게시 순). 로그인 없이 받는다. */
export async function getServerNotices(options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<ServerNotice[]> {
  const res = await apiRequest<{ notices: ServerNotice[] }>('/notices', {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    retries: 0,
  })
  return Array.isArray(res?.notices) ? res.notices : []
}
