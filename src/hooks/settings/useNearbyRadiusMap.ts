import { useMemo, useState } from 'react'
import { useMapData } from '../../lib/mapData'
import { metersPerPixel, project, IMAGE_ASPECT, IMAGE_CSS_WIDTH, CENTER } from '../../utils/settings/nearbyRadiusMap'

/** NearbyRadiusMap 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNearbyRadiusMap({ meters }: Pick<{ meters: number }, 'meters'>) {
  const { partners } = useMapData()
  const [width, setWidth] = useState(0)
  const zoom: 18 | 17 = meters <= 30 ? 18 : 17
  const height = width / IMAGE_ASPECT

  // 그림 안에 들어오는 가게와 그 위치(px). 반경이 그림 밖으로 걸치는 가게도 원 일부가 보이게 넣는다.
  const zones = useMemo(() => {
    if (width <= 0) return []
    const scale = width / IMAGE_CSS_WIDTH
    const center = project(CENTER.lat, CENTER.lng, zoom)
    const r = (meters / metersPerPixel(zoom)) * scale
    return partners
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => {
        const at = project(p.lat, p.lng, zoom)
        return { id: p.id, x: width / 2 + (at.x - center.x) * scale, y: height / 2 + (at.y - center.y) * scale, r }
      })
      .filter((z) => z.x > -z.r && z.x < width + z.r && z.y > -z.r && z.y < height + z.r)
  }, [partners, meters, zoom, width, height])
  return { width, setWidth, zoom, height, zones }
}
