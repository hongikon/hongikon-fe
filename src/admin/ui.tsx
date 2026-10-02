import { createContext, useContext, useEffect, useRef, type ComponentProps, type ReactNode, type RefObject } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import AppButton, { type ButtonVariant as AppButtonVariant } from '../components/common/Button'

/** 관리자 화면 공통 부품. 앱 화면과 섞이지 않게 이 폴더 안에서만 쓴다. */

/**
 * 관리자 화면이 어디에 그려지는지.
 * - 'console': 웹 `/admin` 콘솔(데스크톱 위주, 기존 모양 그대로)
 * - 'app': 앱 하단 "관리" 탭(폰 너비). 누르는 것은 앱 공용 버튼(높이 44)으로, 되돌리기 어려운 처리는
 *   `utils/dialog.ts` 의 확인 창으로 묻는다.
 */
export type AdminHost = 'console' | 'app'

const AdminHostContext = createContext<AdminHost>('console')

export const AdminHostProvider = AdminHostContext.Provider

export function useAdminHost(): AdminHost {
  return useContext(AdminHostContext)
}

/**
 * 앱 관리 탭의 세로 스크롤을 안쪽 부품이 움직일 수 있게 한다(AdminTabScreen 이 넣는다, 웹 콘솔은 없음).
 * ScrollView 의 automaticallyAdjustKeyboardInsets 는 포커스된 입력칸의 윗부분만 키보드 위로 올려서,
 * 그 아래 확인 버튼(반려·이용 정지)이 키보드에 가린다. ConfirmBar 가 이걸로 자기 전체를 키보드 위로 올린다.
 */
export interface AdminScrollHandle {
  /** 지금 위치에서 dy 만큼 아래로(양수) 스크롤한다. */
  scrollBy: (dy: number) => void
}

const AdminScrollContext = createContext<AdminScrollHandle | null>(null)

export const AdminScrollProvider = AdminScrollContext.Provider

/** 키보드 윗변과 확인 막대 사이에 남길 여백 */
const KEYBOARD_REVEAL_GAP = 12

/**
 * 앱(iOS·Android)에서 키보드가 올라오면, 포커스된 입력칸이 `box` 안에 있을 때 `box` 전체(입력칸 + 버튼)가
 * 키보드 위로 보이도록 스크롤한다. 키보드가 이미 떠 있는 채로 열려도(다른 칸에서 넘어옴) 한 번 맞춘다.
 */
function useRevealAboveKeyboard(box: RefObject<View | null>, enabled: boolean): void {
  const scroll = useContext(AdminScrollContext)
  useEffect(() => {
    if (!enabled || !scroll || Platform.OS === 'web') return
    let cancelled = false
    const reveal = (keyboardTop: number) => {
      const focused = TextInput.State.currentlyFocusedInput()
      const target = box.current
      if (!focused || !target) return
      target.measureInWindow((_x, y, _w, height) => {
        focused.measureInWindow((_fx, focusedY) => {
          if (cancelled || focusedY < y || focusedY > y + height) return
          const overflow = y + height + KEYBOARD_REVEAL_GAP - keyboardTop
          if (overflow > 0) scroll.scrollBy(overflow)
        })
      })
    }
    const subscription = Keyboard.addListener('keyboardDidShow', (event) => reveal(event.endCoordinates.screenY))
    const metrics = Keyboard.isVisible() ? Keyboard.metrics() : undefined
    const timer = metrics ? setTimeout(() => reveal(metrics.screenY), 250) : null
    return () => {
      cancelled = true
      subscription.remove()
      if (timer) clearTimeout(timer)
    }
  }, [box, enabled, scroll])
}

export const ADMIN_COLORS = {
  ...COLORS,
  pageBg: '#F5F6F8',
  sidebarBg: '#05014A',
  sidebarText: '#C9C8E6',
  success: '#15803D',
  successBg: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  dangerBg: '#FEE2E2',
  neutralBg: '#F1F5F9',
  neutralText: '#475569',
  infoBg: '#E0E7FF',
  kakao: '#FEE500',
} as const

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONE_STYLE: Record<Tone, { bg: string; text: string }> = {
  neutral: { bg: ADMIN_COLORS.neutralBg, text: ADMIN_COLORS.neutralText },
  success: { bg: ADMIN_COLORS.successBg, text: ADMIN_COLORS.success },
  warning: { bg: ADMIN_COLORS.warningBg, text: ADMIN_COLORS.warning },
  danger: { bg: ADMIN_COLORS.dangerBg, text: COLORS.danger },
  info: { bg: ADMIN_COLORS.infoBg, text: COLORS.primary },
}

export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const colors = TONE_STYLE[tone]
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  /** 진행 중이면 스피너를 보이고 누를 수 없게 한다. */
  loading?: boolean
  icon?: ComponentProps<typeof Ionicons>['name']
  small?: boolean
  style?: StyleProp<ViewStyle>
}

const APP_VARIANT: Record<ButtonVariant, AppButtonVariant> = {
  primary: 'primary',
  secondary: 'outline',
  danger: 'destructive',
  ghost: 'ghost',
}

export function Button({ label, onPress, variant = 'secondary', disabled, loading, icon, small, style }: ButtonProps) {
  const host = useAdminHost()
  if (host === 'app') {
    // 폰에서는 작은 버튼도 터치 최소 크기(44)를 지킨다.
    return (
      <AppButton
        label={label}
        onPress={onPress}
        variant={APP_VARIANT[variant]}
        size="md"
        icon={icon}
        disabled={disabled}
        loading={loading}
        fullWidth={false}
        style={style}
      />
    )
  }
  const inactive = disabled || loading
  const palette = BUTTON_PALETTE[variant]
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !inactive && styles.buttonPressed,
        inactive && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 14 : 16} color={palette.text} />
      ) : null}
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: palette.text }]}>{label}</Text>
    </Pressable>
  )
}

