import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
import { PARTNER_NOTICE_TEXT } from '../components/map/PartnerNoticeModal'

export interface AppNoticeSlide {
  /** 그림 칸에 크게 그리는 아이콘(그림 파일이 생기면 바꾼다). */
  icon: ComponentProps<typeof Ionicons>['name']
  /** 그림 칸 위 작은 꼬리표(예: '11월 업데이트'). */
  badge?: string
  title: string
  text: string
}

export interface AppNoticePopup {
  /** 이날(KST, 'YYYY-MM-DD')까지 띄운다. */
  until: string
  /** 서버 공지(관리자 페이지에서 쓴 것)는 시각까지 정해져 있어 이 시각(epoch ms) 전까지만 띄운다. 있으면 until 대신 쓴다. */
  untilMs?: number
  /** 옆으로 넘기는 카드. 마지막 카드 아래에 linkLabel 이 붙는다. */
  slides: AppNoticeSlide[]
  /** 누르면 이 공지 본문(설정 > 공지사항과 같은 화면)을 연다. */
  linkLabel: string
}

/**
 * 공지 본문 아래 "이전 → 이후" 비교(11-06, 처리방침 변경 공지). after 에서 {{ }} 로 감싼 부분이 바뀐 곳이라
 * 메인 컬러로 강조한다. 문장은 처리방침(legalText.ts) 원문을 그대로 옮긴다.
 */
export interface NoticeComparison {
  title: string
  rows: { label: string; before: string; after: string }[]
}

export interface AppNotice {
  id: string
  title: string
  date: string
  body: string
  /** 앱을 켤 때 한 번 띄우는 요약(LaunchNoticeModal). 없으면 공지사항 목록에만 있다. */
  popup?: AppNoticePopup
  comparison?: NoticeComparison
  /** 서버 공지의 게시 시각(epoch ms). 앱에 적힌 공지와 섞어 최신순으로 줄 세울 때 쓴다(없으면 date 의 KST 자정). */
  publishedMs?: number
}

/** 최신순. 날짜는 'YYYY.MM.DD'. 앱에 실제로 있는 기능만 적는다(길찾기는 11-03부터 켜짐 — ROUTE_FINDING_ENABLED, 1.1.0 빌드부터 '내 위치' 출발). */
export const APP_NOTICES: AppNotice[] = [
  {
    id: '5',
    title: '홍익온 v1.0.0 출시',
    date: '2026.10.01',
    body:
      '홍익온이 출시됐어요.\n\n' +
      '· 지도: 캠퍼스 건물과 편의 시설, 학생 제휴 업체를 한눈에 볼 수 있어요.\n' +
      '· 소식: 학과·학교 공지를 구독하고 북마크해 두세요. 새 공지는 알림으로 받을 수 있어요(로그인 필요).\n' +
      '· 제보: 캠퍼스에서 벌어지는 일을 지도에 제보할 수 있어요. 운영진 확인 뒤 지도에 올라가요(로그인 필요).\n\n' +
      '불편한 점이나 바라는 기능은 설정 > 문의하기로 알려 주세요.',
  },
  {
    id: '4',
    title: '제휴 정보 안내',
    date: '2026.08.20',
    body: PARTNER_NOTICE_TEXT,
  },
]
