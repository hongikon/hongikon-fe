import { NEWS_DATA } from './news'
import type { PushNotificationData } from '../types'

/**
 * 알림 포맷을 눈으로 확인하기 위한 표본. 제목·본문은 서버 발송부(hongikon-be `NewsPushDispatcher`,
 * `ReportPushDispatcher`)가 실제로 채우는 문구와 같게 맞췄다.
 * `AppStatusScreen`(기기 내 로컬 알림 — 탭하면 실제 푸시와 같은 라우팅)과
 * `TempNotificationPreviewScreen`(`/temp/notifications`, 웹 카드 미리보기) 양쪽이 같은 표본을 쓴다.
 */
export interface PushNotificationSample {
  /** 테스트 버튼 이름 */
  label: string
  title: string
  body: string
  data: PushNotificationData
}

const SAMPLE_REPORT_TITLE = '붕어빵 트럭 왔어요'

/** 표본 제보 id. 서버에 없는 id 라 탭하면 지도가 "지금 지도에 없는 제보" 안내와 함께 열린다. */
const SAMPLE_REPORT_ID = 999_999_999

const newsSample: PushNotificationSample | null = NEWS_DATA[0]
  ? {
      label: '소식 알림',
      // 서버는 학과 이름(없으면 "{게시판} 공지")을 제목으로 쓴다.
      title: NEWS_DATA[0].source,
      body: NEWS_DATA[0].title,
      data: { type: 'NEWS', newsId: NEWS_DATA[0].id },
    }
  : null

export const PUSH_NOTIFICATION_SAMPLES: PushNotificationSample[] = [
  ...(newsSample ? [newsSample] : []),
  {
    label: '내 제보 승인 알림',
    title: '제보가 지도에 올라갔어요',
    body: SAMPLE_REPORT_TITLE,
    data: { type: 'REPORT_STATUS', reportId: SAMPLE_REPORT_ID, status: 'ACTIVE' },
  },
  {
    label: '내 제보 반려 알림',
    title: '제보가 반려됐어요',
    body: `${SAMPLE_REPORT_TITLE}\n사유: 위치가 캠퍼스 밖이에요`,
    data: { type: 'REPORT_STATUS', reportId: SAMPLE_REPORT_ID, status: 'REJECTED' },
  },
  {
    label: '캠퍼스 새 제보 알림',
    title: '새 제보 · 학생회관 1층',
    body: SAMPLE_REPORT_TITLE,
    data: { type: 'REPORT_NEW', reportId: SAMPLE_REPORT_ID },
  },
]
