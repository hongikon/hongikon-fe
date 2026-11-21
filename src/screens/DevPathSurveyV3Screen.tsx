import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import NaverMapView from '../components/map/NaverMapView'
import { COLORS } from '../constants/colors'
import { FONTS } from '../constants/typography'
import { removeEdge, setEdgeMemo, setNodeMemo } from '../utils/pathSurveyV3/store'
import { contextLevels, saveStateOf } from '../utils/pathSurveyV3/transfer'
import LegacyPanel from './pathSurvey/LegacyPanel'
import { Btn, ui } from './pathSurvey/ui'
import BackupPanel from './pathSurveyV3/BackupPanel'
import CheckPanel from './pathSurveyV3/CheckPanel'
import ConvertPanel from './pathSurveyV3/ConvertPanel'
import EditTab from './pathSurveyV3/EditTab'
import { CLICK_HINT, NUDGE_HINT } from './pathSurveyV3/keyboard'
import { LOCKED_TEXT } from './pathSurveyV3/screenModel'
import SelectionSheets from './pathSurveyV3/SelectionSheets'
import ServerPanel from './pathSurveyV3/ServerPanel'
import SnapshotPanel from './pathSurveyV3/SnapshotPanel'
import SurveyTopBar from './pathSurveyV3/SurveyTopBar'
import { useDevPathSurveyV3Screen } from '../hooks/debug/useDevPathSurveyV3Screen'

/**
 * Developer screen at /dev/path-survey-v3: survey points and edges in one graph.
 * Every change is kept in localStorage. The save button adds a save point on top of that.
 * The v2 screen and its storage are not touched.
 * State and handlers live in hooks/pathSurveyV3/*, one concern per hook; this file wires them to the panels.
 */
