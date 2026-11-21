/** 브라우저 시계 기준 `14:05:09`. 갱신 시각은 이 화면에서 잰 값이라 서버 시간대와 무관하다. */
export function formatClock(ms: number): string {
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
