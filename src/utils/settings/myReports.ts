import type { MyReport, MyReportDisplayStatus } from '../../apis/myReports'
import { REPORT_CATEGORIES } from '../../constants/reportCategories'
import { formatFloor } from '../common/floors'

export const CATEGORY_BY_KEY = new Map(REPORT_CATEGORIES.map((meta) => [meta.key, meta]))

/** 분류 이름. 기타에 직접 적은 이름이 있으면 그걸 쓴다. */
export function categoryLabel(report: MyReport): string {
  if (report.category === 'ETC' && report.customCategoryLabel) return report.customCategoryLabel
  return CATEGORY_BY_KEY.get(report.category)?.label ?? '기타'
}

/** 건물·층. 캠퍼스 밖 제보는 건물·층이 없어 적은 장소 설명을 보여 준다. 둘 다 없으면 null. */
export function placeLabel(report: MyReport): string | null {
  const parts = [report.buildingName, report.floor !== null && report.floor !== undefined ? formatFloor(report.floor) : null]
  const text = parts.filter(Boolean).join(' ')
  return text || report.placeLabel?.trim() || null
}

/** 제보 삭제 확인 문구 — 지도에 올라간 것·승인 대기·그 밖에 따라 다르게. */
export function deleteConfirmMessage(status: MyReportDisplayStatus): string {
  return status === 'ACTIVE' || status === 'SCHEDULED'
    ? '지도에서도 내려가고 되돌릴 수 없어요. 삭제할까요?'
    : status === 'PENDING'
      ? '승인 대기 중인 제보를 취소하고 지워요. 되돌릴 수 없어요.'
      : '내역에서 지우면 되돌릴 수 없어요. 삭제할까요?'
}
