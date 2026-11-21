/**
 * 외부 스크립트(네이버 maps.js)를 한 번만 불러온다. 화면이 다시 붙을 때 태그가 이미 있어도
 * 아직 내려받는 중일 수 있어, 태그가 있다는 것만으로 끝났다고 보지 않고 실제 로드를 기다린다.
 * 실패한 태그는 지워 다음에 다시 시도할 수 있게 한다.
 */
export function loadExternalScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1' || (window as any).naver?.maps) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => {
      s.dataset.loaded = '1'
      resolve()
    }
    s.onerror = (error) => {
      s.remove()
      reject(error)
    }
    document.head.appendChild(s)
  })
}

/** 이 시간 안에 maps.js 가 안 오면 실패로 보고 다시 시도한다(네이티브 READY_TIMEOUT_MS 와 같다). */
export const LOAD_TIMEOUT_MS = 12_000

/** 자동으로 다시 시도하는 횟수와 간격. 넘으면 "다시 시도" 버튼을 띄우고 멈춘다. */
export const AUTO_RETRY_DELAYS_MS = [1_500, 4_000]

export function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout()
      reject(new Error('timeout'))
    }, ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

/** 지도 페이지 스크립트가 실제로 지도를 만들었는지. #map div 가 이름으로 window.map 에 잡히므로 인스턴스까지 본다. */
export function isMapReady(): boolean {
  const w = window as any
  return (
    typeof w.handleNativeMessage === 'function' &&
    !!w.naver?.maps?.Map &&
    w.map instanceof w.naver.maps.Map
  )
}

export function injectInlineScript(code: string) {
  const s = document.createElement('script')
  s.textContent = code
  // appendChild 시점에 동기적으로 실행되므로, 실행 뒤 태그를 지워도 효과는 남는다.
  // 제휴 칩을 누를 때마다 주입되는데, 지우지 않으면 head 에 태그가 계속 쌓인다.
  document.head.appendChild(s)
  s.remove()
}

export function extractExternalSrc(html: string): string | null {
  const m = html.match(/<script[^>]+src=["']([^"']+)["']/)
  return m ? m[1] : null
}

export function extractInlineScript(html: string): string {
  const parts: string[] = []
  const re = /<script(?:\s(?!src)[^>]*)?>([^]*?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    if (m[1].trim()) parts.push(m[1])
  }
  return parts.join('\n')
}
