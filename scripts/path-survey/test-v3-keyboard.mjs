// Path survey v3: chain base point, keyboard shortcuts, arrow key moves and their undo steps.
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIXTURE_BUILDINGS, lvl } from './v3-helpers.mjs'

register('../ask/ts-hooks.mjs', import.meta.url)
process.removeAllListeners('warning')
const K = await import('../../src/screens/pathSurveyV3/keyboard.ts')
const H = await import('../../src/screens/pathSurveyV3/editHistory.ts')
const M = await import('../../src/screens/pathSurveyV3/mapState.ts')
const Store = await import('../../src/utils/pathSurveyV3/store.ts')
const B = await import('../../src/utils/pathSurveyV3/buildings.ts')
const { checkGraph } = await import('../../src/utils/pathSurveyV3/check.ts')

const index = B.buildBuildingIndex(FIXTURE_BUILDINGS)
const R = 'hongik_r'
const OUT = { scope: 'outdoor' }
const inside = (building, floor, type = 'basic') => ({ scope: 'indoor', type, levels: [lvl(building, floor)] })
const empty = () => Store.emptyStoreV3(0)
const idle = { typing: false, otherScreen: false, selected: 'n1', multi: [], canUndo: true }
const press = (key, state = {}, extra = {}) => K.resolveShortcut({ key, ...extra }, { ...idle, ...state })
const codes = (list) => list.map((i) => i.code)

test('shortcuts: Ctrl+Z and Cmd+Z undo, also with a Korean layout, and only when there is something to undo', () => {
  assert.deepEqual(press('z', {}, { ctrlKey: true }), { kind: 'undo' })
  assert.deepEqual(press('z', {}, { metaKey: true }), { kind: 'undo' })
  assert.deepEqual(press('Process', {}, { ctrlKey: true, code: 'KeyZ' }), { kind: 'undo' })
  assert.equal(press('z', { canUndo: false }, { ctrlKey: true }), null)
  assert.equal(press('z', {}, { ctrlKey: true, shiftKey: true }), null, 'no redo')
  assert.equal(press('z'), null, 'a plain z does nothing')
})

test('shortcuts: Ctrl+X is not connected, and a modifier never turns into a delete or a move', () => {
  assert.equal(press('x', {}, { ctrlKey: true, code: 'KeyX' }), null)
  assert.equal(press('Delete', {}, { ctrlKey: true }), null)
  assert.equal(press('ArrowUp', {}, { metaKey: true }), null)
})

test('shortcuts: Delete and Backspace remove the one selected point', () => {
  assert.deepEqual(press('Delete'), { kind: 'delete', id: 'n1' })
  assert.deepEqual(press('Backspace'), { kind: 'delete', id: 'n1' })
})

test('shortcuts: nothing selected means the keys stay with the browser and the map', () => {
  for (const key of ['Delete', 'Backspace', 'ArrowUp', 'ArrowLeft']) assert.equal(press(key, { selected: null }), null, key)
})

test('shortcuts: several points selected means no delete and no move', () => {
  const state = { selected: null, multi: ['n1', 'n2'] }
  for (const key of ['Delete', 'Backspace', 'ArrowUp']) assert.equal(press(key, state), null, key)
  // A list left over from the multi select also blocks a point selected later.
  assert.equal(press('Delete', { selected: 'n3', multi: ['n1', 'n2'] }), null)
  assert.equal(press('Delete', { selected: 'n3', multi: ['n1'] }), null)
  assert.deepEqual(press('Delete', { selected: null, multi: ['n1'] }), { kind: 'delete', id: 'n1' })
})

test('shortcuts: focus on an input, a dialog, another tab or an open IME ignores every key', () => {
  const keys = [['z', { ctrlKey: true }], ['Delete'], ['Backspace'], ['ArrowUp'], ['ArrowUp', { shiftKey: true }]]
  for (const [key, extra] of keys) {
    assert.equal(press(key, { typing: true }, extra), null, `typing ${key}`)
    assert.equal(press(key, { otherScreen: true }, extra), null, `other screen ${key}`)
    assert.equal(press(key, {}, { ...extra, isComposing: true }), null, `composing ${key}`)
  }
})

test('input detection: inputs, editable elements and text roles count, buttons and the map do not', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) assert.ok(K.isTypingElement({ tagName }), tagName)
  assert.ok(K.isTypingElement({ tagName: 'DIV', isContentEditable: true }))
  assert.ok(K.isTypingElement({ tagName: 'DIV', getAttribute: () => 'textbox' }))
  for (const element of [null, undefined, { tagName: 'BODY' }, { tagName: 'DIV', getAttribute: () => 'button' }]) assert.ok(!K.isTypingElement(element))
})

