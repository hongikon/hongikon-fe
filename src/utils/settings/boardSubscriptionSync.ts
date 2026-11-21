/**
 * 게시판 구독(`SettingsContext.subscribedDepts`·`mutedDepts`, TREE_DATA 리프 id) ↔ 서버
 * `/users/me/subscriptions` 동기화에 쓰는 순수 함수와 전송 대기열. React 에 기대지 않아
 * `fetch` 만 흉내 내면 따로 검증할 수 있다.
 *
 * 학과뿐 아니라 '대학' 게시판(학사·장학·교수학습지원·학생상담·대학혁신지원사업·학생활동)도
 * 서버 구독 단위라 리프 전부를 맞춘다(예전 `/users/me/departments` 동기화는 학과만 맞췄다).
 */

/** 게시판 하나에 대해 원하는 서버 상태. `null` 은 구독 해지, boolean 은 구독 + 알림 켜짐 여부. */
export type BoardTarget = boolean | null

/** 기기에 저장하는 구독 상태. `muted` 는 구독 중이지만 알림을 끈 게시판이다(항상 `subscribed` 의 부분집합). */
export interface BoardState {
  subscribed: string[]
  muted: string[]
}

export interface ServerBoard {
  sourceId: string
  alertEnabled: boolean
}

/** `muted` 를 `subscribed` 안으로 정리한다. 구독을 해지한 게시판의 알림 설정은 남기지 않는다. */
export function normalizeBoardState(state: BoardState): BoardState {
  const subscribed = new Set(state.subscribed)
  const muted = [...new Set(state.muted.filter((id) => subscribed.has(id)))]
  return muted.length === state.muted.length ? state : { ...state, muted }
}

/**
 * 로그인 직후 로컬 구독과 서버 구독을 합친다.
 *
 * - 구독 여부는 합집합이다. 게스트로 쓰다 로그인한 사용자는 로컬에만, 다른 기기에서 구독한 사용자는
 *   서버에만 구독이 있다. 어느 한쪽이 덮으면 고른 구독이 말없이 사라진다 — 하나 더 받는 것보다
 *   하나 놓치는 쪽이 더 나쁘다. 대신 다른 기기에서 해지한 게시판이 이 기기의 로컬 값으로 되살아날 수 있다.
 * - 알림 켜짐 여부는 양쪽에 다 있으면 서버 값을 따른다(알림 분야와 같은 기준 — 로그인한 사용자에겐
 *   서버가 진실 소스). 로컬에만 있는 게시판은 로컬 값을 서버로 올린다.
 * - `pending` 은 사용자가 방금 바꿨지만 아직 서버에 반영하지 못한 값이다. 서버 값보다 우선한다
 *   (`null` 이면 서버에 남아 있어도 되살리지 않는다).
 * - 앱이 모르는 sourceId(`known` 에 없음)는 화면에 그릴 수 없어 건너뛴다.
 *
 * 로컬 순서를 유지하고 서버에서만 온 게시판은 뒤에 붙인다.
 */
export function mergeBoardSubscriptions(
  local: BoardState,
  server: readonly ServerBoard[],
  known: ReadonlySet<string>,
  pending: ReadonlyMap<string, BoardTarget> = new Map(),
): BoardState {
  const serverAlert = new Map(server.map((s) => [s.sourceId, s.alertEnabled]))
  const localMuted = new Set(local.muted)

  const subscribed = [...local.subscribed]
  const seen = new Set(subscribed)
  for (const { sourceId } of server) {
    if (!known.has(sourceId) || seen.has(sourceId) || pending.get(sourceId) === null) continue
    subscribed.push(sourceId)
    seen.add(sourceId)
  }

  const alertOf = (id: string): boolean => {
    const target = pending.get(id)
    if (typeof target === 'boolean') return target
    return serverAlert.get(id) ?? !localMuted.has(id)
  }

  return { subscribed, muted: subscribed.filter((id) => !alertOf(id)) }
}

/**
 * 원하는 상태와 서버 상태의 차이. `toPut` 은 새로 구독하거나 알림 값이 다른 게시판,
 * `toDelete` 는 서버에만 남은 게시판이다. 앱이 모르는 sourceId 는 사용자가 해지할 방법도 없었으니 건드리지 않는다.
 */
export function diffBoardSubscriptions(
  desired: BoardState,
  server: readonly ServerBoard[],
  known: ReadonlySet<string>,
): { toPut: Array<[sourceId: string, alertEnabled: boolean]>; toDelete: string[] } {
  const serverAlert = new Map(server.map((s) => [s.sourceId, s.alertEnabled]))
  const muted = new Set(desired.muted)
  const wanted = new Set(desired.subscribed)

  const toPut: Array<[string, boolean]> = []
  for (const id of wanted) {
    const alertEnabled = !muted.has(id)
    if (serverAlert.get(id) !== alertEnabled) toPut.push([id, alertEnabled])
  }
  const toDelete = server
    .map((s) => s.sourceId)
    .filter((id) => known.has(id) && !wanted.has(id))
  return { toPut, toDelete }
}

