/**
 * 학과 구독(`SettingsContext.subscribedDepts`, TREE_DATA 리프 id) ↔ 서버 `user_departments`
 * 동기화에 쓰는 순수 함수 모음. React·네트워크에 기대지 않아 따로 검증할 수 있다.
 *
 * 리프 id 는 `GET /departments` 의 `name` 과 같은 문자열이다(백엔드 시드가 TREE_DATA 에 맞춰져 있다).
 * '대학' 아래 게시판(학사·장학·교수학습지원·학생상담·대학혁신지원사업·학생활동)은 학과가 아니라
 * 목록에 없다 — 그런 리프는 서버와 맞출 대상이 아니라 로컬에만 둔다.
 */

export interface DepartmentLike {
  id: number
  name: string
}

/** 학과 목록으로 리프 id(=학과 이름) → departmentId 표를 만든다. */
export function buildDepartmentIdMap(departments: readonly DepartmentLike[]): Map<string, number> {
  return new Map(departments.map((d) => [d.name, d.id]))
}

/**
 * 로그인 직후 로컬 구독과 서버 구독을 합친다(합집합).
 *
 * 합집합으로 정한 이유: 게스트로 쓰다 로그인한 사용자는 로컬에만, 다른 기기에서 구독한 사용자는
 * 서버에만 구독이 있다. 어느 한쪽이 덮으면 사용자가 고른 구독이 말없이 사라진다 — 하나 더 받는 것보다
 * 하나 놓치는 쪽이 더 나쁘다. 대신 다른 기기에서 해지한 학과가 이 기기의 로컬 값으로 되살아날 수 있다.
 *
 * `pendingRemovals` 는 사용자가 방금 해지했지만 아직 서버에 반영되지 않은 리프다 — 서버 목록에
 * 남아 있어도 되살리지 않는다. 로컬 순서를 유지하고 서버에서만 온 리프는 뒤에 붙인다.
 */
export function mergeDeptSubscriptions(
  localLeaves: readonly string[],
  serverDepartmentIds: readonly number[],
  idByLeaf: ReadonlyMap<string, number>,
  pendingRemovals: ReadonlySet<string> = new Set(),
): string[] {
  const leafById = new Map<number, string>()
  idByLeaf.forEach((id, leaf) => leafById.set(id, leaf))

  const merged = [...localLeaves]
  const seen = new Set(localLeaves)
  for (const id of serverDepartmentIds) {
    const leaf = leafById.get(id)
    // 앱이 모르는 학과(서버에만 새로 생긴 학과 등)는 화면에 그릴 수 없어 건너뛴다.
    if (!leaf || seen.has(leaf) || pendingRemovals.has(leaf)) continue
    merged.push(leaf)
    seen.add(leaf)
  }
  return merged
}

/**
 * 원하는 구독(리프 목록)과 서버 구독(departmentId 목록)의 차이. 학과가 아닌 리프는 무시한다. */
export function diffDeptSubscriptions(
  desiredLeaves: readonly string[],
  serverDepartmentIds: readonly number[],
  idByLeaf: ReadonlyMap<string, number>,
): { toAdd: number[]; toRemove: number[] } {
  const desiredIds = new Set<number>()
  for (const leaf of desiredLeaves) {
    const id = idByLeaf.get(leaf)
    if (id !== undefined) desiredIds.add(id)
  }
  const knownIds = new Set(idByLeaf.values())
  const serverIds = new Set(serverDepartmentIds)
  return {
    toAdd: [...desiredIds].filter((id) => !serverIds.has(id)),
    // 앱이 모르는 학과는 사용자가 해지할 방법도 없었으니 서버 값을 건드리지 않는다.
    toRemove: [...serverIds].filter((id) => knownIds.has(id) && !desiredIds.has(id)),
  }
}

/**
 * 결과를 한 번만 받아 두는 비동기 함수. 실패하면 기억하지 않아 다음 호출이 다시 시도한다
 * (끊긴 상태에서 한 번 실패했다고 앱을 다시 켤 때까지 동기화가 막히면 안 된다).
 */
export function memoizeAsync<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null
  return () => {
    if (!cached) {
      cached = load().catch((error: unknown) => {
        cached = null
        throw error
      })
    }
    return cached
  }
}
