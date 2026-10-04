import { Linking, Platform } from 'react-native'

/** 네이버 지도 앱이 돌아올 앱을 알 수 있게 넘기는 값(네이버 지도 URL Scheme 규칙). */
const APP_NAME = 'com.hongikon.app'

/**
 * '서울 마포구 와우산로 94' → '마포구'. 같은 이름의 가게가 다른 동네에도 있을 때 검색 결과가 홍대 근처로 모이게
 * 가게 이름 뒤에 구 이름을 붙인다. 주소가 없거나 구를 못 찾으면 이름만 쓴다.
 */
function districtOf(address: string | undefined): string {
  const match = address?.match(/\S+구(?=\s|$)/)
  return match ? match[0] : ''
}

/**
 * 가게를 네이버 지도에서 연다 — 영업시간·메뉴·리뷰·길찾기는 네이버 지도 장소 화면에서 본다.
 * 네이버 정보는 크롤링하지 않는다(약관·데이터베이스권). 우리 앱은 그 화면으로 보내기만 한다.
 *
 * - 앱(iOS·Android): 네이버 지도 앱(`nmap://search`)을 먼저 열고, 앱이 없어 실패하면 웹(map.naver.com)을 연다.
 *   iOS 는 `canOpenURL` 대신 `openURL` 실패로 판단한다 — `canOpenURL` 은 Info.plist 의 LSApplicationQueriesSchemes
 *   등록(네이티브 변경, 새 빌드 필요)이 있어야 해서 쓰지 않는다. `openURL` 은 등록 없이도 된다.
 * - 웹: 바로 map.naver.com. 가게 좌표를 지도 중심으로 줘서 검색 결과가 그 근처로 나오게 한다.
 */
export function openNaverMapPlace(place: { name: string; address?: string; lat: number; lng: number }): void {
  const query = [place.name, districtOf(place.address)].filter(Boolean).join(' ')
  const encoded = encodeURIComponent(query)
  const web = `https://map.naver.com/p/search/${encoded}?c=${place.lng},${place.lat},17,0,0,0,dh`

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.open(web, '_blank', 'noopener')
    return
  }

  const app = `nmap://search?query=${encoded}&appname=${APP_NAME}`
  Linking.openURL(app).catch(() => {
    Linking.openURL(web).catch(() => {})
  })
}
