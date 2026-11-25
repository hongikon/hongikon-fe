import { useMemo, useState } from 'react'
import { downloadText } from '../../utils/pathSurvey/sync'
import { createSnapshot, deleteSnapshot, loadSnapshots, KEPT_LIMIT, renameSnapshot, storageUsage, storeFromSnapshot, type Snapshot } from '../../utils/pathSurveyV3/snapshots'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { serializeBackup, snapshotFileName } from '../../utils/pathSurveyV3/transfer'
import { confirmAction } from '../../utils/pathSurvey/ui'

/** State, effects and handlers of SnapshotPanel. The screen file only renders. */
export function useSnapshotPanel({ store, tick, onChanged, onNotice }: Pick<{
  store: StoreV3
  tick: number
  onRestore: (snapshot: Snapshot) => void
  onChanged: () => void
  onNotice: (message: string) => void
}, 'store' | 'tick' | 'onChanged' | 'onNotice'>) {
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => loadSnapshots().sort((x, y) => y.createdAt - x.createdAt), [tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const usage = useMemo(() => storageUsage(), [tick])
  const rolling = list.filter((s) => s.kind === 'rolling').length
  const kept = list.length - rolling
  const full = kept >= KEPT_LIMIT

  const create = () => {
    const { error } = createSnapshot(store, name, 'manual')
    if (error) return onNotice(error === 'limit' ? `보호 칸 ${KEPT_LIMIT}개가 가득 찼어요. 필요 없는 것을 지워 주세요.` : '저장 공간이 부족해요. 필요 없는 저장 지점을 지워 주세요.')
    setName('')
    onChanged()
    onNotice('저장 지점을 만들었어요.')
  }

  const remove = (snapshot: Snapshot) => {
    if (!confirmAction(`저장 지점 "${snapshot.name}" 을 지울까요? 되돌릴 수 없어요.`)) return
    deleteSnapshot(snapshot.id)
    onChanged()
    onNotice('저장 지점을 지웠어요.')
  }

  const applyRename = (snapshot: Snapshot) => {
    const after = renameSnapshot(snapshot.id, renameText).find((s) => s.id === snapshot.id)
    setRenaming(null)
    onChanged()
    if (after?.kind === 'rolling') onNotice(`이름은 바꿨지만 보호 칸 ${KEPT_LIMIT}개가 가득 차 있어 오래되면 지워져요. 보호하려면 다른 것을 지우고 다시 이름을 붙여 주세요.`)
  }

  const download = (snapshot: Snapshot) => {
    const done = downloadText(snapshotFileName(snapshot.createdAt), serializeBackup(storeFromSnapshot(snapshot), snapshot.createdAt))
    onNotice(done ? '저장 지점을 파일로 내려받았어요.' : '이 브라우저에서는 파일을 내려받지 못해요.')
  }
  return {
    name,
    setName,
    renaming,
    setRenaming,
    renameText,
    setRenameText,
    list,
    usage,
    rolling,
    kept,
    full,
    create,
    remove,
    applyRename,
    download,
  }
}
