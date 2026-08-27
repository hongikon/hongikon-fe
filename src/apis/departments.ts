import { apiRequest } from './client'

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
