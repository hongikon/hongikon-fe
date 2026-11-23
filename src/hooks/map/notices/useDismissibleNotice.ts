import { useCallback } from 'react'
import type { Props } from '../../../components/map/notices/DismissibleNotice'

/** DismissibleNotice 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useDismissibleNotice({ message, onDismiss }: Pick<Props, 'message' | 'onDismiss'>) {
  const dismiss = useCallback(() => onDismiss(message), [onDismiss, message])
  return { dismiss }
}
