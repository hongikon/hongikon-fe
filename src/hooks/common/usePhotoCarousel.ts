import { useEffect, useState } from 'react'
import { Image } from 'react-native'

/** PhotoCarousel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function usePhotoCarousel({ urls }: Pick<{
  urls: readonly string[]
  onPressPhoto: (index: number) => void
  labelPrefix?: string
}, 'urls'>) {
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  const [ratios, setRatios] = useState<Record<string, number>>({})
  // 부모가 렌더마다 새 배열을 넘겨도 같은 사진이면 다시 재지 않는다.
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

  useEffect(() => {
    if (index >= urls.length) setIndex(Math.max(0, urls.length - 1))
  }, [urls.length, index])
  return { width, setWidth, index, setIndex, ratios }
}
