import { useMemo, useState } from 'react'
import { loadLicenses, type Row } from '../../utils/settings/licensesModal'
import type { LicensesModalProps } from '../../components/settings/LicensesModal'

/** LicensesModal 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useLicensesModal({ visible }: Pick<LicensesModalProps, 'visible'>) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const data = visible ? loadLicenses() : null
  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    return [
      { kind: 'header', title: '글꼴' },
      ...data.fonts.map((entry): Row => ({ kind: 'item', key: `font:${entry.n}`, entry })),
      { kind: 'header', title: `소프트웨어 (${data.packages.length}개)` },
      // 같은 이름이 다른 라이선스로 두 번 나올 수 있어(pnpm licenses list) 순번을 붙인다.
      ...data.packages.map((entry, i): Row => ({ kind: 'item', key: `pkg:${i}:${entry.n}`, entry })),
    ]
  }, [data])
  return { openKey, setOpenKey, data, rows }
}
