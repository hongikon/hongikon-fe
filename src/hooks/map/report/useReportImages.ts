import { useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { uploadReportImage, type PickedReportImage } from '../../../apis/reports'
import { filterPickedAssets, pickedAssetsError } from '../../../utils/map/reportComposer'
import { REPORT_MAX_IMAGES } from '../../../utils/reports'

/**
 * 제보 작성창의 사진: 붙인 사진(최대 3장)·이미 올린 사진 키·사진 관련 오류 안내.
 * 권한은 버튼을 누른 그때만 묻는다(카메라·앨범 각각).
 */
export function useReportImages() {
  /** 붙인 사진(최대 3장, 고른 순서 = 보이는 순서). */
  const [images, setImages] = useState<PickedReportImage[]>([])
  /**
   * 이미 올린 사진의 키(uri → key). 제보 등록만 실패하거나 중간 장에서 업로드가 끊겨 다시 시도할 때
   * 올라간 사진을 또 올리지 않게 한다. 서버가 사진을 거절(400)하면 비운다(서버가 지웠을 수 있다).
   */
  const uploadedKeysRef = useRef<Map<string, string>>(new Map())
  /** 사진 업로드가 실패해 "사진 없이 올리기"를 보여줄지. */
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false)
  /** 서버에 사진 기능이 아직 없어 사진을 빼고 올렸다 — 완료 화면에서 알려준다. */
  const [photoSkipped, setPhotoSkipped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 거절된 권한. 있으면 오류 안내 옆에 "설정 열기"를 보여준다. */
  const [blockedPermission, setBlockedPermission] = useState<'camera' | 'library' | null>(null)

  /** 올린 사진 키를 잊는다. 다음 등록 때 사진을 새로 올린다. */
  const clearUploadedKeys = () => {
    uploadedKeysRef.current = new Map()
  }

  const resetImages = () => {
    setImages([])
    uploadedKeysRef.current = new Map()
    setPhotoUploadFailed(false)
    setPhotoSkipped(false)
    setError(null)
    setBlockedPermission(null)
  }

  /**
   * 사진은 최대 3장. 앨범은 남은 장수만큼 한 번에 여러 장 고르고(고른 순서 유지), 카메라는 한 번에 1장씩 더한다.
   * 권한은 버튼을 누른 그때만 묻는다(카메라·앨범 각각). 거절된 뒤엔 휴대폰 설정으로 보내는 버튼을 보여준다.
   */
  const handlePickImage = async (source: 'camera' | 'library') => {
    setError(null)
    setBlockedPermission(null)
    const remaining = REPORT_MAX_IMAGES - images.length
    if (remaining <= 0) {
      setError(`사진은 ${REPORT_MAX_IMAGES}장까지 붙일 수 있어요.`)
      return
    }
    try {
      // Android 앨범은 시스템 사진 선택기(Photo Picker, 없으면 문서 선택기)로 열려 권한이 필요 없다.
      // 저장소·READ_MEDIA_* 권한은 Play 정책 때문에 매니페스트에서 막아 두었으니(app.json blockedPermissions)
      // Android 12 이하에서 사진 권한을 물으면 늘 거절로 돌아와 앨범을 못 연다 — 그래서 묻지 않는다.
      const skipPermission = source === 'library' && Platform.OS === 'android'
      const permission = skipPermission
        ? { granted: true }
        : source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setBlockedPermission(source)
        setError(
          source === 'camera'
            ? '카메라 권한이 꺼져 있어 사진을 찍을 수 없어요.'
            : '사진 접근 권한이 꺼져 있어 사진을 고를 수 없어요.',
        )
        return
      }

      // 남은 자리가 1장이면 단일 선택으로 연다(Android 사진 선택기는 여러 장 모드에서 상한 1을 받지 않는다).
      const multiple = source === 'library' && remaining > 1
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        // JPEG 로 다시 압축해 용량을 줄인다(서버 상한 장당 5MB).
        quality: 0.7,
        allowsEditing: false,
        // iOS 앨범의 HEIC 사진을 JPEG 로 받아 온다(서버는 JPEG·PNG 만 받음).
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        ...(multiple ? { allowsMultipleSelection: true, selectionLimit: remaining, orderedSelection: true } : {}),
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options)
      if (result.canceled || result.assets.length === 0) return

      // 웹은 selectionLimit 를 지원하지 않아 더 많이 고를 수 있다 — 앞에서부터 남은 장수만 쓴다.
      const filtered = filterPickedAssets(
        result.assets,
        images.map((item) => item.uri),
        remaining,
      )
      if (filtered.accepted.length > 0) {
        setImages((prev) => [...prev, ...filtered.accepted].slice(0, REPORT_MAX_IMAGES))
        setPhotoUploadFailed(false)
      }
      const message = pickedAssetsError(filtered, result.assets.length === 1, REPORT_MAX_IMAGES)
      if (message !== null) setError(message)
    } catch {
      // 시뮬레이터처럼 카메라가 없는 기기 등
      setError(source === 'camera' ? '이 기기에서는 카메라를 쓸 수 없어요. 앨범에서 골라 주세요.' : '사진을 불러오지 못했어요.')
    }
  }

  const handleRemoveImage = (uri: string) => {
    setImages((prev) => prev.filter((item) => item.uri !== uri))
    setPhotoUploadFailed(false)
    setError(null)
  }

  /** 사진을 올려 키를 받는다. 같은 사진을 이미 올렸으면 그 키를 쓴다. */
  const ensureImageKey = async (picked: PickedReportImage, token: string, signal?: AbortSignal): Promise<string> => {
    const cached = uploadedKeysRef.current.get(picked.uri)
    if (cached) return cached
    const key = await uploadReportImage(picked, token, signal)
    uploadedKeysRef.current.set(picked.uri, key)
    return key
  }

  return {
    images,
    setImages,
    photoUploadFailed,
    setPhotoUploadFailed,
    photoSkipped,
    setPhotoSkipped,
    error,
    setError,
    blockedPermission,
    clearUploadedKeys,
    resetImages,
    handlePickImage,
    handleRemoveImage,
    ensureImageKey,
  }
}

export type ReportImages = ReturnType<typeof useReportImages>
