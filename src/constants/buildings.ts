import { BUILDING_BOUNDARIES, BUILDING_EXTRA_BOUNDARIES } from './buildingBoundaries'
import type { Building } from '../types'

/**
 * 좌표는 모두 사용자가 직접 확인해 제공한 값이다. 추정값을 넣지 않는다.
 * 새 건물을 추가할 때도 좌표를 확인받기 전에는 목록에 넣지 않는다.
 *
 * floors / hours / description / facilities 는 출처가 확인된 건물만 채운다.
 * 값이 없으면 배너에서 해당 줄이 자동으로 숨겨진다.
 */
const BASE_BUILDINGS: Building[] = [
  // ── 북측 ────────────────────────────────────────────────
  { name: '홍문관 R동', lat: 37.5527515, lng: 126.9250927, color: '#64748B', category: '강의', type: '강의·행정 복합동',
    boundary: [
      [37.55245165, 126.92494078],
      [37.55219916, 126.92462416],
      [37.55227111, 126.92440907],
      [37.55229193, 126.92527479],
      [37.55240014, 126.92541331],
      [37.55261869, 126.92550080],
      [37.55291806, 126.92516665],
    ] },
  { name: '제1공학관 K동', lat: 37.5521221, lng: 126.9261871, color: '#3B82F6', category: '강의', type: '공학 강의동',
    boundary: [
      [37.55248348, 126.92541323],
      [37.55261870, 126.92552060],
      [37.55184454, 126.92664739],
      [37.55192118, 126.92672088],
      [37.55215973, 126.92638114],
    ] },
  { name: '체육관', lat: 37.5518329, lng: 126.9244650, color: '#0EA5E9', category: '편의', type: '체육·스포츠 시설',
    boundary: [
      [37.55147604, 126.92451455],
      [37.55150743, 126.92428819],
      [37.55160201, 126.92424848],
      [37.55168989, 126.92429366],
      [37.55176414, 126.92416061],
      [37.55190158, 126.92422837],
      [37.55193083, 126.92418025],
      [37.55212912, 126.92428190],
      [37.55219000, 126.92438935],
      [37.55206635, 126.92475444],
    ] },
  { name: '제3공학관 J동', lat: 37.5517521, lng: 126.9269971, color: '#2563EB', category: '강의', type: '공학 강의동' },
  // TODO: 용도 미확인 — category/type 확인 필요
  { name: '와우관 L동', lat: 37.5516542, lng: 126.9265733, color: '#14B8A6', category: '강의', type: '확인 필요' },
  { name: '운동장', lat: 37.5514884, lng: 126.9250283, color: '#22C55E', category: '편의', type: '야외 체육 시설',
    boundary: [
      [37.55199248, 126.92548162],
      [37.55210930, 126.92500054],
      [37.55158199, 126.92464459],
      [37.55100979, 126.92453200],
      [37.55098768, 126.92518839],
      [37.55181686, 126.92560062],
    ] },
  { name: '과학관 I동', lat: 37.5514714, lng: 126.9272599, color: '#8B5CF6', category: '강의', type: '자연과학 강의동' },

  // ── 중부 ────────────────────────────────────────────────
  { name: '중앙도서관 H동', lat: 37.5512970, lng: 126.9267288, color: '#059669', category: '강의', type: '중앙 도서관' },
  { name: '학생회관 G동', lat: 37.5511949, lng: 126.9261924, color: '#F59E0B', category: '식당', type: '학생 편의시설·식당' },
  { name: '제2공학관 P동', lat: 37.5510886, lng: 126.9269970, color: '#818CF8', category: '강의', type: '공학 강의동' },
  { name: '정보통신센터 Q동', lat: 37.5509397, lng: 126.9264016, color: '#6366F1', category: '강의', type: '공학·IT 강의동' },
  { name: '제4강의동 Z4동', lat: 37.5507824, lng: 126.9246528, color: '#6D28D9', category: '강의', type: '일반 강의동' },
  { name: '문헌관 MH동', lat: 37.5506803, lng: 126.9259832, color: '#10B981', category: '강의', type: '미술대학 강의동',
    description: '미술대학이 주로 이용하며, 1층에 교학처 등 행정시설이 있습니다.' },
  { name: '미술학관 F동', lat: 37.5506633, lng: 126.9264445, color: '#F97316', category: '강의', type: '미술 강의동' },
  { name: '제1강의동 Z1동', lat: 37.5505697, lng: 126.9255433, color: '#9333EA', category: '강의', type: '일반 강의동' },

  // ── 남부 ────────────────────────────────────────────────
  { name: '조형관', lat: 37.5502933, lng: 126.9261977, color: '#D97706', category: '강의', type: '예술·디자인 강의동' },
  { name: '강당 S동', lat: 37.5502593, lng: 126.9251731, color: '#06B6D4', category: '편의', type: '강당' },
  { name: '미술종합강의동 U동', lat: 37.5501933, lng: 126.9264606, color: '#FB923C', category: '강의', type: '미술 강의동' },
  { name: '제4공학관 T동', lat: 37.5500934, lng: 126.9246689, color: '#1D4ED8', category: '강의', type: '공학 강의동' },
  { name: '인문사회관 B동', lat: 37.5500339, lng: 126.9259939, color: '#EC4899', category: '강의', type: '인문·사회 강의동' },
  { name: '제3강의동 Z3동', lat: 37.5498978, lng: 126.9246528, color: '#7C3AED', category: '강의', type: '일반 강의동' },
  { name: '인문사회관 A동', lat: 37.5496681, lng: 126.9258920, color: '#F472B6', category: '강의', type: '인문·사회 강의동' },
  // TODO: 용도 미확인 — Z 계열이라 강의동으로 두었으나 확인 필요
  { name: '이천득관 Z2동', lat: 37.5496085, lng: 126.9253877, color: '#A855F7', category: '강의', type: '확인 필요' },
  { name: '제2기숙사', lat: 37.5494257, lng: 126.9247386, color: '#0891B2', category: '편의', type: '기숙사' },
  { name: '인문사회관 C동', lat: 37.5491194, lng: 126.9260797, color: '#DB2777', category: '강의', type: '인문·사회 강의동' },
  { name: '인문사회관 D동', lat: 37.5488728, lng: 126.9262568, color: '#BE185D', category: '강의', type: '인문·사회 강의동' },

  // ── 캠퍼스 외부 ─────────────────────────────────────────
  // 본 캠퍼스에서 북서쪽으로 약 1.4km 떨어져 있어 기본 지도 화면 밖에 있다.
  { name: '제3기숙사', lat: 37.5598513, lng: 126.9141520, color: '#0E7490', category: '편의', type: '기숙사' },
]

/**
 * 외곽선을 이름으로 합쳐 내보낸다.
 *
 * 좌표 배열을 위 목록 안에 직접 적으면 건물 한 줄이 수십 줄로 불어나 이름·층수·
 * 설명을 훑어볼 수 없게 된다. 그래서 외곽선만 `buildingBoundaries.ts` 에 두고
 * 여기서 붙인다.
 *
 * 원본을 고치지 않고 새 객체를 만든다. 외곽선이 없는 건물은 `boundary` 가
 * 그대로 undefined 로 남아, 지도에서 영역이 그려지지 않는다.
 */
export const BUILDINGS: Building[] = BASE_BUILDINGS.map((building) => {
  const boundary = BUILDING_BOUNDARIES[building.name]
  const extras = BUILDING_EXTRA_BOUNDARIES[building.name]
  if (!boundary && !extras) return building

  return {
    ...building,
    ...(boundary ? { boundary: boundary as [number, number][] } : {}),
    ...(extras ? { extraBoundaries: extras as [number, number][][] } : {}),
  }
})
