/**
 * 관리자 화면 공통 부품. 앱 화면과 섞이지 않게 이 폴더 안에서만 쓴다.
 * 부품은 `ui/` 아래 파일로 나눠 두고, 여기서 한꺼번에 다시 내보낸다(기존 `from '../ui'` import 를 그대로 쓴다).
 */
export { AdminHostProvider, AdminScrollProvider, useAdminHost, type AdminHost, type AdminScrollHandle } from './ui/host'
export { ADMIN_COLORS, adminText, type Tone } from './ui/theme'
export { Badge } from './ui/Badge'
export { Button } from './ui/Button'
export { Card, LabelValue, ScreenHeader } from './ui/layout'
export { EmptyState, InlineError, Loading } from './ui/status'
export { FilterTabs } from './ui/FilterTabs'
export { ConfirmBar } from './ui/ConfirmBar'
