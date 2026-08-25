import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Modal,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { FONTS } from "../../constants/typography";
import { partnerCategoryMeta } from "../../constants/partnerCategories";
import { searchPartners } from "../../utils/partnerSearch";
import type { Partner } from "../../types";

interface PartnerSearchModalProps {
  visible: boolean;
  /** 상위 화면(Modal 밖)에서 잰 top safe-area inset. */
  topInset: number;
  onClose: () => void;
  onSelect: (partner: Partner) => void;
}

/**
 * 제휴 업체 검색.
 * 앱 안 상수만 훑기 때문에 네트워크를 타지 않고 한 글자마다 즉시 반응한다.
 * 상호명 외에 혜택·주소로도 걸리므로 '10%할인', '상수동' 같은 검색도 된다.
 */
export default function PartnerSearchModal({
  visible,
  topInset,
  onClose,
  onSelect,
}: PartnerSearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  const results = useMemo(() => searchPartners(query), [query]);
  const hasQuery = query.trim().length > 0;

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleSelect = (partner: Partner) => {
    setQuery("");
    onSelect(partner);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      onShow={() => inputRef.current?.focus()}
    >
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="검색 닫기"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#999" />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="제휴 업체 검색"
              placeholderTextColor="#bbb"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {hasQuery && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                accessibilityRole="button"
                accessibilityLabel="검색어 지우기"
              >
                <Ionicons name="close-circle" size={16} color="#ccc" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!hasQuery && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              상호명은 물론 혜택이나 주소로도 찾을 수 있어요.
            </Text>
            <Text style={styles.hintExample}>예: 어리 · 10%할인 · 상수동</Text>
          </View>
        )}

        {hasQuery && results.length === 0 && (
          <View style={styles.hintBox}>
            <Ionicons name="search" size={22} color="#ddd" />
            <Text style={styles.hintText}>검색 결과가 없어요.</Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const meta = partnerCategoryMeta(item.category);
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => handleSelect(item)}
              >
                <View style={[styles.dot, { backgroundColor: meta.color }]} />
                <View style={styles.info}>
                  <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.category, { color: meta.color }]}>
                      {item.category}
                    </Text>
                  </View>
                  {item.benefit && (
                    <Text style={styles.benefit} numberOfLines={2}>
                      {item.benefit}
                    </Text>
                  )}
                  {item.address && (
                    <Text style={styles.address} numberOfLines={1}>
                      {item.address}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={14} color="#ddd" />
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  searchBar: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  hintBox: { alignItems: "center", paddingTop: 40, gap: 6 },
  hintText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  hintExample: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f4f4f4",
  },
  dot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 5 },
  info: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: {
    fontSize: 14.5,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  category: { fontSize: 11, fontFamily: FONTS.semibold },
  benefit: {
    fontSize: 12.5,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  address: {
    fontSize: 11.5,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
});
