import { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'
import { notify } from '../../utils/common/dialog'
import { haversineMeters } from '../../utils/common/geo'
import { getNearbyDebugInfo, startNearbyFieldRecording, stopNearbyFieldRecording } from '../../lib/nearbyPartners/background'
import { fieldCsv, readFieldEntries, recordField, type FieldEntry, type FieldFix } from '../../lib/nearbyPartners/fieldRecord'
import { REFRESH_MS, SHOP_CHOICES, type Shop } from '../../utils/settings/nearbyFieldRecorder'

/** NearbyFieldRecorder 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useNearbyFieldRecorder({ visible }: Pick<{ visible: boolean }, 'visible'>) {
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
  return {
    recording,
    startedAt,
    busy,
    reload,
    fixes,
    lastFix,
    truthCount,
    openTruth,
    shops,
    toggle,
    mark,
    exportCsv,
    recent,
  }
}
