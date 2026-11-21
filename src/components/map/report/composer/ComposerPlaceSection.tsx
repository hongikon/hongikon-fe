import { Animated, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../../constants/colors'
import { REPORT_OFF_CAMPUS_MAX_METERS } from '../../../../constants/report'
import { RADIUS } from '../../../../constants/spacing'
import { FONTS } from '../../../../constants/typography'
import type { useAttentionFlash } from '../../../../hooks/common/useAttentionFlash'
import { REPORT_PLACE_MAX_LENGTH, formatCoord } from '../../../../utils/map/reportComposer'
import TextField from '../../../common/TextField'
import WheelPicker from '../../../common/WheelPicker'
import { type WheelItem } from '../../../../utils/common/wheelPicker'
import type { ReportTarget } from '../ReportComposerModal'
import { composerStyles } from './composerStyles'

const FLOOR_LEVEL_ITEMS: readonly WheelItem<boolean>[] = [
  { value: false, label: '지상' },
  { value: true, label: '지하' },
]

interface ComposerPlaceSectionProps {
  target: ReportTarget | null
  shownPlace: string
  placeEdited: boolean
  onChangePlace: (value: string) => void
  /** 핀 근처 학교 건물을 찾았는지. 없으면 층 다이얼 대신 안내 상자를 보여 준다. */
  hasBuilding: boolean
  offCampus: boolean
  /** 건물 안내 상자를 깜빡이는 애니메이션 스타일(`useAttentionFlash`). */
  buildingFlash: ReturnType<typeof useAttentionFlash>
  basement: boolean
  onChangeBasement: (value: boolean) => void
  floorItems: WheelItem<number>[]
  floorNumber: number
  onChangeFloorNumber: (value: number) => void
  /** 로비층(L)이 있는 건물의 층 목록(위층 → 아래층). 있으면 지상/지하 다이얼 대신 이 목록 하나로 고른다. */
  buildingFloorItems: WheelItem<number>[] | null
  buildingFloor: number
  onChangeBuildingFloor: (value: number) => void
}

/**
 * 제보 작성창 맨 위: 장소 설명 칸과, 학교 건물이면 층 다이얼(지상/지하 · 1~30), 아니면 캠퍼스 밖 안내.
 * 장소 설명은 핀 근처 건물로 채워 두고, 더 정확하게 고칠 수 있다(제보 시트·HOT 목록·공유 문구에 보인다).
 */
export default function ComposerPlaceSection({
  target,
  shownPlace,
  placeEdited,
  onChangePlace,
  hasBuilding,
  offCampus,
  buildingFlash,
  basement,
  onChangeBasement,
  floorItems,
  floorNumber,
  onChangeFloorNumber,
  buildingFloorItems,
  buildingFloor,
  onChangeBuildingFloor,
}: ComposerPlaceSectionProps) {
  return (
    <>
      <View style={styles.placeLabelRow}>
        <Ionicons name="location" size={15} color={COLORS.primary} />
        <Text style={styles.sectionLabelInline}>장소</Text>
      </View>
      <TextField
        value={shownPlace}
        onChangeText={onChangePlace}
        placeholder={
          offCampus
            ? '예: 홍대입구역 9번 출구 앞'
            : target
              ? `${formatCoord(target.lat)}, ${formatCoord(target.lng)}`
              : '장소'
        }
        accessibilityLabel="장소 설명"
        maxLength={REPORT_PLACE_MAX_LENGTH}
      />
      <Text style={styles.placeHint}>
        {offCampus && !placeEdited
          ? '캠퍼스 밖이라 어디인지 꼭 적어 주세요. 제보 시트와 알림에 이 장소로 보여요.'
          : placeEdited
            ? '직접 고친 장소로 올라가요.'
            : '핀 위치로 채웠어요. 더 정확하게 고칠 수 있어요(예: T동 1층 로비 앞).'}
      </Text>

      {!hasBuilding ? (
        <Animated.View style={[composerStyles.errorBox, styles.buildingBox, buildingFlash]}>
          <Ionicons name="information-circle" size={15} color={COLORS.warningIcon} />
          <Text style={composerStyles.errorText}>
            {offCampus
              ? '학교 건물 밖이라 층 없이 올라가요. 위 장소 칸에 어디인지 적어 주세요.'
              : `캠퍼스와 홍대 근처(캠퍼스에서 ${REPORT_OFF_CAMPUS_MAX_METERS / 1000}km 안)까지만 제보할 수 있어요. 창을 닫고 핀을 더 가까이 옮겨 주세요.`}
          </Text>
        </Animated.View>
      ) : (
        <>
          <Text style={composerStyles.sectionLabel}>몇 층인가요?</Text>
          {buildingFloorItems ? (
            // 홍문관 R동처럼 L층이 있는 건물: 길찾기 층 다이얼과 같은 그 건물의 층 목록.
            <View style={styles.floorWheels}>
              <WheelPicker
                items={buildingFloorItems}
                value={buildingFloor}
                onChange={onChangeBuildingFloor}
                visibleRows={3}
                accessibilityLabel="몇 층"
                style={styles.floorWheel}
              />
            </View>
          ) : (
            <View style={styles.floorWheels}>
              <WheelPicker
                items={FLOOR_LEVEL_ITEMS}
                value={basement}
                onChange={onChangeBasement}
                visibleRows={3}
                accessibilityLabel="지상 또는 지하"
                style={styles.floorWheel}
              />
              <WheelPicker
                items={floorItems}
                value={floorNumber}
                onChange={onChangeFloorNumber}
                visibleRows={3}
                accessibilityLabel={basement ? '지하 몇 층' : '몇 층'}
                style={styles.floorWheel}
              />
            </View>
          )}
        </>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  placeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  sectionLabelInline: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  placeHint: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginTop: 6, marginBottom: 16 },
  floorWheels: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  floorWheel: { width: 104 },
  // 깜빡일 때만 보이는 테두리(평소엔 바탕색과 같다).
  buildingBox: { borderWidth: 1, borderColor: COLORS.warningSoft },
})