test('other screens: only the edit and check tabs keep the shortcuts, an open dialog stops them', () => {
  for (const tab of ['edit', 'check']) assert.ok(K.isShortcutTab(tab), tab)
  for (const tab of ['convert', 'backup', 'snapshots', 'legacy']) assert.ok(!K.isShortcutTab(tab), tab)
  assert.ok(K.hasOpenDialog({ querySelector: () => ({}) }))
  assert.ok(!K.hasOpenDialog({ querySelector: () => null }))
  assert.ok(!K.hasOpenDialog(undefined))
})

test('arrow keys: 3 pixels, 15 with Shift, 1 with Alt, in screen directions', () => {
  assert.deepEqual(press('ArrowUp'), { kind: 'nudge', id: 'n1', dx: 0, dy: -3 })
  assert.deepEqual(press('ArrowDown'), { kind: 'nudge', id: 'n1', dx: 0, dy: 3 })
  assert.deepEqual(press('ArrowLeft'), { kind: 'nudge', id: 'n1', dx: -3, dy: 0 })
  assert.deepEqual(press('ArrowRight'), { kind: 'nudge', id: 'n1', dx: 3, dy: 0 })
  assert.deepEqual(press('ArrowRight', {}, { shiftKey: true }), { kind: 'nudge', id: 'n1', dx: 15, dy: 0 })
  assert.deepEqual(press('ArrowUp', {}, { altKey: true }), { kind: 'nudge', id: 'n1', dx: 0, dy: -1 })
  assert.equal(press('ArrowUp', {}, { shiftKey: true, altKey: true }), null)
})

test('arrow keys: pixels become the right distance at a zoom level, and up is north', () => {
  const worldPx = 256 * 2 ** 18
  const lat = 37.5512
  const lng = 126.9255
  const right = K.nudgeCoord(lat, lng, 3, 0, worldPx)
  assert.equal(right.lat.toFixed(9), lat.toFixed(9))
  assert.ok(Math.abs(right.lng - lng - (3 / worldPx) * 360) < 1e-12)
  const up = K.nudgeCoord(lat, lng, 0, -3, worldPx)
  assert.ok(up.lat > lat)
  assert.equal(up.lng, lng)
  // Mercator: at this latitude a pixel north is shorter in degrees than a pixel east, by cos(lat).
  const ratio = (up.lat - lat) / (right.lng - lng)
  assert.ok(Math.abs(ratio - Math.cos((lat * Math.PI) / 180)) < 1e-4, String(ratio))
  // One zoom level closer, the same pixels are half the distance.
  const closer = K.nudgeCoord(lat, lng, 3, 0, worldPx * 2)
  assert.ok(Math.abs(closer.lng - lng - (right.lng - lng) / 2) < 1e-12)
  const back = K.nudgeCoord(up.lat, up.lng, 0, 3, worldPx)
  assert.ok(Math.abs(back.lat - lat) < 1e-9)
})

test('undo history: presses in a row are one step, a pause of 0.6 s or another point starts a new one', () => {
  const history = H.createEditHistory()
  const at = (n) => ({ store: { tag: n }, anchor: null })
  history.recordNudge(at(0), 'n1', 1000)
  history.recordNudge(at(1), 'n1', 1100)
  history.recordNudge(at(2), 'n1', 1699)
  assert.equal(history.size(), 1)
  history.recordNudge(at(3), 'n1', 1699 + H.NUDGE_GROUP_MS)
  assert.equal(history.size(), 2)
  history.recordNudge(at(4), 'n2', 2300)
  assert.equal(history.size(), 3)
  assert.equal(history.pop().store.tag, 4)
  assert.equal(history.pop().store.tag, 3)
  assert.equal(history.pop().store.tag, 0, 'the group goes back to where it started')
  assert.equal(history.pop(), undefined)
})

test('undo history: another edit or an undo ends a group of presses', () => {
  const history = H.createEditHistory()
  const entry = { store: {}, anchor: null }
  history.recordNudge(entry, 'n1', 1000)
  history.record(entry)
  history.recordNudge(entry, 'n1', 1010)
  assert.equal(history.size(), 3)
  history.pop()
  history.recordNudge(entry, 'n1', 1020)
  assert.equal(history.size(), 3)
})

