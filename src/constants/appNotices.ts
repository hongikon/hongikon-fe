import { PARTNER_NOTICE_TEXT } from '../components/map/PartnerNoticeModal'

export interface AppNotice {
  id: string
  title: string
  date: string
  body: string
}

export const APP_NOTICES: AppNotice[] = [
  {
    id: '4',
    title: '제휴 정보 안내',
    date: '2026.08.20',
    body: PARTNER_NOTICE_TEXT,
  },
  {
    id: '3',
    title: '홍익대알리미 v1.0.0 출시',
    date: '2024.08.01',
    body: '홍익대알리미가 정식 출시되었습니다. 캠퍼스 지도, 학과별 소식, 길찾기 기능을 이용해보세요.',
  },
  {
    id: '2',
    title: '소식 탭 업데이트 안내',
    date: '2024.08.05',
    body: '북마크, 구독, 전체 탭으로 소식을 더 편리하게 확인할 수 있습니다. 구독 소식 알림도 설정에서 켜보세요.',
  },
  {
    id: '1',
    title: '지도 기능 개선 예정',
    date: '2024.08.10',
    body: '실제 네이버/카카오 지도 연동 및 GPS 기반 현위치 표시 기능이 다음 업데이트에 추가될 예정입니다.',
  },
]
