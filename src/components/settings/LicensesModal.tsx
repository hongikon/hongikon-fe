import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import SwipeBackModal from '../common/SwipeBackModal'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { SPACING } from '../../constants/spacing'
import { FONTS, TYPE } from '../../constants/typography'
import { openExternalUrl } from '../../utils/common/openExternalUrl'
import ModalHeader, { ModalPanel } from './ModalHeader'
import ContentColumn from '../common/ContentColumn'
import { useLicensesModal } from '../../hooks/settings/useLicensesModal'
import { type Row } from '../../utils/settings/licensesModal'

export interface LicensesModalProps {
  visible: boolean
  onClose: () => void
}

/**
 * 앱에 포함된 오픈소스 소프트웨어·글꼴의 라이선스. MIT·Apache 등은 배포물에 고지를 함께 넣으라고 요구한다.
 * 예전에는 웹(hongikon.com/licenses/)으로 보냈는데, 앱 안에서 바로 보이게 옮겼다. 항목을 누르면 전문이 펼쳐진다.
 */
export default function LicensesModal({ visible, onClose }: LicensesModalProps) {
  const { openKey, setOpenKey, data, rows } = useLicensesModal({ visible })

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'header') return <Text style={styles.header}>{item.title}</Text>
    const { entry, key } = item
    const open = openKey === key
    const meta = [entry.v, entry.l].filter(Boolean).join(' · ')
    const text = entry.t >= 0 && data ? data.texts[entry.t] : null
    return (
      <View style={styles.item}>
        <Pressable
          onPress={() => setOpenKey(open ? null : key)}
          style={({ pressed }) => [styles.itemHead, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${entry.n}, ${meta}`}
        >
          <View style={styles.itemTitle}>
            <Text style={styles.name}>{entry.n}</Text>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.chevron} />
        </Pressable>
        {open ? (
          <View style={styles.detail}>
            {entry.a ? <Text style={styles.meta}>{entry.a}</Text> : null}
            {entry.h ? (
              <Text style={styles.link} onPress={() => openExternalUrl(entry.h)} accessibilityRole="link">
                {entry.h}
              </Text>
            ) : null}
            <Text style={styles.licenseText} selectable>
              {text ?? `라이선스: ${entry.l}`}
            </Text>
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ContentColumn>
            <ModalHeader title="오픈소스 라이선스" onClose={onClose} />
            <ModalPanel>
            <FlatList
              data={rows}
              keyExtractor={(row) => (row.kind === 'header' ? `h:${row.title}` : row.key)}
              renderItem={renderRow}
              extraData={openKey}
              initialNumToRender={30}
              ListHeaderComponent={
                <Text style={styles.intro}>
                  홍익온 앱에는 아래 오픈소스 소프트웨어와 글꼴이 포함돼 있어요. 항목을 누르면 라이선스 전문을 볼 수 있어요.
                </Text>
              }
              contentContainerStyle={styles.list}
            />
            </ModalPanel>
          </ContentColumn>
        </SafeAreaView>
      </SafeAreaProvider>
    </SwipeBackModal>
  )
}

const styles = StyleSheet.create({
  // 회색 바탕 위에 머리 카드와 둥근 흰 본문 판이 뜬다(10-07 설정 탭과 같은 모양).
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  intro: { ...TYPE.callout, color: COLORS.textSecondary, paddingVertical: 16 },
  header: { ...TYPE.section, color: COLORS.textPrimary, marginTop: 16, marginBottom: 4 },
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  itemHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  pressed: { opacity: 0.6 },
  itemTitle: { flex: 1 },
  name: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textPrimary },
  meta: { ...TYPE.caption, color: COLORS.textTertiary, marginTop: 2 },
  detail: { paddingBottom: 14, gap: 6 },
  link: { ...TYPE.caption, color: COLORS.primary, textDecorationLine: 'underline' },
  licenseText: { fontFamily: FONTS.regular, fontSize: 11.5, lineHeight: 17, color: COLORS.textSecondary },
})
