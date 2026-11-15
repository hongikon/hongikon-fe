import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONTS } from '../../constants/typography'
import { RADIUS, SPACING } from '../../constants/spacing'
import Button from '../common/Button'
import { notify } from '../../utils/dialog'
import { haversineMeters } from '../../utils/geo'
import { getNearbyDebugInfo, startNearbyFieldRecording, stopNearbyFieldRecording } from '../../lib/nearbyPartners/background'
import {
  clearFieldEntries,
  fieldClock,
  fieldCsv,
  readFieldEntries,
  recordField,
  type FieldEntry,
  type FieldFix,
} from '../../lib/nearbyPartners/fieldRecord'

/** 측정 중에 화면을 새로 그리는 간격. */
const REFRESH_MS = 3_000
/** 정답 버튼으로 보여 줄 가까운 가게 수. */
const SHOP_CHOICES = 6

interface Shop {
  id: string
  name: string
  meters: number | null
}

/**
 * 현장 측정(11-13, 테스트 앱·관리자 계정): 위치를 연속으로 남기고, 테스터가 가게에 들어가고 나올 때 정답을 누른다.
 * 모은 기록은 CSV 로 내보내 지금 방식·칼만 필터·건물 외곽·HMM 을 같은 데이터로 비교하는 데 쓴다(`fieldRecord`).
 */