const BUTTON_PALETTE: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: COLORS.primary, text: COLORS.white, border: COLORS.primary },
  secondary: { bg: COLORS.white, text: COLORS.textPrimary, border: '#D4D4D8' },
  danger: { bg: COLORS.danger, text: COLORS.white, border: COLORS.danger },
  ghost: { bg: 'transparent', text: COLORS.primary, border: 'transparent' },
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const app = useAdminHost() === 'app'
  return (
    <View style={[styles.header, app && styles.headerApp]}>
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, app && styles.headerTitleApp]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  )
}

/** 요청 실패 안내. 문구는 client 가 만든 한국어 문구만 넘긴다. */
export function InlineError({ message, onRetry, style }: { message: string; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.error, style]} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={16} color={COLORS.danger} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button label="다시 시도" onPress={onRetry} small /> : null}
    </View>
  )
}

export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={COLORS.primary} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="checkmark-done-outline" size={28} color={COLORS.textTertiary} />
      <Text style={styles.muted}>{message}</Text>
    </View>
  )
}

interface TabOption<T extends string> {
  value: T
  label: string
  count?: number
}

/** 상태 필터 탭. 좁은 화면에서는 줄바꿈된다. */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly TabOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  const app = useAdminHost() === 'app'
  const items = options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={app ? 4 : undefined}
            style={[styles.tab, app && styles.tabApp, selected && styles.tabSelected]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{option.label}</Text>
            {option.count !== undefined && option.count > 0 ? (
              <View style={[styles.tabCount, selected && styles.tabCountSelected]}>
                <Text style={[styles.tabCountText, selected && styles.tabCountTextSelected]}>{option.count}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })
  if (app) {
    // 폰에서는 줄바꿈 대신 가로로 넘긴다(필터가 두 줄이 되면 목록이 그만큼 밀린다).
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsScrollContent}
        accessibilityRole="tablist"
      >
        {items}
      </ScrollView>
    )
  }
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {items}
    </View>
  )
}

/**
 * 되돌릴 수 없는 작업 전의 확인 막대. window.confirm 대신 카드 안에 펼친다
 * (브라우저 대화상자는 자동화·스크린 리더에서 다루기 어렵고 화면 흐름을 끊는다).
 */
export function ConfirmBar({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  danger,
  children,
}: {
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  danger?: boolean
  children?: ReactNode
}) {
  const app = useAdminHost() === 'app'
  const boxRef = useRef<View>(null)
  // 사유 입력칸(children)이 있을 때만 — 키보드가 확인 버튼을 가리지 않게 막대 전체를 키보드 위로 올린다.
  useRevealAboveKeyboard(boxRef, app && children != null)
  return (
    <View ref={boxRef} style={[styles.confirm, danger && styles.confirmDanger, app && styles.confirmApp]}>
      <Text style={styles.confirmText}>{message}</Text>
      {children}
      <View style={styles.confirmActions}>
        <Button label="취소" onPress={onCancel} disabled={busy} small style={app ? styles.confirmButtonApp : undefined} />
        <Button
          label={confirmLabel}
          onPress={onConfirm}
          loading={busy}
          variant={danger ? 'danger' : 'primary'}
          small
          style={app ? styles.confirmButtonApp : undefined}
        />
      </View>
    </View>
  )
}

export function LabelValue({ label, value, valueStyle }: { label: string; value: ReactNode; valueStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={styles.labelValue}>
      <Text style={styles.label}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[styles.value, valueStyle]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  )
}

export const adminText = StyleSheet.create({
  body: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary, lineHeight: 21 },
  muted: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  strong: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
})

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontFamily: FONTS.semibold, fontSize: 12 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: FONTS.semibold, fontSize: 14 },
  buttonTextSmall: { fontSize: 13 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  headerText: { flexShrink: 1, gap: 4 },
  headerApp: { alignItems: 'flex-start', marginBottom: 12 },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.textPrimary },
  headerTitleApp: { fontSize: 18 },
  headerSubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: ADMIN_COLORS.dangerBg,
  },
  errorText: { flex: 1, minWidth: 160, fontFamily: FONTS.medium, fontSize: 13, color: COLORS.danger },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  muted: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    backgroundColor: COLORS.white,
  },
  tabApp: { minHeight: 36, paddingHorizontal: 14 },
  tabsScroll: { flexGrow: 0, marginBottom: 12, marginHorizontal: -16 },
  tabsScrollContent: { gap: 6, paddingHorizontal: 16 },
  tabSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary },
  tabTextSelected: { color: COLORS.white },
  tabCount: { minWidth: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: ADMIN_COLORS.dangerBg, alignItems: 'center' },
  tabCountSelected: { backgroundColor: COLORS.white },
  tabCountText: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.danger, lineHeight: 18 },
  tabCountTextSelected: { color: COLORS.primary },
  confirm: {
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: ADMIN_COLORS.infoBg,
  },
  confirmDanger: { backgroundColor: ADMIN_COLORS.dangerBg },
  // 앱 버튼의 '위험' 색(옅은 빨강 바탕)이 빨간 막대 위에서 묻히지 않게 회색 바탕 + 테두리로 바꾼다.
  confirmApp: { backgroundColor: ADMIN_COLORS.neutralBg, borderWidth: 1, borderColor: COLORS.border },
  confirmText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textPrimary, lineHeight: 19 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  confirmButtonApp: { flex: 1, alignSelf: 'auto' },
  labelValue: { gap: 2 },
  label: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  value: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.textPrimary },
})
