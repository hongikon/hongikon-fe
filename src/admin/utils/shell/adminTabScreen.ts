import { type ComponentProps } from 'react'
import { Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AdminSection } from '../../types'

/**
 * 앱 하단 "관리" 탭. 웹 `/admin` 콘솔의 화면들을 그대로 쓰되, 앱 로그인 토큰으로 요청하고(AdminAccessProvider)
 * 폰 너비에 맞춰 그린다(`AdminHostProvider value="app"` → 44pt 버튼·확인 창·가로 필터).
 * 탭 자체는 관리자일 때만 TabNavigator 에 붙는다.
 */

export const SECTIONS: { section: AdminSection; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { section: 'dashboard', label: '대시보드', icon: 'speedometer-outline' },
  { section: 'reports', label: '제보 검토', icon: 'flag-outline' },
  { section: 'comments', label: '신고 댓글', icon: 'chatbubbles-outline' },
  { section: 'feedback', label: '문의', icon: 'chatbox-ellipses-outline' },
  { section: 'askFeedback', label: '물어보기 피드백', icon: 'thumbs-down-outline' },
  { section: 'users', label: '회원', icon: 'people-outline' },
  { section: 'partners', label: '제휴업체', icon: 'pricetags-outline' },
  { section: 'facilities', label: '편의시설', icon: 'business-outline' },
  { section: 'exhibitions', label: '전시', icon: 'easel-outline' },
  { section: 'tools', label: '운영 도구', icon: 'construct-outline' },
]

/** 웹 관리 탭에서 마지막으로 본 섹션. 이 탭(sessionStorage)에만 두어 탭을 닫으면 지워진다. 네이티브는 쓰지 않는다. */
export const SECTION_STORAGE_KEY = 'hongikon_manage_section'

export function readSavedSection(): AdminSection {
  if (Platform.OS !== 'web') return 'dashboard'
  try {
    const saved = window.sessionStorage.getItem(SECTION_STORAGE_KEY)
    return SECTIONS.some((item) => item.section === saved) ? (saved as AdminSection) : 'dashboard'
  } catch {
    return 'dashboard'
  }
}

export function saveSection(section: AdminSection): void {
  if (Platform.OS !== 'web') return
  try {
    window.sessionStorage.setItem(SECTION_STORAGE_KEY, section)
  } catch {
    // 저장하지 못하면 새로고침 때 대시보드부터 연다.
  }
}
