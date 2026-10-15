import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Modal,
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
import { askOffices, matchAskAnswers, type OfficeAskResult } from "../../utils/officeAsk";
import type { AskAnswer } from "../../constants/askAnswers";
import type { Facility } from "../../types";
import ContentColumn from "../common/ContentColumn";
import ScreenHeader from "../common/ScreenHeader";
import { useMapData } from "../../lib/mapData";
import * as haptics from "../../lib/haptics";

/** 처음 열었을 때 눌러 볼 수 있는 질문. 모두 답이 있는 것만 둔다. */
const EXAMPLES = ["에어컨 켜 주세요", "학생증 재발급", "휴학하려면", "와이파이가 안 돼요", "주차 문의", "엘리베이터 고장", "장학금"] as const;

/** 확인한 답이 있을 때 아래에 덧붙일 관련 부서 수. 답이 이미 있으니 짧게. */
const RELATED_WITH_ANSWER = 2;

type ChatMessage =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "bot"; question: string; answers: AskAnswer[]; offices: OfficeAskResult[] };

interface AskOfficeModalProps {
  visible: boolean;
  /** 상위 화면(Modal 밖)에서 잰 top safe-area inset. */
  topInset: number;
  onClose: () => void;
  /** 부서·장소를 골랐다. 지도에서 그 시설 시트를 연다. */
  onSelect: (facility: Facility) => void;
}

/**
 * 지도 검색바 옆 '물어보기'. 채팅처럼 묻고 답한다 — "에어컨 켜 주세요"처럼 할 일을 물으면
 * ① 운영진이 확인한 답(`ASK_ANSWERS`)을 먼저, ② 학교 홈페이지 부서 안내에서 그 일을 맡은 부서와 업무별 전화를 보여 준다.
 * 네트워크 없이 앱에 담아 둔 표만 훑는다 — 답을 지어내지 않고, 없으면 없다고 한다.
 * 대화는 창을 닫았다 열어도(부서 시트를 보고 돌아와도) 앱을 켜 둔 동안 남는다.
 */
export default function AskOfficeModal({ visible, topInset, onClose, onSelect }: AskOfficeModalProps) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const nextId = useRef(1);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const { facilities } = useMapData();

  const ask = (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    haptics.selection();
    const answers = matchAskAnswers(question);
    // 확인한 답이 가야 할 곳까지 정해 주면(학생증 → 신한은행) 부서 목록은 붙이지 않는다 — 학사지원팀으로 헷갈려 가지 않게.
    const placeGiven = answers.some((answer) => answer.facilityId);
    const offices = placeGiven
      ? []
      : askOffices(facilities, question).slice(0, answers.length > 0 ? RELATED_WITH_ANSWER : undefined);
    const userId = nextId.current++;
    const botId = nextId.current++;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text: question },
      { id: botId, role: "bot", question, answers, offices },
    ]);
    setInput("");
  };

  const call = (phone: string) => {
    haptics.selection();
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
  };

  const openPlace = (facilityId: string) => {
    const facility = facilities.find((item) => item.id === facilityId);
    if (facility) onSelect(facility);
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

  const renderOffice = (office: OfficeAskResult) => (
    <TouchableOpacity
      key={office.facility.id}
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => onSelect(office.facility)}
      accessibilityRole="button"
      accessibilityLabel={`${office.name}, ${office.place}. 부서 안내 보기`}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardTitle}>
          <Text style={styles.name} numberOfLines={1}>{office.name}</Text>
          <Text style={styles.place} numberOfLines={1}>{office.place}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
      </View>
      {office.contacts.map((contact, index) => renderPhone(contact.duty, contact.phone, `${contact.phone}-${index}`))}
      {office.snippet ? <Text style={styles.snippet} numberOfLines={3}>{office.snippet}</Text> : null}
    </TouchableOpacity>
  );

  const renderBot = (message: Extract<ChatMessage, { role: "bot" }>) => {
    const { answers, offices } = message;
    if (answers.length === 0 && offices.length === 0) {
      return (
        <View style={styles.botBubble}>
          <Text style={styles.botText}>
            아직 '{message.question}'에 맞는 곳을 못 찾았어요. 학교 홈페이지 부서 안내에 적힌 업무로 찾고 있어요 — 다른 낱말로 물어봐 주세요.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.botGroup}>
        {answers.map((answer) => (
          <View key={answer.id} style={styles.botBubble}>
            <Text style={styles.botText}>{answer.text}</Text>
            {answer.phones?.map((p) => renderPhone(p.label, p.phone, `${answer.id}-${p.phone}`))}
            {answer.facilityId ? (
              <TouchableOpacity
                style={styles.mapLink}
                activeOpacity={0.7}
                onPress={() => openPlace(answer.facilityId as string)}
                accessibilityRole="button"
                accessibilityLabel="지도에서 위치 보기"
              >
                <Ionicons name="location" size={14} color={COLORS.primary} />
                <Text style={styles.mapLinkText}>지도에서 위치 보기</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.checked}>운영진 확인 {answer.checkedAt}</Text>
          </View>
        ))}
        {offices.length > 0 ? (
          <View style={styles.botBubble}>
            <Text style={styles.botText}>
              {answers.length > 0 ? "관련 부서도 함께 알려 드려요." : "이 일을 맡은 부서예요. 누르면 지도에서 부서 안내를 열어요."}
            </Text>
            {offices.map(renderOffice)}
          </View>
        ) : null}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) =>
    item.role === "user" ? (
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{item.text}</Text>
      </View>
    ) : (
      renderBot(item)
    );

  const intro = (
    <View style={styles.botGroup}>
      <View style={styles.botBubble}>
        <Text style={styles.botText}>
          학교에서 해야 할 일을 물어보세요. 어디에 가거나 전화하면 되는지 찾아 드려요.
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
    </View>
  );

  const canSend = input.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => inputRef.current?.focus()}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, { paddingTop: topInset }]}>
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
                    accessibilityLabel="대화 지우기"
                    style={styles.clear}
                  >
                    <Text style={styles.clearText}>지우기</Text>
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
                  학교 홈페이지 부서 안내(2026-10-14)와 운영진이 확인한 내용으로 답해요. 학교 공식 안내가 아니니 자세한 건 부서에 확인해 주세요.
                </Text>
              }
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            />

            <View style={[styles.composer, { paddingBottom: 10 + insets.bottom }]}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="예: 에어컨 켜 주세요"
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  clear: { paddingHorizontal: 6, paddingVertical: 4 },
  clearText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10 },
  botGroup: { gap: 8, alignItems: "flex-start" },
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
  card: { borderRadius: 14, backgroundColor: COLORS.fill, padding: 12, gap: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  place: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary },
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
  mapLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  mapLinkText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
  checked: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary },
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
