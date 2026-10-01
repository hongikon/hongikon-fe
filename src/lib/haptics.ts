import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

/**
 * 짧은 진동(햅틱) 피드백. 스위치·칩 선택, 제출 성공, 당겨서 새로고침처럼 "눌렀다/됐다"를 손끝으로
 * 알려줄 때만 아껴 쓴다.
 *
 * 왜 `expo-haptics` 를 바로 import 하지 않나:
 * 이미 깔린 앱은 OTA(runtimeVersion = appVersion, 같은 1.0.0)로 새 JS 만 받는다. 그 바이너리에는
 * ExpoHaptics 네이티브 모듈이 없다. 모듈을 정적으로 불러오다 실패하면 import 시점에 앱 전체가 죽으므로,
 * 여기서는 `expo-haptics` 의 JS 를 아예 쓰지 않고 처음 부를 때 네이티브 모듈을 "있으면" 꺼내 쓴다.
 * - `requireOptionalNativeModule` 은 모듈이 없으면 throw 하지 않고 null 을 돌려준다.
 *   그래도 혹시 모를 예외까지 try/catch 로 막고, 없으면 조용히 아무것도 하지 않는다.
 * - 네이티브 호출 결과(Promise)의 실패도 삼킨다. 진동이 안 나는 건 기능 문제가 아니다.
 * - 웹은 진동을 쓰지 않는다(no-op).
 * `expo-haptics` 패키지는 다음 네이티브 빌드에 모듈을 넣기 위해 의존성으로만 둔다.
 */

/** ExpoHaptics 네이티브 모듈에서 쓰는 메서드만. 값은 expo-haptics 의 enum 문자열과 같다. */
interface HapticsNativeModule {
  impactAsync?: (style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid') => Promise<void>
  notificationAsync?: (type: 'success' | 'warning' | 'error') => Promise<void>
  selectionAsync?: () => Promise<void>
}

// undefined = 아직 찾아보지 않음, null = 없음(웹·구버전 바이너리).
let cached: HapticsNativeModule | null | undefined

function getModule(): HapticsNativeModule | null {
  if (cached !== undefined) return cached
  if (Platform.OS === 'web') {
    cached = null
    return cached
  }
  try {
    cached = requireOptionalNativeModule<HapticsNativeModule>('ExpoHaptics') ?? null
  } catch {
    cached = null
  }
  return cached
}

function run(call: (mod: HapticsNativeModule) => Promise<void> | undefined): void {
  const mod = getModule()
  if (!mod) return
  try {
    const result = call(mod)
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch {
    // 진동 실패는 무시한다.
  }
}

/** 가벼운 탭. 스위치·북마크·구독처럼 상태를 바꾸는 버튼에. */
export function tapLight(): void {
  run((mod) => mod.impactAsync?.('light'))
}

/** 성공. 제보·문의 접수처럼 무언가를 끝냈을 때. */
export function success(): void {
  run((mod) => mod.notificationAsync?.('success'))
}

/** 주의. 되돌릴 수 없는 일 직전 등에. */
export function warning(): void {
  run((mod) => mod.notificationAsync?.('warning'))
}

/** 선택이 바뀜. 탭·칩처럼 여러 개 중 하나를 고를 때. */
export function selection(): void {
  run((mod) => mod.selectionAsync?.())
}
