import { type Lens } from '../../hooks/common/useBubbleVisible'

/** 떠오를수록 칸보다 조금 크게 — 세로로 조금 더 부풀어 바 위아래로 아주 살짝 삐져나온다. */
export function growTransforms(lens: Lens) {
  return [
    // 0 아래로 넘친 스프링 값에서 알약이 칸보다 작아지지 않게(위아래·좌우 틈이 4 보다 커지지 않게) 묶는다.
    { scaleX: lens.lift.interpolate({ inputRange: [0, 1], outputRange: [1, lens.grow.x], extrapolateLeft: 'clamp' }) },
    { scaleY: lens.lift.interpolate({ inputRange: [0, 1], outputRange: [1, lens.grow.y], extrapolateLeft: 'clamp' }) },
  ]
}
