import { apiRequest } from './client'

interface ServerBuilding {
  id: number
  name: string
}

/**
 * 앱 건물 이름 → 서버 `buildings.id`. 지도 데이터(`GET /map/data`)의 건물에는 `id` 가 실려 와 보통은 그걸 쓰고,
 * 이 함수는 `id` 가 없을 때(그 필드를 싣지 않는 서버)의 대비책이다.
 *
 * 제보(`POST /reports`)는 서버 건물 id 가 필수인데, 앱 건물은 표시 이름으로 식별된다. 서버 이름은 동 표기가 없어(`홍문관` ↔ 앱 `홍문관 R동`) 정확히 같거나
 * "서버 이름 + 공백"으로 시작하면 같은 건물로 본다. 겹치면 더 긴(구체적인) 서버 이름을 고른다.
 * 목록은 앱이 켜져 있는 동안 한 번만 받는다.
 */
let cache: Promise<ServerBuilding[]> | null = null

function loadServerBuildings(): Promise<ServerBuilding[]> {
  if (!cache) {
    cache = apiRequest<{ buildings: ServerBuilding[] }>('/buildings')
      .then((res) => res.buildings ?? [])
      .catch((error) => {
        cache = null // 실패는 캐시하지 않는다 — 다음 제보 때 다시 받는다.
        throw error
      })
  }
  return cache
}

export function matchServerBuildingId(appName: string, buildings: readonly ServerBuilding[]): number | null {
  const candidates = buildings.filter((b) => appName === b.name || appName.startsWith(`${b.name} `))
  if (candidates.length === 0) return null
  return candidates.reduce((best, b) => (b.name.length > best.name.length ? b : best)).id
}

/** 못 찾으면 null(서버에 없는 건물). 네트워크 오류는 그대로 던진다. */
export async function getServerBuildingId(appName: string): Promise<number | null> {
  return matchServerBuildingId(appName, await loadServerBuildings())
}
