import { lazy, type ComponentType } from 'react'

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
/** 개발용 `/dev/sogang` — 서강대 시설 조사 결과 미리보기. 인증키를 맞혀야 화면·데이터를 받는다(`DevSogangGate`). */
export const DevSogangEntry: ComponentType | null = lazy(() => import('../screens/DevSogangGate'))
export const TempNotificationPreviewEntry: ComponentType | null = lazy(
  () => import('../screens/TempNotificationPreviewScreen'),
)
