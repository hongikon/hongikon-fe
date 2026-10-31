import { Platform, Share } from 'react-native'

export type ShareResult = 'shared' | 'copied' | 'dismissed' | 'failed'

/**
 * OS 공유 창을 연다(제보·공지 공유가 함께 쓴다). `message` 끝 줄이 `url` 이어야 한다.
 * 웹은 `navigator.share` 가 있으면 그걸, 없으면(데스크톱 크롬 등) 클립보드에 복사한다.
 */
export async function shareLink({
  title,
  message,
  url,
  dialogTitle,
}: {
  title: string
  message: string
  url: string
  dialogTitle: string
}): Promise<ShareResult> {
  const withoutUrl = message.replace(`\n${url}`, '')
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: unknown }) : undefined
    if (nav && typeof nav.share === 'function') {
      try {
        // 링크는 url 로 따로 준다 — 문구 끝에도 있으면 메신저에 두 번 붙는다.
        await (nav.share as (data: { title?: string; text?: string; url?: string }) => Promise<void>)({ title, text: withoutUrl, url })
        return 'shared'
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return 'dismissed'
      }
    }
    try {
      await navigator.clipboard.writeText(message)
      return 'copied'
    } catch {
      return 'failed'
    }
  }
  try {
    // iOS 는 message + url 을 따로 주면 링크 미리보기가 붙는다. 안드로이드는 message 만 쓴다(링크 포함).
    const result = await Share.share(
      Platform.OS === 'ios' ? { message: withoutUrl, url, title } : { message, title },
      { dialogTitle, subject: title },
    )
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared'
  } catch {
    return 'failed'
  }
}
