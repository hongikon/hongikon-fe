import { Linking } from 'react-native'
import { notify } from '../../common/dialog'

export function openPhoneSettings(what: string) {
  Linking.openSettings().catch(() =>
    notify('설정을 열지 못했어요', `휴대폰 설정 > 홍익온 > ${what}에서 바꿀 수 있어요.`),
  )
}
