/** '2' → 2, '-1'·'B1'·'b1' → -1. 0층이나 숫자가 아니면 null. */
export function parseFloor(text: string): number | null {
  const t = text.trim()
  const b = /^[Bb](\d+)[Ff]?$/.exec(t)
  if (b) return Number(b[1]) ? -Number(b[1]) : null
  const m = /^(-?\d+)[Ff]?$/.exec(t)
  if (!m) return null
  const n = Number(m[1])
  return n === 0 ? null : n
}
