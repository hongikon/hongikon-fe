import { useEffect, useRef } from "react";
import { getPopularGuides } from "../../apis/ask";
import { guidesFromIds, type GreetingGuide } from "../../utils/askGreeting";

/** 요즘 많이 찾는 안내 — 탭을 열 때 한 번 받아 둔다(인사할 때 기다리지 않게). 못 받으면 빈 목록 → 기본 안내. */
export function usePopularGuides() {
  const popularRef = useRef<GreetingGuide[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    getPopularGuides(abort.signal).then((ids) => {
      if (!abort.signal.aborted) popularRef.current = guidesFromIds(ids);
    });
    return () => abort.abort();
  }, []);
  return popularRef;
}
