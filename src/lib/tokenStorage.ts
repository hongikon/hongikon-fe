import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * expo-secure-store 는 웹에서 동작하지 않는다(Keychain/Keystore 가 없어서).
 * 네이티브에서는 그대로 SecureStore, 웹에서만 AsyncStorage 로 대신한다.
 * 웹은 이 앱의 실제 배포 타깃이 아니라서 토큰 보안 수준을 낮춰도 괜찮다.
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
