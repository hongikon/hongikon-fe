export type RouteNext = "from" | "to" | null;

/** 지금 출발·도착 상태에서 다음에 고를 쪽. 출발을 정했으면 '도착', 도착만 정했으면 '출발', 아니면 null. */
export function nextRouteEndpoint(hasFrom: boolean, hasTo: boolean): RouteNext {
  if (hasFrom && !hasTo) return "to";
  if (hasTo && !hasFrom) return "from";
  return null;
}
