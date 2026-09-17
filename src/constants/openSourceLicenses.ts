export interface OSSLicense {
  name: string
  version: string
  license: string
}

/** package.json 의존성 스냅샷. 버전을 올릴 때마다 수동으로 맞춰줘야 한다. */
export const OSS_LICENSES: OSSLicense[] = [
  { name: 'react', version: '19.2.3', license: 'MIT' },
  { name: 'react-dom', version: '19.2.3', license: 'MIT' },
  { name: 'react-native', version: '0.85.3', license: 'MIT' },
  { name: 'react-native-web', version: '0.21.2', license: 'MIT' },
  { name: 'expo', version: '56.0.19', license: 'MIT' },
  { name: 'expo-constants', version: '56.0.23', license: 'MIT' },
  { name: 'expo-font', version: '56.0.7', license: 'MIT' },
  { name: 'expo-image-picker', version: '56.0.23', license: 'MIT' },
  { name: 'expo-secure-store', version: '56.0.4', license: 'MIT' },
  { name: 'expo-splash-screen', version: '56.0.14', license: 'MIT' },
  { name: 'expo-status-bar', version: '56.0.4', license: 'MIT' },
  { name: 'expo-web-browser', version: '56.0.6', license: 'MIT' },
  { name: '@expo/vector-icons', version: '15.1.1', license: 'MIT' },
  { name: '@react-native-async-storage/async-storage', version: '2.2.0', license: 'MIT' },
  { name: '@react-navigation/native', version: '7.3.3', license: 'MIT' },
  { name: '@react-navigation/native-stack', version: '7.17.5', license: 'MIT' },
  { name: '@react-navigation/bottom-tabs', version: '7.18.2', license: 'MIT' },
  { name: 'react-native-safe-area-context', version: '5.7.0', license: 'MIT' },
  { name: 'react-native-screens', version: '4.26.2', license: 'MIT' },
  { name: 'react-native-svg', version: '15.15.4', license: 'MIT' },
  { name: 'react-native-webview', version: '13.16.1', license: 'MIT' },
]
