import { useState } from 'react'
import { Share } from 'react-native'
import { formatModuleExport } from '../../utils/pathSurvey/survey'
import { findModule, type SurveyStore } from '../../utils/pathSurvey/store'
import { copyText, downloadText, stamp } from '../../utils/pathSurvey/sync'

/** TransferPanel 의 상태·효과·핸들러. 화면 파일은 이 훅을 불러 그리기만 한다. */
export function useTransferPanel({ store, initialModuleId, onNotice }: Pick<{
  store: SurveyStore
  initialModuleId: string | null
  onImport: (text: string) => void
  onNotice: (text: string) => void
}, 'store' | 'initialModuleId' | 'onNotice'>) {
  const [moduleId, setModuleId] = useState(initialModuleId ?? store.modules[0]?.id ?? null)
  const [showCode, setShowCode] = useState(false)
  const [paste, setPaste] = useState('')
  const module = findModule(store, moduleId)
  const code = module && showCode ? formatModuleExport(module) : ''

  const copy = async (text: string, what: string) => {
    if (await copyText(text)) return onNotice(`${what} 복사했어요`)
    await Share.share({ message: text })
  }
  const save = (filename: string, text: string) => {
    if (!downloadText(filename, text)) onNotice('이 브라우저에서는 파일로 저장할 수 없어요. 복사를 써 주세요.')
  }
  const fileName = (name: string) => `path-survey-${name.replace(/[\\/:*?"<>|\s]+/g, '_')}-${stamp()}.json`
  return { moduleId, setModuleId, showCode, setShowCode, paste, setPaste, module, code, copy, save, fileName }
}
