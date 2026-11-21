import { useEffect, useState } from 'react'
import type { AppNotice } from '../../constants/appNotices'
import type { NoticeListModalProps } from '../../components/settings/NoticeListModal'

/** NoticeListModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNoticeListModal({ visible, onClose }: Pick<NoticeListModalProps, 'visible' | 'onClose'>) {
  // 고른 공지는 창을 새로 띄우지 않고 이 창 안에서 본문으로 바꿔 보여 준다(NoticeDetailContent 설명 참고).
  // 뒤로 가기·가장자리 밀기는 본문에서는 목록으로, 목록에서는 창을 닫는다.
  const [selected, setSelected] = useState<AppNotice | null>(null)
  useEffect(() => {
    if (!visible) setSelected(null)
  }, [visible])
  const back = () => (selected ? setSelected(null) : onClose())
  return { selected, setSelected, back }
}
