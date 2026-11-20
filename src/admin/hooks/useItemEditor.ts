import { useState, type Dispatch, type SetStateAction } from 'react'
import type { BuildResult } from '../utils/mapFormRules'
import { useMutation } from '../../hooks/useMutation'

interface Options<D, I, Item, K> {
  /** 화면 목록(useAdminLoad 의 setData). 저장·삭제 결과를 다시 불러오지 않고 바로 반영한다. */
  setItems: Dispatch<SetStateAction<Item[] | null>>
  /** 초안 → 요청 본문 검증. */
  build: (draft: D) => BuildResult<I>
  /** 수정 중인 항목의 키. 새로 추가면 null. */
  draftKey: (draft: D) => K | null
  itemKey: (item: Item) => K
  create: (input: I) => Promise<Item>
  update: (key: K, input: I) => Promise<Item>
  remove: (item: Item) => Promise<unknown>
  /** 새 항목을 목록 앞에 넣을지(공지). 기본은 뒤에 붙인다. */
  prependNew?: boolean
  savedNotice: (saved: Item) => string
  removedNotice: (item: Item) => string
  /** 저장 실패 문구(폼 아래 빨간 글). */
  saveErrorMessage: (err: unknown) => string
  /** 삭제 실패 처리(화면마다 목록 오류 줄이나 확인 줄 안에 보인다). */
  onRemoveError: (err: unknown) => void
}

/**
 * 관리 화면(제휴업체·편의시설·전시·공지)이 똑같이 쓰던 '추가·수정 폼 + 저장 + 삭제 확인' 상태.
 * 한 번에 하나만 편집하고, 저장하면 목록에서 그 항목을 바꾸거나(수정) 넣은 뒤(추가) 폼을 닫고 안내 한 줄을 띄운다.
 * 삭제는 카드마다 확인 줄을 한 번 더 거친다(`confirmDelete` 에 그 항목 키).
 * 저장·삭제는 `useMutation` 으로 보내고 서버가 확인한 뒤 목록에 반영한다(낙관적 반영 없음).
 */
export function useItemEditor<D, I, Item, K>(options: Options<D, I, Item, K>) {
  const [draft, setDraft] = useState<D | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState<K | null>(null)
  /** 저장·삭제 뒤 안내 한 줄. */
  const [notice, setNotice] = useState<string | null>(null)

  /** 폼을 연다(추가). 확인 중인 삭제는 그대로 둔다. */
  const openNew = (initial: D) => {
    setDraft(initial)
    setFormErrors([])
    setNotice(null)
  }

  /** 폼을 연다(수정). 확인 중인 삭제는 닫는다. */
  const openEdit = (initial: D) => {
    setDraft(initial)
    setFormErrors([])
    setNotice(null)
    setConfirmDelete(null)
  }

  const update = (patch: Partial<D>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))

  const closeForm = () => setDraft(null)

  /** 저장(추가·수정). 서버가 돌려준 항목으로 목록을 바꾼다 — 관리 화면은 모두 서버 확인 후 반영한다. */
  const saveMutation = useMutation(
    ({ key, input }: { key: K | null; input: I }) => (key !== null ? options.update(key, input) : options.create(input)),
    {
      onMutate: () => setFormErrors([]),
      onSuccess: (saved, { key }) => {
        options.setItems((prev) => {
          const list = prev ?? []
          if (key !== null) return list.map((item) => (options.itemKey(item) === key ? saved : item))
          return options.prependNew ? [saved, ...list] : [...list, saved]
        })
        setNotice(options.savedNotice(saved))
        setDraft(null)
      },
      onError: (err) => setFormErrors([options.saveErrorMessage(err)]),
    },
  )
  const saving = saveMutation.pending

  const save = async () => {
    if (!draft || saving) return
    const result = options.build(draft)
    if ('errors' in result) {
      setFormErrors(result.errors)
      return
    }
    await saveMutation.mutate({ key: options.draftKey(draft), input: result.input })
  }

  /** 삭제. 서버가 지운 뒤 목록에서 뺀다. 지운 항목을 편집 중이었으면(누른 때 기준) 폼도 닫는다. */
  const removeMutation = useMutation(
    ({ item }: { item: Item; key: K; editingSame: boolean }) => options.remove(item),
    {
      onSuccess: (_result, { item, key, editingSame }) => {
        options.setItems((prev) => (prev ? prev.filter((other) => options.itemKey(other) !== key) : prev))
        setNotice(options.removedNotice(item))
        setConfirmDelete(null)
        if (editingSame) setDraft(null)
      },
      onError: (err) => options.onRemoveError(err),
    },
  )
  const deleting = removeMutation.pending

  const remove = async (item: Item) => {
    if (deleting) return
    const key = options.itemKey(item)
    await removeMutation.mutate({ item, key, editingSame: !!draft && options.draftKey(draft) === key })
  }

  return {
    draft,
    formErrors,
    saving,
    confirmDelete,
    setConfirmDelete,
    deleting,
    notice,
    openNew,
    openEdit,
    update,
    closeForm,
    save,
    remove,
  }
}
