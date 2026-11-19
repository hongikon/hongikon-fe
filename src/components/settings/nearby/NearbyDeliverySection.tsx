import { Pressable, Text, View } from 'react-native'
import { DEFAULT_DWELL_MINUTES, MAX_ALERTS_PER_DAY } from '../../../lib/nearbyPartners/rules'
import { setNearbyPrefs, type NearbySettings } from '../../../lib/nearbyPartners/background'
import { NIGHT_HINT, NIGHT_LABEL } from '../../../utils/settings/nearby'
import ToggleSwitch from '../ToggleSwitch'
import { DwellStepper } from './NearbyFormRows'
import { nearbyStyles as styles } from './styles'

interface Props {
  settings: NearbySettings | null
  dwell: { cafe: number; other: number }
  working: boolean
  /** 확인 도구가 보이고 횟수 제한을 풀었으면 안내 문구를 바꾼다. */
  unlimitedNote: boolean
  run: (message: string, job: () => Promise<unknown>) => Promise<void>
  onToggleNight: (allow: boolean) => Promise<void>
}

/** 받는 방법: 횟수 안내 · 알림까지 머무는 시간 · 밤에도 받기. 켜기 전에도 고를 수 있게(11-01 — 켠 뒤에만 보여 머무는 시간 선택을 찾을 수 없었다). */
export default function NearbyDeliverySection({ settings, dwell, working, unlimitedNote, run, onToggleNight }: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>받는 방법</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          {unlimitedNote
            ? '테스트 모드: 지금 횟수 제한 없이 머무는 동안 5분마다 보내요(아래 [테스트]에서 바꿀 수 있어요).'
            : `같은 가게는 다시 찾았을 때 3시간에 한 번, 하루 최대 ${MAX_ALERTS_PER_DAY}번, 알림 사이는 30분 넘게 띄워요.`}
        </Text>
        <View style={styles.divider} />
        <Text style={styles.settingLabel}>알림까지 머무는 시간</Text>
        <DwellStepper
          label="카페"
          value={dwell.cafe}
          disabled={working}
          onChange={(cafe) => void run('저장하는 중이에요', () => setNearbyPrefs({ dwellMinutes: { ...dwell, cafe } }))}
        />
        <DwellStepper
          label="그 밖의 가게"
          value={dwell.other}
          disabled={working}
          onChange={(other) => void run('저장하는 중이에요', () => setNearbyPrefs({ dwellMinutes: { ...dwell, other } }))}
        />
        {(dwell.cafe !== DEFAULT_DWELL_MINUTES.cafe || dwell.other !== DEFAULT_DWELL_MINUTES.other) && (
          <Pressable
            onPress={() => void run('저장하는 중이에요', () => setNearbyPrefs({ dwellMinutes: null }))}
            disabled={working}
            hitSlop={6}
            accessibilityRole="button"
          >
            <Text style={styles.resetText}>
              기본값으로 되돌리기(카페 {DEFAULT_DWELL_MINUTES.cafe}분, 그 밖 {DEFAULT_DWELL_MINUTES.other}분)
            </Text>
          </Pressable>
        )}
        <Text style={styles.hint}>짧게 하면 가게 앞을 지나가기만 해도 올 수 있어요.</Text>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingLabel}>{NIGHT_LABEL}</Text>
            <Text style={styles.hint}>{NIGHT_HINT}</Text>
          </View>
          <ToggleSwitch
            value={settings?.quietNight === false}
            onToggle={() => void onToggleNight(settings?.quietNight !== false)}
            locked={working}
            accessibilityLabel={`${NIGHT_LABEL}, 야간 수신 동의`}
          />
        </View>
      </View>
    </>
  )
}
