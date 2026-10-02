import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * 이 설치(기기·브라우저)를 가리키는 무작위 값. 조회 수를 "하루 한 번"만 세려고 `POST /reports/{id}/views` 의
 * `X-Install-Id` 헤더로만 보낸다. 계정·기기 정보와 묶지 않은 난수이고, 서버는 하루 단위 중복 확인에만 쓰고 지운다
 * (처리방침 "조회 수"). 앱을 지우거나 브라우저 데이터를 지우면 새 값이 생긴다.
 */
const STORAGE_KEY = 'hongikon.installId.v1'

let cached: Promise<string> | null = null

function randomId(): string {
  const bytes = new Uint8Array(16)
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function getInstallId(): Promise<string> {
  if (!cached) {
    cached = AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && /^[0-9a-f]{32}$/.test(stored)) return stored
        const id = randomId()
        AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {})
        return id
      })
      .catch(() => randomId())
  }
  return cached
}
