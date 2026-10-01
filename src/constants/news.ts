import type { TreeNode, TreeChild } from '../types'

export const TREE_DATA: TreeNode[] = [
  { name: '대학', children: [
    { id: '교수학습지원', name: '교수학습지원' },
    { id: '대학혁신지원사업', name: '대학혁신지원사업' },
    { id: '장학', name: '장학' },
    { id: '학사', name: '학사' },
    { id: '학생상담', name: '학생상담' },
    { id: '학생활동', name: '학생활동' },
  ]},
  { name: '건축도시대학', children: [
    { id: '건축학부', name: '건축학부' },
    { id: '도시학과', name: '도시학과' },
  ]},
  { name: '경영대학', children: [
    { id: '경영학부', name: '경영학부' },
  ]},
  { name: '경제학부', children: [
    { id: '경제학부', name: '경제학부' },
  ]},
  { name: '공과대학', children: [
    { id: '건설환경공학과', name: '건설환경공학과' },
    { id: '기계시스템디자인공학과', name: '기계·시스템디자인공학과' },
    { id: '기초과학과', name: '기초과학과' },
    { id: '산업데이터공학과', name: '산업·데이터공학과' },
    // 전공별로 게시판이 따로 있어 전공 단위로 구독하도록 한 단계 더 나눴다.
    { id: '신소재화공시스템공학부', name: '신소재화공시스템공학부', children: [
      { id: '신소재공학전공', name: '신소재공학전공' },
      { id: '화학공학전공', name: '화학공학전공' },
    ]},
    { id: '전자전기공학부', name: '전자전기공학부' },
    { id: '컴퓨터공학과', name: '컴퓨터공학과' },
  ]},
  { name: '공연예술학부', children: [
    { id: '뮤지컬전공', name: '뮤지컬전공' },
    { id: '실용음악전공', name: '실용음악전공' },
  ]},
  { name: '디자인예술경영학부', children: [
    // 전공은 둘인데 공지 게시판은 학부 하나뿐이라 학부 공지를 받을 자리를 따로 뒀다.
    { id: '디자인예술경영학부', name: '학부 공지' },
    { id: '디자인경영전공', name: '디자인경영전공' },
    { id: '예술경영전공', name: '예술경영전공' },
  ]},
  { name: '문과대학', children: [
    { id: '국어국문학과', name: '국어국문학과' },
    { id: '독어독문학과', name: '독어독문학과' },
    { id: '불어불문학과', name: '불어불문학과' },
    { id: '영어영문학과', name: '영어영문학과' },
  ]},
  { name: '미술대학', children: [
    { id: '금속조형디자인과', name: '금속조형디자인과' },
    { id: '도예유리과', name: '도예유리과' },
    { id: '동양화과', name: '동양화과' },
    { id: '디자인학부', name: '디자인학부' },
    { id: '목조형가구학과', name: '목조형가구학과' },
    { id: '섬유미술패션디자인과', name: '섬유미술패션디자인과' },
    { id: '예술학과', name: '예술학과' },
    { id: '자율전공', name: '자율전공' },
    { id: '조소과', name: '조소과' },
    { id: '판화과', name: '판화과' },
    { id: '회화과', name: '회화과' },
  ]},
  { name: '바이오헬스융합학부', children: [
    { id: '바이오헬스융합학부', name: '바이오헬스융합학부' },
  ]},
  { name: '법과대학', children: [
    { id: '법학부', name: '법학부' },
  ]},
  { name: '사범대학', children: [
    { id: '교육학과', name: '교육학과' },
    { id: '국어교육과', name: '국어교육과' },
    { id: '수학교육과', name: '수학교육과' },
    { id: '역사교육과', name: '역사교육과' },
    { id: '영어교육과', name: '영어교육과' },
  ]},
  { name: '융합전공', children: [
    { id: '데이터사이언스전공', name: '데이터사이언스전공' },
    { id: '디자인엔지니어링전공', name: '디자인엔지니어링전공' },
    { id: '사물인터넷공학전공', name: '사물인터넷공학전공' },
    { id: '지능로봇공학전공', name: '지능로봇공학전공' },
  ]},
]

export interface SubscribableItem {
  id: string
  name: string
  group: string
}

/**
 * 실제로 구독할 수 있는 잎 노드만 뽑는다.
 * 신소재화공시스템공학부처럼 하위 전공을 가진 노드는 그 자신이 아니라 전공들이 구독 단위다.
 *
 * group 은 항상 최상위 단과대 이름으로 둔다. 구독 관리 모달이 연속된 같은 group 끼리만
 * 묶기 때문에, 중간 학부 이름을 넣으면 단과대가 두 덩어리로 쪼개진다.
 */
function toSubscribableItems(child: TreeChild, group: string): SubscribableItem[] {
  return child.children?.length
    ? child.children.flatMap((grandchild) => toSubscribableItems(grandchild, group))
    : [{ id: child.id, name: child.name, group }]
}

// TREE_DATA를 구독 가능한 평면 목록으로 변환한다.
// 하위 학과가 있으면 각 학과를, 없으면 기관 자체를 구독 단위로 사용한다.
export const SUBSCRIBABLE_ITEMS: SubscribableItem[] = TREE_DATA.flatMap((node) =>
  node.children.length === 0
    ? [{ id: node.name, name: node.name, group: node.name }]
    : node.children.flatMap((child) => toSubscribableItems(child, node.name))
)

export interface SubscribableGroup {
  name: string
  items: SubscribableItem[]
}

/**
 * 이어 붙은 같은 group(단과대) 끼리 묶는다. 구독 관리 모달과 설정의 게시판별 알림 목록이 함께 쓴다.
 * 마지막 묶음을 직접 바꾸지 않고 새 묶음으로 교체해 원본 배열을 건드리지 않는다.
 */
export function groupSubscribableItems(items: readonly SubscribableItem[]): SubscribableGroup[] {
  return items.reduce<SubscribableGroup[]>((groups, item) => {
    const last = groups[groups.length - 1]
    if (last?.name === item.group) {
      const merged = { ...last, items: [...last.items, item] }
      return [...groups.slice(0, -1), merged]
    }
    return [...groups, { name: item.group, items: [item] }]
  }, [])
}
