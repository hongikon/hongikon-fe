import { useCallback, useEffect, useState } from 'react'
import {
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import {
  requestNotificationPermission,
  useNotificationPermission,
  type NotificationPermission,
} from '../../lib/notificationPermission'
import { notify } from '../../utils/dialog'
import * as haptics from '../../lib/haptics'
import ModalHeader from './ModalHeader'
import Button from '../common/Button'
import { layoutStyles } from '../../constants/layout'

interface AppPermissionsModalProps {
  visible: boolean
  onClose: () => void
}

/**
 * 설정 > 앱 권한. 홍익온이 휴대폰에 요청하는 권한과 지금 상태를 한눈에 보여주고,
 * 꺼져 있으면 여기서 바로 허용하거나(아직 물을 수 있을 때) 휴대폰 설정으로 보낸다.
 *
 * - 알림: notificationPermission.ts 의 공용 상태를 그대로 쓴다.
 * - 카메라·사진: 제보 작성(ReportComposerModal)에서 [카메라로 찍기]·[앨범에서 고르기]를 누를 때만 쓴다.
 * - 위치: 기기 위치(GPS)는 쓰지 않는다(개인정보 처리방침과 같다). 제보 위치는 지도에서 직접 고른다.
 * 휴대폰 설정에서 바꾸고 돌아오면(앱이 다시 앞으로 오면) 상태를 다시 읽는다.
 */

/** 화면에 보여줄 권한 상태. 알림·사진을 같은 모양으로 맞춘다. */
type PermissionView =
  | { kind: 'loading' }
  | { kind: 'granted'; limited?: boolean }
  | { kind: 'undetermined'; canAskAgain: boolean }
  | { kind: 'denied'; canAskAgain: boolean }
  /** 이 기기에선 권한 없이 동작한다(Android 사진 선택기). */
  | { kind: 'notNeeded' }

function fromNotification(p: NotificationPermission): PermissionView {
  if (p.status === 'unknown' || p.status === 'unsupported') return { kind: 'loading' }
  if (p.status === 'granted') return { kind: 'granted' }
  return { kind: p.status, canAskAgain: p.canAskAgain }
}

function fromCamera(res: ImagePicker.CameraPermissionResponse): PermissionView {
  if (res.granted) return { kind: 'granted' }
  return { kind: res.status === 'denied' ? 'denied' : 'undetermined', canAskAgain: res.canAskAgain }
}

/** 카메라 권한. 사진 보관함과 같은 방식으로 앱 복귀 때 다시 읽는다. */
function useCameraPermission(enabled: boolean) {
  const [state, setState] = useState<PermissionView>({ kind: 'loading' })

  const refresh = useCallback(async () => {
    try {
      setState(fromCamera(await ImagePicker.getCameraPermissionsAsync()))
    } catch {
      // 읽지 못하면 이전 값을 둔다.
    }
  }, [])

  const request = useCallback(async () => {
    try {
      setState(fromCamera(await ImagePicker.requestCameraPermissionsAsync()))
    } catch {
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    return () => sub.remove()
  }, [enabled, refresh])

  return { state, request }
}

function fromMedia(res: ImagePicker.MediaLibraryPermissionResponse): PermissionView {
  if (res.granted) return { kind: 'granted', limited: res.accessPrivileges === 'limited' }
  return { kind: res.status === 'denied' ? 'denied' : 'undetermined', canAskAgain: res.canAskAgain }
}

/** 사진 보관함 권한. 화면이 떠 있는 동안 앱이 앞으로 돌아오면 다시 읽는다. */
function useMediaLibraryPermission(enabled: boolean) {
  const [state, setState] = useState<PermissionView>({ kind: 'loading' })

  const refresh = useCallback(async () => {
    try {
      setState(fromMedia(await ImagePicker.getMediaLibraryPermissionsAsync()))
    } catch {
      // 읽지 못하면 이전 값을 둔다.
    }
  }, [])

  const request = useCallback(async () => {
    try {
      setState(fromMedia(await ImagePicker.requestMediaLibraryPermissionsAsync()))
    } catch {
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    return () => sub.remove()
  }, [enabled, refresh])

  return { state, request }
}

function openPhoneSettings(what: string) {
  Linking.openSettings().catch(() =>
    notify('설정을 열지 못했어요', `휴대폰 설정 > 홍익온 > ${what}에서 바꿀 수 있어요.`),
  )
}

export default function AppPermissionsModal({ visible, onClose }: AppPermissionsModalProps) {
  const isWeb = Platform.OS === 'web'
  // Android 는 시스템 사진 선택기를 써서 사진 권한 자체가 없다(app.json blockedPermissions).
  const isAndroid = Platform.OS === 'android'
  const notification = fromNotification(useNotificationPermission())
  const media = useMediaLibraryPermission(visible && !isWeb && !isAndroid)
  const camera = useCameraPermission(visible && !isWeb)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* 폴드를 펼친 화면·넓은 웹 창에선 머리줄·카드를 가운데 읽기 폭으로 모은다.
              회색 바탕(scroll)은 화면 끝까지 깔아야 해서 본문은 contentContainerStyle 로만 좁힌다. */}
          <View style={layoutStyles.readable}>
            <ModalHeader title="앱 권한" onClose={onClose} />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, layoutStyles.readable]}>
            <Text style={styles.lead}>
              홍익온이 휴대폰에 요청하는 권한은 아래 세 가지뿐이에요. 모두 선택 권한이라 허용하지 않아도 홍익온을 쓸 수 있고, 그 기능만 쓸 수 없어요. 필요한 순간에만 묻고, 언제든 바꿀 수 있어요.
            </Text>

            {isWeb ? (
              <View style={styles.webNote}>
                <Ionicons name="phone-portrait-outline" size={18} color={COLORS.primary} />
                <Text style={styles.webNoteText}>
                  알림·카메라·사진 권한은 휴대폰 앱에서 설정해요. 웹에서는 따로 요청하는 권한이 없어요.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                <PermissionRow
                  icon="notifications-outline"
                  title="알림"
                  purpose="(선택) 구독한 게시판의 새 소식과 내 제보 승인·반려, 캠퍼스 새 제보를 알려드려요"
                  state={notification}
                  onRequest={() => {
                    void requestNotificationPermission()
                  }}
                  settingsName="알림"
                />
                <View style={styles.separator} />
                <PermissionRow
                  icon="camera-outline"
                  title="카메라"
                  purpose="(선택) 제보할 때 현장 사진을 바로 찍어요. 카메라 버튼을 누를 때만 물어요"
                  state={camera.state}
                  onRequest={() => {
                    void camera.request()
                  }}
                  settingsName="카메라"
                />
                <View style={styles.separator} />
                <PermissionRow
                  icon="images-outline"
                  title="사진"
                  purpose={
                    isAndroid
                      ? '(선택) 제보에 사진을 첨부할 때 휴대폰의 사진 선택 화면에서 골라요. 고른 사진만 전달돼서 따로 권한을 묻지 않아요'
                      : '(선택) 제보에 사진을 첨부할 때 앨범에서 골라요. 앨범 버튼을 누를 때만 물어요'
                  }
                  state={isAndroid ? { kind: 'notNeeded' } : media.state}
                  onRequest={() => {
                    void media.request()
                  }}
                  settingsName="사진"
                />
              </View>
            )}

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={17} color={COLORS.textSecondary} />
              </View>
              <View style={styles.infoBody}>
                <Text style={styles.infoTitle}>위치(GPS)·마이크·연락처는 사용하지 않아요</Text>
                <Text style={styles.infoText}>
                  기기 위치, 마이크, 연락처, Face ID 같은 권한은 요청하지 않아요. 제보 위치는 지도에서 직접 고른 곳만 써요.
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

const PILL = {
  granted: { label: '허용됨', bg: COLORS.successSoft, fg: COLORS.success },
  limited: { label: '일부 허용', bg: COLORS.warningSoft, fg: COLORS.warning },
  denied: { label: '꺼짐', bg: COLORS.dangerSoft, fg: '#B91C1C' },
  undetermined: { label: '아직 묻지 않음', bg: COLORS.fill, fg: COLORS.textSecondary },
  loading: { label: '확인 중', bg: COLORS.fill, fg: COLORS.textTertiary },
  notNeeded: { label: '권한 필요 없음', bg: COLORS.fill, fg: COLORS.textSecondary },
} as const

function pillFor(state: PermissionView) {
  if (state.kind === 'granted') return state.limited ? PILL.limited : PILL.granted
  return PILL[state.kind]
}

function PermissionRow({
  icon,
  title,
  purpose,
  state,
  onRequest,
  settingsName,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  purpose: string
  state: PermissionView
  onRequest: () => void
  /** 휴대폰 설정에서 찾아갈 항목 이름(설정을 못 열 때 안내에 쓴다). */
  settingsName: string
}) {
  const pill = pillFor(state)
  const canAsk = (state.kind === 'undetermined' || state.kind === 'denied') && state.canAskAgain
  const blocked = (state.kind === 'undetermined' || state.kind === 'denied') && !state.canAskAgain

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowPurpose}>{purpose}</Text>
        </View>
        <View
          style={[styles.pill, { backgroundColor: pill.bg }]}
          accessible
          accessibilityLabel={`${title} 권한 ${pill.label}`}
        >
          <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      </View>

      {canAsk && (
        <Button
          label="허용하기"
          size="md"
          onPress={() => {
            haptics.tapLight()
            onRequest()
          }}
          accessibilityLabel={`${title} 권한 허용하기`}
        />
      )}
      {blocked && (
        <Button
          label="설정 열기"
          variant="secondary"
          size="md"
          icon="open-outline"
          iconPosition="right"
          onPress={() => openPhoneSettings(settingsName)}
          accessibilityLabel={`휴대폰 설정에서 ${title} 권한 켜기`}
        />
      )}
      {state.kind === 'granted' && (
        <Pressable
          style={styles.linkBtn}
          onPress={() => openPhoneSettings(settingsName)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`휴대폰 설정에서 ${title} 권한 바꾸기`}
        >
          <Text style={styles.linkBtnText}>
            {state.limited ? '휴대폰 설정에서 전체 허용으로 바꾸기' : '휴대폰 설정에서 바꾸기'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  scroll: { flex: 1, backgroundColor: COLORS.sectionBg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  lead: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
  },
  card: { backgroundColor: COLORS.white, borderRadius: 16, paddingHorizontal: 16 },
  separator: { height: 0.5, backgroundColor: COLORS.border },
  row: { paddingVertical: 16, gap: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.textPrimary },
  rowPurpose: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: COLORS.textSecondary },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontFamily: FONTS.semibold, fontSize: 12 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 50, marginTop: -4 },
  linkBtnText: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  webNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },
  webNoteText: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: COLORS.textPrimary },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBody: { flex: 1, gap: 3, paddingTop: 1 },
  infoTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  infoText: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: COLORS.textSecondary },
})
