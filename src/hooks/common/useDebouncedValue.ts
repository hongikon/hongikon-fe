import { useEffect, useState } from 'react'

/** 값이 `delayMs` 동안 그대로일 때만 바뀐 값을 내준다. 타이핑마다 서버 검색을 보내지 않으려고 쓴다. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
