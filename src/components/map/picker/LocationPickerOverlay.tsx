import { memo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Button from '../../common/Button'
import ReportMegaphoneIcon from '../../common/ReportMegaphoneIcon'
import { COLORS } from '../../../constants/colors'
import { CAMPUS_CENTER } from '../../../constants/map'
import { REPORT_OFF_CAMPUS_MAX_METERS } from '../../../constants/report'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { haversineMeters } from '../../../utils/common/geo'
import MapCrosshair from './MapCrosshair'

/** report: 제보, partner: 정보 제보(설정의 정보 제보 창), routeTo: 길찾기 도착 건물을 핀으로. */
export type PickerPurpose = 'report' | 'partner' | 'routeTo'

export interface PickerCenter {
  lat: number
  lng: number
  buildingName: string | null
}

interface Props {
  purpose: PickerPurpose
  /** 지도 가운데 좌표(지도를 움직일 때마다 바뀐다). 아직 모르면 null. */
  center: PickerCenter | null
  /** routeTo 일 때 핀 아래(또는 가까운) 길찾기할 수 있는 건물 이름. 없으면 null. */
  routeBuildingName: string | null
  /** 위 안내 줄 top(지도 위 막대 아래). */
  top: number
  /** 아래 카드 bottom(떠 있는 탭바 위). */
  bottom: number
  /** 넓은 창에서 시트와 같은 폭으로 맞추는 양쪽 여백. */
  side: number
  onCancel: () => void
  onConfirm: () => void
}

const GUIDE: Record<PickerPurpose, string> = {
  partner: '지도를 움직여 가게 위치에 핀을 맞춰 주세요',
  routeTo: '지도를 움직여 도착할 건물에 핀을 맞춰 주세요',
  report: '지도를 움직여 제보할 위치를 맞춰 주세요',
}

const CONFIRM: Record<PickerPurpose, string> = {
  partner: '이 위치로 정보 제보',
  routeTo: '여기로 도착',
  report: '이 위치 제보하기',
}

/** 아래 카드의 위치 문구. */
function locationText(purpose: PickerPurpose, center: PickerCenter | null, routeBuildingName: string | null): string {
  if (!center) return '위치 확인 중...'
  if (purpose === 'routeTo') return routeBuildingName ? `도착: ${routeBuildingName}` : '근처에 길찾기할 수 있는 건물이 없어요'
  if (center.buildingName) return `${center.buildingName} 근처`
  if (purpose === 'report') {
    // 캠퍼스 밖 제보(10-27): 홍대 생활권 안이면 장소를 직접 적어 올리고, 더 멀면 올릴 수 없다고 미리 알린다.
    return haversineMeters(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, center.lat, center.lng) <= REPORT_OFF_CAMPUS_MAX_METERS
      ? '캠퍼스 밖 · 다음 화면에서 장소를 적어 주세요'
      : `캠퍼스에서 ${REPORT_OFF_CAMPUS_MAX_METERS / 1000}km 밖은 제보할 수 없어요`
  }
  return `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
}

/**
 * 지도에서 위치 고르기: 가운데 고정 핀 + 위 안내 줄 + 아래 위치·확인 카드. 지도를 움직여 핀 아래로 위치를 맞춘다.
 */
function LocationPickerOverlay({ purpose, center, routeBuildingName, top, bottom, side, onCancel, onConfirm }: Props) {
  const inset = { left: 12 + side, right: 12 + side }
  return (
    <>
      <MapCrosshair>
        <View style={styles.pinAnchor}>
          <View style={styles.pinBubble}>
            {purpose === 'routeTo' ? (
              <Ionicons name="flag" size={18} color={COLORS.white} />
            ) : (
              <ReportMegaphoneIcon size={18} color={COLORS.white} />
            )}
          </View>
          <View style={styles.pinTail} />
        </View>
        <View style={styles.dot} />
      </MapCrosshair>

      <View style={[styles.topBar, inset, { top }]}>
        <Text style={styles.topText} numberOfLines={2}>
          {GUIDE[purpose]}
        </Text>
        <TouchableOpacity
          onPress={onCancel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="위치 선택 취소"
        >
          <Ionicons name="close" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomBar, inset, { bottom }]}>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color={COLORS.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationText(purpose, center, routeBuildingName)}
          </Text>
          {/* 위쪽 안내 줄의 X 까지 손을 뻗지 않아도 되게 아래 카드에도 취소를 둔다(10-27 요청).
              오른손 엄지가 닿는 오른쪽, 위치 문구와 같은 줄. */}
          <TouchableOpacity
            onPress={onCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="위치 선택 취소"
          >
            <Ionicons name="close" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        <Button
          label={CONFIRM[purpose]}
          onPress={onConfirm}
          disabled={!center || (purpose === 'routeTo' && !routeBuildingName)}
        />
      </View>
    </>
  )
}

export default memo(LocationPickerOverlay)

const styles = StyleSheet.create({
  pinAnchor: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateY: -25 }],
  },
  pinBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pinTail: {
    width: 2,
    height: 9,
    backgroundColor: COLORS.primary,
    marginTop: -1,
  },
  dot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  topBar: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  topText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 20,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.floating,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  locationText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14.5,
    color: COLORS.textPrimary,
  },
})
