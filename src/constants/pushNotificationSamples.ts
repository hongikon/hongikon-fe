import type { PushNotificationData } from '../types'

/**
 * 알림 포맷을 눈으로 확인하기 위한 표본. 제목·본문은 서버 발송부(hongikon-be `NewsPushDispatcher`,
 * `ReportPushDispatcher`, `AdminAlertDispatcher`)가 실제로 채우는 문구와 같게 맞췄다.
 * 관리자 알림 표본은 관리자 계정이면 관리 탭으로, 아니면 지도 탭 + 안내로 열린다.
 * `AppStatusScreen`(기기 내 로컬 알림 — 탭하면 실제 푸시와 같은 라우팅)과
 * `TempNotificationPreviewScreen`(`/temp/notifications`, 웹 카드 미리보기) 양쪽이 같은 표본을 쓴다.
 */
export interface PushNotificationSample {
  /** 테스트 버튼 이름 */
  label: string
  /** Android 알림 채널(서버가 channelId 로 보내는 값). 없으면 기본 채널. */
  channelId?: string
  title: string
  body: string
  data: PushNotificationData
}

const SAMPLE_REPORT_TITLE = '붕어빵 트럭 왔어요'

/** 표본 제보 id. 서버에 없는 id 라 탭하면 지도가 "지금 지도에 없는 제보" 안내와 함께 열린다. */
const SAMPLE_REPORT_ID = 999_999_999

/**
 * 표본 소식. 운영 서버에 실제로 있는 공지 id 라 탭하면 상세 화면이 `GET /news/{id}` 로 받아 그린다.
 * 서버는 학과 이름(없으면 "{게시판} 공지")을 제목으로 쓴다.
 */
const NEWS_SAMPLE: PushNotificationSample = {
  label: '소식 알림',
  title: '장학 공지',
  body: '2026년 든든 학업지원금 공고문',
  data: { type: 'NEWS', newsId: '11950' },
}

export const PUSH_NOTIFICATION_SAMPLES: PushNotificationSample[] = [
  NEWS_SAMPLE,
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
  {
    label: '[관리] 새 제보 승인 대기',
    channelId: 'admin',
    title: '[관리] 새 제보 3건 승인 대기',
    body: `최근: ${SAMPLE_REPORT_TITLE} · 학생회관 1층`,
    data: { type: 'ADMIN_REPORT_PENDING', reportId: SAMPLE_REPORT_ID, count: 3 },
  },
  {
    label: '[관리] 새 문의',
    channelId: 'admin',
    title: '[관리] 새 문의',
    body: '새 문의가 도착했어요',
    data: { type: 'ADMIN_FEEDBACK', feedbackId: SAMPLE_REPORT_ID, count: 1 },
  },
  {
    label: '[관리] 신고 누적 자동 숨김',
    channelId: 'admin',
    title: '[관리] 신고 누적으로 자동 숨김',
    body: `${SAMPLE_REPORT_TITLE} · 학생회관 1층`,
    data: { type: 'ADMIN_REPORT_FLAGGED', reportId: SAMPLE_REPORT_ID, count: 1 },
  },
]
