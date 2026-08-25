import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { OSS_LICENSES } from '../../constants/openSourceLicenses'
import ModalHeader from './ModalHeader'

interface OpenSourceLicensesModalProps {
  visible: boolean
  onClose: () => void
}

export default function OpenSourceLicensesModal({ visible, onClose }: OpenSourceLicensesModalProps) {
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container} edges={['top']}>
        <ModalHeader title="오픈소스 라이선스" onClose={onClose} />
        <ScrollView style={styles.body}>
          {OSS_LICENSES.map((pkg) => (
            <View key={pkg.name} style={styles.row}>
              <Text style={styles.name}>{pkg.name}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.version}>v{pkg.version}</Text>
                <Text style={styles.license}>{pkg.license}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  body: { padding: 20 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f4f4f4',
  },
  name: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  version: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  license: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
})
