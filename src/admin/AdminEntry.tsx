import type { ComponentType } from 'react'

/**
 * 네이티브용 빈 진입점. 별도 주소(`/admin`)로 여는 콘솔은 웹에만 있다 — 앱에서는 관리자 계정일 때
 * 하단 "관리" 탭(`AdminTabScreen`)으로 같은 화면들을 쓴다. 웹은 Metro 가 `AdminEntry.web.tsx` 를 대신 고른다.
 */
const AdminEntry: ComponentType | null = null

export default AdminEntry
