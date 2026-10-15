import type { ComponentType } from 'react'
import type { CampusPreviewKey } from './campusPreview'

/**
 * 네이티브용 빈 진입점. `/temp/*` 디버그 화면은 웹 전용이라 iOS/Android 번들에는 싣지 않는다.
 * 웹은 Metro 가 `TempDebugEntry.web.tsx` 를 대신 고른다(관리자 `AdminEntry` 와 같은 방식).
 */
export const TempEntranceDebugEntry: ComponentType<{ mode: 'dots' | 'paths' | 'nodes' }> | null = null
export const DevPathAuditEntry: ComponentType | null = null
/** 개발용 `/dev/path-survey` — 경로망 현장 조사. 웹 전용이라 네이티브에서는 null. */
export const DevPathSurveyEntry: ComponentType | null = null
export const DevCampusEntry: ComponentType<{ campus: CampusPreviewKey }> | null = null
export const TempNotificationPreviewEntry: ComponentType | null = null
