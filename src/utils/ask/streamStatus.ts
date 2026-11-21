import { ApiError } from '../../apis/client'
import type { AskStreamEvent } from '../../apis/ask'

/**
 * 흘려받기 진행 이벤트 → 지금 하는 일 한 줄(status)과 '살펴본 과정' 한 줄(step). 쉬운 말만 쓴다 — 안내 id·검색어·안내 첫 문장 조각을
 * 그대로 보였더니 알아보기 힘들었다(10-16 사용자 지적). 사람이 읽을 수 있는 공지 제목·학식 날짜만 과정에 남긴다.
 */
export function stepInfo(event: AskStreamEvent): { status: string; step: string | null } | null {
  switch (event.event) {
    case 'picked':
      return { status: '관련 문서를 읽고 있어요', step: `관련 안내 ${event.data.titles.length}개 확인` }
    case 'search':
      return { status: '관련 문서를 더 찾고 있어요', step: '다른 안내 찾아봄' }
    case 'read':
      return { status: '찾은 문서를 읽고 있어요', step: '안내 원문 읽음' }
    case 'noticeSearch':
      return { status: '학교 공지를 찾고 있어요', step: '학교 공지 찾아봄' }
    case 'noticeRead':
      return { status: '공지를 읽고 있어요', step: `공지 읽음 · ${event.data.title}` }
    case 'cafeteria':
      return { status: '학식 메뉴를 확인하고 있어요', step: `학식 확인 · ${event.data.date}` }
    case 'thinking':
      // 답 쓰기 호출부터 첫 글자까지 수 초(모델이 원문을 따지는 중) — 문구만 바꾸고 과정 줄은 늘리지 않는다(11-01).
      return { status: event.data.afterTools ? '찾은 내용으로 답을 준비하고 있어요' : '원문을 따져 보며 답을 준비하고 있어요', step: null }
    case 'writing':
      return { status: '답을 정리하고 있어요', step: '답 정리' }
    default:
      return null
  }
}

/** 과정 목록에 한 줄을 잇는다. 같은 일이 잇따르면(공지를 여러 번 찾기 등) 한 번만 남기고, step 이 null 이면 그대로. */
export function appendStep(steps: string[], step: string | null): string[] {
  return step === null || steps[steps.length - 1] === step ? steps : [...steps, step]
}

/** 서버 답이 실패했을 때 알릴 말. 상태 코드는 routeAsk(ApiError)에서만 알 수 있다 — 흘려받기 도중 끊기면 일반 문구. */
export function askFailureText(error: unknown, app: boolean): string {
  const status = error instanceof ApiError ? error.status : null
  // 앱 탭: 하루 한도·로그인 안내는 서버 문구를 그대로(계정 한도인지 전체 상한인지 서버만 안다).
  if (app && (status === 429 || status === 403) && error instanceof ApiError && error.serverMessage) return error.serverMessage
  if (status === 429) return '질문이 많아 잠시 쉬고 있어요. 조금 뒤에 다시 물어봐 주세요.'
  if (status === 403) {
    return app ? '로그인하면 물어볼 수 있어요.' : '암호키가 맞지 않아 답할 수 없어요. /dev 화면에서 암호키를 다시 넣어 주세요.'
  }
  if (status === 404) return '지금은 물어보기 서버가 꺼져 있어 답할 수 없어요.'
  return '지금은 답을 만들 수 없어요. 잠시 뒤에 다시 물어봐 주세요.'
}
