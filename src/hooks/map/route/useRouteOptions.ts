import { useEffect, useRef, useState } from 'react'
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { describeRoutes } from '../../../utils/map/route/routeLabels'
import { PAGE_GAP, SETTLE_MS } from '../../../utils/map/route/routeOptions'
import type { RouteOptionsProps } from '../../../components/map/route/RouteOptions'

/** RouteOptions 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useRouteOptions({ routes, selectedIndex, onSelect }: Pick<RouteOptionsProps, 'routes' | 'selectedIndex' | 'onSelect'>) {
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const texts = describeRoutes(routes);
  const page = width + PAGE_GAP * 2;

  // 밖에서 고른 길이 바뀌면(새 경로는 0번부터) 그 카드로 옮긴다.
  useEffect(() => {
    if (page > 0)
      scrollRef.current?.scrollTo({ x: selectedIndex * page, animated: true });
  }, [selectedIndex, page]);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const index = Math.max(
        0,
        Math.min(routes.length - 1, Math.round(x / page)),
      );
      if (index !== selectedIndex) onSelect(index);
    }, SETTLE_MS);
  };
  return { width, setWidth, scrollRef, texts, page, handleScroll }
}
