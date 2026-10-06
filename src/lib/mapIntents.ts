/**
 * 다른 화면이 지도 탭에 "이걸 해 달라"고 넘기는 한 번짜리 요청.
 * - pickPartnerLocation: 설정의 정보 제보 창에서 "지도에서 위치 찍기"를 누르면 지도 탭으로 옮겨 가 핀 고르기를 시작한다.
 * - focusReport: 제보 알림(REPORT_STATUS 승인·REPORT_NEW)이나 내 제보 내역의 "지도에 표시 중" 제보를 누르면 제보 레이어를 켜고 그 제보를 가운데에 띄운다.
 * - previewLocation: 관리 탭 제보 검토의 "지도에서 보기" → 지도 탭으로 옮겨 그 좌표에 임시 핀을 찍고 가운데로(승인 전 제보도 볼 수 있게).
 * - startReport: 내 제보 내역이 비어 있을 때 "지도로 가서 제보하기" → 제보 위치 고르기를 시작한다(게스트면 로그인 안내).
 * 지도 화면은 포커스될 때 요청을 꺼내(consume) 처리한다 — 두 번 처리되지 않는다.
 */
export type MapIntent =
  | { type: 'pickPartnerLocation' }
  | { type: 'focusReport'; reportId: number }
  | { type: 'startReport' }
  /** label: 핀 이름표(제보 제목). detail: 지도 위 안내 줄에 덧붙일 작성자·건물·층. */
  | { type: 'previewLocation'; lat: number; lng: number; label?: string; detail?: string }

/**
 * focusReport 요청은 웹에서 sessionStorage 에도 15분 동안 남긴다. 카카오·Apple 웹 로그인은 페이지를 통째로 넘겼다
 * 돌아오므로 메모리만으로는 "로그인하고 보던 제보로 돌아가기"가 사라진다.
 */
const STORAGE_KEY = 'hongikon_pending_map_intent'
const STORED_INTENT_TTL_MS = 15 * 60 * 1000

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null
  } catch {
    return null
  }
}

function saveStored(intent: MapIntent | null): void {
  const store = storage()
  if (!store) return
  try {
    if (intent && intent.type === 'focusReport') {
      store.setItem(STORAGE_KEY, JSON.stringify({ intent, savedAt: Date.now() }))
    } else {
      store.removeItem(STORAGE_KEY)
    }
  } catch {
    // 저장 공간을 못 쓰면(사파리 사생활 보호 등) 메모리로만 처리한다.
  }
}

function loadStored(): MapIntent | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { intent?: MapIntent; savedAt?: number }
    if (!parsed.intent || parsed.intent.type !== 'focusReport' || typeof parsed.intent.reportId !== 'number') return null
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > STORED_INTENT_TTL_MS) return null
    return parsed.intent
  } catch {
    return null
  }
}

let pending: MapIntent | null = loadStored()
const listeners = new Set<() => void>()

export function requestMapIntent(intent: MapIntent): void {
  pending = intent
  saveStored(intent)
  listeners.forEach((listener) => listener())
}

export function consumeMapIntent(): MapIntent | null {
  const intent = pending
  pending = null
  if (intent) saveStored(null)
  return intent
}

/**
 * 지금 지도에 열려 있는 제보(시트). 게스트가 댓글·공감 등을 누르다 "로그인하러 가기"로 떠났다가 로그인하거나
 * 둘러보기로 돌아오면 이 제보를 다시 띄운다(promptLogin → returnToOpenReportAfterAuth).
 */
let openReportId: number | null = null

export function setOpenReport(reportId: number | null): void {
  openReportId = reportId
}

/** 열려 있던 제보가 있으면 지도에 돌아왔을 때 그 제보를 다시 띄우도록 걸어 둔다. */
export function returnToOpenReportAfterAuth(): void {
  if (openReportId === null) return
  // 지금 떠 있는 지도에 바로 알리면 로그인 화면으로 넘어가기 전에 처리돼 버린다. 조용히 걸어 두고,
  // 로그인·둘러보기 뒤 지도 탭이 다시 포커스될 때 꺼내 쓰게 한다.
  pending = { type: 'focusReport', reportId: openReportId }
  saveStored(pending)
}

/** 지도 탭이 이미 떠 있는 상태에서 요청이 오면 바로 처리할 수 있게 알린다. */
export function subscribeMapIntent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
