import { useEffect, useMemo, useState } from 'react'
import { fetchWalkApproach, fetchWalkRoutes, pickApproachRoutes, type RouteAlternative, type WalkApproach } from '../../apis/routes'
import { isCancelledError } from '../../apis/client'
import type { LivePosition } from '../../lib/nearbyPartners/platform'
import type { Building } from '../../types'
import { straightLineFallback, straightLineFromPoint } from '../../utils/routeEstimate'

interface Endpoints {
  fromBuilding: Building | null
  fromFloor: number | null
  toBuilding: Building | null
  toFloor: number | null
  /** 출발이 '내 위치'. */
  fromMyLocation: boolean
  /** 내 위치 출발의 기준 위치(15m 넘게 움직일 때만 바뀐다). */
  routeOrigin: LivePosition | null
  /** 지도에 있는 건물(내 위치가 건물 안인지 볼 때 쓴다). */
  buildings: readonly Building[]
}

/**
 * 길찾기 후보 길. 서버가 계산한다(11-09, GET /map/routes). 받기 전에는 비어 있고, 받지 못하면(오프라인·오류) 직선 어림 하나로 대신한다.
 * 내 위치 출발은 위치를 보내지 않는다 — 도착까지의 길 묶음(GET /map/routes/approach)을 받아 휴대폰이 내 위치에서 가까운 길 점을 골라 잇는다.
 */
export function useRouteData({ fromBuilding, fromFloor, toBuilding, toFloor, fromMyLocation, routeOrigin, buildings }: Endpoints): RouteAlternative[] {
  const routesKey =
    !fromMyLocation && fromBuilding && toBuilding ? `${fromBuilding.id}|${fromFloor}|${toBuilding.id}|${toFloor}` : null
  const approachKey = fromMyLocation && toBuilding ? `${toBuilding.id}|${toFloor}` : null
  const [serverRoutes, setServerRoutes] = useState<{ key: string; routes: RouteAlternative[] | null } | null>(null)
  const [approach, setApproach] = useState<{ key: string; data: WalkApproach | null } | null>(null)

  useEffect(() => {
    if (!routesKey || !fromBuilding || !toBuilding) return
    const controller = new AbortController()
    fetchWalkRoutes({ from: fromBuilding, fromFloor, to: toBuilding, toFloor, signal: controller.signal })
      .then((routes) => setServerRoutes({ key: routesKey, routes: routes.length > 0 ? routes : null }))
      .catch((error) => {
        if (!isCancelledError(error) && !controller.signal.aborted) setServerRoutes({ key: routesKey, routes: null })
      })
    return () => controller.abort()
    // routesKey 가 건물 id·층을 모두 담는다(같은 건물이 새로 받아져도 다시 묻지 않게).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routesKey])

  useEffect(() => {
    if (!approachKey || !toBuilding) return
    const controller = new AbortController()
    fetchWalkApproach({ to: toBuilding, toFloor, signal: controller.signal })
      .then((data) => setApproach({ key: approachKey, data }))
      .catch((error) => {
        if (!isCancelledError(error) && !controller.signal.aborted) setApproach({ key: approachKey, data: null })
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approachKey])

  return useMemo<RouteAlternative[]>(() => {
    if (fromMyLocation && toBuilding) {
      if (!routeOrigin || approach?.key !== approachKey) return []
      const fromMe = approach.data ? pickApproachRoutes(approach.data, routeOrigin, buildings) : []
      return fromMe.length > 0 ? fromMe : [straightLineFromPoint(routeOrigin, toBuilding, toFloor)]
    }
    if (!fromBuilding || !toBuilding || serverRoutes?.key !== routesKey) return []
    return serverRoutes.routes ?? [straightLineFallback(fromBuilding, fromFloor, toBuilding, toFloor)]
  }, [fromBuilding, toBuilding, fromFloor, toFloor, fromMyLocation, routeOrigin, approach, approachKey, serverRoutes, routesKey, buildings])
}
