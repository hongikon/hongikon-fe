import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { PickedReportImage } from '../../../../apis/reports'
import { COLORS } from '../../../../constants/colors'
import { RADIUS } from '../../../../constants/spacing'
import { FONTS } from '../../../../constants/typography'
import { REPORT_MAX_IMAGES } from '../../../../utils/map/report/reports'
import { composerStyles } from './composerStyles'

interface ComposerPhotoSectionProps {
  images: readonly PickedReportImage[]
  /** 등록 중에는 사진을 더하거나 뺄 수 없다. */
  submitting: boolean
  onPickImage: (source: 'camera' | 'library') => void
  onRemoveImage: (uri: string) => void
}

/** 제보 작성창의 사진(선택): 붙인 사진 미리보기(첫 장 = 대표)와 카메라·앨범 버튼. 웹은 앨범만. */
export default function ComposerPhotoSection({
  images,
  submitting,
  onPickImage,
  onRemoveImage,
}: ComposerPhotoSectionProps) {
  return (
    <>
      <View style={styles.photoHeader}>
        <Text style={[composerStyles.sectionLabel, styles.photoHeaderLabel]}>사진 (선택)</Text>
        <Text
          style={styles.photoCount}
          accessibilityLabel={`사진 ${images.length}장, 최대 ${REPORT_MAX_IMAGES}장`}
        >
          {images.length}/{REPORT_MAX_IMAGES}
        </Text>
      </View>
      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoThumbRow}
        >
          {images.map((item, index) => (
            <View key={item.uri} style={styles.photoPreviewWrap}>
              <Image
                source={{ uri: item.uri }}
                style={styles.photoPreview}
                accessibilityLabel={`첨부한 사진 ${index + 1}`}
              />
              {index === 0 && images.length > 1 && (
                <View style={styles.photoCoverBadge} pointerEvents="none">
                  <Text style={styles.photoCoverText}>대표</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => onRemoveImage(item.uri)}
                disabled={submitting}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`첨부한 사진 ${index + 1} 빼기`}
              >
                <Ionicons name="close" size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      {images.length < REPORT_MAX_IMAGES && (
        <View style={styles.photoBtnRow}>
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={[styles.photoBtn, styles.photoBtnHalf]}
              onPress={() => onPickImage('camera')}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="카메라로 찍기"
            >
              <Ionicons name="camera-outline" size={18} color={COLORS.primary} />
              <Text style={styles.photoBtnText}>카메라로 찍기</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.photoBtn, styles.photoBtnHalf]}
            onPress={() => onPickImage('library')}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="앨범에서 고르기"
          >
            <Ionicons name="images-outline" size={18} color={COLORS.primary} />
            <Text style={styles.photoBtnText}>앨범에서 고르기</Text>
          </TouchableOpacity>
        </View>
      )}
      {images.length === 0 && (
        <Text style={composerStyles.hint}>최대 {REPORT_MAX_IMAGES}장까지 붙일 수 있어요. 촬영 위치 정보는 지우고 올려요.</Text>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  photoBtn: {
    height: 46,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.chipBorder,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.primary },
  photoBtnRow: { flexDirection: 'row', gap: 8 },
  photoBtnHalf: { flex: 1 },
  photoHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  photoHeaderLabel: { flex: 1 },
  photoCount: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary, marginBottom: 8 },
  // 지우기 버튼(위·오른쪽으로 6 나감)이 잘리지 않게 위·오른쪽 여백을 둔다.
  photoThumbRow: { flexDirection: 'row', gap: 10, paddingTop: 6, paddingRight: 6, marginBottom: 10 },
  photoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoPreview: { width: 96, height: 96, borderRadius: RADIUS.md, backgroundColor: COLORS.fill },
  photoCoverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoCoverText: { fontFamily: FONTS.semibold, fontSize: 10.5, color: COLORS.white },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
