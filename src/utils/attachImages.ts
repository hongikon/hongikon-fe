import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { REPORT_IMAGE_MAX_BYTES, reportImageContentType, type PickedReportImage } from '../apis/reports'

/** 문의(물어보기 '운영진에게 물어보기')에 붙이는 참고 사진 최대 장수 — 서버 FeedbackCreateRequest 와 같다. */
export const ATTACH_MAX_IMAGES = 3

/**
 * 앨범에서 참고 사진(화면 캡처 등)을 고른다. 제보 사진(ReportComposerModal)과 같은 규칙:
 * JPEG·PNG, 장당 5MB, iOS HEIC 는 JPEG 로 받아 오고, Android 는 시스템 사진 선택기라 권한을 묻지 않는다.
 * 올리기(uploadReportImage)는 보낼 때 한다 — 서버가 촬영 위치 등 부가 정보를 지운 사본으로 바꿔 저장한다.
 *
 * @returns 고른 뒤의 전체 목록과 안내 글(문제 없으면 null)
 */
export async function pickAttachImages(current: PickedReportImage[]): Promise<{ images: PickedReportImage[]; error: string | null }> {
  const remaining = ATTACH_MAX_IMAGES - current.length
  if (remaining <= 0) return { images: current, error: `사진은 ${ATTACH_MAX_IMAGES}장까지 붙일 수 있어요.` }
  try {
    if (Platform.OS !== 'android') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        return { images: current, error: '사진 접근 권한이 꺼져 있어요. 휴대폰 설정에서 홍익온의 사진 접근을 켜 주세요.' }
      }
    }
    const multiple = remaining > 1
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      ...(multiple ? { allowsMultipleSelection: true, selectionLimit: remaining, orderedSelection: true } : {}),
    })
    if (result.canceled || result.assets.length === 0) return { images: current, error: null }
    const seen = new Set(current.map((item) => item.uri))
    const next = [...current]
    let skipped = 0
    for (const asset of result.assets) {
      const picked: PickedReportImage = { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize }
      if (seen.has(picked.uri)) continue
      if (reportImageContentType(picked) === null || (picked.fileSize && picked.fileSize > REPORT_IMAGE_MAX_BYTES)) {
        skipped += 1
        continue
      }
      if (next.length >= ATTACH_MAX_IMAGES) {
        skipped += 1
        continue
      }
      seen.add(picked.uri)
      next.push(picked)
    }
    return {
      images: next,
      error: skipped > 0 ? `JPEG·PNG 이고 5MB 이하인 사진 ${ATTACH_MAX_IMAGES}장까지만 붙일 수 있어 ${skipped}장은 뺐어요.` : null,
    }
  } catch {
    return { images: current, error: '사진을 불러오지 못했어요.' }
  }
}
