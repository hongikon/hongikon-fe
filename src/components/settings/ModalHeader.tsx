import type { ReactNode } from 'react'
import ScreenHeader from '../common/ScreenHeader'

interface ModalHeaderProps {
  title: string
  onClose: () => void
  /** 오른쪽 자리(완료 등) */
  right?: ReactNode
}

/** 전체 화면 창(설정의 각 창)의 머리줄. 쌓인 화면과 같은 ScreenHeader 를 쓴다. */
export default function ModalHeader({ title, onClose, right }: ModalHeaderProps) {
  return <ScreenHeader title={title} onBack={onClose} right={right} />
}
