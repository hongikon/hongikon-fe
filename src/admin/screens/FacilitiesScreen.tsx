import { StyleSheet, Text, View } from 'react-native'
import { FacilityCard } from '../components/facilities/FacilityCard'
import { FacilityForm } from '../components/facilities/FacilityForm'
import { useFacilitiesAdmin } from '../hooks/useFacilitiesAdmin'
import { TextRow } from '../MapForm'
import { adminText, Button, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'

/**
 * 편의시설 관리. 지도 "편의 시설" 갈래(프린터·열람실 …)와 '전시' 칩에 나오는 시설을 추가·수정·삭제한다(`/admin/map/facilities`).
 * 시설은 건물을 가리키고 지도 핀은 그 건물 좌표에 찍힌다. 건물 밖(야외 흡연구역 등)처럼 현장에서 잰 좌표가 있을 때만 위도·경도를 넣는다.
 */
export default function FacilitiesScreen() {
  const {
    facilities,
    buildings,
    loading,
    error,
    reload,
    query,
    setQuery,
    shown,
    buildingQuery,
    setBuildingQuery,
    buildingOptions,
    editor,
    openNew,
    openEdit,
  } = useFacilitiesAdmin()
  const { draft } = editor

  return (
    <View>
      <ScreenHeader
        title="편의시설 관리"
        subtitle="지도 '편의 시설'과 '전시' 칩에 나오는 시설입니다. 핀은 고른 건물 좌표에 찍히고, 현장에서 잰 좌표가 있을 때만 위도·경도를 넣습니다."
        right={draft ? null : <Button label="시설 추가" icon="add" variant="primary" onPress={openNew} small />}
      />

      {editor.notice ? <Text style={[adminText.muted, styles.notice]}>{editor.notice}</Text> : null}

      {draft ? (
        <FacilityForm
          draft={draft}
          update={editor.update}
          buildings={buildings}
          buildingOptions={buildingOptions}
          buildingQuery={buildingQuery}
          onChangeBuildingQuery={setBuildingQuery}
          formErrors={editor.formErrors}
          saving={editor.saving}
          onCancel={editor.closeForm}
          onSave={editor.save}
        />
      ) : null}

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextRow value={query} onChangeText={setQuery} placeholder="종류·건물·코드·위치 설명으로 찾기" accessibilityLabel="편의시설 검색" />
        </View>
        {facilities ? <Text style={adminText.muted}>{shown.length}건</Text> : null}
      </View>

      {error ? <InlineError message={error} onRetry={reload} style={styles.error} /> : null}
      {!facilities ? (
        loading ? <Loading /> : null
      ) : shown.length === 0 ? (
        <EmptyState message={query ? '찾는 시설이 없습니다.' : '등록된 편의시설이 없습니다.'} />
      ) : (
        <View style={styles.list}>
          {shown.map((facility) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              confirming={editor.confirmDelete === facility.id}
              deleting={editor.deleting}
              onEdit={() => openEdit(facility)}
              onAskDelete={() => editor.setConfirmDelete(facility.id)}
              onCancelDelete={() => editor.setConfirmDelete(null)}
              onRemove={() => void editor.remove(facility)}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  searchInput: { flex: 1 },
  error: { marginBottom: 12 },
  list: { gap: 12 },
})
