import { useSyncExternalStore } from 'react'
import { useIsFocused } from '@react-navigation/native'
import { View, Text, StyleSheet, Modal } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { DIALOG_MAX_WIDTH } from '../../constants/layout'
import Button from '../common/Button'

const STORAGE_KEY = '@hongik_partner_notice_seen'

/**
 * 안내를 이미 봤는지. 앱 전체가 함께 본다 — 알림 안내(NotificationPrimer)가 이 창이 닫힐 때까지 기다린다.
 * 처음 로그인하고 지도에 들어오면 이 창과 알림 안내(전체 화면 Modal)가 거의 동시에 떴는데, 네이티브 Modal 두 개가
 * 겹쳐 뜨면 뒤 것이 제대로 안 열리고 보이지 않는 막만 남아 화면을 눌러도 반응이 없었다(10-15 iOS·Android 첫 설치 제보).
 * 'unknown' = 저장소를 아직 안 읽음, 'pending' = 띄울 차례, 'seen' = 봤음(또는 못 읽어 건너뜀).
 */
type NoticeState = 'unknown' | 'pending' | 'seen'
let noticeState: NoticeState = 'unknown'
let loading = false
const listeners = new Set<() => void>()

function setNoticeState(next: NoticeState): void {
  if (noticeState === next) return
  noticeState = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!loading) {
    loading = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((seen) => setNoticeState(seen ? 'seen' : 'pending'))
      .catch(() => setNoticeState('seen'))
  }
  return () => {
    listeners.delete(listener)
  }
}

/** 제휴 안내가 아직 닫히지 않았는지(판단 전 포함). 다른 첫 실행 안내 창은 이게 false 가 된 뒤에 띄운다. */
export function usePartnerNoticePending(): boolean {
  return useSyncExternalStore(subscribe, () => noticeState, () => noticeState) !== 'seen'
}

export const PARTNER_NOTICE_TEXT =
  '해당 정보들은 각 단과대의 instagram을 참고하여 제작하였으며 잘못된 제휴 내용은 업데이트를 위해 제보 부탁드립니다.'

/**
 * 앱을 처음 열었을 때 한 번만 뜨는 제휴 정보 출처 안내.
 * 확인을 누르면 AsyncStorage 에 플래그를 남겨 다음부터는 뜨지 않는다.
 * 같은 문구는 설정 탭 공지사항에도 실려 있어, 언제든 다시 확인할 수 있다.
 */
export default function PartnerNoticeModal() {
  const visible = useSyncExternalStore(subscribe, () => noticeState, () => noticeState) === 'pending'
  // 지도 탭이 화면에 보일 때만 띄운다. 소식 상세 링크로 바로 들어오면 지도 탭이 뒤에서 먼저 그려지는데,
  // 그때 이 창이 소식 화면 위를 덮었다.
  const focused = useIsFocused()

  const handleConfirm = () => {
    setNoticeState('seen')
    AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {})
  }

  if (!visible || !focused) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleConfirm}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="information-circle" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>제휴 정보 안내</Text>
          <Text style={styles.body}>{PARTNER_NOTICE_TEXT}</Text>
          <Button label="확인했어요" onPress={handleConfirm} size="md" />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.scrim,
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconWrap: { marginBottom: 8 },
  title: { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 8 },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
})
