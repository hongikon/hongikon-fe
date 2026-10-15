import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { RADIUS } from "../../constants/spacing";
import { ALL_ASK_FLOWS, askOffices, matchAskFlow, type OfficeAskResult } from "../../utils/officeAsk";
import { type AskAnswerNode, type AskLink, type AskQuestionNode, type AskSection } from "../../constants/askAnswers";
import ContentColumn from "../common/ContentColumn";
import { formatFloor } from "../../utils/floors";
import ScreenHeader from "../common/ScreenHeader";
import { useMapData } from "../../lib/mapData";
import * as haptics from "../../lib/haptics";

/** 처음 열었을 때 눌러 볼 수 있는 질문. 모두 답이 있는 것만 둔다. */
const EXAMPLES = ["자퇴하려면", "와이파이 연결 방법", "학교 메일 계정", "다쳤어요", "휴학 신청 기간", "학생증 재발급"] as const;

/**
 * 대화 한 줄. 고객센터 챗봇처럼 봇이 버튼으로 되묻고(question), 고른 버튼은 사용자 말풍선으로 남는다.
 * 끝 답(answer) 뒤에는 '해결됐나요?'(feedback)를 붙이고, 아니라고 하면 맡은 부서(offices)를 이어 보여 준다.
 */
type ChatMessage =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "question"; node: AskQuestionNode; flowId: string; chosen: string | null }
  | { id: number; role: "answer"; node: AskAnswerNode; flowId: string; checkedAt: string; question: string; followed: boolean }
  | { id: number; role: "feedback"; question: string; resolved: boolean | null }
  | { id: number; role: "offices"; intro: string; offices: OfficeAskResult[] }
  | { id: number; role: "text"; text: string };

type NewMessage = ChatMessage extends infer M ? (M extends { id: number } ? Omit<M, "id"> : never) : never;

interface AskChatProps {
  /** 있으면 머리에 뒤로 가기 버튼을 단다. */
  onClose?: () => void;
}

/**
 * '물어보기' 챗봇 화면. 고객센터 챗봇처럼 묻고 답한다.
 * 완성 전까지는 운영 앱에 넣지 않고 웹 `/dev/ask`(암호키 인증, `DevPathGate`)에서만 연다(10-15 요청).
 * ① 안내 흐름(`ASK_FLOWS` — 학교 안내 페이지·운영진 확인)에 맞으면 필요한 것만 버튼으로 되물어 답하고 그 학교 페이지로 잇는다.
 * ② 흐름이 없으면 학교 홈페이지 부서 안내에서 그 일을 맡은 부서와 업무별 전화를 보여 준다.
 * 네트워크 없이 앱에 담아 둔 표만 훑는다 — 답을 지어내지 않고, 없으면 없다고 한다.
 */