/** @param devKey /dev gate key; the Server tab sends it (X-Dev-Key) to upload and apply route graphs. */
export default function DevPathSurveyV3Screen({ devKey }: { devKey?: string } = {}) {
  const { webViewRef, panelRef, buildings, data, status, reload, mapHTML, wide, notice, setNotice, tab, setTab, showChanges, setShowChanges, labelMode, setLabelMode, legacyToggles, setLegacyToggles, index, overlay, context, setContext, settings, setSettings, mode, setMode, chain, setChain, selected, setSelected, pending, setPending, selectedEdge, multi, setMulti, clearSelection, edits, store, storeRef, commit, change, undo, redo, filter, onlyFilter, selectMany, canEditNode, canEditEdgeId, applyFilter, showRouteLines, focusNode, goToIssue, replace, report, updateReport, runConvert, keepOutdoor, makeIndoor, save, actions, check, fingerprint, used, backupStatus, sampleIds, changeCounts, allIssues, handleReady, serverLine, tabs } = useDevPathSurveyV3Screen({ devKey })

  const panel = (
    <ScrollView ref={panelRef} style={wide ? styles.panelWide : styles.panelNarrow} contentContainerStyle={styles.panelBody} keyboardShouldPersistTaps="handled">
      <Text style={styles.summary}>{`경로망 조사 v3, 지점 ${store.nodes.length}, 간선 ${store.edges.length}`}</Text>
      <Text style={styles.summary}>{backupStatus}</Text>
      {Platform.OS === 'web' ? <Text style={ui.sectionHelp}>{NUDGE_HINT}</Text> : null}
      {Platform.OS === 'web' ? <Text style={ui.sectionHelp}>{CLICK_HINT}</Text> : null}
      {edits.saveFailed ? <Text style={ui.error}>{'브라우저에 보관하지 못했어요(용량 또는 브라우저 제한). 지금 내용은 이 탭에만 있으니 백업 파일을 내려받아 주세요.'}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <SelectionSheets
        mode={mode}
        store={store}
        index={index}
        used={used}
        multi={multi}
        onSelectMany={selectMany}
        onApplyBulk={actions.applyBulk}
        onExitSelect={() => {
          setMode('add')
          selectMany([])
        }}
        selected={selected}
        selectedEdge={selectedEdge}
        canEditNode={canEditNode}
        canEditEdgeId={canEditEdgeId}
        undoTick={edits.undoTick}
        allIssues={allIssues}
        report={report}
        contextLevels={contextLevels(context)}
        onChange={change}
        onNodeMemo={(id, text, first) => commit(setNodeMemo(storeRef.current, id, text), first)}
        onEdgeMemo={(id, text, first) => commit(setEdgeMemo(storeRef.current, id, text), first)}
        onFocusNode={focusNode}
        onDeleteNode={actions.deleteNode}
        onDeleteEdge={(id) => {
          commit(removeEdge(storeRef.current, id))
          clearSelection()
          setNotice('간선을 지웠어요')
        }}
        onKeepOutdoor={keepOutdoor}
        onClose={clearSelection}
      />
      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Btn key={t.key} label={t.label} kind={tab === t.key ? 'active' : 'default'} onPress={() => setTab(t.key)} style={styles.tab} />
        ))}
      </View>
      {tab === 'edit' ? (
        <EditTab
          mode={mode}
          pending={pending}
          nodes={store.nodes}
          index={index}
          filter={filter}
          onFilter={(next) => applyFilter(next, onlyFilter)}
          onlyFilter={onlyFilter}
          onToggleOnlyFilter={() => applyFilter(filter, !onlyFilter)}
          showChanges={showChanges}
          onToggleShowChanges={() => setShowChanges((v) => !v)}
          changeCounts={changeCounts}
          labelMode={labelMode}
          onLabelMode={setLabelMode}
          sampleCount={sampleIds.length}
          onAddSample={actions.addSample}
          onRemoveSample={() => actions.removeSample(sampleIds)}
        />
      ) : null}
      {tab === 'check' ? (
        <CheckPanel check={check} tolerance={settings.entranceToleranceM} onTolerance={(entranceToleranceM) => setSettings({ entranceToleranceM })} onGo={goToIssue} />
      ) : null}
      {tab === 'convert' ? (
        <ConvertPanel
          store={store}
          index={index}
          report={report}
          multi={multi}
          selected={selected}
          onConvert={runConvert}
          onFocus={focusNode}
          onNotice={setNotice}
          onToggleMulti={(id) => {
            if (!multi.includes(id) && !canEditNode(id)) return setNotice(LOCKED_TEXT)
            setMulti((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
          }}
          onSelectMany={selectMany}
          onKeepOutdoor={keepOutdoor}
          onResetKept={() => updateReport((r) => ({ ...r, dismissed: [] }))}
          onMakeIndoor={makeIndoor}
        />
      ) : null}
      {tab === 'backup' ? (
        <BackupPanel
          store={store}
          index={index}
          tolerance={settings.entranceToleranceM}
          backupStatus={backupStatus}
          onBackedUp={replace.markBackedUp}
          onRestore={replace.runRestore}
          onPulled={replace.runGistPull}
          onNotice={setNotice}
        />
      ) : null}
      {tab === 'server' ? (
        <ServerPanel
          devKey={devKey}
          buildings={buildings}
          onLoadVersion={(id) => save.loadFromServer(id)}
          onRouteLines={showRouteLines}
          onNotice={setNotice}
          onUpload={(name) => save.pushToServer(storeRef.current, { name })}
          tick={save.serverTick}
        />
      ) : null}
      {tab === 'snapshots' ? (
        <SnapshotPanel store={store} tick={replace.snapshotTick} onRestore={replace.runSnapshotRestore} onChanged={replace.bumpSnapshotTick} onNotice={setNotice} />
      ) : null}
      {tab === 'legacy' ? <LegacyPanel overlay={overlay} toggles={legacyToggles} onChange={setLegacyToggles} /> : null}
    </ScrollView>
  )

  return (
    <View style={styles.container}>
      <SurveyTopBar
        saveBar={{
          state: saveStateOf(save.saveMeta, fingerprint),
          lastSaveAt: save.saveMeta.lastSaveAt,
          errors: check.errors.length,
          warnings: check.warnings.length,
          onSave: save.saveNow,
          undoCount: edits.undoCount,
          onUndo: undo,
          redoCount: edits.redoCount,
          onRedo: redo,
          onShowCheck: () => setTab('check'),
          server: serverLine,
          onServerRetry: save.retryServer,
        }}
        offer={save.offer}
        serverSaving={save.serverSaving}
        onAcceptOffer={save.acceptOffer}
        onCloseOffer={() => save.setOffer(null)}
        mode={mode}
        onMode={(key) => {
          setMode(key)
          setPending(null)
          if (key === 'select') setSelected(null)
        }}
        chain={chain}
        onToggleChain={() => setChain((v) => !v)}
        index={index}
        context={context}
        used={used}
        closeSignal={selected ?? selectedEdge}
        onContext={setContext}
      />
      <View style={[styles.main, wide && styles.mainWide]}>
        <View style={styles.mapArea}>
          {!data ? (
            <Text style={styles.loading} onPress={status === 'error' ? reload : undefined}>
              {status === 'error' ? '지도 정보를 불러오지 못했어요. 다시 시도' : '지도 정보를 불러오는 중이에요'}
            </Text>
          ) : (
            <NaverMapView key={data.version} ref={webViewRef} html={mapHTML} onReady={handleReady} onMessage={(event: unknown) => actions.handlerRef.current(event)} />
          )}
        </View>
        {panel}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  main: { flex: 1, minHeight: 0 },
  mainWide: { flexDirection: 'row' },
  mapArea: { flex: 1, minHeight: 200 },
  loading: { padding: 20, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  panelWide: { width: 420, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  panelNarrow: { maxHeight: '50%', borderTopWidth: 1, borderTopColor: COLORS.border },
  panelBody: { padding: 12, gap: 10 },
  summary: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.textSecondary },
  tabRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tab: { minWidth: '30%' },
  notice: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#1D4ED8' },
})
