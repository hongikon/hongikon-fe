import { useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../../constants/colors'
import { downloadText } from '../../utils/pathSurveySync'
import {
  createSnapshot,
  deleteSnapshot,
  loadSnapshots,
  KEPT_LIMIT,
  renameSnapshot,
  ROLLING_LIMIT,
  STORAGE_WARN_CHARS,
  storageUsage,
  storeFromSnapshot,
  type Snapshot,
  type SnapshotKind,
} from '../../utils/pathSurveyV3/snapshots'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { serializeBackup, snapshotFileName } from '../../utils/pathSurveyV3/transfer'
import { Btn, confirmAction, Row, Section, ui } from '../pathSurvey/ui'
import { dateTimeText } from './SaveBar'

const KIND_TEXT: Record<SnapshotKind, string> = {
  manual: '직접 만듦',
  protected: '자동, 보호됨',
  rolling: `저장 버튼 칸, ${ROLLING_LIMIT}개가 넘으면 오래된 것부터 지워짐`,
}

/** Save points: list, restore, name, download and delete. tick reloads the list after a save elsewhere on the screen. */
export default function SnapshotPanel({
  store,
  tick,
  onRestore,
  onChanged,
  onNotice,
}: {
  store: StoreV3
  tick: number
  onRestore: (snapshot: Snapshot) => void
  onChanged: () => void
  onNotice: (message: string) => void
}) {
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

  return (
    <View style={{ gap: 14 }}>
      <Section title="새 저장 지점" help="이름을 붙여 지금 상태를 남겨요. 직접 만든 저장 지점은 직접 지울 때만 없어져요.">
        <TextInput value={name} onChangeText={setName} placeholder="이름 (예: K동 끝낸 뒤)" style={ui.input} accessibilityLabel="새 저장 지점 이름" />
        <Btn label="지금 상태로 만들기" kind="primary" onPress={create} />
      </Section>
      <Section title={`저장 지점: 보호 ${kept} / ${KEPT_LIMIT}, 저장 버튼 ${rolling} / ${ROLLING_LIMIT}`} help="복원하면 지금 상태를 자동 저장 지점으로 남긴 뒤 바꿔요.">
        {usage !== null ? <Text style={ui.hint}>{`브라우저 저장 공간 약 ${(usage / 1_000_000).toFixed(1)}MB 사용 중`}</Text> : null}
        {usage !== null && usage >= STORAGE_WARN_CHARS ? <Text style={ui.warn}>{'저장 공간이 얼마 남지 않았어요. 백업 파일을 내려받고 필요 없는 저장 지점을 지워 주세요.'}</Text> : null}
        {full ? <Text style={ui.warn}>{`보호 칸 ${KEPT_LIMIT}개가 가득 찼어요. 복원이나 변환 전 자동 저장 지점을 남기려면 필요 없는 것을 지워 주세요.`}</Text> : null}
        {list.length === 0 ? <Text style={ui.empty}>{'아직 저장 지점이 없어요.'}</Text> : null}
        {list.map((snapshot) => (
          <View key={snapshot.id} style={styles.row}>
            {renaming === snapshot.id ? (
              <>
                <TextInput value={renameText} onChangeText={setRenameText} autoFocus onSubmitEditing={() => applyRename(snapshot)} style={ui.input} accessibilityLabel="저장 지점 이름" />
                <Row>
                  <Btn label="이름 저장" kind="primary" disabled={!renameText.trim()} onPress={() => applyRename(snapshot)} />
                  <Btn label="취소" onPress={() => setRenaming(null)} />
                </Row>
              </>
            ) : (
              <Text style={ui.rowText}>{snapshot.name}</Text>
            )}
            <Text style={ui.hint}>{`${dateTimeText(snapshot.createdAt)}, 지점 ${snapshot.nodes.length}, 간선 ${snapshot.edges.length}`}</Text>
            <Text style={ui.hint}>{KIND_TEXT[snapshot.kind]}</Text>
            <Row>
              <Btn label="복원" onPress={() => onRestore(snapshot)} />
              <Btn
                label="이름 붙이기"
                onPress={() => {
                  setRenaming(snapshot.id)
                  setRenameText(snapshot.name)
                }}
              />
            </Row>
            <Row>
              <Btn label="내려받기" onPress={() => download(snapshot)} />
              <Btn label="삭제" kind="danger" onPress={() => remove(snapshot)} />
            </Row>
          </View>
        ))}
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
})
