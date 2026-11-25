import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import ImageViewerModal from '../../../components/common/ImageViewerModal'
import { COLORS } from '../../../constants/colors'
import { RADIUS } from '../../../constants/spacing'
import { FONTS } from '../../../constants/typography'
import { useReportPhotos } from '../../hooks/reports/useReportPhotos'

export interface Props {
  /** 최대 3장(등록 순서). */
  photoUrls: readonly string[]
  /** 앱 관리 탭이면 같은 폭 타일(cover) + '원본' 힌트, 웹 콘솔은 원본 비율(contain). */
  app: boolean
}

/**
 * 제보 첨부 사진 줄과 크게 보기. 원본 주소(S3)를 브라우저로 열지 않고 앱 안에서 크게 본다 — 사용자 화면(ReportSheet)과 같은 보기.
 */
export function ReportPhotos({ photoUrls, app }: Props) {
  const { failedPhotoUrls, setFailedPhotoUrls, viewerIndex, setViewerIndex } = useReportPhotos()

  return (
    <>
      {photoUrls.length > 0 ? (
        <View style={styles.photoRow}>
          {photoUrls.map((url, index) =>
            failedPhotoUrls.includes(url) ? (
              <View key={url} style={[styles.photoFailed, app ? styles.photoAppTile : styles.photoTile]}>
                <Text style={styles.metaItalic}>사진을 불러오지 못했습니다. 새로고침하면 다시 불러옵니다.</Text>
              </View>
            ) : (
              <Pressable
                key={url}
                style={app ? styles.photoAppTile : styles.photoTile}
                onPress={() => setViewerIndex(index)}
                accessibilityRole="button"
                accessibilityLabel={photoUrls.length > 1 ? `첨부 사진 ${index + 1}/${photoUrls.length} 크게 보기` : '첨부 사진 크게 보기'}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.photoImage}
                  resizeMode={app ? 'cover' : 'contain'}
                  onError={() => setFailedPhotoUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))}
                />
                {app ? (
                  <View style={styles.photoHint} pointerEvents="none">
                    <Ionicons name="expand-outline" size={12} color={COLORS.white} />
                    <Text style={styles.photoHintText}>{photoUrls.length > 1 ? `${index + 1}/${photoUrls.length}` : '원본'}</Text>
                  </View>
                ) : null}
              </Pressable>
            ),
          )}
        </View>
      ) : null}
      <ImageViewerModal urls={photoUrls} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
    </>
  )
}

const styles = StyleSheet.create({
  // 웹 콘솔은 원본 비율 그대로(contain) 나란히, 앱은 같은 폭 타일(cover)로 나눈다.
  photoRow: { flexDirection: 'row', gap: 8 },
  // 좁은 화면에서도 한 줄에 나란히(줄어듦), 넓으면 장당 240 까지.
  photoTile: { flex: 1, minWidth: 0, maxWidth: 240, height: 200, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: '#F2F2F2' },
  photoAppTile: { flex: 1, height: 140, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: '#F2F2F2' },
  photoImage: { width: '100%', height: '100%' },
  photoFailed: { justifyContent: 'center', padding: 8 },
  photoHint: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoHintText: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.white },
  metaItalic: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary },
})
