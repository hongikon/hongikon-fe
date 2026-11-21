import { Alert, Platform } from 'react-native'

/**
 * 확인/취소를 묻는다. react-native-web 의 Alert.alert 는 버튼을 넘겨도 아무것도 띄우지 않아
 * (웹에서 로그아웃·회원 탈퇴·설정 초기화 버튼이 눌러도 반응이 없었다) 웹은 window.confirm 으로 대신한다.
 */
export function confirmAction(options: {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}): void {
  const { title, message, confirmLabel, destructive, onConfirm } = options
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm()
    return
  }
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ])
}

/** 버튼 하나짜리 안내. 웹은 window.alert 로 대신한다(위와 같은 이유). */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title)
    return
  }
  Alert.alert(title, message)
}
