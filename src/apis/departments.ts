import { ApiError, apiRequest } from './client'
import { buildDepartmentIdMap, memoizeAsync } from '../utils/departmentSync'

/**
 * `GET /departments` 항목. `college`는 FE `TREE_DATA`(`constants/news.ts`)의 최상위
 * 단과대 이름과 맞춰 채워야 한다(`Department.java` 주석 참고) — 이 매핑은
 * `NewsLocationMatcher`가 크롤링한 소식의 `department_id`를 채우는 데 그대로 쓰인다.
 */
export interface Department {
  id: number
  name: string
  college: string
  kind: 'department' | 'office'
}

export async function getDepartments(): Promise<Department[]> {
  const { departments } = await apiRequest<{ departments: Department[] }>('/departments')
  return departments
}

/**
 * TREE_DATA 리프 id(=학과 이름) → departmentId. 학과 목록은 거의 바뀌지 않아 앱 실행 중
 * 한 번만 받아 둔다(실패하면 다음 호출 때 다시 받는다).
 */
export const loadDepartmentIdMap = memoizeAsync(async () => buildDepartmentIdMap(await getDepartments()))

/** `GET /users/me/departments` 항목(`UserDepartmentResponse`). */
export interface UserDepartment {
  id: number
  departmentId: number
  departmentName: string
  isPrimary: boolean
}

/** 내 구독 학과 목록. 학과 소식 푸시 대상(`UserDeviceRepository.findPushTargets`)이 이 목록으로 정해진다. */
export async function getMyDepartments(accessToken: string): Promise<UserDepartment[]> {
  const { departments } = await apiRequest<{ departments: UserDepartment[] }>('/users/me/departments', {
    accessToken,
  })
  return departments
}

/**
 * 학과 구독 추가(`POST /users/me/departments`). 이미 구독 중이면 서버가 409 를 주는데,
 * 원하던 상태가 이미 된 것이라 성공으로 본다 — 그래서 응답이 끊겨 다시 보내도 안전하다.
 */
export async function addMyDepartment(departmentId: number, accessToken: string): Promise<void> {
  try {
    await apiRequest<unknown>('/users/me/departments', {
      method: 'POST',
      body: { departmentId, isPrimary: false },
      accessToken,
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return
    throw error
  }
}

/** 학과 구독 해지(`DELETE /users/me/departments/{departmentId}`). 이미 없으면(404) 성공으로 본다. */
export async function removeMyDepartment(departmentId: number, accessToken: string): Promise<void> {
  try {
    await apiRequest<void>(`/users/me/departments/${departmentId}`, {
      method: 'DELETE',
      accessToken,
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return
    throw error
  }
}
