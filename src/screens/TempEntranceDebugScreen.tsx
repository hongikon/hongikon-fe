import { useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import NaverMapView from '../components/map/NaverMapView'
import type { NaverMapViewHandle } from '../components/map/NaverMapView'
import { buildMapHTML } from '../utils/mapHtml'
import { BUILDINGS } from '../constants/buildings'

interface Props {
  /** 'dots' = 지점+연결선+경로 전부(/temp/dots). 'paths' = 실내 경로 선만(/temp/path). */
  mode: 'dots' | 'paths'
}

/**
 * 임시 - 출입구/실내 경로 좌표 검증용 화면. 웹에서 `/temp/dots`, `/temp/path` 로 직접
 * 접근한다(App.tsx 참고). buildings.ts/pathNodes.ts 에 실 데이터가 반영되면 이 파일과
 * App.tsx 의 관련 분기, `src/debug/entranceCheckData.ts`, `buildMapHTML` 의
 * `entranceDebugMode` 매개변수를 통째로 지운다.
 *
 * 네이티브(WebView)는 원격 지도 페이지(MAP_PAGE_URL)를 그대로 불러와 `html` prop을
 * 쓰지 않으므로 이 화면은 웹에서만 의미가 있다.
 */
export default function TempEntranceDebugScreen({ mode }: Props) {
  const webViewRef = useRef<NaverMapViewHandle>(null)
  const [authFailed, setAuthFailed] = useState(false)
  const mapHTML = useMemo(() => buildMapHTML(BUILDINGS, mode), [mode])

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {mode === 'paths'
            ? '임시 · 실내 경로 전용 보기 (/temp/path)'
            : '임시 · 출입구 좌표 검증용 (/temp/dots)'}
        </Text>
      </View>
      <NaverMapView
        ref={webViewRef}
        html={mapHTML}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data)
            if (msg.type === 'mapAuthFailure') setAuthFailed(true)
          } catch {
            // 무시 - 이 화면은 지도 인증 실패 여부만 신경 쓴다.
          }
        }}
      />
      {authFailed && (
        <View style={styles.authFailBanner}>
          <Text style={styles.authFailText}>네이버 지도 인증 실패 - 도메인 미등록 가능성</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  banner: {
    paddingTop: 44,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: '#111827',
  },
  bannerText: { color: '#fbbf24', fontSize: 12 },
  authFailBanner: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: '#7f1d1d',
    padding: 10,
    borderRadius: 8,
  },
  authFailText: { color: '#fff', fontSize: 12 },
})
