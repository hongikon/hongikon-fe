/** 웹 확인창. 없으면(네이티브) 진행한다 — 이 화면은 웹 전용이다. */
export function confirmAction(message: string): boolean {
  const w = globalThis as any
  return typeof w.confirm === 'function' ? !!w.confirm(message) : true
}
