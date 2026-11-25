import { GistErrorV3 } from './gist'

/** Only our own error text reaches the screen, so nothing else can carry the token there. */
export const failureText = (e: unknown) => (e instanceof GistErrorV3 ? e.message : '알 수 없는 오류로 동기화하지 못했어요.')
