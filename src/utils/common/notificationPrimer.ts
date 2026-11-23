import AsyncStorage from '@react-native-async-storage/async-storage'

/** 최초 실행 때 한 번 물었는지. 한 번 물은 뒤엔 다시 자동으로 띄우지 않는다(설정 화면에서 켤 수 있다). */
export const ASKED_KEY = '@hongikon_notification_permission_asked'

/**
 * 첫 실행 온보딩의 알림 단계가 화면에 나오면 부른다. 그 단계가 허용 창을 맡으므로
 * 온보딩이 끝난 뒤 NotificationPrimer 가 같은 걸 또 묻지 않게 물었다고 기록해 둔다.
 */
export async function markNotificationPermissionAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, '1')
  } catch {
    // 못 남겨도 NotificationPrimer 는 권한이 이미 정해졌으면(허용·거절) 묻지 않는다.
  }
}

/** 로그인 직후(또는 학과 고르기를 끝낸 직후) 화면이 바뀐 뒤에 띄우려고 잠깐 기다린다. */
export const FIRST_LAUNCH_DELAY_MS = 800
