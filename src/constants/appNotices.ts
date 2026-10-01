import { PARTNER_NOTICE_TEXT } from '../components/map/PartnerNoticeModal'

export interface AppNotice {
  id: string
  title: string
  date: string
  body: string
}

/** 최신순. 날짜는 'YYYY.MM.DD'. 앱에 실제로 있는 기능만 적는다(길찾기는 아직 꺼져 있다 — ROUTE_FINDING_ENABLED). */
export const APP_NOTICES: AppNotice[] = [
  {
    id: '5',
    title: '홍익온 v1.0.0 출시',
    date: '2026.10.01',
    body:
      '홍익온이 출시되었습니다.\n\n' +
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
