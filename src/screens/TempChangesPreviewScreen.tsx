import { useMemo, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { RADIUS } from '../constants/spacing'
import BuildingSheet from '../components/map/BuildingSheet'
import FacilitySheet from '../components/map/FacilitySheet'
import AskChat from '../components/ask/AskChat'
import ReportScheduleFields, { initialReportSchedule, resolveSchedule, scheduleDaysFor, type ReportSchedule } from '../components/map/ReportScheduleFields'
import { toReportMarkers } from '../utils/reports'
import {
  formatDaySpan,
  formatReportSchedule,
  isSameKstDay,
  kstDateTime,
  parseReportDays,
  reportPhase,
  type ReportDayHours,
} from '../utils/reportSchedule'
import type { Building, Facility, ReportListItem } from '../types'

/**
 * 개발용 `/temp/changes` — 11-08 바뀐 화면을 실제 컴포넌트와 예시 데이터로 한곳에서 본다(개발 서버·테스트 빌드 웹에서만).
 * 서버를 부르지 않는다. 지도 위 동작(핀 흐림·경로 맞춤·칩과 시트)은 글로 적는다.
 */

const HOUR = 60 * 60 * 1000

const R_BUILDING: Building = {
  name: '홍문관 R동',
  lat: 37.5508,
  lng: 126.9245,
  color: COLORS.primary,
  category: '강의',
  type: '강의동',
  floors: 15,
  basementFloors: 2,
  description: '예시 건물(미리보기용)',
}

const R_FACILITIES: Facility[] = [
  { id: 'p1', kind: '프린터', buildingName: R_BUILDING.name, floor: 2, note: '복사실 옆' },
  { id: 'p2', kind: '프린터', buildingName: R_BUILDING.name, floor: 5 },
  { id: 'e1', kind: '엘리베이터', buildingName: R_BUILDING.name },
  { id: 'x1', kind: '행사·전시', buildingName: R_BUILDING.name, floor: 1 },
  { id: 'c1', kind: '카페', buildingName: R_BUILDING.name, floor: 1 },
]

/** 오늘부터 dayOffset 일 뒤 한국 날짜 `2026-11-14`. */
function dateKey(dayOffset: number): string {
  const ms = kstDateTime(dayOffset, 12, 0) + 9 * HOUR
  return new Date(ms).toISOString().slice(0, 10)
}

/** 한국 시각 → 서버 형식(존 없는 UTC). */
function serverTime(dayOffset: number, hours: number, minutes = 0): string {
  return new Date(kstDateTime(dayOffset, hours, minutes)).toISOString().slice(0, 19)
}

function sampleReport(id: number, title: string, startsAt: string, endsAt: string, days?: ReportDayHours[]): ReportListItem {
  return {
    id,
    buildingId: null,
    floor: null,
    lat: 37.55,
    lng: 126.925,
    category: 'BOOTH',
    title,
    content: null,
    authorNickname: '예시',
    isMine: false,
    startsAt,
    endsAt,
    createdAt: serverTime(0, 9),
    ...(days ? { days } : {}),
  } as ReportListItem
}

// 2일 뒤부터 3일: 매일 14:00~18:00 / 날마다 다른 시간(가운데 날 쉼) / 한 번짜리(2일 뒤 14:00~16:00)
const SAME = sampleReport(1, '붕어빵 부스', serverTime(2, 14), serverTime(4, 18), [
  { date: dateKey(2), start: '14:00', end: '18:00' },
  { date: dateKey(3), start: '14:00', end: '18:00' },
  { date: dateKey(4), start: '14:00', end: '18:00' },
])
const VARIED = sampleReport(2, '플리마켓', serverTime(2, 14), serverTime(5, 17), [
  { date: dateKey(2), start: '14:00', end: '18:00' },
  { date: dateKey(3), start: '11:00', end: '15:00' },
  { date: dateKey(5), start: '13:00', end: '17:00' },
])
const ONCE = sampleReport(3, '버스킹 공연', serverTime(2, 14), serverTime(2, 16))
const REPORTS = [SAME, VARIED, ONCE]

const TIMES: { label: string; ms: number }[] = [
  { label: '시작 전날 20:00', ms: kstDateTime(1, 20, 0) },
  { label: '첫날 10:00', ms: kstDateTime(2, 10, 0) },
  { label: '첫날 15:00', ms: kstDateTime(2, 15, 0) },
  { label: '첫날 15:40', ms: kstDateTime(2, 15, 40) },
  { label: '첫날 17:40', ms: kstDateTime(2, 17, 40) },
  { label: '첫날 19:00', ms: kstDateTime(2, 19, 0) },
  { label: '둘째 날 16:00', ms: kstDateTime(3, 16, 0) },
]

export default function TempChangesPreviewScreen() {
  return (
    <SafeAreaProvider>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>11-08 바뀐 내용 미리보기</Text>
        <Text style={styles.lead}>
          실제 앱 컴포넌트에 예시 데이터를 넣어 보여 줍니다. 서버에는 아무것도 보내지 않아요. 지도 위에서만 보이는 동작은 글로 적었어요.
        </Text>

        <MapSheetsSection />
        <RouteSection />
        <ReportPinsSection />
        <ReportComposerSection />
        <SettingsSection />
        <AskComposerSection />
      </ScrollView>
    </SafeAreaProvider>
  )
}

/** 물어보기 입력창(앱 모드). 로그인 없이 인사(하이·hi)만 답한다 — 웹 Enter 보내기·포커스 테두리 확인용(11-09). */
function AskComposerSection() {
  return (
    <Section title="6. 물어보기 입력창 — 웹 Enter 보내기" commit="FE 11-09">
      <Changes
        items={[
          'Enter 는 보내기, Shift+Enter 는 줄바꿈이에요(한글 조합 중 Enter 도 글자가 확정된 뒤 보내요).',
          '입력칸의 브라우저 기본 분홍·파랑 테두리를 없애고, 포커스는 입력 상자 테두리 색(남색)으로 보여요.',
          "로그인 없이 '하이'·'hi' 같은 인사만 답해요(그 밖의 질문은 로그인 안내).",
        ]}
      />
      <View style={{ height: 360, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
        <AskChat accessToken={null} beta bottomInset={0} />
      </View>
    </Section>
  )
}

function Section({ title, commit, children }: { title: string; commit: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.h2}>{title}</Text>
        <Text style={styles.commit}>{commit}</Text>
      </View>
      {children}
    </View>
  )
}

function Changes({ items }: { items: string[] }) {
  return (
    <View style={styles.changes}>
      {items.map((item) => (
        <View key={item} style={styles.changeRow}>
          <View style={styles.bullet} />
          <Text style={styles.changeText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

function Phone({ caption, height = 560, children }: { caption: string; height?: number; children: ReactNode }) {
  return (
    <View style={styles.phoneWrap}>
      <View style={[styles.phone, { height }]}>{children}</View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  )
}

// ── 1. 지도 시트와 필터 칩 ─────────────────────────────

function MapSheetsSection() {
  return (
    <Section title="1. 건물 시트 · 시설 시트" commit="FE 03a315d">
      <Changes
        items={[
          "'건물 안 시설' 목록이 위쪽 칩과 같은 목록·이름을 씁니다. 엘리베이터는 칩처럼 숨기고, '행사·전시'는 '전시'로 적어요.",
          "줄을 누르면 지금처럼 그 건물의 시설 시트(예: R동 프린터실)가 열리고, '학교 시설'·'프린터' 칩이 켜져요.",
          '시설 시트 머리에도 출발·도착 버튼이 생겼어요(그 시설이 있는 건물로 길찾기). 건물 시트와 같은 버튼을 함께 씁니다.',
        ]}
      />
      <View style={styles.phones}>
        <Phone caption="건물 시트 — 엘리베이터 줄 없음, '전시' 이름">
          <BuildingSheet
            building={R_BUILDING}
            facilities={R_FACILITIES}
            onOpenFacility={() => {}}
            onClose={() => {}}
            routeFindingEnabled
            onSetFrom={() => {}}
            onSetTo={() => {}}
          />
        </Phone>
        <Phone caption="시설 시트 — 머리 아래 출발·도착(새로)">
          <FacilitySheet
            kind="프린터"
            buildingName={R_BUILDING.name}
            items={R_FACILITIES.filter((f) => f.kind === '프린터')}
            onClose={() => {}}
            onSetFrom={() => {}}
            onSetTo={() => {}}
            routeNext={null}
          />
        </Phone>
      </View>
    </Section>
  )
}

// ── 2. 길찾기 ───────────────────────────────────────

function RouteSection() {
  return (
    <Section title="2. 길찾기" commit="FE 03a315d">
      <Changes
        items={[
          '출발만 정한 채 위쪽 칩을 눌러도, 도착을 고르려고 열어 둔 건물 시트가 닫히지 않아요.',
          '경로가 그려진 동안 칩으로 켠 편의시설·제휴 핀을 흐리게(투명도 0.5) 해 경로가 묻히지 않게 했어요. 고른 제휴 핀은 그대로.',
          '경로를 화면에 맞출 때 위 경로 막대·아래 결과 카드의 실제 높이를 재서 맞춰요(전에는 100·90px 어림값이라 기기에 따라 경로가 가렸어요).',
          '시설 시트에서 출발·도착을 정할 수 있어요(1번 시트 참고). 정하면 시트가 내려가고 결과 카드가 보여요.',
          '이 부분은 지도 화면에서만 보여요. 지도 탭(localhost:8090)에서 길찾기를 해 보세요. 핀 흐림은 map.html 을 배포해야 앱에 반영돼요.',
        ]}
      />
    </Section>
  )
}

// ── 3. 제보 핀 둘째 줄과 시트 ───────────────────────────

function ReportPinsSection() {
  const [timeIndex, setTimeIndex] = useState(2)
  const now = TIMES[timeIndex].ms
  const markers = useMemo(() => toReportMarkers(REPORTS, now), [now])
  return (
    <Section title="3. 여러 날 제보 — 핀 둘째 줄 · 시트" commit="FE 93ac23e · BE 9aae427">
      <Changes
        items={[
          '핀은 기간 내내 지도에 남고, 이름 아래 둘째 줄에 오늘 상태를 적어요: 오늘 14:00 시작 · 운영 중 · 18:00까지 · 곧 종료 · 18:00.',
          "끝나기 30분 전부터 '곧 종료'(한 번짜리 제보도). 운영 시간 밖이면 속이 빈 예정 배지 모양이에요.",
          '날마다 시간이 달라도 되고, 쉬는 날은 건너뛰어요(다음 운영 날을 알려 줘요).',
          '시트에는 기간·운영 시간 한 줄, 오늘 상태 배지, 날짜별 운영 시간(오늘 진하게, 지난 날 흐리게)이 보여요.',
        ]}
      />
      <Text style={styles.label}>지금 시각을 바꿔 보세요</Text>
      <View style={styles.chips}>
        {TIMES.map((time, index) => (
          <TouchableOpacity
            key={time.label}
            style={[styles.chip, index === timeIndex && styles.chipOn]}
            onPress={() => setTimeIndex(index)}
            accessibilityRole="button"
            accessibilityState={{ selected: index === timeIndex }}
          >
            <Text style={[styles.chipText, index === timeIndex && styles.chipTextOn]}>{time.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.pinRow}>
        {markers.map((marker) => (
          <View key={marker.id} style={styles.pin}>
            <View style={[styles.pinBadge, marker.upcoming && styles.pinBadgeMuted]} />
            <Text style={[styles.pinName, marker.upcoming && styles.pinNameMuted]} numberOfLines={1}>
              {marker.label}
            </Text>
            {marker.sub ? (
              <Text style={[styles.pinSub, marker.ending && styles.pinSubEnding]} numberOfLines={1}>
                {marker.sub}
              </Text>
            ) : (
              <Text style={styles.pinSubNone}>(둘째 줄 없음)</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.sheetCards}>
        {REPORTS.map((report) => (
          <ReportSheetPreview key={report.id} report={report} now={now} />
        ))}
      </View>
    </Section>
  )
}

function ReportSheetPreview({ report, now }: { report: ReportListItem; now: number }) {
  const phase = reportPhase(report, now)
  const spans = parseReportDays(report)
  const upcoming = phase.kind === 'upcoming'
  return (
    <View style={styles.sheetCard}>
      <Text style={styles.sheetTitle}>{report.title}</Text>
      <Text style={styles.sheetMeta}>
        {upcoming ? '예정 · ' : ''}
        {formatReportSchedule(report)}
      </Text>
      {phase.text && !upcoming ? (
        <View style={[styles.phase, phase.kind === 'ending' && styles.phaseEnding, phase.kind === 'later' && styles.phaseLater]}>
          <Text style={[styles.phaseText, phase.kind === 'ending' && styles.phaseTextEnding]}>{phase.text}</Text>
        </View>
      ) : null}
      {spans ? (
        <View style={styles.dayList}>
          {spans.map((span) => {
            const today = isSameKstDay(span.startMs, now)
            const past = span.endMs <= now
            return (
              <Text key={span.date} style={[styles.dayRow, past && styles.dayPast, today && styles.dayToday]}>
                {formatDaySpan(span)}
                {today ? ' · 오늘' : ''}
              </Text>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

// ── 4. 제보 작성 — 날짜별 운영 시간 ─────────────────────────

function ReportComposerSection() {
  const [schedule, setSchedule] = useState<ReportSchedule>(() => {
    const base = initialReportSchedule(2)
    return {
      ...base,
      startMode: 'scheduled',
      scheduledStartMs: kstDateTime(2, 14, 0),
      endMode: 'custom',
      customEndMs: kstDateTime(4, 18, 0),
      daily: true,
    }
  })
  const [now] = useState(Date.now())
  const days = scheduleDaysFor(schedule, resolveSchedule(schedule, now))
  return (
    <Section title="4. 제보 작성 — 매일 정해진 시간에만 운영" commit="FE 93ac23e · BE 9aae427">
      <Changes
        items={[
          "기간이 이틀 이상이면 '매일 정해진 시간에만 운영' 체크가 나와요. 시작이 '지금'이어도 돼요(첫날은 지금부터, 11-09).",
          "켜면 '매일 같은 시간'(시각 한 줄만 고르면 모든 날에 적용, 목록에서는 쉬는 날만 빼기)과 '날마다 다르게'(날마다 시각을 따로) 중에 골라요.",
          '첫날 시작·마지막 날 끝은 위의 시작·종료 시각과 같이 움직여요. 공식 계정의 시간 수정 창에도 같은 목록이 있어요.',
          '서버에는 날짜별 운영 시간(days)으로 보내요. 아래는 실제로 보낼 값이에요.',
        ]}
      />
      <View style={styles.composer}>
        <ReportScheduleFields value={schedule} onChange={setSchedule} now={now} />
      </View>
      <Text style={styles.label}>보낼 값</Text>
      <Text style={styles.code}>{days ? JSON.stringify(days, null, 1) : 'days 없음(한 번짜리 제보)'}</Text>
    </Section>
  )
}

// ── 5. 설정 ─────────────────────────────────────────

function SettingsSection() {
  return (
    <Section title="5. 설정 — 펼친 묶음 아래 모서리" commit="FE 6e4ed17">
      <Changes
        items={[
          "'일반'처럼 펼친 묶음에서, 마지막 줄('설정 초기화') 아래에 옅은 회색 4pt 가 남아 아래 모서리가 위(머리 줄)보다 덜 둥글어 보였어요.",
          '아래 여백을 없애 위·아래 모서리가 같은 곡률(22)로 보여요. 고객 지원·약관 및 정책·계정·알림 묶음도 같아요.',
        ]}
      />
      <View style={styles.phones}>
        <SettingsCard bottomGap caption="전: 아래에 회색 4pt" />
        <SettingsCard caption="후: 마지막 줄이 카드 끝까지" />
      </View>
    </Section>
  )
}

function SettingsCard({ bottomGap = false, caption }: { bottomGap?: boolean; caption: string }) {
  return (
    <View style={styles.phoneWrap}>
      <View style={styles.settingsBg}>
        <View style={styles.settingsCard}>
          <View style={styles.settingsHead}>
            <Text style={styles.settingsHeadText}>일반</Text>
          </View>
          <View style={[styles.settingsBody, bottomGap && { paddingBottom: 4 }]}>
            {['앱 권한', '공지사항', '학교'].map((row) => (
              <View key={row} style={styles.settingsRow}>
                <Text style={styles.settingsRowText}>{row}</Text>
              </View>
            ))}
            <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.settingsRowText, { color: COLORS.danger }]}>설정 초기화</Text>
            </View>
          </View>
        </View>
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 80, gap: 20, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  h1: { fontFamily: FONTS.semibold, fontSize: 24, color: COLORS.textPrimary },
  lead: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },
  section: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 18, gap: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  h2: { fontFamily: FONTS.semibold, fontSize: 18, color: COLORS.primary },
  commit: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  changes: { gap: 6 },
  changeRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 8 },
  changeText: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.textPrimary },
  phones: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  phoneWrap: { width: 360, maxWidth: '100%', gap: 8 },
  phone: { width: '100%', backgroundColor: '#E8ECE6', borderRadius: 24, overflow: 'hidden', position: 'relative' },
  caption: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: COLORS.chipBorder, backgroundColor: COLORS.white },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textPrimary },
  chipTextOn: { color: COLORS.white, fontFamily: FONTS.semibold },
  pinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#E8ECE6', borderRadius: 16, padding: 16 },
  pin: { width: 170, alignItems: 'center', gap: 2 },
  pinBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, borderWidth: 3, borderColor: COLORS.white },
  pinBadgeMuted: { backgroundColor: COLORS.white, borderColor: COLORS.primary, borderStyle: 'dashed', borderWidth: 2 },
  pinName: { fontFamily: FONTS.semibold, fontSize: 12, color: '#1f2937', marginTop: 4 },
  pinNameMuted: { color: '#4b5563' },
  pinSub: { fontFamily: FONTS.medium, fontSize: 11, color: '#4b5563' },
  pinSubEnding: { color: COLORS.primary, fontFamily: FONTS.semibold },
  pinSubNone: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textTertiary },
  sheetCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sheetCard: { width: 320, maxWidth: '100%', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, gap: 4 },
  sheetTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.textPrimary },
  sheetMeta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  phase: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: COLORS.primarySoft },
  phaseEnding: { backgroundColor: COLORS.primary },
  phaseLater: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.chipBorder },
  phaseText: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.primary },
  phaseTextEnding: { color: COLORS.white },
  dayList: { marginTop: 8, gap: 3 },
  dayRow: { fontFamily: FONTS.regular, fontSize: 12.5, color: COLORS.textSecondary },
  dayToday: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  dayPast: { color: COLORS.textTertiary },
  composer: { maxWidth: 420, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14 },
  code: { fontFamily: 'monospace', fontSize: 12, color: COLORS.textPrimary, backgroundColor: COLORS.fill, borderRadius: 10, padding: 10 },
  settingsBg: { backgroundColor: COLORS.background, padding: 16, borderRadius: 16 },
  settingsCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden' },
  settingsHead: { padding: 18 },
  settingsHeadText: { fontFamily: FONTS.semibold, fontSize: 16, color: COLORS.textPrimary },
  settingsBody: { backgroundColor: COLORS.background, paddingTop: 4 },
  settingsRow: { backgroundColor: COLORS.white, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  settingsRowText: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textPrimary },
})
