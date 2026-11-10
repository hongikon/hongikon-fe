/**
 * Keyboard shortcuts of the survey screen as pure functions. The screen only reads the event and runs the result.
 * Web only: the screen registers the listener, native never reaches this code.
 */

export const NUDGE_PX = 3
export const NUDGE_PX_LARGE = 15
export const NUDGE_PX_SMALL = 1
export const NUDGE_HINT = '방향키로 선택한 점 이동 (Shift: 크게, Alt: 작게)'
export const CLICK_HINT = '선택한 간선을 Shift+클릭: 그 자리에 점을 넣어 나누기. 점을 고른 뒤 다른 점을 Ctrl+클릭(Mac은 Cmd+클릭): 두 점 잇기'

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
  /** Something an undo took back can be applied again. Missing means no. */
  canRedo?: boolean
  /** Whether the point the keys would act on may be edited (the "only the filter" box). Missing means yes. */
  canEdit?: (id: string) => boolean
}

export type ShortcutAction = { kind: 'undo' } | { kind: 'redo' } | { kind: 'delete'; id: string } | { kind: 'nudge'; id: string; dx: number; dy: number }

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
    if (event.altKey) return null
    // The physical key, so a Korean layout (key is a Hangul letter or Process) still works, or the letter itself.
    const isZ = event.code === 'KeyZ' || event.key === 'z' || event.key === 'Z'
    const isY = event.code === 'KeyY' || event.key === 'y' || event.key === 'Y'
    // Redo: Ctrl/Cmd+Shift+Z, and Ctrl+Y on Windows. Cmd+Y belongs to the browser on a Mac (history).
    const redo = (isZ && event.shiftKey) || (isY && event.ctrlKey && !event.metaKey && !event.shiftKey)
    if (redo) return state.canRedo ? { kind: 'redo' } : null
    return isZ && !event.shiftKey && state.canUndo ? { kind: 'undo' } : null
  }
  const id = keyboardTarget(state.selected, state.multi)
  if (!id || (state.canEdit && !state.canEdit(id))) return null
  if (event.key === 'Delete' || event.key === 'Backspace') return event.shiftKey || event.altKey ? null : { kind: 'delete', id }
  const arrow = ARROWS[event.key]
  const distance = arrow ? nudgeDistance(event) : null
  if (!arrow || distance === null) return null
  // Written this way so that a zero stays 0 and not -0.
  return { kind: 'nudge', id, dx: arrow[0] && arrow[0] * distance, dy: arrow[1] && arrow[1] * distance }
}

/** Modifier keys held during a map click. */
export interface ClickMods {
  shift?: boolean
  ctrl?: boolean
  meta?: boolean
}

export interface ClickState {
  /** Map mode: add, link, move or select. */
  mode: string
  selected: string | null
  selectedEdge: string | null
  pending: string | null
  hasEdge: (a: string, b: string) => boolean
  canEditNode: (id: string) => boolean
  canEditEdge: (id: string) => boolean
}

export type ClickTarget = { kind: 'node'; id: string } | { kind: 'edge'; id: string }

export type ClickShortcut =
  | { kind: 'link'; from: string; to: string }
  | { kind: 'split'; edgeId: string }
  | { kind: 'blocked'; why: 'locked' | 'exists' }

const CLICK_SHORTCUT_MODES: readonly string[] = ['add', 'link', 'move']

/** Ctrl on Windows, Cmd on Mac. Both are accepted everywhere; on a Mac Ctrl+click is usually the context menu. */
export const isLinkModifier = (mods: ClickMods) => !!(mods.ctrl || mods.meta)

/**
 * Map click shortcuts. Cmd or Ctrl + click on another point joins it to the one selected point. Shift + click on the
 * selected edge places a point there and splits the edge. null means a normal press. Link mode with a started
 * pair keeps its own behavior, and the several points mode never uses these.
 */
export function resolveClickShortcut(target: ClickTarget, mods: ClickMods, state: ClickState): ClickShortcut | null {
  if (!CLICK_SHORTCUT_MODES.includes(state.mode)) return null
  if (target.kind === 'node') {
    if (!isLinkModifier(mods) || (state.mode === 'link' && state.pending)) return null
    const from = state.selected
    if (!from || from === target.id) return null
    if (!state.canEditNode(from) || !state.canEditNode(target.id)) return { kind: 'blocked', why: 'locked' }
    if (state.hasEdge(from, target.id)) return { kind: 'blocked', why: 'exists' }
    return { kind: 'link', from, to: target.id }
  }
  if (!mods.shift || isLinkModifier(mods) || state.selectedEdge !== target.id) return null
  return state.canEditEdge(target.id) ? { kind: 'split', edgeId: target.id } : { kind: 'blocked', why: 'locked' }
}

/** Modifier state kept from key events, for when a map click does not say which keys were held. */
export function modsAfterKey(mods: Required<ClickMods>, event: Pick<KeyLike, 'shiftKey' | 'ctrlKey' | 'metaKey'>): Required<ClickMods> {
  const next = { shift: !!event.shiftKey, ctrl: !!event.ctrlKey, meta: !!event.metaKey }
  return next.shift === mods.shift && next.ctrl === mods.ctrl && next.meta === mods.meta ? mods : next
}

export const NO_MODS: Required<ClickMods> = { shift: false, ctrl: false, meta: false }

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
