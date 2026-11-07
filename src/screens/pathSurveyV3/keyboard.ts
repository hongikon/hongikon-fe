/**
 * Keyboard shortcuts of the survey screen as pure functions. The screen only reads the event and runs the result.
 * Web only: the screen registers the listener, native never reaches this code.
 */

export const NUDGE_PX = 3
export const NUDGE_PX_LARGE = 15
export const NUDGE_PX_SMALL = 1
export const NUDGE_HINT = '방향키로 선택한 점 이동 (Shift: 크게, Alt: 작게)'

/** Tabs that keep the map as the thing being worked on. Every other tab counts as another screen. */
const SHORTCUT_TABS: readonly string[] = ['edit', 'check']
export const isShortcutTab = (tab: string) => SHORTCUT_TABS.includes(tab)

export interface KeyLike {
  key: string
  /** Physical key. With a Korean keyboard layout key can be a Hangul letter or Process while code stays KeyZ. */
  code?: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  isComposing?: boolean
}

export interface ShortcutState {
  /** Focus is on an input, so the key belongs to the browser. */
  typing: boolean
  /** A dialog or another tab is open. */
  otherScreen: boolean
  selected: string | null
  multi: readonly string[]
  canUndo: boolean
}

export type ShortcutAction = { kind: 'undo' } | { kind: 'delete'; id: string } | { kind: 'nudge'; id: string; dx: number; dy: number }

/** The one point the keyboard acts on. Several points, or a selection that disagrees with the list, means none. */
export function keyboardTarget(selected: string | null, multi: readonly string[]): string | null {
  if (multi.length > 1) return null
  if (multi.length === 0) return selected
  return !selected || selected === multi[0] ? multi[0] : null
}

const ARROWS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }

export function nudgeDistance(event: Pick<KeyLike, 'shiftKey' | 'altKey'>): number | null {
  if (event.shiftKey && event.altKey) return null
  if (event.shiftKey) return NUDGE_PX_LARGE
  return event.altKey ? NUDGE_PX_SMALL : NUDGE_PX
}

export function resolveShortcut(event: KeyLike, state: ShortcutState): ShortcutAction | null {
  if (state.typing || state.otherScreen || event.isComposing) return null
  if (event.ctrlKey || event.metaKey) {
    const isZ = event.code === 'KeyZ' || event.key === 'z' || event.key === 'Z'
    return isZ && !event.shiftKey && !event.altKey && state.canUndo ? { kind: 'undo' } : null
  }
  const id = keyboardTarget(state.selected, state.multi)
  if (!id) return null
  if (event.key === 'Delete' || event.key === 'Backspace') return event.shiftKey || event.altKey ? null : { kind: 'delete', id }
  const arrow = ARROWS[event.key]
  const distance = arrow ? nudgeDistance(event) : null
  if (!arrow || distance === null) return null
  // Written this way so that a zero stays 0 and not -0.
  return { kind: 'nudge', id, dx: arrow[0] && arrow[0] * distance, dy: arrow[1] && arrow[1] * distance }
}

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']
const TYPING_ROLES = ['textbox', 'searchbox', 'combobox']

export function isTypingElement(element: any): boolean {
  if (!element) return false
  if (TYPING_TAGS.includes(String(element.tagName ?? '').toUpperCase()) || element.isContentEditable) return true
  return TYPING_ROLES.includes(element.getAttribute?.('role') ?? '')
}

export const hasOpenDialog = (doc: any): boolean => !!doc?.querySelector?.('[aria-modal="true"],[role="dialog"],[role="alertdialog"],dialog[open]')

/**
 * New position of a point moved by a number of screen pixels, on the Web Mercator map.
 * worldPx is the width of the whole world in pixels at the current zoom, as reported by the map.
 */
export function nudgeCoord(lat: number, lng: number, dx: number, dy: number, worldPx: number): { lat: number; lng: number } {
  const sin = Math.sin((lat * Math.PI) / 180)
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) + dy / worldPx
  return {
    lat: ((2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * 180) / Math.PI,
    lng: lng + (dx / worldPx) * 360,
  }
}
