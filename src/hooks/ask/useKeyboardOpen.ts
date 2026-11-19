import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * 키보드가 떠 있는지(iOS 는 뜨기 직전 Will 이벤트, Android 는 Did 이벤트).
 * skipWeb 이면 웹에서는 듣지 않는다(늘 false).
 */
export function useKeyboardOpen({ skipWeb = false }: { skipWeb?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (skipWeb && Platform.OS === "web") return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [skipWeb]);
  return open;
}
