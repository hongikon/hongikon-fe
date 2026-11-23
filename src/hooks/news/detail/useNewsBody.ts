import { useMemo } from 'react'
import { formatNewsBody } from '../../../utils/news/newsBody'

/** NewsBody 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNewsBody({ text }: Pick<{ text: string }, 'text'>) {
  const blocks = useMemo(() => formatNewsBody(text), [text])
  return { blocks }
}
