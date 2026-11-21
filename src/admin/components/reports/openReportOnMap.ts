import { requestMapIntent } from '../../../lib/mapIntents'
import { navigationRef } from '../../../navigation/navigationRef'
import { openExternalUrl } from '../../../utils/common/openExternalUrl'
import type { AdminReport } from '../../types'
import { googleMapsSearchUrl, reportMapPreviewDetail } from '../../utils/reportReview'

/**
 * 제보 위치를 지도에서 연다. 좌표가 없으면 아무것도 안 한다.
 * - 앱 관리 탭: 우리 지도 탭으로 옮겨 그 좌표에 핀을 찍는다(승인 전 제보도 확인 가능).
 * - 웹 /admin: 좌표 검색이 정확한 구글 지도로 연다(네이버 좌표 검색은 위치가 어긋났다).
 */
export function openReportOnMap(report: AdminReport, app: boolean): void {
  if (report.lat === null || report.lng === null) return
  if (app) {
    requestMapIntent({
      type: 'previewLocation',
      lat: report.lat,
      lng: report.lng,
      label: report.title,
      detail: reportMapPreviewDetail(report),
    })
    if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Map' })
    return
  }
  openExternalUrl(googleMapsSearchUrl(report.lat, report.lng))
}