/**
 * 전송 실패를 어떻게 다룰지.
 * - retry: 연결 문제. 값을 남겨 두었다가 재연결·포그라운드 때 다시 보낸다.
 * - drop: 서버가 거절(400 등). 다시 보내도 같아 버린다. 로컬 구독은 피드에도 쓰여 되돌리지 않는다.
 * - unsupported: 서버에 구독 API 가 아직 없다(404, 또는 토큰 재발급 뒤에도 401). 이번 실행 동안은 보내지 않고 로컬에만 둔다.
 */
export type SyncFailureKind = 'retry' | 'drop' | 'unsupported'

export interface BoardSyncQueueOptions {
  send: (sourceId: string, target: BoardTarget) => Promise<void>
  classify: (error: unknown) => SyncFailureKind
  /** 처음 'unsupported' 로 판정됐을 때 한 번 불린다. */
  onUnsupported?: () => void
  log?: (message: string, error: unknown) => void
}

export interface BoardSyncQueue {
  /** 원하는 값을 적고 바로 보낸다. 같은 게시판의 이전 미전송 값은 덮는다. */
  set: (sourceId: string, target: BoardTarget) => void
  /** 남아 있는 값을 전부 다시 보낸다. */
  flush: () => void
  /** 미전송 값을 버린다(로그아웃 — 이전 계정의 변경을 다음 계정에 보내면 안 된다). */
  clear: () => void
  /** 지금 서버에 반영되지 않은 값(게시판 → 원하는 상태). */
  readonly pending: ReadonlyMap<string, BoardTarget>
  /** 이번 실행 동안 서버에 구독 API 가 없다고 판정했는지. 앱을 다시 켜면 처음부터 다시 시도한다. */
  isUnsupported: () => boolean
  markUnsupported: () => void
  /** 보내는 중인 요청이 모두 끝날 때까지 기다린다(검증용). */
  idle: () => Promise<void>
}

/**
 * 게시판별로 줄을 세워 보내는 대기열.
 *
 * 같은 게시판의 PUT·DELETE 가 겹치면 늦게 보낸 요청이 먼저 처리돼 순서가 뒤집힐 수 있어,
 * 게시판 하나당 요청은 한 번에 하나만 보낸다. 보내는 사이 값이 또 바뀌면 끝난 뒤 마지막 값만 이어 보낸다.
 * 서로 다른 게시판은 동시에 보낸다.
 */
export function createBoardSyncQueue(options: BoardSyncQueueOptions): BoardSyncQueue {
  const { send, classify, onUnsupported, log } = options
  const pending = new Map<string, BoardTarget>()
  const inFlight = new Map<string, Promise<void>>()
  let unsupported = false

  const markUnsupported = () => {
    if (unsupported) return
    unsupported = true
    onUnsupported?.()
  }

  const flushOne = (sourceId: string): void => {
    if (unsupported || inFlight.has(sourceId) || !pending.has(sourceId)) return
    const target = pending.get(sourceId) as BoardTarget

    // 다음 마이크로태스크에 보낸다 — send 가 동기로 던져도 inFlight 표시가 먼저 붙고 finally 에서 확실히 떨어진다.
    const run = Promise.resolve().then(async () => {
      let sent = false
      try {
        await send(sourceId, target)
        if (pending.get(sourceId) === target) pending.delete(sourceId)
        sent = true
      } catch (error) {
        const kind = classify(error)
        if (kind === 'unsupported') {
          // 값은 남겨 둔다. 다음 실행 때 로그인 합치기가 로컬 상태로 다시 계산하므로 잃는 것은 없다.
          markUnsupported()
        } else if (kind === 'drop') {
          if (pending.get(sourceId) === target) pending.delete(sourceId)
        }
        log?.(`${sourceId} 구독 저장 실패(${kind})`, error)
      } finally {
        inFlight.delete(sourceId)
      }
      // 보내는 사이 값이 또 바뀌었으면 이어 보낸다. 실패했어도 새 값이 쌓였으면 그 값은 아직 한 번도 안 보냈으니
      // 보낸다(예전엔 성공했을 때만 이어 보내 마지막 변경이 다음 재연결까지 묶였다). 실패한 값 그대로 남은
      // 경우(retry)는 여기서 다시 보내지 않는다 — 같은 값을 곧바로 되풀이하면 연결이 없는 동안 끝없이 돈다.
      // 재시도는 재연결·포그라운드의 flush 몫이다.
      if (pending.has(sourceId) && (sent || pending.get(sourceId) !== target)) flushOne(sourceId)
    })
    inFlight.set(sourceId, run)
  }

  const flush = () => {
    for (const sourceId of [...pending.keys()]) flushOne(sourceId)
  }

  return {
    set(sourceId, target) {
      pending.set(sourceId, target)
      flushOne(sourceId)
    },
    flush,
    clear() {
      pending.clear()
    },
    pending,
    isUnsupported: () => unsupported,
    markUnsupported,
    async idle() {
      while (inFlight.size > 0) await Promise.all([...inFlight.values()])
    },
  }
}
