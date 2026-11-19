/**
 * 마지막 요청만 결과를 반영하게 하는 문. 요청을 보낼 때 `begin()` 으로 번호를 받고, 응답이 오면
 * `isCurrent(번호)` 로 그 사이 더 새 요청이 나갔거나(`begin`) 화면이 닫혔는지(`close`) 확인한다.
 * 늦게 온 옛 응답이 새 값을 덮어쓰지 않게 하려는 것이다.
 */
export interface LatestGate {
  begin: () => number
  isCurrent: (token: number) => boolean
  /** 진행 중인 요청을 모두 옛것으로 만든다(화면 이탈·창 닫힘). */
  close: () => void
}

export function createLatestGate(): LatestGate {
  let current = 0
  return {
    begin: () => {
      current += 1
      return current
    },
    isCurrent: (token) => token === current,
    close: () => {
      current += 1
    },
  }
}
