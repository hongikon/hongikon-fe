import { lazy, type ComponentType } from 'react'
import type { CampusPreviewKey } from './campusPreview'

/**
 * 웹 전용 `/temp/*` 디버그 화면 진입점. 해당 경로로 들어왔을 때만 지연 로드해, 일반 화면을 여는
 * 사용자는 디버그 화면 코드를 받지 않는다. 네이티브는 `TempDebugEntry.tsx`(null)가 쓰인다.
 */
export const TempEntranceDebugEntry: ComponentType<{ mode: 'dots' | 'paths' | 'nodes' }> | null = lazy(
  () => import('../screens/TempEntranceDebugScreen'),
)
/** 개발용 `/dev/path` — 암호키 입력 후 경로망 점검(빠진 지점·끊긴 간선). */
export const DevPathAuditEntry: ComponentType | null = lazy(() =>
  import('../screens/DevPathGate').then(({ default: Gate }) => ({ default: () => <Gate mode="audit" /> })),
)
/** 개발용 `/dev/path-survey` — 암호키 입력 후 경로망 현장 조사(지점·간선 찍기, 메모). */
export const DevPathSurveyEntry: ComponentType | null = lazy(() =>
  import('../screens/DevPathGate').then(({ default: Gate }) => ({ default: () => <Gate mode="survey" /> })),
)
/** Developer /dev/path-survey-v3: new one-graph path survey behind the same key gate. */
export const DevPathSurveyV3Entry: ComponentType | null = lazy(() =>
  import('../screens/DevPathGate').then(({ default: Gate }) => ({ default: () => <Gate mode="surveyV3" /> })),
)
/** 개발용 `/dev/ask` — 암호키 입력 후 '물어보기' 챗봇 미리보기(완성 전까지 운영 앱에 넣지 않는다). */
export const DevAskEntry: ComponentType | null = lazy(() =>
  import('../screens/DevPathGate').then(({ default: Gate }) => ({ default: () => <Gate mode="ask" /> })),
)
/** 개발용 `/dev/sogang`·`/dev/yonsei`·`/dev/ewha` — 다른 학교 시설 조사 결과 미리보기. 인증키를 맞혀야 화면·데이터를 받는다(`DevCampusGate`). */
export const DevCampusEntry: ComponentType<{ campus: CampusPreviewKey }> | null = lazy(() => import('../screens/DevCampusGate'))
/** 개발용 `/temp/changes` — 11-08 바뀐 화면 미리보기(개발 서버·테스트 빌드 웹에서만). */
export const TempChangesPreviewEntry: ComponentType | null = lazy(() => import('../screens/TempChangesPreviewScreen'))
export const TempNotificationPreviewEntry: ComponentType | null = lazy(
  () => import('../screens/TempNotificationPreviewScreen'),
)
