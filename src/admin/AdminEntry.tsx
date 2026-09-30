import type { ComponentType } from 'react'

/**
 * 네이티브용 빈 진입점. 관리자 화면은 웹 전용이라 iOS/Android 번들에는 싣지 않는다.
 * 웹은 Metro 가 `AdminEntry.web.tsx` 를 대신 고른다.
 */
const AdminEntry: ComponentType | null = null

export default AdminEntry
