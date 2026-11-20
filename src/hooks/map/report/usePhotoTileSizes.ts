import { useEffect, useState } from 'react'
import { Image, type LayoutChangeEvent } from 'react-native'
import { photoRowHeight } from '../../../utils/map/reportSheet'

const UNKNOWN_PHOTO_RATIO = 1

/**
 * 시트 사진 칸 크기 — 사진마다 원래 비율(가로/세로)로 폭을 정하고, 모두 같은 높이로 줄 폭 안에 들어가게 맞춘다.
 * 비율을 모르는 동안은 정사각형으로 둔다.
 */
export function usePhotoTileSizes(urls: readonly string[]) {
  const [rowWidth, setRowWidth] = useState(0)
  const [ratios, setRatios] = useState<Record<string, number>>({})
  const urlsKey = urls.join('\n')

  useEffect(() => {
    let alive = true
    urls.forEach((url) => {
      Image.getSize(
        url,
        (w, h) => {
          if (alive && w > 0 && h > 0) setRatios((prev) => (prev[url] ? prev : { ...prev, [url]: w / h }))
        },
        () => {},
      )
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey])

  const ratioOf = (url: string) => ratios[url] ?? UNKNOWN_PHOTO_RATIO
  const height = photoRowHeight(urls.map(ratioOf), rowWidth)

  return {
    onLayout: (event: LayoutChangeEvent) => {
      const next = Math.floor(event.nativeEvent.layout.width)
      if (next !== rowWidth) setRowWidth(next)
    },
    sizeOf: (url: string) => ({ width: Math.floor(height * ratioOf(url)), height: Math.round(height) }),
  }
}

export type PhotoTileSizes = ReturnType<typeof usePhotoTileSizes>
