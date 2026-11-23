import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import SwipeBackModal from '../common/SwipeBackModal'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { requestNotificationPermission, useNotificationPermission } from '../../lib/notificationPermission'
import { canLocate } from '../../lib/nearbyPartners/platform'
import ModalHeader from './ModalHeader'
import { nearbyAlertsAvailable } from '../../lib/nearbyPartners/background'
import { layoutStyles } from '../../constants/layout'
import { RADIUS, SPACING } from '../../constants/spacing'
import { kstTodayYmd } from '../../utils/map/exhibitions'
import { useCameraPermission, useLocationPermission, useMediaLibraryPermission } from '../../hooks/settings/usePermissionStates'
import { fromNotification, locationPurpose, mapLocationUse, unusedPermissionsCopy } from '../../utils/settings/permissions'
import PermissionRow from './permissions/PermissionRow'

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
 * - 위치: 지도 검색의 "내 주변 제휴 보기"(앱 사용 중, `lib/nearbyPartners/platform.ts`)와, 근처 알림 빌드에서 사용자가 켠
 *   근처 제휴 알림("항상")에 쓴다. 위치 모듈이 없는 예전 빌드(OTA)에서는 줄을 그리지 않는다. 제보 위치는 여전히 지도에서 직접 고른다.
 * 휴대폰 설정에서 바꾸고 돌아오면(앱이 다시 앞으로 오면) 상태를 다시 읽는다(hooks/settings/usePermissionStates).
 */
export default function AppPermissionsModal({ visible, onClose }: AppPermissionsModalProps) {
  const isWeb = Platform.OS === 'web'
  // Android 는 시스템 사진 선택기를 써서 사진 권한 자체가 없다(app.json blockedPermissions).
  const isAndroid = Platform.OS === 'android'
  const notification = fromNotification(useNotificationPermission())
  const media = useMediaLibraryPermission(visible && !isWeb && !isAndroid)
  const camera = useCameraPermission(visible && !isWeb)
  const hasLocation = !isWeb && canLocate()
  const location = useLocationPermission(visible && hasLocation)
  const unused = unusedPermissionsCopy(hasLocation, nearbyAlertsAvailable())

  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* 폴드를 펼친 화면·넓은 웹 창에선 머리 카드·카드를 가운데 읽기 폭으로 모은다.
              회색 바탕(scroll)은 화면 끝까지 깔아야 해서 본문은 contentContainerStyle 로만 좁힌다. */}
          <ModalHeader title="앱 권한" onClose={onClose} />
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, layoutStyles.readable]}>
            <Text style={styles.lead}>
              홍익온이 휴대폰에 요청하는 권한은 아래 {hasLocation ? '네' : '세'} 가지뿐이에요. 모두 선택 권한이라 허용하지 않아도 홍익온을 쓸 수 있고, 그 기능만 쓸 수 없어요. 필요한 순간에만 묻고, 언제든 바꿀 수 있어요.
            </Text>

            {isWeb ? (
              <View style={styles.webNote}>
                <Ionicons name="phone-portrait-outline" size={18} color={COLORS.primary} />
                <Text style={styles.webNoteText}>
                  알림·카메라·사진 권한은 휴대폰 앱에서 설정해요. 웹에서는 "내 주변 제휴 보기"를 누를 때만 브라우저가 위치 허용 여부를 물어요.
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
                {hasLocation && (
                  <>
                    <View style={styles.separator} />
                    <PermissionRow
                      icon="navigate-outline"
                      title="위치"
                      purpose={locationPurpose(nearbyAlertsAvailable(), mapLocationUse(kstTodayYmd()))}
                      state={location.state}
                      onRequest={() => {
                        void location.request()
                      }}
                      settingsName="위치"
                    />
                  </>
                )}
              </View>
            )}

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={17} color={COLORS.textSecondary} />
              </View>
              <View style={styles.infoBody}>
                {/* 근처 알림 빌드는 알림을 켜면 "항상" 위치를 쓴다 — 그때는 "백그라운드 위치를 안 쓴다"고 하지 않는다(11-03). */}
                <Text style={styles.infoTitle}>{unused.title}</Text>
                <Text style={styles.infoText}>{unused.text}</Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </SwipeBackModal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm, paddingBottom: 40 },
  lead: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    // 카드 안 글자(28)와 같은 들여쓰기(10-08).
    paddingHorizontal: SPACING.lg,
    paddingTop: 4,
    paddingBottom: 4,
  },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.floating, paddingHorizontal: 16 },
  separator: { height: 0.5, backgroundColor: COLORS.border },
  webNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: RADIUS.floating,
    backgroundColor: COLORS.white,
  },
  webNoteText: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: COLORS.textPrimary },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: RADIUS.floating,
    backgroundColor: COLORS.white,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBody: { flex: 1, gap: 3, paddingTop: 1 },
  infoTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary },
  infoText: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: COLORS.textSecondary },
})
