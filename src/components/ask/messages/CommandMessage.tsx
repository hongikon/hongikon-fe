import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { ChatMessageOf } from "../../../utils/ask/chatTypes";
import { boardCommandVerb, commandText } from "../../../utils/ask/appCommandText";
import { askStyles, botBubbleStyle } from "../askStyles";
import type { AskMessageActions, AskMessageEnv } from "./types";

function CommandButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={askStyles.option} activeOpacity={0.7} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={askStyles.optionText}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * 설정 바꾸기·화면 열기 확인 카드(11-09). 학생이 버튼을 눌러야만 바뀌고, 누른 뒤에는 결과 한 줄만 남는다.
 * '어떻게 해' 물음은 바꾸지 않고 설정 화면 열기 버튼만(onOpenSettings 가 없으면 안내만).
 */
export default function CommandMessage({ item, env, actions }: { item: ChatMessageOf<"command">; env: AskMessageEnv; actions: AskMessageActions }) {
  const { command } = item;
  const { onOpenSettings } = env;
  let buttons: ReactNode[] = [];
  if (item.done === null) {
    if (command.kind === "subscribe" || command.kind === "boardAlert") {
      buttons = command.boards.map((board) => {
        const verb = boardCommandVerb(command);
        return <CommandButton key={board.id} label={`${verb} · ${board.name}`} onPress={() => actions.applyCommand(item, board.id)} />;
      });
    } else if (command.kind === "alertAll" || command.kind === "alertCategory") {
      buttons = [<CommandButton key="apply" label={command.on ? "알림 켜기" : "알림 끄기"} onPress={() => actions.applyCommand(item)} />];
    }
  }
  if (command.kind === "open" && onOpenSettings) {
    const label = command.screen === "alerts" ? "알림 설정 열기" : "구독 관리 열기";
    buttons = [<CommandButton key="open" label={label} onPress={() => onOpenSettings(command.screen)} />];
  }
  return (
    <View style={botBubbleStyle(env.appMode)}>
      <Text style={askStyles.botText}>{item.done ?? commandText(command)}</Text>
      {buttons.length > 0 ? <View style={askStyles.options}>{buttons}</View> : null}
    </View>
  );
}
