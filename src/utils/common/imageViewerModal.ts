import { Platform } from 'react-native'

/** 위·아래로 이만큼(px) 끌거나 빠르게 튕기면 닫는다. */
export const DRAG_CLOSE_DISTANCE = 80

export const DRAG_CLOSE_VELOCITY = 0.6

/**
 * iOS 는 사진 칸(확대용 ScrollView)·옆 넘기기 목록의 네이티브 끌기가 JS 끌기보다 먼저 손가락을 가져가,
 * PanResponder 로는 끌어 닫기가 되다 말다 했다(11-01). iOS 는 사진 칸을 세로로 당기는 네이티브 튕김으로 재고
 * (손을 뗄 때 당긴 거리·속도로 닫기), Android 는 PanResponder 로 끈다.
 */
export const NATIVE_PULL = Platform.OS === 'ios'
