import type { AskAppCommand } from '../askAppCommand'

/** 설정 확인 카드의 물음(누르기 전). */
export function commandText(command: AskAppCommand): string {
  switch (command.kind) {
    case 'subscribe':
      if (command.on) {
        return command.boards.length > 1
          ? '어느 게시판을 구독할까요? 구독하면 소식 탭에 그 게시판 공지가 모이고 알림을 받을 수 있어요.'
          : `${command.boards[0].name} 게시판을 구독할까요? 구독하면 소식 탭에 공지가 모이고 알림을 받을 수 있어요.`
      }
      return command.boards.length > 1 ? '어느 게시판 구독을 해제할까요?' : `${command.boards[0].name} 게시판 구독을 해제할까요?`
    case 'boardAlert':
      return `${command.boards.map((b) => b.name).join(', ')} 게시판 알림을 ${command.on ? '켤' : '끌'}까요?`
    case 'alertAll':
      return command.on ? '앱 알림을 다시 켤까요?' : '앱 알림을 모두 끌까요? 끄면 구독한 게시판·분야 소식 알림이 오지 않아요.'
    case 'alertCategory':
      return `${command.category} 분야 알림을 ${command.on ? '켤' : '끌'}까요?`
    case 'open':
      return command.screen === 'alerts'
        ? "알림은 설정 탭 > 알림에서 바꿔요. 전체 알림, 분야별 알림(공지·장학·행사·수강·시설·취업·상담), 게시판별 알림, 제보 알림을 켜고 끌 수 있어요. 여기서 '장학 알림 꺼 줘'처럼 말해도 돼요."
        : "게시판 구독은 소식 탭이나 설정 탭 > 구독 관리에서 해요. 여기서 '화학공학과 구독해 줘'처럼 말해도 돼요."
  }
}

/** 게시판 하나를 고르는 버튼의 동사. */
export function boardCommandVerb(command: Extract<AskAppCommand, { kind: 'subscribe' | 'boardAlert' }>): string {
  return command.kind === 'subscribe' ? (command.on ? '구독하기' : '구독 해제') : command.on ? '알림 켜기' : '알림 끄기'
}

