import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  message?: string
}

export default function EmptyState({
  icon = 'file-tray-outline',
  message = '등록된 항목이 없습니다',
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color="#ddd" />
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: { fontSize: 13, color: '#ccc' },
})
