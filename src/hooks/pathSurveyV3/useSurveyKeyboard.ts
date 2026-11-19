import { useEffect, useRef, type MutableRefObject } from 'react'
import { Platform } from 'react-native'
import type { EditHistory } from '../../screens/pathSurveyV3/editHistory'
import {
  hasOpenDialog,
  isShortcutTab,
  isTypingElement,
  modsAfterKey,
  NO_MODS,
  resolveShortcut,
  type ClickMods,
  type ShortcutAction,
} from '../../screens/pathSurveyV3/keyboard'
import type { Tab } from '../../screens/pathSurveyV3/screenModel'

/**
 * Modifier keys seen in key events (web only). A map click that carries its own keys (domEvent) wins; this is the fallback.
 * clickMods uses this when a map click does not report Shift, Ctrl or Meta.
 */
export function useClickMods() {
  const modsRef = useRef<Required<ClickMods>>(NO_MODS)
  const clickMods = (msg: any): ClickMods =>
    typeof msg?.shift === 'boolean' ? { shift: msg.shift, ctrl: !!msg.ctrl, meta: !!msg.meta } : modsRef.current
  useEffect(() => {
    const w = globalThis as any
    if (Platform.OS !== 'web' || typeof w.addEventListener !== 'function') return
    const onModKey = (event: any) => {
      modsRef.current = modsAfterKey(modsRef.current, event)
    }
    // A key released in another window never reaches this one.
    const onBlur = () => {
      modsRef.current = NO_MODS
    }
    w.addEventListener('keydown', onModKey, true)
    w.addEventListener('keyup', onModKey, true)
    w.addEventListener('blur', onBlur)
    return () => {
      w.removeEventListener('keydown', onModKey, true)
      w.removeEventListener('keyup', onModKey, true)
      w.removeEventListener('blur', onBlur)
    }
  }, [])
  return clickMods
}

interface KeyboardOptions {
  /** The map is up. Keys are handled only then. */
  ready: boolean
  tab: Tab
  selected: string | null
  multi: string[]
  historyRef: MutableRefObject<EditHistory>
  worldPxRef: MutableRefObject<number>
  canEditNode: (id: string | null | undefined) => boolean
  undo: () => void
  redo: () => void
  deleteNode: (id: string) => void
  nudgeNode: (action: Extract<ShortcutAction, { kind: 'nudge' }>) => void
}

/** Web shortcuts: undo, redo, deleting a point, arrow key moves (rules in keyboard.ts resolveShortcut). */
export function useSurveyKeyboard(options: KeyboardOptions) {
  const { ready, tab, selected, multi, historyRef, worldPxRef, canEditNode, undo, redo, deleteNode, nudgeNode } = options

  const keyHandlerRef = useRef<(event: any) => void>(() => {})
  keyHandlerRef.current = (event) => {
    const doc = (globalThis as any).document
    const action = resolveShortcut(event, {
      typing: isTypingElement(event.target) || isTypingElement(doc?.activeElement),
      otherScreen: !isShortcutTab(tab) || hasOpenDialog(doc),
      selected,
      multi,
      canUndo: historyRef.current.size() > 0,
      canRedo: historyRef.current.redoSize() > 0,
      canEdit: canEditNode,
    })
    if (!action || (action.kind === 'nudge' && !worldPxRef.current)) return
    event.preventDefault()
    event.stopPropagation()
    if (action.kind === 'undo') undo()
    else if (action.kind === 'redo') redo()
    else if (action.kind === 'delete') deleteNode(action.id)
    else nudgeNode(action)
  }

  // Registered only while the map is up, in the capture phase so that the map does not also act on the key.
  useEffect(() => {
    const w = globalThis as any
    if (!ready || Platform.OS !== 'web' || typeof w.addEventListener !== 'function') return
    const onKey = (event: any) => keyHandlerRef.current(event)
    w.addEventListener('keydown', onKey, true)
    return () => w.removeEventListener('keydown', onKey, true)
  }, [ready])
}
