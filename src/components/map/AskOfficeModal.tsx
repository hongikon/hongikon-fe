import { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, Modal, TouchableOpacity, Linking, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { RADIUS } from "../../constants/spacing";
import { askOffices, type OfficeAskResult } from "../../utils/officeAsk";
import type { Facility } from "../../types";
import ContentColumn from "../common/ContentColumn";
import ScreenHeader from "../common/ScreenHeader";
import { ModalPanel } from "../settings/ModalHeader";
import EmptyState from "../common/EmptyState";
import SearchBar from "../news/SearchBar";
import { useMapData } from "../../lib/mapData";
import * as haptics from "../../lib/haptics";

/** 처음 열었을 때 눌러 볼 수 있는 질문. 모두 부서 안내에 답이 있는 것만 둔다. */
const EXAMPLES = ["냉난방이 안 돼요", "휴학하려면", "학생증 재발급", "와이파이가 안 돼요", "주차 문의", "엘리베이터 고장", "장학금"] as const;

interface AskOfficeModalProps {
  visible: boolean;
  /** 상위 화면(Modal 밖)에서 잰 top safe-area inset. */
  topInset: number;
  onClose: () => void;
  /** 부서를 골랐다. 지도에서 그 부서 시트(상세)를 연다. */
  onSelect: (facility: Facility) => void;
}

/**
 * 지도 검색바 옆 '물어보기'. "냉난방이 안 돼요"처럼 할 일을 물으면 맡은 부서와 업무별 전화를 보여 준다.
 * 학교 홈페이지 부서 안내(앱에 담아 둔 표)만 훑어 네트워크 없이 바로 답한다 — 답을 지어내지 않고, 없으면 없다고 한다.
 */
export default function AskOfficeModal({ visible, topInset, onClose, onSelect }: AskOfficeModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const { facilities } = useMapData();
  const results = useMemo(() => askOffices(facilities, query), [facilities, query]);
  const trimmed = query.trim();

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleSelect = (facility: Facility) => {
    setQuery("");
    onSelect(facility);
  };

  const call = (phone: string) => {
    haptics.selection();
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
  };

  const renderResult = ({ item }: { item: OfficeAskResult }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handleSelect(item.facility)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.place}. 부서 안내 보기`}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardTitle}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.place} numberOfLines={1}>{item.place}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
      </View>
      {item.contacts.map((contact, index) => (
        <View key={`${contact.phone}-${index}`} style={styles.contact}>
          <Text style={styles.duty} numberOfLines={3}>{contact.duty}</Text>
          <TouchableOpacity
            style={styles.phone}
            activeOpacity={0.7}
            onPress={() => call(contact.phone)}
            accessibilityRole="button"
            accessibilityLabel={`${contact.phone} 전화 걸기`}
            hitSlop={6}
          >
            <Ionicons name="call" size={13} color={COLORS.primary} />
            <Text style={styles.phoneText}>{contact.phone}</Text>
          </TouchableOpacity>
        </View>
      ))}
      {item.snippet ? <Text style={styles.snippet} numberOfLines={3}>{item.snippet}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} onShow={() => inputRef.current?.focus()}>
      <View style={[styles.container, { paddingTop: topInset }]}>
        <ContentColumn>
          <ScreenHeader onBack={handleClose} card>
            <SearchBar
              inputRef={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="무엇이 궁금한가요? 예: 냉난방 고장"
              accessibilityLabel="학교 일 물어보기"
              style={styles.searchBar}
            />
          </ScreenHeader>

          <ModalPanel>
            {!trimmed ? (
              <ScrollView contentContainerStyle={styles.intro} keyboardShouldPersistTaps="handled">
                <Text style={styles.introTitle}>어디에 연락해야 할지 물어보세요</Text>
                <Text style={styles.introText}>
                  해야 할 일을 적으면 그 일을 맡은 학교 부서와 업무별 전화번호를 찾아 드려요.
                </Text>
                <View style={styles.examples}>
                  {EXAMPLES.map((example) => (
                    <TouchableOpacity
                      key={example}
                      style={styles.example}
                      activeOpacity={0.7}
                      onPress={() => {
                        haptics.selection();
                        setQuery(example);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${example} 물어보기`}
                    >
                      <Text style={styles.exampleText}>{example}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : results.length === 0 ? (
              <EmptyState
                icon="chatbubble-ellipses-outline"
                message={`'${trimmed}'에 맞는 부서를 아직 못 찾았어요`}
                description="학교 홈페이지 부서 안내에 적힌 업무로만 찾아요. 다른 낱말로 물어보세요."
                style={styles.hintBox}
              />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.facility.id}
                renderItem={renderResult}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.list}
                ListFooterComponent={
                  <Text style={styles.footnote}>
                    학교 홈페이지 부서 안내(2026-10-14)를 바탕으로 찾았어요. 학교 공식 안내가 아니니 자세한 내용은 부서에 확인해 주세요.
                  </Text>
                }
              />
            )}
          </ModalPanel>
        </ContentColumn>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchBar: { flex: 1, marginRight: 4, backgroundColor: COLORS.background, borderWidth: 0 },
  hintBox: { minHeight: 200 },
  intro: { padding: 20, gap: 8 },
  introTitle: { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  introText: { fontSize: 14, lineHeight: 21, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
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
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 10 },
  card: { borderRadius: 14, backgroundColor: COLORS.fill, padding: 14, gap: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.textPrimary },
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
    backgroundColor: COLORS.white,
  },
  phoneText: { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.primary },
  snippet: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  footnote: { marginTop: 6, fontSize: 11, lineHeight: 16, fontFamily: FONTS.regular, color: COLORS.textTertiary },
});
