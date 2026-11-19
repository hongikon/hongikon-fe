import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { fetchGraphBackup, listGraphVersions, routeGraphErrorMessage, uploadGraphVersion, type GraphVersion, type GraphVersionSummary } from '../../apis/routeGraph'
import { confirmAction } from '../../screens/pathSurvey/ui'
import { clockText } from '../../screens/pathSurveyV3/SaveBar'
import {
  afterAdopt,
  afterUpload,
  BROWSER_SAVE_FAILED_TEXT,
  checkOnEntry,
  hasUnsentChanges,
  loadServerSaveState,
  overwriteCheck,
  overwriteQuestion,
  pushSurvey,
  saveNoticeText,
  saveServerSaveState,
  serverNoticeText,
  stateAfter,
  UNSENT_WARNING_TEXT,
  type PushOutcome,
  type ServerOffer,
  type ServerSaveState,
} from '../../utils/pathSurveyV3/serverSave'
import { createSnapshot } from '../../utils/pathSurveyV3/snapshots'
import type { StoreV3 } from '../../utils/pathSurveyV3/store'
import { EMPTY_META, loadSaveMeta, parseBackupText, saveSaveMeta, storeFingerprint, type SaveMeta } from '../../utils/pathSurveyV3/transfer'

interface SaveOptions {
  /** /dev gate key (X-Dev-Key). Without it nothing is uploaded. */
  devKey?: string
  /** The stored survey could not be read on entry. The save record (saveMeta) then starts empty too. */
  corrupt: boolean
  storeRef: MutableRefObject<StoreV3>
  blockedRef: MutableRefObject<boolean>
  runRestore: (next: StoreV3, warning?: string) => boolean
  bumpSnapshotTick: () => void
  setNotice: (text: string) => void
}

/**
 * The save button (browser save point, then a server draft) and the server save state. Uploads are drafts only
 * (production is applied from the Server tab). On entry one list call may offer a base save or a server version, never acting by itself.
 */
