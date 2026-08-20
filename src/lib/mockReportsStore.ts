import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  CreateReportFlagInput,
  CreateReportInput,
  Report,
  ReportFlagResult,
} from '../types'

/**
 * 백엔드가 아직 없어(§ `docs/report-api-spec.md`는 제안 단계) 제보 기능을
 * 기기 로컬에만 저장하는 임시 구현이다. 실제 API가 준비되면 이 파일과
 * `reportsApi.ts` 의 이 스토어를 쓰는 부분을 걷어내고 `apiRequest` 호출로
 * 되돌리면 된다.
 *
 * 검토 절차(PENDING → ACTIVE)를 처리할 운영자 화면이 없으므로, 여기서는
 * 만들자마자 ACTIVE로 올린다.
 */
const STORAGE_KEY = 'hongikon_mock_reports'
const STORAGE_SEQ_KEY = 'hongikon_mock_reports_seq'

/** 이 정도 신고가 쌓이면 검토 없이 바로 숨긴다. 운영자 화면이 없어 정한 임시 값. */
const FLAG_HIDE_THRESHOLD = 3

let cache: Report[] | null = null
let nextId = 1

async function ensureLoaded(): Promise<Report[]> {
  if (cache !== null) return cache

  try {
    const [rawReports, rawSeq] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(STORAGE_SEQ_KEY),
    ])
    cache = rawReports ? (JSON.parse(rawReports) as Report[]) : []
    nextId = rawSeq ? Number(rawSeq) : 1
  } catch {
    cache = []
    nextId = 1
  }

  return cache
}

async function persist(): Promise<void> {
  if (cache === null) return
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)),
    AsyncStorage.setItem(STORAGE_SEQ_KEY, String(nextId)),
  ])
}

export async function listMockReports(buildingId?: number): Promise<Report[]> {
  const reports = await ensureLoaded()
  return buildingId === undefined
    ? reports
    : reports.filter((report) => report.buildingId === buildingId)
}

export async function createMockReport(input: CreateReportInput): Promise<Report> {
  const reports = await ensureLoaded()

  const report: Report = {
    id: nextId++,
    buildingId: input.buildingId ?? null,
    floor: input.floor ?? null,
    lat: input.lat,
    lng: input.lng,
    category: input.category,
    customCategoryLabel: input.customCategoryLabel,
    title: input.title,
    content: input.content ?? null,
    authorNickname: '나',
    imageUrl: input.imageUrl,
    isMine: true,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  }

  reports.push(report)
  await persist()
  return report
}

export async function deleteMockReport(id: number): Promise<void> {
  const reports = await ensureLoaded()
  const index = reports.findIndex((report) => report.id === id)
  if (index === -1) return
  reports.splice(index, 1)
  await persist()
}

const flagCounts = new Map<number, number>()

export async function flagMockReport(
  id: number,
  _input: CreateReportFlagInput,
): Promise<ReportFlagResult> {
  const reports = await ensureLoaded()
  const report = reports.find((r) => r.id === id)
  if (!report) return {}

  const flagCount = (flagCounts.get(id) ?? 0) + 1
  flagCounts.set(id, flagCount)

  if (flagCount >= FLAG_HIDE_THRESHOLD) {
    report.status = 'HIDDEN'
    await persist()
  }

  return { flagCount }
}
