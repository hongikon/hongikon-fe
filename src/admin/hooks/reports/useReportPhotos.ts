import { useState } from 'react'
import type { Props } from '../../components/reports/ReportPhotos'

/** ReportPhotos 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportPhotos() {
  /** 사진 URL 이 만료(1시간)돼 못 불러온 장. 새로고침하면 새 URL 을 받는다. */
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<readonly string[]>([])
  /** 크게 보고 있는 사진 순번. null 이면 닫혀 있다. */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  return { failedPhotoUrls, setFailedPhotoUrls, viewerIndex, setViewerIndex }
}
