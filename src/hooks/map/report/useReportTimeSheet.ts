import { useEffect } from 'react'
import { Keyboard } from 'react-native'
import type { ReportTimeSheetProps } from '../../../components/map/report/ReportTimeSheet'

/** ReportTimeSheet 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useReportTimeSheet(props: ReportTimeSheetProps) {
  // 작성창 제목·본문 입력칸에 포커스가 남아 있으면 이 시트 위로 키보드가 올라와 다이얼을 가린다(10-19 지적) — 열 때 내린다.
  useEffect(() => {
    if (props.visible) Keyboard.dismiss()
  }, [props.visible])
}
