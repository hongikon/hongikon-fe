import { Platform } from 'react-native'

export interface WheelItem<T> {
  value: T
  label: string
  /** 고를 수 없는 값(지난 시각 등). 흐리게 보이고, 멈추면 가장 가까운 고를 수 있는 칸으로 옮겨 간다. */
  disabled?: boolean
}

export const WHEEL_ITEM_HEIGHT = 44

export const DEFAULT_VISIBLE_ROWS = 5

/**
 * 웹: 스크롤이 이만큼(ms) 멈춰 있으면 가장 가까운 칸에 맞춘다(스냅 이벤트가 없다).
 * 앱: 손을 뗀 뒤 이만큼 관성·스냅이 시작되지 않으면 그 자리에서 맞춘다.
 */
export const SETTLE_DELAY_MS = 120

export const IS_WEB = Platform.OS === 'web'
