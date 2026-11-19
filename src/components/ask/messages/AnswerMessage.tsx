import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import type { ChatMessageOf } from "../../../utils/ask/chatTypes";
import { briefSections, firstSentence } from "../../../utils/ask/replyText";
import { askStyles, botBubbleStyle } from "../askStyles";
import SectionBlock from "../parts/SectionBlock";
import PlaceRow from "../parts/PlaceRow";
import { LinkButton, PhoneRow } from "../parts/ContactButtons";
import { MapButton } from "../parts/PlaceActionButtons";
import type { AskMessageActions, AskMessageEnv } from "./types";

/** 앱 안내 흐름의 끝 답 — 안내 원문 앞부분, 위치·전화, '이어서 물어보기', 학교 페이지 링크, 확인 날짜. */
export default function AnswerMessage({ item, env, actions }: { item: ChatMessageOf<"answer">; env: AskMessageEnv; actions: AskMessageActions }) {
  const { appMode } = env;
  const brief = briefSections(item.node.sections);
  return (
    <View style={botBubbleStyle(appMode)}>
      <Text style={[askStyles.botText, item.node.sections?.length ? askStyles.lead : null]}>{item.node.text}</Text>
      {brief.shown.map((section, index) => (
        <SectionBlock key={`${index}`} section={section} appMode={appMode} />
      ))}
      {brief.cut ? <Text style={askStyles.checked}>전체 내용은 아래 학교 페이지에서 볼 수 있어요.</Text> : null}
      {item.node.facilityId ? <PlaceRow facilities={env.places.facilities} facilityId={item.node.facilityId} /> : null}
      {item.node.facilityId ? (
        <MapButton action={{ target: `facility:${item.node.facilityId}`, summary: firstSentence(item.node.text) }} env={env} />
      ) : null}
      {item.node.phones?.map((p) => <PhoneRow key={p.phone} label={p.label} phone={p.phone} />)}
      {item.node.followUps && !item.followed ? (
        <View style={askStyles.options}>
          <Text style={askStyles.followTitle}>이어서 물어보기</Text>
          {item.node.followUps.map((option) => (
            <TouchableOpacity
              key={option.next + option.label}
              style={askStyles.option}
              activeOpacity={0.7}
              onPress={() => actions.follow(item, option.label, option.next)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <Text style={askStyles.optionText}>{option.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {item.node.links?.map((link) => <LinkButton key={link.url} link={link} appMode={appMode} />)}
      <Text style={askStyles.checked}>
        {item.node.links?.length ? "학교 안내" : "운영진"} 확인 {item.checkedAt}
        {item.viaServer ? " · 질문 뜻을 풀어 찾은 안내예요" : ""}
      </Text>
    </View>
  );
}
