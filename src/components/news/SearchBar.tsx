import type { Ref } from 'react'
import { StyleSheet, TextInput, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS } from '../../constants/spacing'

interface SearchBarProps {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  accessibilityLabel: string
  style?: StyleProp<ViewStyle>
  autoFocus?: boolean
  /** 창이 뜬 뒤 직접 포커스를 줄 때(Modal onShow 등) */
  inputRef?: Ref<TextInput>
}

/**
 * 앱 공용 검색바.
 * 소식 검색·학과 검색·구독 관리·제휴 업체 검색·온보딩 학과 고르기가 같은 모양(높이 44·모서리 12·흰 바탕 테두리)을 쓴다.
 */
export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  style,
  autoFocus,
  inputRef,
}: SearchBarProps) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="search" size={18} color={COLORS.textTertiary} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textPlaceholder}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="검색어 지우기"
        >
          <Ionicons name="close-circle" size={18} color={COLORS.iconMuted} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 44,
    // 지도 검색바·하단 탭 캡슐과 같은 알약 모양(10-07).
    borderRadius: RADIUS.floating,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    padding: 0,
  },
})
