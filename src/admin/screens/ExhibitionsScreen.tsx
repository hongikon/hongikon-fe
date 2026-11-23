import { StyleSheet, Text, View } from 'react-native'
import type { ExhibitionPhase } from '../../utils/map/exhibitions'
import { ExhibitionCard } from '../components/exhibitions/ExhibitionCard'
import { ExhibitionForm } from '../components/exhibitions/ExhibitionForm'
import { useExhibitionsAdmin } from '../hooks/exhibitions/useExhibitionsAdmin'
import { adminText, Button, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'

/**
 * 전시 관리. 지도 '전시' 칩의 전시장(현대미술관 1관·2관, 박물관 …)마다 지금 전시·다음 전시를 넣는다(`/admin/map/exhibitions`).
 * 앱 지도에는 서버가 끝나지 않았고 60일 안에 시작하는 전시만 내려 준다. 날짜는 한국 날짜로 양끝을 포함한다.
 */

const PHASE_SECTIONS: { phase: ExhibitionPhase; title: string; empty: string }[] = [
  { phase: 'current', title: '진행 중', empty: '지금 열려 있는 전시가 없습니다.' },
  { phase: 'upcoming', title: '예정', empty: '예정된 전시가 없습니다.' },
  { phase: 'past', title: '지난 전시', empty: '지난 전시가 없습니다.' },
]

export default function ExhibitionsScreen() {
  const { exhibitions, venues, loading, error, reload, today, grouped, venueName, venueOptions, editor, openNew, openEdit } =
    useExhibitionsAdmin()
  const { draft } = editor

  return (
    <View>
      <ScreenHeader
        title="전시 관리"
        subtitle="지도 '전시' 칩의 전시장마다 보이는 지금 전시·다음 전시입니다. 앱에는 끝나지 않았고 60일 안에 시작하는 전시만 나옵니다. 날짜는 한국 날짜이고 시작일·종료일을 모두 포함합니다."
        right={draft ? null : <Button label="전시 추가" icon="add" variant="primary" onPress={openNew} small />}
      />

      {editor.notice ? <Text style={[adminText.muted, styles.notice]}>{editor.notice}</Text> : null}

      {draft ? (
        <ExhibitionForm
          draft={draft}
          update={editor.update}
          venues={venues}
          venueOptions={venueOptions}
          formErrors={editor.formErrors}
          saving={editor.saving}
          onCancel={editor.closeForm}
          onSave={editor.save}
        />
      ) : null}

      {error ? <InlineError message={error} onRetry={reload} style={styles.error} /> : null}
      {!exhibitions ? (
        loading ? <Loading /> : null
      ) : exhibitions.length === 0 ? (
        <EmptyState message="등록된 전시가 없습니다." />
      ) : (
        PHASE_SECTIONS.map(({ phase, title, empty }) => (
          <View key={phase} style={styles.section}>
            <Text style={[adminText.strong, styles.sectionTitle]}>
              {title} <Text style={adminText.muted}>{grouped[phase].length}건</Text>
            </Text>
            {grouped[phase].length === 0 ? (
              <Text style={adminText.muted}>{empty}</Text>
            ) : (
              <View style={styles.list}>
                {grouped[phase].map((exhibition) => (
                  <ExhibitionCard
                    key={exhibition.id}
                    exhibition={exhibition}
                    phase={phase}
                    today={today}
                    venueName={venueName(exhibition.facilityId)}
                    confirming={editor.confirmDelete === exhibition.id}
                    deleting={editor.deleting}
                    onEdit={() => openEdit(exhibition)}
                    onAskDelete={() => editor.setConfirmDelete(exhibition.id)}
                    onCancelDelete={() => editor.setConfirmDelete(null)}
                    onRemove={() => void editor.remove(exhibition)}
                  />
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { marginBottom: 12 },
  error: { marginBottom: 12 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, marginBottom: 8 },
  list: { gap: 12 },
})
