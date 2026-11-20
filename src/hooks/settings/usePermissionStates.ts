import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { getLocationPermission, requestLocationPermission } from '../../lib/nearbyPartners/platform'
import { fromCamera, fromLocation, fromMedia, type PermissionView } from '../../utils/settings/permissions'

/** 카메라 권한. 사진 보관함과 같은 방식으로 앱 복귀 때 다시 읽는다. */
export function useCameraPermission(enabled: boolean) {
  const [state, setState] = useState<PermissionView>({ kind: 'loading' })

  const refresh = useCallback(async () => {
    try {
      setState(fromCamera(await ImagePicker.getCameraPermissionsAsync()))
    } catch {
      // 읽지 못하면 이전 값을 둔다.
    }
  }, [])

  const request = useCallback(async () => {
    try {
      setState(fromCamera(await ImagePicker.requestCameraPermissionsAsync()))
    } catch {
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    return () => sub.remove()
  }, [enabled, refresh])

  return { state, request }
}

/** 사진 보관함 권한. 화면이 떠 있는 동안 앱이 앞으로 돌아오면 다시 읽는다. */
export function useMediaLibraryPermission(enabled: boolean) {
  const [state, setState] = useState<PermissionView>({ kind: 'loading' })

  const refresh = useCallback(async () => {
    try {
      setState(fromMedia(await ImagePicker.getMediaLibraryPermissionsAsync()))
    } catch {
      // 읽지 못하면 이전 값을 둔다.
    }
  }, [])

  const request = useCallback(async () => {
    try {
      setState(fromMedia(await ImagePicker.requestMediaLibraryPermissionsAsync()))
    } catch {
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    return () => sub.remove()
  }, [enabled, refresh])

  return { state, request }
}

/** 위치(앱 사용 중) 권한. 카메라와 같이 앱 복귀 때 다시 읽는다. */
export function useLocationPermission(enabled: boolean) {
  const [state, setState] = useState<PermissionView>({ kind: 'loading' })

  const refresh = useCallback(async () => {
    const res = await getLocationPermission()
    if (res) setState(fromLocation(res))
  }, [])

  const request = useCallback(async () => {
    setState(fromLocation(await requestLocationPermission()))
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    return () => sub.remove()
  }, [enabled, refresh])

  return { state, request }
}
