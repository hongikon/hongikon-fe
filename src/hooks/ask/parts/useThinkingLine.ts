import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Platform } from 'react-native'

/** ThinkingLine 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useThinkingLine({ text }: Pick<{ text: string }, 'text'>) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(Date.now()).current;
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== "web" }).start();
  }, [text, enter]);
  return { pulse, enter, seconds }
}
