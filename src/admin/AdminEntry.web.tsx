import { lazy, type ComponentType } from 'react'

/**
 * 웹 전용 관리자 진입점. `/admin` 에 들어왔을 때만 관리자 코드를 불러오도록 지연 로드한다.
 * 네이티브는 `AdminEntry.tsx`(null)가 쓰인다.
 */
const AdminEntry: ComponentType | null = lazy(() => import('./AdminApp'))

export default AdminEntry