test('undo history: keeps the same limit of 50 steps as before, dropping the oldest', () => {
  assert.equal(H.UNDO_LIMIT, 50)
  const history = H.createEditHistory()
  for (let i = 0; i < 60; i += 1) history.record({ store: { tag: i }, anchor: null })
  assert.equal(history.size(), 50)
  let last
  for (let entry = history.pop(); entry; entry = history.pop()) last = entry
  assert.equal(last.store.tag, 10)
})

test('arrow keys end to end: a group of moves goes back in one undo, the edge follows, no edge is split', () => {
  const history = H.createEditHistory()
  let store = Store.addNode(empty(), 37.55, 126.92, OUT).store
  store = H.placeChained(store, 37.551, 126.92, OUT, true, 'n1').store
  store = H.placeChained(store, 37.552, 126.92, OUT, true, 'n2').store
  const before = store
  const worldPx = 256 * 2 ** 18
  for (let i = 0; i < 5; i += 1) {
    const node = Store.findNode(store, 'n2')
    const to = K.nudgeCoord(node.lat, node.lng, 3, 0, worldPx)
    history.recordNudge({ store, anchor: 'n2' }, 'n2', 1000 + i * 100)
    store = Store.moveNode(store, 'n2', to.lat, to.lng)
  }
  assert.ok(Store.findNode(store, 'n2').lng > 126.92)
  assert.deepEqual(store.edges, before.edges, 'same edges, none split')
  assert.equal(store.nodes.length, 3)
  assert.equal(history.size(), 1)
  assert.deepEqual(history.pop().store, before)
})

test('delete shortcut: same edit as the delete button, and undo brings back the point and its edges', () => {
  const history = H.createEditHistory()
  let store = Store.addNode(empty(), 37.55, 126.92, OUT).store
  store = H.placeChained(store, 37.551, 126.92, OUT, true, 'n1').store
  store = H.placeChained(store, 37.552, 126.92, OUT, true, 'n2').store
  const before = store
  const action = press('Delete', { selected: 'n2' })
  history.record({ store, anchor: 'n2' })
  store = Store.removeNode(store, action.id)
  assert.equal(Store.findNode(store, 'n2'), undefined)
  assert.equal(store.edges.length, 0)
  const entry = history.pop()
  assert.deepEqual(entry.store, before)
  assert.equal(H.anchorAfterUndo('n2', entry), 'n2')
})

test('chain: on joins the base point and the new point becomes the next base, off joins nothing', () => {
  const first = H.placeChained(empty(), 37.55, 126.92, OUT, true, null)
  assert.equal(first.from, undefined)
  assert.equal(first.store.edges.length, 0)
  const second = H.placeChained(first.store, 37.551, 126.92, OUT, true, first.id)
  assert.equal(second.from.id, first.id)
  assert.equal(second.store.edges.length, 1)
  const edge = second.store.edges[0]
  assert.deepEqual([edge.a, edge.b], [first.id, second.id])
  assert.ok(!edge.kind || edge.kind === 'normal', 'a normal edge')
  const third = H.placeChained(second.store, 37.552, 126.92, OUT, true, second.id)
  assert.deepEqual([third.store.edges[1].a, third.store.edges[1].b], [second.id, third.id])
  const off = H.placeChained(second.store, 37.552, 126.92, OUT, false, second.id)
  assert.equal(off.store.edges.length, 1)
  assert.equal(off.from, undefined)
  const gone = H.placeChained(second.store, 37.552, 126.92, OUT, true, 'n999')
  assert.equal(gone.store.edges.length, 1, 'a base point that no longer exists joins nothing')
})

test('chain: one undo takes back the point and its edge together, and the base point returns', () => {
  const history = H.createEditHistory()
  const first = H.placeChained(empty(), 37.55, 126.92, OUT, true, null)
  const before = first.store
  history.record({ store: before, anchor: first.id })
  const second = H.placeChained(before, 37.551, 126.92, OUT, true, first.id)
  assert.equal(second.store.nodes.length, 2)
  assert.equal(second.store.edges.length, 1)
  assert.equal(history.size(), 1)
  const entry = history.pop()
  assert.deepEqual(entry.store, before)
  assert.equal(entry.store.edges.length, 0)
  assert.equal(H.anchorAfterUndo(second.id, entry), first.id)
  assert.equal(H.anchorAfterUndo(first.id, entry), first.id, 'a base point that survived stays')
  assert.equal(H.anchorAfterUndo('n999', { store: before, anchor: 'n998' }), null)
})

