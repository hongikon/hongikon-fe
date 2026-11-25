import { useEffect, useState } from 'react'
import { fetchWalkRestrictionSpots, type WalkRestrictionSpot } from '../../apis/walkRestrictions'

const EMPTY: WalkRestrictionSpot[] = []

/** 길찾기 경로를 그리는 동안(active) 막힌 곳 목록을 받는다. 길찾기를 열 때마다 새로 받는다(관리자가 방금 바꿨을 수 있다). */
export function useWalkRestrictionSpots(active: boolean): WalkRestrictionSpot[] {
  const [spots, setSpots] = useState<WalkRestrictionSpot[]>(EMPTY)
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    fetchWalkRestrictionSpots(controller.signal).then((list) => {
      if (!controller.signal.aborted) setSpots(list.length ? list : EMPTY)
    })
    return () => controller.abort()
  }, [active])
  return spots
}
