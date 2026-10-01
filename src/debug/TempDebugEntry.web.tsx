import { lazy, type ComponentType } from 'react'

/**
 * 웹 전용 `/temp/*` 디버그 화면 진입점. 해당 경로로 들어왔을 때만 지연 로드해, 일반 화면을 여는
 * 사용자는 디버그 화면 코드를 받지 않는다. 네이티브는 `TempDebugEntry.tsx`(null)가 쓰인다.
 */
export const TempEntranceDebugEntry: ComponentType<{ mode: 'dots' | 'paths' | 'nodes' }> | null = lazy(
  () => import('../screens/TempEntranceDebugScreen'),
)
export const TempNotificationPreviewEntry: ComponentType | null = lazy(
  () => import('../screens/TempNotificationPreviewScreen'),
)