test('chain across a context change: the edge is made and the check reports it, nothing is blocked', () => {
  const chained = (a, b) => {
    const one = H.placeChained(empty(), 37.55, 126.92, a, true, null)
    const two = H.placeChained(one.store, 37.5501, 126.92, b, true, one.id)
    assert.equal(two.store.edges.length, 1)
    return checkGraph(two.store.nodes, two.store.edges, index)
  }
  const floors = chained(inside(R, 1), inside(R, 3))
  assert.ok(codes(floors.warnings).includes('same_building_direct'), 'another floor')
  const buildings = chained(inside(R, 1), inside('hongik_k', 1))
  assert.ok(codes(buildings.warnings).includes('different_building_direct'), 'another building')
  const scope = chained(OUT, inside(R, 1))
  assert.ok(scope.errors.length > 0, 'outdoor to an indoor point that is not an entrance')
  const same = chained(inside(R, 2), inside(R, 2))
  assert.ok(!codes(same.warnings).some((c) => c.endsWith('_direct')), 'the same floor stays quiet')
})

test('chain base point on the map: marked and kept readable under a filter, off without an anchor', () => {
  const made = H.placeChained(empty(), 37.55, 126.92, inside(R, 1), true, null)
  const base = { index, filter: M.NO_FILTER, mode: 'add', selected: null, pending: null, selectedEdge: null }
  assert.equal(M.buildRenderState(made.store, base).nodes[0].anchor, false)
  const marked = M.buildRenderState(made.store, { ...base, anchor: made.id }).nodes[0]
  assert.equal(marked.anchor, true)
  assert.equal(marked.emphasized, true)
  const filter = { building: 'hongik_k', floor: null }
  assert.equal(M.buildRenderState(made.store, { ...base, filter }).nodes[0].dim, true)
  assert.equal(M.buildRenderState(made.store, { ...base, filter, anchor: made.id }).nodes[0].dim, false)
})

test('chain toggle text', () => {
  assert.equal(H.chainToggleLabel(true), '이어 찍기 켜짐 - 직전 점과 연결 중')
  assert.equal(H.chainToggleLabel(false), '이어 찍기 꺼짐')
  assert.equal(K.NUDGE_HINT, '방향키로 선택한 점 이동 (Shift: 크게, Alt: 작게)')
})

// The screen needs the app runtime to render, so these read its source. They exist so that a screen rewrite cannot silently drop these again.
const screen = readFileSync(new URL('../../src/screens/DevPathSurveyV3Screen.tsx', import.meta.url), 'utf8')
const controls = readFileSync(new URL('../../src/screens/pathSurveyV3/controls.tsx', import.meta.url), 'utf8')
const bridge = readFileSync(new URL('../../src/screens/pathSurveyV3/mapBridge.ts', import.meta.url), 'utf8')

test('presence: the chain toggle is in the top bar, under the modes and above the context bar', () => {
  const top = screen.slice(screen.indexOf('const topBar = ('), screen.indexOf('const editTab = ('))
  const modes = top.indexOf('styles.modeRow')
  const toggle = top.indexOf('<ChainToggle')
  const contextBar = top.indexOf('<ContextBar')
  assert.ok(modes > -1 && toggle > modes && contextBar > toggle, 'order of the rows in the top bar')
  assert.match(top, /<ChainToggle visible=\{mode === 'add'\} on=\{chain\}/)
  assert.ok(!screen.includes('<Check '), 'the old checkbox inside the edit tab is gone')
  assert.match(controls, /chainRow: \{ minHeight: TOUCH \}/, 'the row keeps its height while hidden')
  assert.match(screen, /placeChained\(storeRef\.current, lat, lng, toNodeContext\(context\), chain, anchorRef\.current\)/)
  assert.match(screen, /anchor: chain && mode === 'add' \? anchor : null/)
  assert.ok(bridge.includes('data-anchor'), 'the map draws the base point ring')
})

test('presence: the key listener is web only, needs the map, and is removed when leaving', () => {
  assert.match(screen, /if \(!ready \|\| Platform\.OS !== 'web'/)
  assert.match(screen, /addEventListener\('keydown', onKey, true\)/)
  assert.match(screen, /removeEventListener\('keydown', onKey, true\)/)
  assert.match(screen, /Platform\.OS === 'web' \? <Text[^>]*>\{NUDGE_HINT\}/)
  assert.match(bridge, /keyboardShortcuts: !locked/)
})
