import { COMMENTS_PREVIEW_SIZE } from '../../../../apis/comments'

/** 숨긴 사용자·지운 댓글 자리를 빼고도 미리보기를 채우도록 조금 더 받는다. */
export const PREVIEW_FETCH_SIZE = COMMENTS_PREVIEW_SIZE + 3

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string; network: boolean; retryable: boolean }
  /** 서버에 댓글 기능이 없거나(배포 전) 이 제보가 더는 공개 상태가 아니다 → 댓글 칸을 감춘다. */
  | { kind: 'unavailable' }
