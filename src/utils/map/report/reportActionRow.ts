/** 1,234 → '1,234', 12,300 → '1.2만'. */
export function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}만`
  return n.toLocaleString('ko-KR')
}
