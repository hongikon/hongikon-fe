import type { ReactNode } from 'react'
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import { RADIUS, SPACING } from '../../../constants/spacing'
import { layoutStyles } from '../../../constants/layout'
import { PARTNER_REGION_RADIUS_METERS } from '../../../lib/nearbyPartners/rules'
import { backgroundDisclosure, deviceIsKorean } from '../../../lib/nearbyPartners/locationDisclosure'
import { alwaysAllowCopy, permissionSteps, type PermissionStep } from '../../../utils/settings/nearby'
import Button from '../../common/Button'
import { nearbyStyles as shared } from './styles'

/** 시스템 권한 창(또는 설정 목록) 그림. 눌러야 할 항목에 남색 테두리와 "이걸 눌러요". */
function PermissionMock({ title, options, pick, list }: Omit<PermissionStep, 'caption'>) {
  return (
    <View style={[styles.mockDialog, list && styles.mockList]} accessible accessibilityLabel={`${options[pick]} 을 고르세요`}>
      {title ? <Text style={styles.mockTitle}>{title}</Text> : null}
      {options.map((option, index) => {
        const picked = index === pick
        return (
          <View key={option} style={[list ? styles.mockRow : styles.mockButton, picked && styles.mockPicked]}>
            <Text style={[styles.mockButtonText, list && styles.mockRowText, picked && styles.mockPickedText]}>{option}</Text>
            {list && picked ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
            {picked ? (
              <View style={styles.mockTag} pointerEvents="none">
                <Text style={styles.mockTagText}>이걸 눌러요</Text>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

/** 전체 화면 안내 틀(아이콘·제목·스크롤 본문·아래 버튼). */
function OverlayFrame({ title, footer, children }: { title: string; footer: ReactNode; children: ReactNode }) {
  // 절대 위치라 SafeAreaView 의 여백을 받지 못한다 — 상태 막대·홈 표시줄만큼 직접 띄운다(10-29 시뮬레이터에서 아이콘이 시계와 겹침).
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={[styles.overlayContent, layoutStyles.readable]}>
        <View style={styles.overlayIcon}>
          <Ionicons name="navigate" size={28} color={COLORS.white} />
        </View>
        <Text style={styles.overlayTitle}>{title}</Text>
        {children}
      </ScrollView>
      <View style={[shared.footer, layoutStyles.readable, styles.overlayFooter]}>{footer}</View>
    </View>
  )
}

/**
 * 위치 정보 사용 명시적 공개(Google Play 사용자 데이터 정책 "명시적 공개 및 동의 요건", 백그라운드 위치 정책의 "눈에 띄는 고지").
 * 위치 권한 창 바로 앞에 띄우고, '동의하고 계속'을 누르면 곧바로 위치 권한 창이 뜬다(알림 권한은 이 화면 전에 묻는다).
 * 공개 문장과 동의 버튼만 둔다 — 권한 창 사용법 그림은 "앱 사용 중"을 허용한 뒤 `AlwaysAllowOverlay` 에서.
 * 문구는 `locationDisclosure.ts`(휴대폰 언어가 한국어가 아니면 영어 — 11-12 두 번째 거절 때 심사 기기가 영어였다).
 */
export function LocationDisclosureOverlay({ onAgree, onDecline }: { onAgree: () => void; onDecline: () => void }) {
  const copy = backgroundDisclosure(deviceIsKorean(), PARTNER_REGION_RADIUS_METERS)
  return (
    <OverlayFrame
      title={copy.title}
      footer={
        <>
          <Button label={copy.agree} size="lg" onPress={onAgree} />
          <Button label={copy.decline} variant="secondary" size="lg" onPress={onDecline} />
        </>
      }
    >
      <View style={styles.disclosureCard} accessibilityRole="summary">
        <Text style={styles.disclosureLead}>{copy.lead}</Text>
        {copy.bullets.map((line) => (
          <View key={line} style={shared.bulletRow}>
            <Text style={shared.bullet}>·</Text>
            <Text style={shared.bulletText}>{line}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.overlayBody}>{copy.next}</Text>
    </OverlayFrame>
  )
}

/**
 * "항상 허용" 고르기 안내. "앱 사용 중"을 허용한 뒤 "항상" 권한 창(Android 는 앱 위치 설정 화면) 전에 무엇을 고르는지 그림으로 보여 준다.
 * `afterSettings`: "항상"을 고르지 않고 돌아온 경우 — 휴대폰 설정에서 바꾸는 길을 안내한다.
 */
export function AlwaysAllowOverlay({ afterSettings, onContinue, onCancel }: { afterSettings: boolean; onContinue: () => void; onCancel: () => void }) {
  const ko = deviceIsKorean()
  const ios = Platform.OS === 'ios'
  const steps = permissionSteps(afterSettings, ko, ios)
  const { title, body } = alwaysAllowCopy(afterSettings, ko, ios)
  return (
    <OverlayFrame
      title={title}
      footer={
        <>
          {afterSettings ? (
            <Button label={ko ? '휴대폰 설정 열기' : 'Open phone settings'} size="lg" onPress={() => Linking.openSettings().catch(() => {})} />
          ) : (
            <Button label={ko ? '계속' : 'Continue'} size="lg" onPress={onContinue} />
          )}
          <Button label={ko ? '나중에 할게요' : 'Not now'} variant="secondary" size="lg" onPress={onCancel} />
        </>
      }
    >
      <Text style={styles.overlayBody}>{body}</Text>
      {steps.map((item) => (
        <View key={item.caption} style={styles.mockStep}>
          <Text style={styles.mockCaption}>{item.caption}</Text>
          <PermissionMock title={item.title} options={item.options} pick={item.pick} list={item.list} />
        </View>
      ))}
    </OverlayFrame>
  )
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: COLORS.background },
  overlayContent: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: SPACING.lg },
  overlayIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  overlayTitle: { fontSize: 20, lineHeight: 28, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  overlayBody: { fontSize: 15, lineHeight: 23, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  disclosureCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, gap: 8, borderWidth: 1, borderColor: COLORS.primary },
  disclosureLead: { fontSize: 16, lineHeight: 24, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 4 },
  mockStep: { gap: 8 },
  mockCaption: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  // iOS 시스템 창처럼: 둥근 회색 판, 알약 모양 버튼.
  mockDialog: { backgroundColor: '#E9E9EE', borderRadius: RADIUS.lg, padding: 14, gap: 8 },
  mockList: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 4, gap: 0 },
  mockTitle: { fontSize: 14, lineHeight: 19, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 4 },
  mockButton: {
    backgroundColor: '#D9D9DF',
    borderRadius: RADIUS.pill,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mockPicked: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  mockButtonText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  mockRowText: { color: COLORS.textPrimary },
  mockPickedText: { fontFamily: FONTS.bold, color: COLORS.primary },
  mockTag: {
    position: 'absolute',
    top: -11,
    right: 10,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  mockTagText: { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.white },
  overlayFooter: { gap: SPACING.sm },
})
