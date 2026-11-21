import { memo, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

/**
 * [지도 위 안내 줄 묶음] 검색바·칩 아래에 위에서부터 쌓이는 안내 줄·카드 자리.
 * 넓은 창(웹·태블릿)에선 검색바·시트와 같은 칸에 둔다(10-07 요청). 좁으면 양옆 16.
 */
function MapNoticeStack({ top, side, children }: { top: number; side: number; children: ReactNode }) {
  return (
    <View pointerEvents="box-none" style={[styles.stack, { top }, side > 0 && { left: side, right: side, maxWidth: undefined }]}>
      {children}
    </View>
  )
}

export default memo(MapNoticeStack)

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    maxWidth: 560,
    gap: 6,
  },
})