export default function NearbyFieldRecorder({ visible }: { visible: boolean }) {
  const [entries, setEntries] = useState<FieldEntry[]>([])
  const [recording, setRecording] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [targets, setTargets] = useState<{ id: string; name: string; lat: number; lng: number }[]>([])
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    void readFieldEntries().then((result) => {
      setEntries(result.entries)
      setRecording(result.recording)
      setStartedAt(result.startedAt)
    })
    void getNearbyDebugInfo().then((info) => {
      if (info) setTargets(info.state.targets.map((t) => ({ id: t.id, name: t.name, lat: t.lat, lng: t.lng })))
    })
  }, [])

  useEffect(() => {
    if (!visible) return
    reload()
    if (!recording) return
    const timer = setInterval(reload, REFRESH_MS)
    return () => clearInterval(timer)
  }, [visible, recording, reload])

  const fixes = useMemo(() => entries.filter((e): e is FieldFix => e.k === 'fix'), [entries])
  const lastFix = fixes.at(-1)
  const truthCount = entries.filter((e) => e.k === 'truth').length
  // 지금 '들어감'을 누른 채 '나옴'을 누르지 않은 가게.
  const openTruth = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const e = entries[i]
      if (e.k === 'truth') return e.ev === 'enter' ? e : null
    }
    return null
  }, [entries])

  const shops: Shop[] = useMemo(() => {
    const base = lastFix
      ? targets.map((t) => ({ id: t.id, name: t.name, meters: haversineMeters(lastFix.lat, lastFix.lng, t.lat, t.lng) }))
      : targets.map((t) => ({ id: t.id, name: t.name, meters: null }))
    return base.sort((a, b) => (a.meters ?? 0) - (b.meters ?? 0)).slice(0, SHOP_CHOICES)
  }, [targets, lastFix])

  const toggle = async () => {
    setBusy(true)
    try {
      if (recording) {
        await stopNearbyFieldRecording()
      } else {
        const ok = await startNearbyFieldRecording()
        if (!ok) notify('GPS 를 켜지 못했어요', '위치를 "항상" 허용했는지 확인해 주세요. 기록은 켜 두었어요.')
      }
    } finally {
      setBusy(false)
      reload()
    }
  }

  const mark = async (ev: 'enter' | 'exit', shop: { id: string; name: string }) => {
    await recordField({ k: 'truth', t: Date.now(), ev, shop: shop.id, name: shop.name })
    reload()
  }

  const exportCsv = async () => {
    const { entries: all } = await readFieldEntries()
    if (all.length === 0) {
      notify('내보낼 기록이 없어요')
      return
    }
    await Share.share({ title: '홍익온 현장 측정 기록', message: fieldCsv(all) }).catch(() => {})
  }

  const recent = entries.slice(-12).reverse()

  return (
    <>
      <Text style={styles.label}>현장 측정(정답 기록)</Text>
      <Text style={styles.hint}>
        측정을 켜면 GPS 를 계속 켜고 위치마다 위도·경도·오차·판단 결과를 남겨요. 가게에 들어가면 그 가게를, 나오면 '나왔어요'를 눌러
        정답을 남겨요. 좌표는 측정 중에만, 이 휴대폰에만 남고 직접 내보낼 때만 밖으로 나가요. 측정 중에는 배터리를 더 써요.
      </Text>

      <View style={styles.statusBox}>
        <Text style={[styles.status, recording && styles.statusOn]}>
          {recording ? `측정 중 · ${startedAt ? fieldClock(startedAt).slice(11, 16) : ''} 시작` : '측정 꺼짐'}
        </Text>
        <Text style={styles.small}>
          위치 {fixes.length}개 · 정답 {truthCount}개
          {lastFix
            ? ` · 마지막 ${fieldClock(lastFix.t).slice(11)} ${lastFix.src} 오차 ${lastFix.acc === null ? '?' : Math.round(lastFix.acc)}m` +
              (lastFix.nearName && lastFix.nearM !== undefined ? ` · ${lastFix.nearName} ${Math.round(lastFix.nearM)}m` : '') +
              (lastFix.inside.length > 0 ? ` · 머무는 중 ${lastFix.inside.length}곳` : '')
            : ''}
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button label={recording ? '측정 끝' : '측정 시작'} variant={recording ? 'secondary' : 'primary'} size="sm" onPress={() => void toggle()} loading={busy} />
        <Button label="CSV 내보내기" variant="outline" size="sm" onPress={() => void exportCsv()} />
        <Button label="기록 지우기" variant="ghost" size="sm" onPress={() => void clearFieldEntries().then(reload)} disabled={recording} />
      </View>

      {recording && (
        <View style={styles.truthBox}>
          {openTruth ? (
            <>
              <Text style={styles.small}>
                지금 {openTruth.name} 안 · {Math.max(0, Math.round((Date.now() - openTruth.t) / 60_000))}분째
              </Text>
              <Button label="나왔어요" variant="primary" size="sm" onPress={() => void mark('exit', { id: openTruth.shop, name: openTruth.name })} />
            </>
          ) : (
            <>
              <Text style={styles.small}>가게에 들어가면 그 가게를 눌러요(가까운 순)</Text>
              <View style={styles.buttons}>
                {shops.length === 0 ? (
                  <Text style={styles.small}>알림 대상 가게가 없어요. 근처 제휴 알림을 켜 두세요.</Text>
                ) : (
                  shops.map((shop) => (
                    <Button
                      key={shop.id}
                      label={shop.meters === null ? shop.name : `${shop.name} ${Math.round(shop.meters)}m`}
                      variant="outline"
                      size="sm"
                      onPress={() => void mark('enter', shop)}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </View>
      )}

      {recent.length > 0 && (
        <View style={styles.logBox}>
          {recent.map((e, index) => (
            <Text key={`${e.t}-${index}`} style={styles.logLine} selectable>
              {fieldClock(e.t).slice(11)}  {describe(e)}
            </Text>
          ))}
        </View>
      )}
      {recording && (
        <Pressable onPress={reload} accessibilityRole="button" style={styles.refresh}>
          <Text style={styles.refreshText}>{REFRESH_MS / 1000}초마다 새로 보여요 · 지금 새로 보기</Text>
        </Pressable>
      )}
    </>
  )
}

function describe(e: FieldEntry): string {
  if (e.k === 'truth') return `정답: ${e.name} ${e.ev === 'enter' ? '들어감' : '나옴'}`
  if (e.k === 'note') return e.text
  const near = e.nearName && e.nearM !== undefined ? ` · ${e.nearName} ${Math.round(e.nearM)}m` : ''
  const alert = e.alert ? ' · 알림 보냄' : ''
  return `${e.src} 오차 ${e.acc === null ? '?' : Math.round(e.acc)}m${near}${e.inside.length > 0 ? ` · 머무는 중 ${e.inside.length}` : ''}${alert}`
}

const styles = StyleSheet.create({
  label: { fontSize: 16, lineHeight: 22, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  hint: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  small: { fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  statusBox: { backgroundColor: COLORS.background, borderRadius: RADIUS.sm, padding: SPACING.sm, gap: 2 },
  status: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  statusOn: { color: COLORS.primary },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  truthBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, gap: 8 },
  logBox: { backgroundColor: COLORS.background, borderRadius: RADIUS.sm, padding: SPACING.sm, gap: 2 },
  logLine: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  refresh: { alignItems: 'center', paddingTop: 2 },
  refreshText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.primary },
})
