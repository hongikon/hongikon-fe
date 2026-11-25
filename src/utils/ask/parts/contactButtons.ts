import { Linking } from 'react-native'
import * as haptics from '../../../lib/haptics'

export function call(phone: string) {
  haptics.selection();
  Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
}

export function openLink(url: string) {
  haptics.selection();
  Linking.openURL(url).catch(() => {});
}
