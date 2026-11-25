import { useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ModerationMenuProps } from '../../../components/map/report/ModerationMenu'

/** ModerationMenu 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useModerationMenu({ visible }: Pick<ModerationMenuProps, 'visible'>) {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<'menu' | 'reasons'>('menu')

  useEffect(() => {
    if (visible) setStep('menu')
  }, [visible])
  return { insets, step, setStep }
}
