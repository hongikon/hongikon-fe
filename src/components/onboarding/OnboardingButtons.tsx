import Button from '../common/Button'

interface ButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  accessibilityHint?: string
}

/**
 * 온보딩 하단의 꽉 찬 버튼. 앱 공용 Button(lg)을 그대로 써서 다른 화면의 주 버튼과 같은 모양이다.
 * `tone="soft"` 는 "나중에 할게요"처럼 넘어가기만 하는 버튼에 쓴다(secondary).
 */
export function OnboardingPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  accessibilityHint,
  tone = 'solid',
}: ButtonProps & { tone?: 'solid' | 'soft' }) {
  return (
    <Button
      label={label}
      onPress={onPress}
      variant={tone === 'soft' ? 'secondary' : 'primary'}
      disabled={disabled}
      loading={loading}
      accessibilityHint={accessibilityHint}
    />
  )
}

/** 큰 버튼 아래의 가벼운 글자 버튼(나중에·건너뛰기). */
export function OnboardingTextButton({ label, onPress, disabled }: ButtonProps) {
  return <Button label={label} onPress={onPress} disabled={disabled} variant="ghost" size="md" />
}
