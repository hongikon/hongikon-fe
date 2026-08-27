import type { TreeNode, TreeChild, NewsItem } from '../types'
import { CRAWLED_NEWS, CRAWLED_SOURCE_IDS } from './crawledNews'

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

/**
 * 아직 크롤러를 붙이지 않은 기관·학과용 예시 데이터.
 * 크롤링이 덮은 학과는 아래에서 걸러내므로 실제 공지와 섞이지 않는다.
 */
const MOCK_NEWS: NewsItem[] = [
  { id: 'n1', category: '공지', title: '2024년 2학기 수강신청 일정 안내', preview: '수강신청은 8월 19일(월)부터 23일(금)까지 진행됩니다', source: '교학처', sourceId: '학사', date: '2024.08.12' },
  { id: 'n2', category: '장학', title: '국가근로장학금 추가 선발 공고', preview: '2학기 추가 선발 인원을 모집합니다', source: '장학복지처', sourceId: '장학', date: '2024.08.10' },
  { id: 'n3', category: '행사', title: '가을 축제 "한마음제" 참가 신청', preview: '9월 27~28일 개최 예정, 부스 및 공연팀 신청', source: '학생처', sourceId: '학생활동', date: '2024.08.09' },
  { id: 'n4', category: '수강', title: '전공 선택 과목 수강 변경 신청', preview: '수강 변경은 개강 후 1주일 이내에만 가능합니다', source: '컴퓨터공학과', sourceId: '컴퓨터공학과', date: '2024.08.07' },
  { id: 'n5', category: '공지', title: '도서관 추석 연휴 휴관 안내', preview: '추석 연휴 기간 중앙도서관 전 열람실 휴관', source: '중앙도서관', sourceId: '학사', date: '2024.08.06' },
  { id: 'n6', category: '공지', title: '2학기 튜터링·학습코칭 프로그램 모집', preview: '전공별 튜터링, 1:1 학습코칭 참여 신청', source: '교수학습지원센터', sourceId: '교수학습지원', date: '2024.08.04' },
  { id: 'n7', category: '취업', title: '경영대학 2024 취업박람회 개최 안내', preview: '국내외 주요 기업 50여 개사가 참가합니다', source: '경영대학', sourceId: '경영학부', date: '2024.08.03' },
  { id: 'n8', category: '상담', title: '학생 정신건강 무료 상담 프로그램', preview: '전문 상담사와 1:1 심리상담을 무료로 받으세요', source: '학생상담센터', sourceId: '학생상담', date: '2024.08.02' },
  { id: 'n9', category: '공지', title: '전자전기공학부 졸업작품 전시회', preview: '2024년 8월 졸업생 작품 전시회를 개최합니다', source: '전자전기공학부', sourceId: '전자전기공학부', date: '2024.07.30' },
  { id: 'n10', category: '수강', title: '경영학부 전공필수 대체 이수 신청', preview: '8월 말까지 이수 인정 신청을 완료하세요', source: '경영학부', sourceId: '경영학부', date: '2024.07.28' },
]

/**
 * 크롤링한 실제 공지가 앞, 아직 크롤러가 없는 학과의 예시 데이터가 뒤.
 * date 는 전부 'YYYY.MM.DD' 라 문자열 비교만으로 최신순 정렬된다.
 */
export const NEWS_DATA: NewsItem[] = [
  ...CRAWLED_NEWS,
  ...MOCK_NEWS.filter((item) => !CRAWLED_SOURCE_IDS.has(item.sourceId)),
]

/** id → NewsItem. 알림 탭 시 `newsId`로 상세 화면에 넘길 항목을 찾는 데 쓴다. */
export const NEWS_BY_ID: Map<string, NewsItem> = new Map(
  NEWS_DATA.map((item) => [item.id, item]),
)

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
