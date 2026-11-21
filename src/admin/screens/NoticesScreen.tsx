import { StyleSheet, Text, View } from 'react-native'
import { NoticeCard } from '../components/notices/NoticeCard'
import { NoticeForm } from '../components/notices/NoticeForm'
import { useNoticesAdmin } from '../hooks/notices/useNoticesAdmin'
import { adminText, Button, EmptyState, InlineError, Loading, ScreenHeader } from '../ui'
import { NOTICE_SECTIONS } from '../utils/notices/noticeDraft'

/**
 * 앱 공지 관리(11-09). 여기서 쓴 공지는 게시 시각부터 앱의 설정 > 공지사항에 보이고(`GET /notices`), 팝업을 켜면
 * 그 기간 동안 앱을 켤 때 한 번 뜬다(본 사람이 '다시 보지 않기'를 누르면 더는 안 뜬다). 시각은 모두 한국 시간으로 쓴다.
 * 앱에 적힌 예전 공지(constants/appNotices.ts)는 여기 나오지 않는다.
 */
export default function NoticesScreen() {
  const { notices, loading, error, reload, now, grouped, editor, openNew, openEdit } = useNoticesAdmin()
  const { draft } = editor

  return (
    <View>
      <ScreenHeader
        title="앱 공지"
        subtitle="여기서 쓴 공지는 게시 시각부터 앱의 설정 > 공지사항에 보입니다. 팝업을 켜면 그 기간 동안 앱을 켤 때 한 번 뜹니다. 시각은 모두 한국 시간입니다. 앱은 켤 때 공지를 받아서, 게시 시각이 지난 뒤 앱을 새로 켜야 보입니다."
        right={draft ? null : <Button label="공지 쓰기" icon="add" variant="primary" onPress={openNew} small />}
      />

      {editor.notice ? <Text style={[adminText.muted, styles.message]}>{editor.notice}</Text> : null}

      {draft ? (
        <NoticeForm
          draft={draft}
          update={editor.update}
          formErrors={editor.formErrors}
          saving={editor.saving}
          onCancel={editor.closeForm}
          onSave={editor.save}
        />
      ) : null}

      {error ? <InlineError message={error} onRetry={reload} style={styles.error} /> : null}
      {!notices ? (
        loading ? <Loading /> : null
      ) : notices.length === 0 ? (
        <EmptyState message="여기서 쓴 공지가 아직 없습니다." />
      ) : (
        NOTICE_SECTIONS.map(({ phase, title, empty }) => (
          <View key={phase} style={styles.section}>
            <Text style={[adminText.strong, styles.sectionTitle]}>
              {title} <Text style={adminText.muted}>{grouped[phase].length}건</Text>
            </Text>
            {grouped[phase].length === 0 ? (
              <Text style={adminText.muted}>{empty}</Text>
            ) : (
              <View style={styles.list}>
                {grouped[phase].map((notice) => (
                  <NoticeCard
                    key={notice.id}
                    notice={notice}
                    phase={phase}
                    now={now}
                    confirming={editor.confirmDelete === notice.id}
                    deleting={editor.deleting}
                    onEdit={() => openEdit(notice)}
                    onAskDelete={() => editor.setConfirmDelete(notice.id)}
                    onCancelDelete={() => editor.setConfirmDelete(null)}
                    onRemove={() => void editor.remove(notice)}
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
  message: { marginBottom: 12 },
  error: { marginBottom: 12 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, marginBottom: 8 },
  list: { gap: 12 },
})
