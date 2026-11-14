import AsyncStorage from '@react-native-async-storage/async-storage'
import { LogBox } from 'react-native'
import { PRESENTATION_DEMO } from './scenes'
import notice from './notice.json'
import job from './job-notice.json'

// Public notice snapshots fetched 2026-11-14. Account state and report submission stay local.
// No credential is stored and no write request reaches the production service.
const subscriptions = new Set<string>()
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
export const PRESENTATION_TOKEN = 'presentation-local-only'
export const presentationReady = PRESENTATION_DEMO ? AsyncStorage.multiSet([
  ['@hongikon_onboarding_done', '1'], ['@hongikon_dept_pick_pending', '0'],
  ['@hongikon_notification_permission_asked', '1'], ['ask.consent.v1', 'yes'],
  ['@hongik_partner_notice_seen', '1'], ['@hongikon_launch_notice_seen', '6'],
  ['@hongik_settings', JSON.stringify({ subscriptionAlert: false, subscribedDepts: [], bookmarkedNews: [] })],
]) : Promise.resolve()

export const presentationAnswer = {
  nodeId: 'none', nodeIds: [], found: true, catalogVersion: 'presentation-snapshot',
  answer: '국민취업지원제도는 온라인 신청 또는 교내 현장접수로 상담받을 수 있어요. 온라인으로 신청할 때는 희망지역을 서울서부지사로 선택해 주세요.',
  sections: [
    { title: '온라인 신청', ordered: true, items: ['인지어스 홈페이지에서 국민취업지원제도 신청하기를 선택해요.', '신청 정보를 입력하고 희망지역을 서울서부지사로 골라 문의를 등록해요.', '소득심사 이후 담당 상담사가 개별 연락해요.'], table: null },
    { title: '학교에서 현장접수', ordered: false, items: ['10월 안내 기준 매주 화요일 13:00~17:00, 정보통신센터 Q307호에서 사전 예약 없이 상담할 수 있었어요.', '10월 일정은 지난 안내예요. 방문 전 최신 공지와 담당 부서에 일정을 확인해 주세요.'], table: null },
  ],
  references: [{ title: job.title, url: job.sourceUrl, date: '2026-09-30' }],
  pages: [], phones: [{ label: '인지어스 서울서부지사', phone: '02-6232-7494' }],
  facilityId: 'hi-q-3f-office-02', actions: [{ type: 'map', target: 'facility:hi-q-3f-office-02', label: '취업진로지원센터' }],
}

if (PRESENTATION_DEMO) {
  // Unsigned simulator builds cannot read APNs keychain registration. Local notifications still work.
  LogBox.ignoreAllLogs()
  const originalFetch = globalThis.fetch.bind(globalThis)
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!apiBase || !url.startsWith(apiBase)) return originalFetch(input, init)
    const u = new URL(url), path = url.slice(apiBase.length).split('?')[0], method = init?.method ?? 'GET'
    if (method === 'GET' && path.startsWith('/map/')) return originalFetch(input, init)
    if (path === '/news') return json({ content: [notice, job].filter(n => !u.searchParams.has('sourceId') || u.searchParams.getAll('sourceId').includes(n.sourceId)), page: 0, size: 20, totalElements: 2, totalPages: 1, hasNext: false })
    if (path === '/news/13377') return json(notice)
    if (path === '/news/12315') return json(job)
    if (path === '/ask/status') return json({ enabled: true, loggedIn: true, limit: 10, remaining: 10, soldOut: false })
    if (path === '/ask/popular') return json({ ids: [] })
    if (path === '/ask/route') return json(presentationAnswer)
    if (path === '/ask/route/stream') return new Response('', { status: 404 })
    if (path === '/users/me/subscriptions') return json({ subscriptions: [...subscriptions].map(sourceId => ({ sourceId, alertEnabled: true, createdAt: '2026-11-14' })) })
    if (path.startsWith('/users/me/subscriptions/')) {
      const sourceId = decodeURIComponent(path.split('/').pop()!)
      if (method === 'DELETE') subscriptions.delete(sourceId); else subscriptions.add(sourceId)
      return json({ sourceId, alertEnabled: true, createdAt: '2026-11-14' })
    }
    if (path === '/users/me/notification-categories') return json({ categories: ['공지','장학','행사','수강','시설','취업','상담'].map(category => ({ category, enabled: true })) })
    if (path === '/users/me/notification-settings') return json({ reportStatus: true, newReports: false })
    if (path === '/reports' && method === 'GET') return json({ reports: [] })
    if (path === '/reports' && method === 'POST') {
      const data = JSON.parse(String(init?.body ?? '{}'))
      return json({ ...data, id: 900001, status: 'PENDING', createdAt: new Date().toISOString() })
    }
    if (path === '/admin/overview') return new Response('', { status: 403 })
    if (method === 'GET' && path === '/status') return originalFetch(input, init)
    // Catch all other endpoints locally, including push registration and feedback.
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })
  }
}
