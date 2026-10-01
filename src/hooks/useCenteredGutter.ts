import { useWindowDimensions } from 'react-native'
import { SHEET_MAX_WIDTH } from '../constants/layout'

/**
 * 창 너비가 `maxWidth` 보다 넓을 때 양옆에 더 띄워야 하는 거리(dp). 좁으면 0.
 *
 * 지도 위 배너·하단 시트처럼 position:absolute 로 left/right 를 정하는 요소는
 * maxWidth 만으로는 가운데 서지 않아(왼쪽에 붙는다) 이 값을 left/right 에 더한다.
 * `useWindowDimensions` 라 폴드를 펼치고 접거나 웹 창 크기를 바꾸면 바로 다시 계산된다 —
 * 모듈에서 한 번 읽는 `Dimensions.get` 은 쓰지 않는다(접고 펼 때 액티비티가 다시 만들어지지 않는다).
 */
export function useCenteredGutter(maxWidth: number = SHEET_MAX_WIDTH): number {
  const { width } = useWindowDimensions()
  return Math.max(0, Math.floor((width - maxWidth) / 2))
}
