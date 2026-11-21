import { useDeferredValue, useMemo, useState } from 'react'
import { copyText, downloadText, pickTextFile } from '../../utils/pathSurvey/sync'
import { type BuildingIndex } from '../../utils/pathSurveyV3/buildings'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { backupFileName, buildGraphExport, labelsNotOnServer, parseBackupText, serializeBackup, type BackupVia } from '../../utils/pathSurveyV3/transfer'

/** State, effects and handlers of BackupPanel. The screen file only renders. */
export function useBackupPanel({ store, index, tolerance, onBackedUp, onRestore, onNotice }: Pick<{
  store: StoreV3
  index: BuildingIndex
  tolerance: number
  backupStatus: string
  onBackedUp: (via: BackupVia) => void
  onRestore: (next: StoreV3) => void
  onPulled: (next: StoreV3) => boolean
  onNotice: (message: string) => void
}, 'store' | 'index' | 'tolerance' | 'onBackedUp' | 'onRestore' | 'onNotice'>) {
  const [text, setText] = useState('')
  const [manualCopy, setManualCopy] = useState<string | null>(null)
  // The preview runs on a deferred copy. The file itself is made from the current data when the button is pressed.
  const deferred = useDeferredValue(store)
  const preview = useMemo(() => buildGraphExport(deferred, index, 0, { entranceToleranceM: tolerance }), [deferred, index, tolerance])
  const missing = useMemo(() => labelsNotOnServer(store, index), [store, index])

  const saveFile = () => {
    if (downloadText(backupFileName(), serializeBackup(store))) {
      onBackedUp('file')
      onNotice('백업 파일을 내려받았어요. 잘 보관해 주세요.')
    } else onNotice('이 브라우저에서는 파일을 내려받지 못해요. 코드 복사를 써 주세요.')
  }

  const copyAll = async () => {
    const value = serializeBackup(store)
    if (await copyText(value)) {
      setManualCopy(null)
      onBackedUp('copy')
      onNotice('백업 내용을 복사했어요. 메모 앱 같은 곳에 붙여 넣어 보관해 주세요.')
    } else {
      setManualCopy(value)
      onNotice('자동 복사가 막혀 있어요. 아래 칸의 내용을 직접 복사해 주세요.')
    }
  }

  const restore = (value: string) => {
    try {
      onRestore(parseBackupText(value))
      setText('')
    } catch (e) {
      onNotice(`불러오지 못했어요. ${(e as Error).message}`)
    }
  }

  const fromFile = async () => {
    const value = await pickTextFile()
    if (value) restore(value)
  }
  return { text, setText, manualCopy, preview, missing, saveFile, copyAll, restore, fromFile }
}
