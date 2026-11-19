import { memo } from "react";
import { Text, View } from "react-native";
import type { ChatMessage } from "../../../utils/ask/chatTypes";
import { askStyles, botBubbleStyle, userBubbleStyle } from "../askStyles";
import OfficeCard from "../parts/OfficeCard";
import AnswerMessage from "./AnswerMessage";
import { GreetingMessage, QuestionMessage } from "./ChoiceMessages";
import CommandMessage from "./CommandMessage";
import FeedbackMessage from "./FeedbackMessage";
import HandoffMessage from "./HandoffMessage";
import ReplyMessage from "./ReplyMessage";
import type { AskMessageActions, AskMessageEnv } from "./types";

interface Props {
  item: ChatMessage;
  env: AskMessageEnv;
  actions: AskMessageActions;
}

/**
 * 대화 한 줄을 역할에 맞는 말풍선으로. memo — 흘려받는 동안에는 글자가 바뀌는 답 한 줄만 다시 그린다
 * (env·actions 는 AskChat 이 같은 참조로 넘긴다).
 */
function MessageItem({ item, env, actions }: Props) {
  const { appMode } = env;
  switch (item.role) {
    case "user": {
      const user = userBubbleStyle(appMode);
      return (
        <View style={user.bubble}>
          <Text style={user.text}>{item.text}</Text>
        </View>
      );
    }
    case "text":
      return (
        <View style={botBubbleStyle(appMode)}>
          <Text style={askStyles.botText}>{item.text}</Text>
        </View>
      );
    case "handoff":
      return <HandoffMessage item={item} env={env} actions={actions} />;
    case "reply":
      return <ReplyMessage item={item} env={env} actions={actions} />;
    case "command":
      return <CommandMessage item={item} env={env} actions={actions} />;
    case "greeting":
      return <GreetingMessage item={item} appMode={appMode} actions={actions} />;
    case "question":
      return <QuestionMessage item={item} appMode={appMode} actions={actions} />;
    case "answer":
      return <AnswerMessage item={item} env={env} actions={actions} />;
    case "feedback":
      return <FeedbackMessage item={item} appMode={appMode} actions={actions} />;
    case "offices":
      return (
        <View style={botBubbleStyle(appMode)}>
          <Text style={askStyles.botText}>{item.intro}</Text>
          {item.offices.map((office) => (
            <OfficeCard key={office.facility.id} office={office} appMode={appMode} />
          ))}
        </View>
      );
  }
}

export default memo(MessageItem);
