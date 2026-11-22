import { Linking, Platform, Text, View } from 'react-native'
import type { NearbyChecklist } from '../../../lib/nearbyPartners/background'
import { CheckRow } from './NearbyFormRows'
import { nearbyStyles as styles } from './styles'

/** 위치를 "항상 허용"해야 하는 이유 — 켜기 전 안내와 권한이 모자랄 때 같은 말을 쓴다. */
const ALWAYS_ALLOW_NOTICE =
  Platform.OS === 'android'
    ? '위치를 "항상 허용"으로 해 두어야 제휴 가게에 머물 때 바로 알림을 받을 수 있어요. "앱 사용 중에만 허용"으로 두면 앱을 닫았을 때는 알림이 오지 않아요.'
    : '위치를 "항상 허용"으로 해 두어야 제휴 가게에 머물 때 바로 알림을 받을 수 있어요. "앱을 사용하는 동안"만 허용하면 앱을 닫았을 때는 알림이 오지 않아요.'

interface Props {
  alreadyOn: boolean
  checklist: NearbyChecklist | null
  serverPaused: boolean
  onFixNotifications: () => void
  onFixAlways: () => void
}

/** 창 맨 위: 켜져 있으면 "알림이 오려면" 점검표, 꺼져 있으면 "항상 허용" 안내와 받는 조건 설명. */
export default function NearbyStatusSection({ alreadyOn, checklist, serverPaused, onFixNotifications, onFixAlways }: Props) {
  if (alreadyOn) {
    return (
      <>
        <Text style={styles.sectionTitle}>알림이 오려면</Text>
        <View style={styles.card}>
          <CheckRow ok={checklist?.notifications === true} label="알림 허용" fixLabel="허용하기" onFix={onFixNotifications} />
          <CheckRow
            ok={checklist?.always === true}
            label={'위치 "항상 허용"'}
            hint="앱을 닫아 둬도 가게에 머무는 걸 알아채려면 필요해요."
            fixLabel="고치기"
            onFix={onFixAlways}
          />
          {checklist?.precise !== null && checklist?.precise !== undefined && (
            <CheckRow
              ok={checklist.precise}
              label="정확한 위치"
              hint="대략적인 위치로는 어느 가게에 있는지 알 수 없어요."
              fixLabel="설정 열기"
              onFix={() => Linking.openSettings().catch(() => {})}
            />
          )}
          <CheckRow ok={!serverPaused} label="근처 알림 운영 중" hint={serverPaused ? '운영진이 잠시 멈췄어요. 다시 켜지면 자동으로 알려 드려요.' : undefined} last />
        </View>
      </>
    )
  }
  return (
    <>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>{ALWAYS_ALLOW_NOTICE}</Text>
      </View>
      <View style={styles.card}>
        {[
          `제휴 가게 근처에 머물면 그 가게 혜택을 알려 드려요.`,
          '위치는 휴대폰 안에서 근처 업체를 찾는 데만 쓰고, 서버로 보내거나 저장하지 않아요.',
        ].map((line) => (
          <View key={line} style={styles.bulletRow}>
            <Text style={styles.bullet}>·</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
      </View>
    </>
  )
}
