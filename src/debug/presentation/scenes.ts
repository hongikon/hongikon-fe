import { useEffect, useSyncExternalStore } from 'react'
import { Linking, Platform } from 'react-native'

/** Opt-in native recording build only. Never enabled by an ordinary development/production build. */
export const PRESENTATION_DEMO = __DEV__ && Platform.OS === 'ios' && process.env.EXPO_PUBLIC_PRESENTATION_DEMO === '1'
let current = 'map'
const listeners = new Set<() => void>()
function receive(url: string | null) {
  if (!PRESENTATION_DEMO || !url?.startsWith('hongikon://presentation/')) return
  current = decodeURIComponent(url.split('/presentation/')[1].split('?')[0])
  listeners.forEach(fn => fn())
}
if (PRESENTATION_DEMO) {
  Linking.getInitialURL().then(receive)
  Linking.addEventListener('url', ({ url }) => receive(url))
  // Local capture runner avoids an iOS "Open in app?" sheet between every recorded frame.
  let lastCommand = ''
  setInterval(() => {
    void fetch('http://127.0.0.1:8767/scene').then(r => r.json()).then((command: { scene?: string; id?: string }) => {
      if (command.scene && command.id && command.id !== lastCommand) {
        lastCommand = command.id
        receive('hongikon://presentation/' + encodeURIComponent(command.scene))
      }
    }).catch(() => {})
  }, 350)
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function usePresentationScene(run: (scene: string) => void | (() => void)) {
  const scene = useSyncExternalStore(subscribe, () => current)
  useEffect(() => { if (PRESENTATION_DEMO) return run(scene) }, [scene])
}
