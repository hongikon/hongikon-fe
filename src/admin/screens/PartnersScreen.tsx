import { StyleSheet, Text, View } from 'react-native'
import { PartnerCard } from '../components/partners/PartnerCard'
import { PartnerForm } from '../components/partners/PartnerForm'
import { usePartnersAdmin } from '../hooks/usePartnersAdmin'
import { TextRow } from '../MapForm'
import { adminText, Button, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'

/**
 * 제휴업체 관리. 지도 "제휴 업체" 갈래와 제휴 검색에 나오는 업체를 추가·수정·삭제한다(`/admin/map/partners`).
 * 저장하면 서버가 지도 데이터(`GET /map/data`)를 바로 새로 만들어, 앱은 다음 확인 때(실행·포그라운드 복귀) 받아 간다.
 * 좌표·혜택은 확인된 값만 넣는다 — 추정해서 채우지 않는다.
 */
export default function PartnersScreen() {
  const {
    partners,
    loading,
    error,
    reload,
    query,
    setQuery,
    shown,
    editor,
    openNew,
    openEdit,
    askDelete,
    confirmName,
    changeConfirmName,
    deleteError,
    remove,
  } = usePartnersAdmin()
  const { draft } = editor

  return (
    <View>
      <ScreenHeader
        title="제휴업체 관리"
        subtitle="지도 '제휴 업체'와 제휴 검색에 나오는 업체입니다. 좌표·혜택은 확인된 값만 넣습니다. 저장하면 앱에는 다음 실행이나 앱으로 돌아올 때 반영됩니다."
        right={draft ? null : <Button label="업체 추가" icon="add" variant="primary" onPress={openNew} small />}
      />

      {editor.notice ? <Text style={[adminText.muted, styles.notice]}>{editor.notice}</Text> : null}

      {draft ? (
        <PartnerForm
          draft={draft}
          update={editor.update}
          formErrors={editor.formErrors}
          saving={editor.saving}
          onCancel={editor.closeForm}
          onSave={editor.save}
        />
      ) : null}

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextRow value={query} onChangeText={setQuery} placeholder="이름·코드·소속·혜택·주소로 찾기" accessibilityLabel="제휴업체 검색" />
        </View>
        {partners ? <Text style={adminText.muted}>{shown.length}곳</Text> : null}
      </View>

      {error ? <InlineError message={error} onRetry={reload} style={styles.error} /> : null}
      {!partners ? (
        loading ? <Loading /> : null
      ) : shown.length === 0 ? (
        <EmptyState message={query ? '찾는 업체가 없습니다.' : '등록된 제휴업체가 없습니다.'} />
      ) : (
        <View style={styles.list}>
          {shown.map((partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              confirming={editor.confirmDelete === partner.id}
              deleting={editor.deleting}
              confirmName={confirmName}
              onChangeConfirmName={changeConfirmName}
              deleteError={deleteError}
              onEdit={() => openEdit(partner)}
              onAskDelete={() => askDelete(partner)}
              onCancelDelete={() => askDelete(null)}
              onRemove={() => void remove(partner)}
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
