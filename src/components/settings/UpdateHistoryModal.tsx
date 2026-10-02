import { useState } from 'react'
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import { COLORS } from '../../constants/colors'
import { FONTS, TYPE } from '../../constants/typography'
import { RADIUS, SPACING } from '../../constants/spacing'
import { CHANGELOG, type ChangelogEntry } from '../../constants/changelog'
import { confirmAction, notify } from '../../utils/dialog'
import ModalHeader from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import ListRow from '../common/ListRow'
import SectionTitle from '../common/SectionTitle'
import Button from '../common/Button'

type UpdatesModule = typeof import('expo-updates')

let cachedUpdates: UpdatesModule | null | undefined
/** 웹·네이티브 모듈이 없는 환경에서도 죽지 않게, expo-updates 는 쓸 때 꺼내 본다. */
function loadUpdates(): UpdatesModule | null {
  if (cachedUpdates !== undefined) return cachedUpdates
  cachedUpdates = null
  if (Platform.OS !== 'web') {
    try {
      cachedUpdates = require('expo-updates') as UpdatesModule
    } catch {
      cachedUpdates = null
    }
  }
  return cachedUpdates
}

interface UpdateInfo {
  /** 스토어/테스트 빌드처럼 OTA 를 실제로 받는 환경인지(개발 서버·Expo Go·웹은 false) */
  enabled: boolean
  isEmbeddedLaunch: boolean
  createdAt: Date | null
  updateId: string | null
  channel: string | null
}

function readUpdateInfo(): UpdateInfo | null {
  const Updates = loadUpdates()
  if (!Updates) return null
  try {
    return {
      enabled: Updates.isEnabled,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      createdAt: Updates.createdAt ?? null,
      updateId: Updates.updateId ?? null,
      channel: Updates.channel ?? null,
    }
  } catch {
    return null
  }
}

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '-'
}

/** "현재 버전 1.0.0 · 마지막 업데이트 2026-10-02" 의 뒷부분 */
function describeInstalled(info: UpdateInfo | null): string {
  if (info?.enabled) {
    if (info.isEmbeddedLaunch) return '앱에 포함된 버전'
    if (info.createdAt) return `마지막 업데이트 ${formatDate(info.createdAt)}`
  }
  // 웹·개발 환경은 OTA 정보가 없어 변경 기록의 최신 날짜를 보여 준다.
  return CHANGELOG[0] ? `마지막 업데이트 ${CHANGELOG[0].date}` : ''
}

interface UpdateHistoryModalProps {
  visible: boolean
  onClose: () => void
}

/** 설정 > 일반 > 업데이트 내역. 지금 버전과 `constants/changelog.ts` 의 기록을 최신순으로 보여 준다. */
export default function UpdateHistoryModal({ visible, onClose }: UpdateHistoryModalProps) {
  const [checking, setChecking] = useState(false)
  const info = readUpdateInfo()
  const installed = describeInstalled(info)
  const canCheck = info?.enabled === true && !__DEV__ && Platform.OS !== 'web'

  const technical = [
    info?.updateId && !info.isEmbeddedLaunch ? `업데이트 ID ${info.updateId.slice(0, 8)}` : null,
    info?.channel ? `채널 ${info.channel}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const checkForUpdate = async () => {
    const Updates = loadUpdates()
    if (!Updates || checking) return
    setChecking(true)
    try {
      const result = await Updates.checkForUpdateAsync()
      if (!result.isAvailable) {
        notify('최신 버전이에요', '지금 쓰고 있는 버전이 가장 새로운 버전이에요.')
        return
      }
      await Updates.fetchUpdateAsync()
      confirmAction({
        title: '새 버전을 받았어요',
        message: '앱을 다시 시작하면 적용돼요. 지금 다시 시작할까요?',
        confirmLabel: '다시 시작',
        onConfirm: () => {
          void Updates.reloadAsync().catch(() => notify('다시 시작하지 못했어요', '앱을 껐다가 다시 켜 주세요.'))
        },
      })
    } catch {
      notify('업데이트를 확인하지 못했어요', '인터넷 연결을 확인하고 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ContentColumn>
            <ModalHeader title="업데이트 내역" onClose={onClose} />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              <View style={styles.current}>
                <Text style={styles.currentTitle}>
                  현재 버전 {getAppVersion()}
                  {installed ? ` · ${installed}` : ''}
                </Text>
                {technical !== '' && <Text style={styles.currentMeta}>{technical}</Text>}
                {canCheck && (
                  <Button
                    label="업데이트 확인"
                    variant="secondary"
                    size="sm"
                    icon="refresh-outline"
                    fullWidth={false}
                    loading={checking}
                    onPress={() => void checkForUpdate()}
                    style={styles.checkButton}
                  />
                )}
              </View>

              {CHANGELOG.map((entry) => (
                <ChangelogSection key={`${entry.date}-${entry.title}`} entry={entry} />
              ))}
            </ScrollView>
          </ContentColumn>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

function ChangelogSection({ entry }: { entry: ChangelogEntry }) {
  const kindLabel = entry.kind === 'app' ? '새 앱 버전' : entry.kind === 'ota' ? '바로 적용' : null
  return (
    <View style={styles.section}>
      <SectionTitle title={entry.title} meta={`v${entry.version} · ${entry.date}`} />
      {kindLabel && (
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>{kindLabel}</Text>
        </View>
      )}
      <View style={styles.items}>
        {entry.items.map((item) => (
          <View key={item} style={styles.item}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * 설정 > 일반의 "업데이트 내역" 줄. 창 열림 상태를 스스로 가져서 설정 화면에는 이 한 줄만 들어간다.
 */
export function UpdateHistoryRow({ last }: { last?: boolean }) {
  const [visible, setVisible] = useState(false)
  return (
    <>
      <ListRow
        icon="information-circle-outline"
        label="업데이트 내역"
        value={getAppVersion()}
        last={last}
        onPress={() => setVisible(true)}
      />
      <UpdateHistoryModal visible={visible} onClose={() => setVisible(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: SPACING.xxxl },
  current: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  currentTitle: { ...TYPE.subhead, color: COLORS.textPrimary },
  currentMeta: { ...TYPE.caption, color: COLORS.textTertiary },
  checkButton: { alignSelf: 'flex-start', marginTop: SPACING.sm },
  section: { backgroundColor: COLORS.white, marginBottom: SPACING.sm, paddingBottom: SPACING.md },
  badgeRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xs },
  badge: {
    ...TYPE.label,
    color: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
  },
  items: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, gap: SPACING.sm },
  item: { flexDirection: 'row', gap: SPACING.sm },
  bullet: { ...TYPE.body, color: COLORS.textTertiary },
  itemText: { ...TYPE.body, flex: 1, color: COLORS.textPrimary, fontFamily: FONTS.regular },
})
