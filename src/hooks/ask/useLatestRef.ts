import { useRef } from "react";

/** 그린 때의 최신 값을 담는 ref. 참조가 바뀌지 않는 콜백이 지금 값을 읽을 때 쓴다(그릴 때마다 덮어쓴다). */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
