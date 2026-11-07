// Shared helpers for the path survey v3 tests.
export const lvl = (building, floor) => ({ building, floor })

let seq = 0
export function node(id, extra = {}) {
  seq += 1
  return { id, lat: 37.55 + seq * 1e-5, lng: 126.92 + seq * 1e-5, scope: 'outdoor', type: 'basic', ...extra }
}
export const indoor = (id, levels, extra = {}) => node(id, { scope: 'indoor', levels, ...extra })
export const edge = (id, a, b, extra = {}) => ({ id, a, b, kind: 'normal', ...extra })

export function memoryStorage(init = {}) {
  const data = new Map(Object.entries(init))
  const writes = []
  return {
    data,
    writes,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      writes.push(k)
      data.set(k, String(v))
    },
    removeItem: (k) => {
      writes.push(k)
      data.delete(k)
    },
  }
}

/** Breadth first search over an expanded graph. */
export function hasPath(graph, from, to) {
  const adjacent = new Map(graph.vertices.map((v) => [v.id, []]))
  for (const e of graph.edges) {
    adjacent.get(e.a)?.push(e.b)
    adjacent.get(e.b)?.push(e.a)
  }
  if (!adjacent.has(from) || !adjacent.has(to)) return false
  const seen = new Set([from])
  const queue = [from]
  while (queue.length) {
    const id = queue.shift()
    if (id === to) return true
    for (const next of adjacent.get(id)) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return false
}

// Synthetic buildings. Real names and coordinates are not needed here. \uB3D9 is the "dong" suffix.
export const FIXTURE_BUILDINGS = [
  { id: 1, code: 'hongik_r', name: 'Hongmun R\uB3D9', lat: 37.5, lng: 126.9, entrances: [
    { label: 'HI_R_1F5_ENTER', minFloor: 1.5, maxFloor: 1.5 }, { label: 'HI_R_B2_ENTER', minFloor: -2, maxFloor: -2 },
  ], boundary: [[37.5, 126.9], [37.5, 126.901], [37.501, 126.901], [37.501, 126.9]] },
  { id: 2, code: 'hongik_k', name: 'First K\uB3D9', lat: 37.51, lng: 126.91, entrances: [{ label: 'HI_K_1F_1_ENTER', minFloor: 1, maxFloor: 1 }] },
  { id: 3, code: 'hongik_gym', name: 'Gym', lat: 37.52, lng: 126.92, entrances: [{ label: 'HI_M_B2_ENTER', minFloor: -2, maxFloor: -2 }] },
  { id: 5, code: 'hongik_d', name: 'Inmun D\uB3D9', lat: 37.53, lng: 126.93, entrances: [{ label: 'HI_D_1F_ENTER', minFloor: 1, maxFloor: 1 }] },
  { id: 4, code: 'hongik_dorm2', name: 'Dorm 2', lat: 37.54, lng: 126.94, entrances: [{ label: 'HI_D2_1F_ENTER2', minFloor: 1, maxFloor: 1 }, { label: 'HI_D2_B1_1_ENTER', minFloor: -1, maxFloor: -1 }] },
  { id: 6, code: 'hongik_z1', name: 'First Z1\uB3D9', lat: 37.55, lng: 126.95, entrances: [] },
  { id: 7, code: 'hongik_z3', name: 'Third Z3\uB3D9', lat: 37.56, lng: 126.96, entrances: [{ label: 'HI_Z3_B1F_ENTER', minFloor: -1, maxFloor: -1 }] },
  { id: 8, code: 'hongik_t', name: 'Fourth T\uB3D9', lat: 37.57, lng: 126.97, entrances: [] },
  { id: 9, code: 'hongik_mh', name: 'Munheon MH\uB3D9', lat: 37.58, lng: 126.98, entrances: [] },
  { id: 10, code: 'hongik_b', name: 'Inmun B\uB3D9', lat: 37.6, lng: 127, entrances: [],
    boundary: [[37.6, 127], [37.6, 127.001], [37.601, 127.001], [37.601, 127]],
    extraBoundaries: [[[37.61, 127], [37.61, 127.001], [37.611, 127.001], [37.611, 127]]] },
]