export default function AskChat({ onClose }: AskChatProps) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const nextId = useRef(1);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const { facilities } = useMapData();

  const push = (...items: NewMessage[]) =>
    setMessages((prev) => [...prev, ...items.map((item) => ({ ...item, id: nextId.current++ }) as ChatMessage)]);

  /** 흐름의 한 단계를 대화에 잇는다. 끝 답이면 '해결됐나요?'를 붙인다. */
  const stepMessages = (flowId: string, nodeId: string, question: string): NewMessage[] => {
    const flow = ALL_ASK_FLOWS.find((item) => item.id === flowId);
    const node = flow?.nodes[nodeId];
    if (!flow || !node) return [{ role: "text", text: "안내를 불러오지 못했어요. 다시 물어봐 주세요." }];
    if (node.kind === "question") return [{ role: "question", node, flowId, chosen: null }];
    return [
      { role: "answer", node, flowId, checkedAt: flow.checkedAt, question, followed: false },
      { role: "feedback", question, resolved: null },
    ];
  };

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    haptics.selection();
    setInput("");
    const matched = matchAskFlow(question);
    if (matched) {
      push({ role: "user", text: question }, ...stepMessages(matched.flow.id, matched.nodeId, question));
      return;
    }
    const offices = askOffices(facilities, question);
    push(
      { role: "user", text: question },
      offices.length > 0
        ? { role: "offices", intro: "이 일을 맡은 부서예요. 전화하거나 학교 홈페이지의 부서 안내를 확인해 보세요.", offices }
        : {
            role: "text",
            text: `아직 '${question}'에 맞는 안내를 못 찾았어요. 학교 홈페이지 안내와 부서 업무로 찾고 있어요 — 다른 낱말로 물어봐 주세요.`,
          },
    );
  };

  const choose = (message: Extract<ChatMessage, { role: "question" }>, label: string, next: string) => {
    if (message.chosen !== null) return;
    haptics.selection();
    // '해결 안 됨'일 때 부서를 찾을 수 있게 처음 질문 글을 넘긴다(버튼 글자로는 부서가 잘 안 걸린다).
    const lastQuestion = [...messages].reverse().find((item) => item.role === "user")?.text ?? label;
    setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, chosen: label } : item)));
    push({ role: "user", text: label }, ...stepMessages(message.flowId, next, lastQuestion));
  };

  /** 답 아래 '이어서 물어보기' 버튼. 한 번 누르면 그 답의 버튼은 접는다. */
  const follow = (message: Extract<ChatMessage, { role: "answer" }>, label: string, next: string) => {
    if (message.followed) return;
    haptics.selection();
    setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, followed: true } : item)));
    push({ role: "user", text: label }, ...stepMessages(message.flowId, next, message.question));
  };

  const renderSection = (section: AskSection, key: string) => (
    <View key={key} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.table ? (
        <View style={styles.table}>
          {[section.table.head, ...section.table.rows].map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.tableRow, rowIndex === 0 && styles.tableHead]}>
              {row.map((cell, cellIndex) => (
                <Text
                  key={cellIndex}
                  style={[styles.tableCell, rowIndex === 0 && styles.tableHeadText, cellIndex === 0 && styles.tableFirst]}
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
      {section.items?.map((itemText, index) => (
        <View key={index} style={styles.itemRow}>
          <Text style={[styles.itemMark, section.ordered && styles.itemNumber]}>{section.ordered ? `${index + 1}` : "•"}</Text>
          <Text style={styles.itemText}>{itemText}</Text>
        </View>
      ))}
    </View>
  );

  const answerFeedback = (message: Extract<ChatMessage, { role: "feedback" }>, resolved: boolean) => {
    if (message.resolved !== null) return;
    haptics.selection();
    setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...message, resolved } : item)));
    if (resolved) {
      push({ role: "text", text: "다행이에요. 다른 것도 궁금하면 언제든 물어보세요." });
      return;
    }
    const offices = askOffices(facilities, message.question).slice(0, 3);
    push(
      offices.length > 0
        ? { role: "offices", intro: "담당 부서에 직접 물어보면 가장 정확해요.", offices }
        : { role: "text", text: "더 도와드리지 못해 아쉬워요. 위 학교 안내 페이지의 담당 부서로 문의해 보세요." },
    );
  };

  const call = (phone: string) => {
    haptics.selection();
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
  };

  const openLink = (url: string) => {
    haptics.selection();
    Linking.openURL(url).catch(() => {});
  };

  const renderPhone = (label: string, phone: string, key: string) => (
    <View key={key} style={styles.contact}>
      <Text style={styles.duty} numberOfLines={3}>{label}</Text>
      <TouchableOpacity
        style={styles.phone}
        activeOpacity={0.7}
        onPress={() => call(phone)}
        accessibilityRole="button"
        accessibilityLabel={`${phone} 전화 걸기`}
        hitSlop={6}
      >
        <Ionicons name="call" size={13} color={COLORS.primary} />
        <Text style={styles.phoneText}>{phone}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLink = (link: AskLink, key: string) => (
    <TouchableOpacity
      key={key}
      style={styles.linkButton}
      activeOpacity={0.7}
      onPress={() => openLink(link.url)}
      accessibilityRole="link"
      accessibilityLabel={`${link.label} 열기`}
    >
      <Text style={styles.linkText} numberOfLines={1}>{link.label}</Text>
      <Ionicons name="open-outline" size={15} color={COLORS.primary} />
    </TouchableOpacity>
  );

  /** 찾아갈 부서 위치(건물·층). /dev/ask 는 지도와 떨어진 화면이라 글로만 보여 준다. 지도 데이터에 없으면 그리지 않는다. */
  const renderPlace = (facilityId: string) => {
    const facility = facilities.find((item) => item.id === facilityId);
    if (!facility) return null;
    const place = [facility.buildingName, facility.floor !== undefined ? formatFloor(facility.floor) : null].filter(Boolean).join(" ");
    return (
      <View style={styles.placeRow}>
        <Ionicons name="location" size={14} color={COLORS.primary} />
        <Text style={styles.placeText}>{[facility.note, place].filter(Boolean).join(" · ")}</Text>
      </View>
    );
  };

  const renderOffice = (office: OfficeAskResult) => (
    <View key={office.facility.id} style={styles.card}>
      <View style={styles.cardTitle}>
        <Text style={styles.name} numberOfLines={1}>{office.name}</Text>
        <Text style={styles.place} numberOfLines={1}>{office.place}</Text>
      </View>
      {office.contacts.map((contact, index) => renderPhone(contact.duty, contact.phone, `${contact.phone}-${index}`))}
      {office.snippet ? <Text style={styles.snippet} numberOfLines={3}>{office.snippet}</Text> : null}
      {renderLink({ label: "학교 홈페이지 · 부서 안내", url: office.source }, "source")}
    </View>
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    switch (item.role) {
      case "user":
        return (
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        );
      case "text":
        return (
          <View style={styles.botBubble}>
            <Text style={styles.botText}>{item.text}</Text>
          </View>
        );
      case "question":
        return (
          <View style={styles.botBubble}>
            <Text style={styles.botText}>{item.node.text}</Text>
            {item.chosen === null ? (
              <View style={styles.options}>
                {item.node.options.map((option) => (
                  <TouchableOpacity
                    key={option.next + option.label}
                    style={styles.option}
                    activeOpacity={0.7}
                    onPress={() => choose(item, option.label, option.next)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        );
      case "answer":
        return (
          <View style={styles.botBubble}>
            <Text style={[styles.botText, item.node.sections?.length ? styles.lead : null]}>{item.node.text}</Text>
            {item.node.sections?.map((section, index) => renderSection(section, `${index}`))}
            {item.node.facilityId ? renderPlace(item.node.facilityId) : null}
            {item.node.phones?.map((p) => renderPhone(p.label, p.phone, p.phone))}
            {item.node.followUps && !item.followed ? (
              <View style={styles.options}>
                <Text style={styles.followTitle}>이어서 물어보기</Text>
                {item.node.followUps.map((option) => (
                  <TouchableOpacity
                    key={option.next + option.label}
                    style={styles.option}
                    activeOpacity={0.7}
                    onPress={() => follow(item, option.label, option.next)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {item.node.links?.map((link) => renderLink(link, link.url))}
            <Text style={styles.checked}>
              {item.node.links?.length ? "학교 안내" : "운영진"} 확인 {item.checkedAt}
            </Text>
          </View>
        );
      case "feedback":
        return (
          <View style={styles.botBubble}>
            <Text style={styles.botText}>궁금한 점이 해결됐나요?</Text>
            {item.resolved === null ? (
              <View style={styles.feedbackRow}>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  activeOpacity={0.7}
                  onPress={() => answerFeedback(item, true)}
                  accessibilityRole="button"
                  accessibilityLabel="네, 해결됐어요"
                >
                  <Text style={styles.feedbackText}>네, 해결됐어요</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  activeOpacity={0.7}
                  onPress={() => answerFeedback(item, false)}
                  accessibilityRole="button"
                  accessibilityLabel="아니요, 더 알고 싶어요"
                >
                  <Text style={styles.feedbackText}>아니요, 더 알고 싶어요</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.feedbackDone}>{item.resolved ? "네, 해결됐어요" : "아니요, 더 알고 싶어요"}</Text>
            )}
          </View>
        );
      case "offices":
        return (
          <View style={styles.botBubble}>
            <Text style={styles.botText}>{item.intro}</Text>
            {item.offices.map(renderOffice)}
          </View>
        );
    }
  };

  const intro = (
    <View style={styles.botBubble}>
      <Text style={styles.botText}>
        학교에서 해야 할 일을 물어보세요. 필요한 건 몇 가지 되물어서, 어떻게 하면 되는지와 어디에 연락하면 되는지 알려 드려요.
      </Text>
      <View style={styles.examples}>
        {EXAMPLES.map((example) => (
          <TouchableOpacity
            key={example}
            style={styles.example}
            activeOpacity={0.7}
            onPress={() => ask(example)}
            accessibilityRole="button"
            accessibilityLabel={`${example} 물어보기`}
          >
            <Text style={styles.exampleText}>{example}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const canSend = input.trim().length > 0;

  return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
          <ContentColumn>
            <ScreenHeader
              title="물어보기"
              onBack={onClose}
              card
              right={
                messages.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setMessages([])}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="처음으로 — 대화 지우기"
                    style={styles.clear}
                  >
                    <Text style={styles.clearText}>처음으로</Text>
                  </TouchableOpacity>
                ) : undefined
              }
            />

            <FlatList
              ref={listRef}
              style={styles.flex}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderMessage}
              ListHeaderComponent={intro}
              ListFooterComponent={
                <Text style={styles.footnote}>
                  학교 홈페이지 안내와 운영진이 확인한 내용으로 답해요. 학교 공식 상담이 아니니 정확한 건 담당 부서에 확인해 주세요.
                </Text>
              }
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              // 새 말풍선이 그려진 뒤에 내려야 끝까지 간다(바로 부르면 늘어나기 전 높이에서 멈춰 답이 아래에 잘렸다).
              onContentSizeChange={() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)}
            />

            <View style={[styles.composer, { paddingBottom: 10 + insets.bottom }]}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="예: 휴학 신청 기간"
                placeholderTextColor={COLORS.textPlaceholder}
                returnKeyType="send"
                onSubmitEditing={() => ask(input)}
                submitBehavior="submit"
                accessibilityLabel="학교 일 물어보기"
              />
              <TouchableOpacity
                style={[styles.send, !canSend && styles.sendOff]}
                onPress={() => ask(input)}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="보내기"
              >
                <Ionicons name="arrow-up" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </ContentColumn>
        </View>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  clear: { paddingHorizontal: 6, paddingVertical: 4 },
  clearText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10 },
  botBubble: {
    maxWidth: "92%",
    alignSelf: "flex-start",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    padding: 14,
    gap: 10,
  },
  botText: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  userBubble: {
    maxWidth: "80%",
    alignSelf: "flex-end",
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    borderTopRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.medium, color: COLORS.white },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  example: {
    paddingHorizontal: 12,
    height: 34,
    justifyContent: "center",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  exampleText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  // 되묻는 버튼은 한 줄에 하나씩(고객센터 챗봇의 선택지 목록처럼) — 글이 길어도 잘리지 않게.
  options: { gap: 6 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.fill,
  },
  optionText: { flex: 1, fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  lead: { fontFamily: FONTS.semibold },
  section: { gap: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  sectionTitle: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primary },
  itemRow: { flexDirection: "row", gap: 8 },
  itemMark: { width: 14, fontSize: 14, lineHeight: 21, fontFamily: FONTS.bold, color: COLORS.textTertiary, textAlign: "center" },
  itemNumber: { color: COLORS.primary },
  itemText: { flex: 1, fontSize: 14, lineHeight: 21, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  // 표는 말풍선 폭 안에서 칸을 고르게 나눈다(첫 칸만 조금 넓게). 좁은 화면에선 칸 안에서 줄을 바꾼다.
  table: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  tableHead: { borderTopWidth: 0, backgroundColor: COLORS.fill },
  tableCell: { flex: 1, paddingHorizontal: 6, paddingVertical: 7, fontSize: 12, lineHeight: 16, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  tableFirst: { flex: 1.3 },
  tableHeadText: { fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  followTitle: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textTertiary, marginTop: 2 },
  card: { borderRadius: 14, backgroundColor: COLORS.fill, padding: 12, gap: 8 },
  cardTitle: { gap: 2 },
  name: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  place: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  placeText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  contact: { flexDirection: "row", alignItems: "center", gap: 10 },
  duty: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  phone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  phoneText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
  snippet: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  linkText: { flex: 1, fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
  checked: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  feedbackRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  feedbackButton: {
    paddingHorizontal: 12,
    height: 36,
    justifyContent: "center",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  feedbackText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  feedbackDone: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textTertiary },
  footnote: { marginTop: 6, fontSize: 11, lineHeight: 16, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { backgroundColor: COLORS.toggleOff },
});
