import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * expo-secure-store 는 웹에서 동작하지 않는다(Keychain/Keystore 가 없어서).
 * 네이티브에서는 그대로 SecureStore, 웹에서만 AsyncStorage 로 대신한다.
 * 웹(AsyncStorage → localStorage)은 암호화되지 않고 페이지 스크립트가 읽을 수 있다.
 * 지금은 카카오 콜백이 앱 스킴(hongikon://)이라 웹에서 토큰이 발급될 길이 없어 괜찮지만,
 * 웹 로그인을 붙일 땐 여기에 장기 토큰을 두지 말고 httpOnly 쿠키 등으로 바꿔야 한다.
 */
const isWeb = Platform.OS === 'web'

export async function getItem(key: string): Promise<string | null> {
  return isWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value)
  } else {
    await SecureStore.setItemAsync(key, value)
  }
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key)
  } else {
    await SecureStore.deleteItemAsync(key)
  }
}
