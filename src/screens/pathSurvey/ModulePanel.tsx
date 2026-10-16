import type { ReactNode } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { findModule, type SurveyStore } from '../../utils/pathSurveyStore'
import { Btn, Section, TOUCH, ui } from './ui'

/**
 * 모듈 목록과 고른 모듈의 수명주기. 지점·간선은 편집 중인(active) 모듈에만 더해진다.
 * - 모듈 마치기: 이어 찍기를 끊고 done 으로(장소가 1개 이상일 때만)
 * - 다시 편집: done 을 draft 로 되돌려 편집 중으로 / 작성 중 모듈은 바로 편집 중으로
 */
export default function ModulePanel({
  store,
  hidden,
  detailId,
  onDetail,
  onToggleHidden,
  onStart,
  onFinish,
  onReopen,
  onRename,
  onDelete,
  children,
}: {
  store: SurveyStore
  hidden: Record<string, boolean>
  detailId: string | null
  onDetail: (id: string) => void
  onToggleHidden: (id: string) => void
  onStart: () => void
  onFinish: (id: string) => void
  onReopen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  /** 고른 모듈의 속성 편집(색·장소·메모). */
  children?: ReactNode
}) {
  const detail = findModule(store, detailId)
  return (
    <View style={{ gap: 14 }}>
      <Section title="모듈" help="모듈 하나는 한 층위예요. 편집 중인 모듈 외에는 흐리게 보여요. 왼쪽 칸을 끄면 지도에서 숨겨요. 줄을 누르면 아래에서 자세히 봐요.">
        {store.modules.map((m) => {
          const isActive = m.id === store.activeModuleId
          return (
            <View key={m.id} style={[ui.listRow, m.id === detailId && ui.listRowOn]}>
              <Pressable
                onPress={() => onToggleHidden(m.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !hidden[m.id] }}
                accessibilityLabel={`${m.name} 지도에 보이기`}
                style={{ minWidth: 32, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={[ui.check, !hidden[m.id] && { backgroundColor: m.color, borderColor: m.color }]} />
              </Pressable>
              <Pressable onPress={() => onDetail(m.id)} style={{ flex: 1, minHeight: TOUCH, justifyContent: 'center' }} accessibilityRole="button">
                <Text style={ui.rowText} numberOfLines={1}>
                  {`${isActive ? '[편집 중] ' : ''}${m.name}`}
                </Text>
                <Text style={ui.sectionHelp} numberOfLines={1}>
                  {`${m.status === 'done' ? '완료' : '작성 중'} · 지점 ${m.nodes.length} · 간선 ${m.edges.length} · 장소 ${m.places.length}`}
                </Text>
              </Pressable>
            </View>
          )
        })}
        {store.modules.length === 0 ? <Text style={ui.empty}>아직 모듈이 없어요</Text> : null}
        <Btn label="새 모듈 시작" kind="primary" onPress={onStart} />
      </Section>

      {detail ? (
        <Section title={`${detail.name} (${detail.status === 'done' ? '완료' : '작성 중'})`} help={detail.id}>
          <TextInput
            key={`name-${detail.id}`}
            defaultValue={detail.name}
            onChangeText={(text) => onRename(detail.id, text)}
            placeholder="모듈 이름 (예: G동 2층 - Q동 1층 통로)"
            style={ui.input}
          />
          <View style={ui.btnRow}>
            {detail.status === 'draft' && detail.id === store.activeModuleId ? <Btn label="모듈 마치기" kind="primary" onPress={() => onFinish(detail.id)} /> : null}
            {detail.status === 'done' || detail.id !== store.activeModuleId ? (
              <Btn label={detail.status === 'done' ? '다시 편집' : '이 모듈 편집'} onPress={() => onReopen(detail.id)} />
            ) : null}
            <Btn label="모듈 삭제" kind="danger" onPress={() => onDelete(detail.id)} />
          </View>
          {children}
        </Section>
      ) : null}
    </View>
  )
}
