import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { COLORS } from '../../../constants/colors'

/**
 * 작성자 기본 프로필: 연한 메인 컬러 동그라미 안에 사람 모양(자체 경로). 프로필 사진 기능이 없어 모두 같은 모양이다.
 * 예전엔 이름 첫 글자('와')를 넣었는데, 이름을 두 번 보여 줄 뿐이라 기본 프로필로 바꿨다(10-05 요청).
 * 지운 댓글 자리(name 없음)는 회색으로 그린다.
 */
export default function CommentAvatar({
  name,
  size = 32,
}: {
  name: string | null
  /** 예전 호출부 호환(색 고르기용이었다). 쓰지 않는다. */
  seed?: string | null
  size?: number
}) {
  const muted = !name
  const bg = muted ? COLORS.fill : COLORS.primarySoft
  const fg = muted ? COLORS.iconMuted : '#8C93C4'
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, overflow: 'hidden' }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Circle cx={16} cy={12.5} r={5.5} fill={fg} />
        <Path d="M5 31c0-6.6 4.9-10.5 11-10.5S27 24.4 27 31z" fill={fg} />
      </Svg>
    </View>
  )
}
