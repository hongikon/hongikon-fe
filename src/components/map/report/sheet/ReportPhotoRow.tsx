import { Image, Pressable, StyleSheet, View } from 'react-native'
import { COLORS } from '../../../../constants/colors'
import { RADIUS } from '../../../../constants/spacing'
import type { PhotoTileSizes } from '../../../../hooks/map/report/usePhotoTileSizes'

interface ReportPhotoRowProps {
  photoUrls: readonly string[]
  photoSizes: PhotoTileSizes
  /** 사진을 누르면 그 번호로 크게 보기. */
  onOpen: (index: number) => void
  /** 만료 등으로 못 불러온 사진(깨진 칸 대신 숨긴다). */
  onError: (url: string) => void
}

/**
 * 제보 시트의 사진 줄. 사진마다 원래 비율 그대로 같은 높이로 나란히 — 자르지도, 칸에 여백을 남기지도 않는다(11-01).
 * 누르면 앱 안 사진 보기(ImageViewerModal)로 크게 연다.
 */
export default function ReportPhotoRow({ photoUrls, photoSizes, onOpen, onError }: ReportPhotoRowProps) {
  return (
    <View style={styles.photoRow} onLayout={photoSizes.onLayout}>
      {photoUrls.map((url, index) => (
        <Pressable
          key={url}
          style={[styles.photoTile, photoSizes.sizeOf(url)]}
          onPress={() => onOpen(index)}
          accessibilityRole="imagebutton"
          accessibilityLabel={
            photoUrls.length > 1
              ? `제보 첨부 사진 ${index + 1}/${photoUrls.length}, 크게 보기`
              : '제보 첨부 사진, 크게 보기'
          }
        >
          <Image
            source={{ uri: url }}
            style={styles.photo}
            resizeMode="cover"
            onError={() => onError(url)}
          />
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  photoTile: { borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.fill },
  photo: { width: '100%', height: '100%' },
})
