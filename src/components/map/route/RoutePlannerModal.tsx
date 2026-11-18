import { memo, type ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import SwipeBackModal from '../../common/SwipeBackModal'
import ContentColumn from '../../common/ContentColumn'
import { COLORS } from '../../../constants/colors'
import { FONTS } from '../../../constants/typography'
import type { Building } from '../../../types'
import RouteEndpointInputs, { type RouteEndpoint } from './RouteEndpointInputs'
import BuildingSearchList from './BuildingSearchList'

interface Props {
  visible: boolean
  onClose: () => void
  /** 이 창 위에 떠야 하는 팝업(고른 건물의 층 다이얼). */
  overlay?: ReactNode
  target: RouteEndpoint | null
  fromLabel: string | null
  toLabel: string | null
  onChangeTarget: (target: RouteEndpoint) => void
  query: string
  onChangeQuery: (query: string) => void
  buildings: readonly Building[]
  onSelectBuilding: (building: Building) => void
  onPickDestinationOnMap: () => void
  onSelectMyLocation?: () => void
}

/** 길찾기 창: 출발·도착 칸 + 고르는 쪽의 건물 검색. 건물을 고르면 창이 닫히고 지도에 경로가 그려진다. */
function RoutePlannerModal({ visible, onClose, overlay, target, fromLabel, toLabel, onChangeTarget, ...search }: Props) {
  return (
    <SwipeBackModal visible={visible} onRequestClose={onClose}>
      {overlay}
      {/* Modal 은 별도 화면으로 떠서 바깥 SafeAreaProvider 의 inset 이 맞지 않는다(노치·홈 인디케이터와 겹침). */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ContentColumn>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="뒤로 가기"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.title}>길찾기</Text>
              <View style={styles.headerSpacer} />
            </View>

            <RouteEndpointInputs target={target} fromLabel={fromLabel} toLabel={toLabel} onChangeTarget={onChangeTarget} />

            {target && <BuildingSearchList target={target} {...search} />}
          </ContentColumn>
        </SafeAreaView>
      </SafeAreaProvider>
    </SwipeBackModal>
  )
}

export default memo(RoutePlannerModal)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 16,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  headerSpacer: { width: 22 },
})
