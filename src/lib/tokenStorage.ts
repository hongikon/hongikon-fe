import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * expo-secure-store 는 웹에서 동작하지 않는다(Keychain/Keystore 가 없어서).
 * 네이티브에서는 그대로 SecureStore, 웹에서만 AsyncStorage 로 대신한다.
 * 웹(AsyncStorage → localStorage)은 암호화되지 않고 페이지 스크립트가 읽을 수 있다.
 * 웹 로그인(/auth/callback)이 생겨 이제 웹에도 토큰이 저장된다. 사용자 입력을 HTML 로 그리지 않아
 * XSS 여지가 작다고 보고 둔 절충이다 — 웹 사용자가 늘면 refresh 토큰을 httpOnly 쿠키로 옮기는 게 맞다.
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