export function useSurveySave({ devKey, corrupt, storeRef, blockedRef, runRestore, bumpSnapshotTick, setNotice }: SaveOptions) {
  const [saveMeta, setSaveMeta] = useState<SaveMeta>(() => (corrupt ? EMPTY_META : loadSaveMeta()))
  // Server draft saved by the save button. The ref is read by the upload, which may finish after more edits.
  const serverStateRef = useRef<ServerSaveState>(loadServerSaveState())
  const [serverState, setServerState] = useState<ServerSaveState>(serverStateRef.current)
  const serverBusyRef = useRef(false)
  const [serverSaving, setServerSaving] = useState(false)
  // Newest server version id this tab has seen in a list: the reference for asking before the next save.
  const seenIdRef = useRef<number | null>(null)
  // Offer from the entry check: save this survey as the base, or load a server version. Never acted on by itself.
  const [offer, setOffer] = useState<ServerOffer<GraphVersionSummary> | null>(null)
  // Bumped after each upload so an open Server tab lists the new draft.
  const [serverTick, setServerTick] = useState(0)

  /**
   * Sends the survey to the server as a draft (never to production). Stops without a key, when this tab's saving is
   * stopped (other tab, damaged data), on the same content as the last draft, or while one upload is going.
   * A failure only changes the server state: the browser save has already happened.
   */
  const recordServerState = useCallback((next: ServerSaveState) => {
    if (next === serverStateRef.current) return
    serverStateRef.current = next
    setServerState(next)
    saveServerSaveState(next)
  }, [])

  /**
   * `check`: the save button path. Before uploading it lists the versions once and asks when another device saved
   * after the newest version this tab knows (see overwriteCheck). The Server tab and the base save do not ask.
   */
  const pushToServer = useCallback(
    async (content: StoreV3, options: { name?: string; check?: boolean } = {}): Promise<PushOutcome<GraphVersion>> => {
      const outcome = await pushSurvey({
        store: content,
        devKey,
        blocked: blockedRef.current,
        state: serverStateRef.current,
        busy: serverBusyRef.current,
        name: options.name,
        begin: () => {
          serverBusyRef.current = true
          setServerSaving(true)
        },
        end: () => {
          serverBusyRef.current = false
          setServerSaving(false)
        },
        beforeUpload:
          options.check && devKey
            ? async () => {
                const result = await overwriteCheck({
                  lastVersionId: serverStateRef.current.lastVersionId,
                  seenId: seenIdRef.current,
                  listVersions: () => listGraphVersions(devKey),
                  confirm: (newer) => confirmAction(overwriteQuestion(newer)),
                })
                seenIdRef.current = result.seenId
                return result.go
              }
            : undefined,
        upload: uploadGraphVersion,
        errorText: (e) => routeGraphErrorMessage(e, '서버에 저장하지 못했어요.'),
      })
      recordServerState(stateAfter(serverStateRef.current, outcome))
      if (outcome.kind === 'uploaded') {
        setServerTick((n) => n + 1)
        setOffer((o) => (o?.kind === 'baseline' ? null : o))
      }
      return outcome
    },
    // blockedRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devKey, recordServerState],
  )

  /** Tapping the failed status line: the same upload as the save button, without a new save point. */
  const retryServer = () => {
    void pushToServer(storeRef.current, { check: true }).then((outcome) => {
      const text = serverNoticeText(outcome)
      if (text) setNotice(text)
    })
  }

  /** Loads a server version through the usual overwrite question, and records it as what this browser holds. */
  const loadFromServer = async (id: number, version?: GraphVersionSummary) => {
    if (!devKey) return
    const next = parseBackupText(await fetchGraphBackup(devKey, id))
    const warning = hasUnsentChanges(serverStateRef.current, storeRef.current) ? UNSENT_WARNING_TEXT : ''
    if (!runRestore(next, warning)) return
    const fingerprint = storeFingerprint(next)
    recordServerState(version ? afterAdopt(serverStateRef.current, version, fingerprint) : afterUpload(serverStateRef.current, id, fingerprint, Date.now()))
    seenIdRef.current = Math.max(seenIdRef.current ?? id, id)
    setOffer(null)
  }

  const acceptOffer = () => {
    if (!offer) return
    if (offer.kind === 'baseline') {
      void pushToServer(storeRef.current).then((outcome) => {
        const text = serverNoticeText(outcome)
        if (text) setNotice(text)
      })
      return
    }
    loadFromServer(offer.version.id, offer.version).catch((e) => setNotice(routeGraphErrorMessage(e, '서버에서 불러오지 못했어요.')))
  }

  // One list call when the screen opens with a key. Offers only; nothing is uploaded or loaded by itself.
  useEffect(() => {
    if (!devKey || blockedRef.current) return
    let alive = true
    checkOnEntry({
      state: serverStateRef.current,
      store: storeRef.current,
      listVersions: () => listGraphVersions(devKey),
      backupFingerprint: async (id) => storeFingerprint(parseBackupText(await fetchGraphBackup(devKey, id))),
    }).then((result) => {
      if (!alive) return
      seenIdRef.current = result.seenId
      recordServerState(result.state)
      setOffer(result.offer)
    })
    return () => {
      alive = false
    }
    // storeRef and blockedRef are refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devKey, recordServerState])

  /**
   * Browser save point first, then the server draft. A full browser storage does not stop the server save;
   * a stopped tab or damaged data does (pushSurvey answers blocked).
   */
  const saveNow = () => {
    const current = storeRef.current
    // Save button points roll over on their own, so pressing it often never runs into the limit.
    const { error } = createSnapshot(current, `저장 ${clockText(Date.now())}`, 'rolling')
    bumpSnapshotTick()
    const browserSaved = !error
    if (browserSaved) {
      const meta = { lastSaveAt: Date.now(), lastSaveFingerprint: storeFingerprint(current) }
      setSaveMeta(meta)
      saveSaveMeta(meta)
    }
    if (!blockedRef.current) setNotice(browserSaved ? '저장했어요.' : BROWSER_SAVE_FAILED_TEXT)
    void pushToServer(current, { check: true }).then((outcome) => {
      const text = saveNoticeText(browserSaved, outcome)
      if (text) setNotice(text)
    })
  }

  return { saveMeta, serverState, serverSaving, offer, setOffer, serverTick, pushToServer, retryServer, loadFromServer, acceptOffer, saveNow }
}
