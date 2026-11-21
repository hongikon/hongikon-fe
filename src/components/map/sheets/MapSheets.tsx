import { memo, type ContextType, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { SheetHeaderContext } from '../../../hooks/map/useResizableSheet'

interface Props {
  /** 시트가 위로 끌어 올릴 때 검색바·칩을 가리는지 알리는 통로(useResizableSheet). */
  headerContext: ContextType<typeof SheetHeaderContext>
  /** 시트 아래 끝(시트를 연 동안 0, 아니면 떠 있는 탭바 높이). */
  bottom: number
  /** 넓은 창에서 검색바와 같은 폭으로 맞추는 양쪽 여백. */
  side: number
  children: ReactNode
}

/**
 * [아래 시트 자리] 건물·제휴·시설·제보를 누르면 올라오는 시트를 얹는 층. 시트마다 자기 스타일에서
 * position:absolute; bottom:0 을 쓰므로, 이 층은 지도 칸 전체를 덮어 그 기준선만 잡아 준다(빈 곳은 지도로 터치가 간다).
 */
function MapSheets({ headerContext, bottom, side, children }: Props) {
  return (
    <SheetHeaderContext.Provider value={headerContext}>
      <View pointerEvents="box-none" style={[styles.layer, { bottom, left: side, right: side }]}>
        {children}
      </View>
    </SheetHeaderContext.Provider>
  )
}

export default memo(MapSheets)

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
})
