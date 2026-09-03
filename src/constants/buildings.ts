import { BUILDING_BOUNDARIES, BUILDING_EXTRA_BOUNDARIES } from './buildingBoundaries'
import type { Building } from '../types'

/**
 * 좌표는 모두 사용자가 직접 확인해 제공한 값이다. 추정값을 넣지 않는다.
 * 새 건물을 추가할 때도 좌표를 확인받기 전에는 목록에 넣지 않는다.
 *
 * floors / hours / description / facilities 는 출처가 확인된 건물만 채운다.
 * 값이 없으면 배너에서 해당 줄이 자동으로 숨겨진다.
 *
 * entrances 는 층에 따라 실제로 드나드는 문이 달라지는 건물만 채운다(예: 저층은
 * 정문, 고층은 후문 계단으로만 연결). 출입구 좌표가 확인되지 않았으면 비워 두고,
 * 길찾기는 건물 대표 좌표(lat/lng)로 대신한다. `src/utils/floors.ts` 의
 * `resolveEntrancePoint` 참고.
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
    ],
    // L층·옥상은 층 다이얼이 다루는 정수 층 체계 밖이라 뺐다(entranceCheckData id0,1,112).
    entrances: [
      { label: 'HI_R_1F5_ENTER', lat: 37.5524325, lng: 126.9249828, minFloor: 1.5, maxFloor: 1.5 },
      { label: 'HI_R_2F_ENTER', lat: 37.5523262, lng: 126.9252161, minFloor: 2, maxFloor: 2 },
      { label: 'HI_R_3F_ENTER', lat: 37.55260289093227, lng: 126.92545837645307, minFloor: 3, maxFloor: 3 },
      { label: 'HI_R_B2_ENTER', lat: 37.55224413873024, lng: 126.92450528922885, minFloor: -2, maxFloor: -2 },
    ] },
  { name: '제1공학관 K동', lat: 37.5521221, lng: 126.9261871, color: '#3B82F6', category: '강의', type: '공학 강의동',
    boundary: [
      [37.55248348, 126.92541323],
      [37.55261870, 126.92552060],
      [37.55184454, 126.92664739],
      [37.55192118, 126.92672088],
      [37.55215973, 126.92638114],
    ],
    entrances: [
      { label: 'HI_K_1F_1_ENTER', lat: 37.55240472150334, lng: 126.92553779193621, minFloor: 1, maxFloor: 1 },
      { label: 'HI_K_1F_2_ENTER', lat: 37.55193449138625, lng: 126.92640116593464, minFloor: 1, maxFloor: 1 },
      { label: 'HI_K_4F_ENTER', lat: 37.55188286179927, lng: 126.92668696576492, minFloor: 4, maxFloor: 4 },
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
    ],
    entrances: [
      { label: 'HI_M_B2_ENTER', lat: 37.551716884921056, lng: 126.9242398769817, minFloor: -2, maxFloor: -2 },
      { label: 'HI_M_B1_1_ENTER', lat: 37.55202547108534, lng: 126.92423107701065, minFloor: -1, maxFloor: -1 },
      { label: 'HI_M_B1_2_ENTER', lat: 37.5521465, lng: 126.924465, minFloor: -1, maxFloor: -1 },
      { label: 'HI_M_B1_3_ENTER', lat: 37.55195822377321, lng: 126.92474323054743, minFloor: -1, maxFloor: -1 },
      { label: 'HI_M_B1_4_ENTER', lat: 37.5515120909974, lng: 126.92452583191815, minFloor: -1, maxFloor: -1 },
      { label: 'HI_M_1F_1_ENTER', lat: 37.5521125, lng: 126.9245857, minFloor: 1, maxFloor: 1 },
      { label: 'HI_M_1F_2_ENTER', lat: 37.551478207651996, lng: 126.92437591937156, minFloor: 1, maxFloor: 1 },
    ] },
  { name: '제3공학관 J동', lat: 37.5517521, lng: 126.9269971, color: '#2563EB', category: '강의', type: '공학 강의동',
    entrances: [
      { label: 'HI_J_1F_ENTER', lat: 37.5517127, lng: 126.9269460, minFloor: 1, maxFloor: 1 },
      { label: 'HI_J_2F_ENTER', lat: 37.5516628, lng: 126.9270506, minFloor: 2, maxFloor: 2 },
      { label: 'HI_J_3F_ENTER', lat: 37.5516479, lng: 126.9271713, minFloor: 3, maxFloor: 3 },
    ] },
  // TODO: 용도 미확인 — category/type 확인 필요
  { name: '와우관 L동', lat: 37.5516542, lng: 126.9265733, color: '#14B8A6', category: '강의', type: '확인 필요',
    entrances: [
      { label: 'HI_L_1F_ENTER', lat: 37.55173403355862, lng: 126.92642399659778, minFloor: 1, maxFloor: 1 },
      { label: 'HI_L_4F_1_ENTER', lat: 37.5517680127205, lng: 126.92673234537114, minFloor: 4, maxFloor: 4 },
      { label: 'HI_L_4F_2_ENTER', lat: 37.5516415, lng: 126.9267543, minFloor: 4, maxFloor: 4 },
      { label: 'HI_L_6F_ENTER', lat: 37.55169601535792, lng: 126.92686538785387, minFloor: 6, maxFloor: 6 },
      { label: 'HI_L_7F_ENTER', lat: 37.5515681, lng: 126.9270292, minFloor: 7, maxFloor: 7 },
      { label: 'HI_L_4F_3_ENTER', lat: 37.5516973, lng: 126.9267925, minFloor: 4, maxFloor: 4 },
    ] },
  { name: '운동장', lat: 37.5514884, lng: 126.9250283, color: '#22C55E', category: '편의', type: '야외 체육 시설',
    boundary: [
      [37.55199248, 126.92548162],
      [37.55210930, 126.92500054],
      [37.55158199, 126.92464459],
      [37.55100979, 126.92453200],
      [37.55098768, 126.92518839],
      [37.55181686, 126.92560062],
    ] },
  { name: '과학관 I동', lat: 37.5514714, lng: 126.9272599, color: '#8B5CF6', category: '강의', type: '자연과학 강의동',
    entrances: [
      { label: 'HI_I_1F_1_ENTER', lat: 37.5514948, lng: 126.927174, minFloor: 1, maxFloor: 1 },
      { label: 'HI_I_1F_2_ENTER', lat: 37.551592613928165, lng: 126.92721064978504, minFloor: 1, maxFloor: 1 },
      { label: 'HI_I_4F_ENTER', lat: 37.5513597, lng: 126.9271405, minFloor: 4, maxFloor: 4 },
      { label: 'HI_I_5F_ENTER', lat: 37.5513597, lng: 126.9271405, minFloor: 5, maxFloor: 5 },
      { label: 'HI_I_6F_ENTER', lat: 37.5513597, lng: 126.9271405, minFloor: 6, maxFloor: 6 },
    ] },

  // ── 중부 ────────────────────────────────────────────────
  { name: '중앙도서관 H동', lat: 37.5512970, lng: 126.9267288, color: '#059669', category: '강의', type: '중앙 도서관',
    entrances: [
      { label: 'HI_H_1F_ENTER', lat: 37.55141204667593, lng: 126.92661669741632, minFloor: 1, maxFloor: 1 },
      { label: 'HI_H_3F_1_ENTER', lat: 37.5513251, lng: 126.9265693, minFloor: 3, maxFloor: 3 },
      { label: 'HI_H_3F_2_ENTER', lat: 37.551344482409974, lng: 126.92663373872931, minFloor: 3, maxFloor: 3 },
      { label: 'HI_H_5F_ENTER', lat: 37.5510539247594, lng: 126.92665665687645, minFloor: 5, maxFloor: 5 },
    ] },
  { name: '학생회관 G동', lat: 37.5511949, lng: 126.9261924, color: '#F59E0B', category: '식당', type: '학생 편의시설·식당',
    entrances: [
      { label: 'HI_G_4F_ENTER', lat: 37.551432264580214, lng: 126.92652897296448, minFloor: 4, maxFloor: 4 },
      { label: 'HI_G_6F_ENTER', lat: 37.55136693521775, lng: 126.92651772037682, minFloor: 6, maxFloor: 6 },
      { label: 'HI_G_1F_1_ENTER', lat: 37.55148614274957, lng: 126.9262375141635, minFloor: 1, maxFloor: 1 },
      { label: 'HI_G_1F_2_ENTER', lat: 37.55138255100608, lng: 126.92627439559115, minFloor: 1, maxFloor: 1 },
      { label: 'HI_G_1F_3_ENTER', lat: 37.5514095226001, lng: 126.92618100605969, minFloor: 1, maxFloor: 1 },
      { label: 'HI_G_2F_ENTER', lat: 37.5513601072553, lng: 126.92640455992606, minFloor: 2, maxFloor: 2 },
    ] },
  { name: '제2공학관 P동', lat: 37.5510886, lng: 126.9269970, color: '#818CF8', category: '강의', type: '공학 강의동',
    entrances: [
      { label: 'HI_P_5F_ENTER', lat: 37.5513023, lng: 126.9271029, minFloor: 5, maxFloor: 5 },
      { label: 'HI_P_6F_ENTER', lat: 37.5513023, lng: 126.9271029, minFloor: 6, maxFloor: 6 },
      { label: 'HI_P_7F_ENTER', lat: 37.5513023, lng: 126.9271029, minFloor: 7, maxFloor: 7 },
      { label: 'HI_P_B2_ENTER', lat: 37.55101796737566, lng: 126.92678966290985, minFloor: -2, maxFloor: -2 },
      { label: 'HI_P_1F_1_ENTER', lat: 37.55125003735499, lng: 126.92689128620393, minFloor: 1, maxFloor: 1 },
      { label: 'HI_P_1F_2_ENTER', lat: 37.55113512862428, lng: 126.92684047337738, minFloor: 1, maxFloor: 1 },
      { label: 'HI_P_3F_ENTER', lat: 37.55119838737498, lng: 126.92714596220212, minFloor: 3, maxFloor: 3 },
    ] },
  { name: '정보통신센터 Q동', lat: 37.5509397, lng: 126.9264016, color: '#6366F1', category: '강의', type: '공학·IT 강의동',
    entrances: [
      { label: 'HI_Q_7F_ENTER', lat: 37.5510020980638, lng: 126.92662558684303, minFloor: 7, maxFloor: 7 },
      { label: 'HI_Q_1F_1_ENTER', lat: 37.55117310792542, lng: 126.92633684367583, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Q_1F_2_ENTER', lat: 37.55094551770519, lng: 126.92619560950573, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Q_2F_1_ENTER', lat: 37.550880239567945, lng: 126.92626640289171, minFloor: 2, maxFloor: 2 },
      { label: 'HI_Q_2F_2_ENTER', lat: 37.55113715442653, lng: 126.92647550841156, minFloor: 2, maxFloor: 2 },
      { label: 'HI_Q_3F_1_ENTER', lat: 37.55084208476401, lng: 126.92648711490183, minFloor: 3, maxFloor: 3 },
      { label: 'HI_Q_4F_1_ENTER', lat: 37.550907473973844, lng: 126.9265945588253, minFloor: 4, maxFloor: 4 },
      { label: 'HI_Q_4F_2_ENTER', lat: 37.55083312408005, lng: 126.92656634015292, minFloor: 4, maxFloor: 4 },
      { label: 'HI_Q_3F_2_ENTER', lat: 37.5511381, lng: 126.9261756, minFloor: 3, maxFloor: 3 },
    ] },
  { name: '제4강의동 Z4동', lat: 37.5507824, lng: 126.9246528, color: '#6D28D9', category: '강의', type: '일반 강의동',
    entrances: [
      { label: 'HI_Z4_1F_1_ENTER', lat: 37.55085461531827, lng: 126.92492257726056, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z4_1F_2_ENTER', lat: 37.55073297704688, lng: 126.92491704096119, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z4_1F_3_ENTER', lat: 37.55087910044487, lng: 126.92446422867586, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z4_1F_4_ENTER', lat: 37.55076866666891, lng: 126.92436814880448, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z4_1F_5_ENTER', lat: 37.55048934110241, lng: 126.92434296873957, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z4_1F_6_ENTER', lat: 37.550356529076105, lng: 126.92447607260678, minFloor: 1, maxFloor: 1 },
    ] },
  { name: '문헌관 MH동', lat: 37.5506803, lng: 126.9259832, color: '#10B981', category: '강의', type: '미술대학 강의동',
    description: '미술대학이 주로 이용하며, 1층에 교학처 등 행정시설이 있습니다.',
    entrances: [
      { label: 'HI_MH_1F_ENTER', lat: 37.55072454638785, lng: 126.92583369557815, minFloor: 1, maxFloor: 1 },
      { label: 'HI_MH_4F_ENTER', lat: 37.55074043984462, lng: 126.92603454986464, minFloor: 4, maxFloor: 4 },
      { label: 'HI_MH_8F_ENTER', lat: 37.550706664837925, lng: 126.9260543873203, minFloor: 8, maxFloor: 8 },
    ] },
  { name: '미술학관 F동', lat: 37.5506633, lng: 126.9264445, color: '#F97316', category: '강의', type: '미술 강의동',
    entrances: [
      { label: 'HI_F_2F_1_ENTER', lat: 37.55078801786133, lng: 126.92647585137533, minFloor: 2, maxFloor: 2 },
      { label: 'HI_F_2F_2_ENTER', lat: 37.550603149221985, lng: 126.92621292200054, minFloor: 2, maxFloor: 2 },
      { label: 'HI_F_3F_ENTER', lat: 37.55059646769854, lng: 126.9263345820368, minFloor: 3, maxFloor: 3 },
      { label: 'HI_F_4F_ENTER', lat: 37.550587544127055, lng: 126.92647321915231, minFloor: 4, maxFloor: 4 },
      { label: 'HI_F_5F_ENTER', lat: 37.55071606295771, lng: 126.92667679202779, minFloor: 5, maxFloor: 5 },
      { label: 'HI_F_2F_3_ENTER', lat: 37.55073376558205, lng: 126.92616752675342, minFloor: 2, maxFloor: 2 },
      { label: 'HI_F_6F_ENTER', lat: 37.55069996932533, lng: 126.92615341432149, minFloor: 6, maxFloor: 6 },
    ] },
  { name: '제1강의동 Z1동', lat: 37.5505697, lng: 126.9255433, color: '#9333EA', category: '강의', type: '일반 강의동',
    entrances: [
      { label: 'HI_Z1_1F_1_ENTER', lat: 37.5509552, lng: 126.9255299, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z1_1F_2_ENTER', lat: 37.550128, lng: 126.9255192, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z1_1F_3_ENTER', lat: 37.5506451, lng: 126.9254884, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z1_2F_1_ENTER', lat: 37.550128, lng: 126.9255594, minFloor: 2, maxFloor: 2 },
      { label: 'HI_Z1_2F_2_ENTER', lat: 37.5509552, lng: 126.9255594, minFloor: 2, maxFloor: 2 },
    ] },

  // ── 남부 ────────────────────────────────────────────────
  { name: '조형관', lat: 37.5502933, lng: 126.9261977, color: '#D97706', category: '강의', type: '예술·디자인 강의동',
    entrances: [
      { label: 'HI_E_3F_ENTER', lat: 37.5503078, lng: 126.9260846, minFloor: 1, maxFloor: 1 },
      { label: 'HI_E_1F_ENTER', lat: 37.55020218050226, lng: 126.92617370938746, minFloor: 2, maxFloor: 2 },
      { label: 'HI_E_2F_ENTER', lat: 37.55054232834514, lng: 126.92620732366287, minFloor: 3, maxFloor: 3 },
    ] },
  { name: '강당 S동', lat: 37.5502593, lng: 126.9251731, color: '#06B6D4', category: '편의', type: '강당',
    entrances: [
      { label: 'HI_S_3F_ENTER', lat: 37.5504890, lng: 126.9251832, minFloor: 1, maxFloor: 1 },
      { label: 'HI_S_1F_ENTER', lat: 37.55020385453509, lng: 126.92525423881615, minFloor: 3, maxFloor: 3 },
    ] },
  { name: '미술종합강의동 U동', lat: 37.5501933, lng: 126.9264606, color: '#FB923C', category: '강의', type: '미술 강의동',
    entrances: [
      { label: 'HI_U_B2_ENTER', lat: 37.55018201935799, lng: 126.92635196473525, minFloor: -2, maxFloor: -2 },
      { label: 'HI_U_2F_1_ENTER', lat: 37.5503278, lng: 126.9264432, minFloor: 2, maxFloor: 2 },
      { label: 'HI_U_2F_2_ENTER', lat: 37.550112266088455, lng: 126.92647085689944, minFloor: 2, maxFloor: 2 },
    ] },
  { name: '제4공학관 T동', lat: 37.5500934, lng: 126.9246689, color: '#1D4ED8', category: '강의', type: '공학 강의동',
    entrances: [
      { label: 'HI_T_3F_ENTER', lat: 37.5501348, lng: 126.9249452, minFloor: 3, maxFloor: 3 },
      { label: 'HI_T_5F_ENTER', lat: 37.5501562, lng: 126.9249398, minFloor: 5, maxFloor: 5 },
      { label: 'HI_T_1F_1_ENTER', lat: 37.55008836632357, lng: 126.92429527881669, minFloor: 1, maxFloor: 1 },
      { label: 'HI_T_1F_2_ENTER', lat: 37.55002084407098, lng: 126.92437739182762, minFloor: 1, maxFloor: 1 },
    ] },
  { name: '인문사회관 B동', lat: 37.5500339, lng: 126.9259939, color: '#EC4899', category: '강의', type: '인문·사회 강의동',
    entrances: [
      { label: 'HI_B_1F_1_ENTER', lat: 37.55009185955166, lng: 126.9262558629962, minFloor: 1, maxFloor: 1 },
      { label: 'HI_B_1F_2_ENTER', lat: 37.550010771523475, lng: 126.92625877201391, minFloor: 1, maxFloor: 1 },
      { label: 'HI_B_1F_3_ENTER', lat: 37.55001280441093, lng: 126.92590795814857, minFloor: 1, maxFloor: 1 },
    ] },
  { name: '제3강의동 Z3동', lat: 37.5498978, lng: 126.9246528, color: '#7C3AED', category: '강의', type: '일반 강의동',
    entrances: [
      { label: 'HI_Z3_1F_ENTER', lat: 37.54989044158931, lng: 126.92475662609401, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z3_B1_ENTER', lat: 37.54992842109183, lng: 126.92426714934065, minFloor: -1, maxFloor: -1 },
      { label: 'HI_Z3_3F_ENTER', lat: 37.5499792, lng: 126.9248808, minFloor: 3, maxFloor: 3 },
    ] },
  { name: '인문사회관 A동', lat: 37.5496681, lng: 126.9258920, color: '#F472B6', category: '강의', type: '인문·사회 강의동',
    entrances: [
      { label: 'HI_A_2F_ENTER', lat: 37.55006909546062, lng: 126.92587395286704, minFloor: 2, maxFloor: 2 },
      { label: 'HI_A_1F_1_ENTER', lat: 37.55006894959721, lng: 126.92564196434817, minFloor: 1, maxFloor: 1 },
      { label: 'HI_A_1F_2_ENTER', lat: 37.550057818778704, lng: 126.92585133099767, minFloor: 1, maxFloor: 1 },
      { label: 'HI_A_1F_3_ENTER', lat: 37.5502413, lng: 126.9259109, minFloor: 1, maxFloor: 1 },
      { label: 'HI_A_1F_4_ENTER', lat: 37.5496938, lng: 126.9257796, minFloor: 1, maxFloor: 1 },
    ] },
  // TODO: 용도 미확인 — Z 계열이라 강의동으로 두었으나 확인 필요
  { name: '이천득관 Z2동', lat: 37.5496085, lng: 126.9253877, color: '#A855F7', category: '강의', type: '확인 필요',
    entrances: [
      { label: 'HI_Z2_1F_ENTER', lat: 37.54985921753994, lng: 126.92524609560533, minFloor: 1, maxFloor: 1 },
      { label: 'HI_Z2_2F_1_ENTER', lat: 37.54943137416806, lng: 126.92545304762459, minFloor: 2, maxFloor: 2 },
      { label: 'HI_Z2_3F_ENTER', lat: 37.55000095601928, lng: 126.9249800160683, minFloor: 3, maxFloor: 3 },
      { label: 'HI_Z2_4F_ENTER', lat: 37.5500653, lng: 126.9253039, minFloor: 4, maxFloor: 4 },
      { label: 'HI_Z2_5F_ENTER', lat: 37.549893060445676, lng: 126.92533376463105, minFloor: 5, maxFloor: 5 },
      { label: 'HI_Z2_2F_2_ENTER', lat: 37.5500689, lng: 126.9253227, minFloor: 2, maxFloor: 2 },
    ] },
  { name: '제2기숙사', lat: 37.5494257, lng: 126.9247386, color: '#0891B2', category: '편의', type: '기숙사',
    entrances: [
      { label: 'HI_D2_1F_ENTER', lat: 37.5493950637821, lng: 126.9250258889983, minFloor: 1, maxFloor: 1 },
      { label: 'HI_D2_B1_ENTER', lat: 37.54938816237495, lng: 126.92479956756739, minFloor: -1, maxFloor: -1 },
      { label: 'HI_D2_B2_ENTER', lat: 37.549680786236046, lng: 126.92448524177497, minFloor: -2, maxFloor: -2 },
    ] },
  { name: '인문사회관 C동', lat: 37.5491194, lng: 126.9260797, color: '#DB2777', category: '강의', type: '인문·사회 강의동',
    entrances: [
      { label: 'HI_C_1F_1_ENTER', lat: 37.54922654695708, lng: 126.92569089586517, minFloor: 1, maxFloor: 1 },
      { label: 'HI_C_1F_2_ENTER', lat: 37.549068881234525, lng: 126.92570519784722, minFloor: 1, maxFloor: 1 },
      { label: 'HI_C_3F_1_ENTER', lat: 37.54957357333066, lng: 126.9259168802598, minFloor: 3, maxFloor: 3 },
      { label: 'HI_C_3F_2_ENTER', lat: 37.54959606098547, lng: 126.9258574466474, minFloor: 3, maxFloor: 3 },
      { label: 'HI_C_3F_3_ENTER', lat: 37.54924925669763, lng: 126.92598509962252, minFloor: 3, maxFloor: 3 },
      { label: 'HI_C_3F_4_ENTER', lat: 37.5490727, lng: 126.9262581, minFloor: 3, maxFloor: 3 },
      { label: 'HI_C_3F_5_ENTER', lat: 37.5498765, lng: 126.9260891, minFloor: 3, maxFloor: 3 },
    ] },
  { name: '인문사회관 D동', lat: 37.5488728, lng: 126.9262568, color: '#BE185D', category: '강의', type: '인문·사회 강의동',
    entrances: [
      { label: 'HI_D_2F_1_ENTER', lat: 37.54894059749405, lng: 126.92587789950531, minFloor: 2, maxFloor: 2 },
      { label: 'HI_D_2F_2_ENTER', lat: 37.548947459638505, lng: 126.92604480888187, minFloor: 2, maxFloor: 2 },
      { label: 'HI_D_1F_ENTER', lat: 37.5488932897769, lng: 126.92586945909416, minFloor: 1, maxFloor: 1 },
    ] },

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
