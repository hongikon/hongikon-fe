const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i

/**
 * 백엔드 날짜 문자열 → epoch ms.
 *
 * 백엔드는 `LocalDateTime` 을 존 정보 없이(`2026-09-30T03:00:00`) 내려주고, 값은 UTC 기준이다
 * (앱이 제보 시각을 `toISOString()` 으로 보내고, 서버 JVM 기본 시간대도 UTC 라 `createdAt` 도 UTC).
 * 그런데 JS 는 존 없는 날짜-시각 문자열을 **기기 현지 시간**으로 해석한다 — 한국 폰에선 9시간
 * 이르게 읽혀, 남은 시간이 9시간 미만인 제보가 지도에서 바로 걸러지고 "○시까지"도 틀렸다.
 * 그래서 존이 없으면 UTC(`Z`)로 못 박아 읽는다. 해석 못 하면 NaN.
 */
export function parseServerTime(value: string): number {
  return new Date(HAS_ZONE.test(value) ? value : `${value}Z`).getTime()
}
