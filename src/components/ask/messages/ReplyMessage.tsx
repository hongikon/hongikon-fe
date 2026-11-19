import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/colors";
import { FONTS } from "../../../constants/typography";
import type { ChatMessageOf } from "../../../utils/ask/chatTypes";
import { replyButtons } from "../../../utils/ask/conversation";
import { parseReply } from "../../../utils/ask/replyText";
import { askStyles, botBubbleStyle } from "../askStyles";
import SectionBlock from "../parts/SectionBlock";
import ThinkingLine from "../parts/ThinkingLine";
import PlaceRow from "../parts/PlaceRow";
import { LinkButton, PhoneRow } from "../parts/ContactButtons";
import { NewsSearchButton, ReplyMapButton, RouteButton } from "../parts/PlaceActionButtons";
import type { AskMessageActions, AskMessageEnv } from "./types";

/** 답 아래 처음부터 보이는 전화·링크 버튼 수. 나머지는 '더 보기'로 접는다. */
const VISIBLE_ACTIONS = 2;

/** 서버 답 — 예전 안내 카드처럼 요약·소제목·항목, 그 아래 근거 안내의 위치·담당 전화·학교 페이지와 공지 버튼. */
export default function ReplyMessage({ item, env, actions }: { item: ChatMessageOf<"reply">; env: AskMessageEnv; actions: AskMessageActions }) {
  const { appMode } = env;
  const botStyle = botBubbleStyle(appMode);
  if (item.streaming && !item.text) {
    // Claude 앱처럼 지금 하는 일 한 줄만 제자리에서 바꿔 가며 깜빡인다(쌓지 않는다).
    return (
      <View style={botStyle}>
        <ThinkingLine text={item.status} />
      </View>
    );
  }
  // 서버가 목록·표를 구조로 줬으면 그대로 그린다(text 는 요약만). 옛 서버·흘러나오는 중이면 글을 잘라 그린다.
  const { lead, sections, tail } = item.sections ? { lead: item.text, sections: item.sections, tail: "" } : parseReply(item.text);
  const { phones, place, links } = replyButtons(item);
  const cursor = item.streaming ? <Text style={styles.cursor}>▍</Text> : null;
  // 전화·학교 페이지·공지 버튼은 앞의 몇 개만 보이고 나머지는 접는다 — 한 답에 버튼이 줄줄이 붙어 답이 묻혔다(10-24 지적).
  const contactButtons = [
    ...phones.map((phone) => <PhoneRow key={phone.phone} label={phone.label} phone={phone.phone} />),
    ...links.map((source) => (
      <LinkButton
        key={source.key}
        link={{ label: source.date ? `${source.title} · ${source.date}` : source.title, url: source.url as string }}
        appMode={appMode}
      />
    )),
  ];
  return (
    <View style={botStyle}>
      {lead ? (
        <Text style={[askStyles.botText, sections.length > 0 && askStyles.lead]}>
          {lead}
          {sections.length === 0 ? cursor : null}
        </Text>
      ) : null}
      {sections.map((section, index) => (
        <SectionBlock key={`${index}`} section={section} appMode={appMode} />
      ))}
      {tail ? <Text style={[askStyles.botText, styles.replyTail]}>{tail}</Text> : null}
      {sections.length > 0 ? cursor : null}
      {place ? <PlaceRow facilities={env.places.facilities} facilityId={place} /> : null}
      {item.streaming ? null : <ReplyMapButton item={item} place={place ?? null} env={env} />}
      {item.streaming ? null : <RouteButton item={item} env={env} />}
      {item.streaming ? null : <NewsSearchButton item={item} env={env} />}
      {contactButtons.slice(0, VISIBLE_ACTIONS)}
      {contactButtons.length > VISIBLE_ACTIONS ? (
        <>
          <TouchableOpacity
            style={askStyles.sourceToggle}
            activeOpacity={0.7}
            onPress={() => actions.toggleReply(item.id, "moreOpen")}
            accessibilityRole="button"
            accessibilityState={{ expanded: item.moreOpen }}
            accessibilityLabel={`연락처·링크 ${contactButtons.length - VISIBLE_ACTIONS}개 ${item.moreOpen ? "접기" : "더 보기"}`}
          >
            <Text style={askStyles.sourceToggleText}>연락처·링크 {contactButtons.length - VISIBLE_ACTIONS}개 더 보기</Text>
            <Ionicons name={item.moreOpen ? "chevron-up" : "chevron-down"} size={14} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {item.moreOpen ? contactButtons.slice(VISIBLE_ACTIONS) : null}
        </>
      ) : null}
      {!item.streaming && item.steps.length > 1 ? (
        <>
          <TouchableOpacity
            style={askStyles.sourceToggle}
            activeOpacity={0.7}
            onPress={() => actions.toggleReply(item.id, "stepsOpen")}
            accessibilityRole="button"
            accessibilityState={{ expanded: item.stepsOpen }}
            accessibilityLabel={`살펴본 과정 ${item.steps.length}단계 ${item.stepsOpen ? "접기" : "보기"}`}
          >
            <Text style={askStyles.sourceToggleText}>살펴본 과정 {item.steps.length}단계</Text>
            <Ionicons name={item.stepsOpen ? "chevron-up" : "chevron-down"} size={14} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {item.stepsOpen ? (
            <View style={styles.stepList}>
              {item.steps.map((step, index) => (
                <View key={`${index}-${step}`} style={styles.stepRow}>
                  <Ionicons name="checkmark" size={13} color={COLORS.textTertiary} />
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      {!item.streaming ? (
        <Text style={askStyles.checked}>
          {item.stopped
            ? "중간에 멈춘 답이에요"
            : item.found
              ? "학교 안내 원문에서 찾아 답했어요"
              : "안내에서 확인되지 않은 내용이 있어요 — 담당 부서에 확인해 주세요"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stepList: { gap: 4 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepText: { flexShrink: 1, fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  replyTail: { marginTop: 12 },
  cursor: { color: COLORS.primary },
});
