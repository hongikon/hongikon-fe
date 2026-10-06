/**
 * 임시 노드 - 2026-09-30에 새로 받은 출입구 좌표 중, 이미 건물 데이터(서버) 에 같은
 * 라벨로 들어가 있는 출입구의 "새 후보 좌표"만 모았다. 기존 좌표와 10~56m 까지
 * 벌어져 있어 바로 덮어쓰지 않고, `/temp/path-nodes` 지도(`mapHtml.ts` 의
 * `'nodes'` 모드)에 기존 좌표와 나란히 찍어 비교만 한다.
 *
 * 어느 쪽이 맞는지 확인되면 건물 데이터(서버) 의 해당 출입구 좌표를 고치고 여기서
 * 지운다. 비면 이 파일과 `mapHtml.ts` 의 TEMP_ENTRANCE_NODES 블록을 지운다.
 *
 * - `raw3`: 제보 좌표의 세 번째 값. 의미를 확인받지 못해 그대로 보관만 한다.
 * - `sameAs`: "지도에는 이 출입구와 같은 위경도로(고도만 다르게) 표시" 지시.
 *   지도에는 가리키는 노드의 좌표로 찍고, 받은 좌표는 infowindow 에만 보인다.
 * - `indoorOnly`: 바깥과 연결되지 않은 실내 출입문.
 */
export interface TempEntranceNode {
  buildingName: string
  label: string
  lat: number
  lng: number
  raw3: number
  sameAs?: string
  indoorOnly?: boolean
  note?: string
}

export const TEMP_ENTRANCE_NODES: readonly TempEntranceNode[] = [
  // ── 제2기숙사 ─────────────────────────────────────────
  // 제보 라벨 "HI_D2_B1_ENTER 1(주차장 입구)" / "HI_D2_1F_ENTER1(남자,여자기숙사 입구)"
  { buildingName: '제2기숙사', label: 'HI_D2_B1_ENTER', lat: 37.54935199026331, lng: 126.924481203919, raw3: 40.0058997023106, note: 'B1_ENTER 1 · 주차장 입구' },
  { buildingName: '제2기숙사', label: 'HI_D2_1F_ENTER', lat: 37.54957699965131, lng: 126.9250647068301, raw3: 39.0245895385742, note: '1F_ENTER1 · 남자/여자 기숙사 입구' },

  // ── 제3강의동 Z3동 ────────────────────────────────────
  { buildingName: '제3강의동 Z3동', label: 'HI_Z3_1F_ENTER', lat: 37.5495549291722, lng: 126.9249476586719, raw3: 69.4480972290039 },
  { buildingName: '제3강의동 Z3동', label: 'HI_Z3_3F_ENTER', lat: 37.55011124955998, lng: 126.9250150589245, raw3: 54.6867370605469, indoorOnly: true, note: '= HI_Z2_3F_ENTER' },

  // ── 제4공학관 T동 ─────────────────────────────────────
  { buildingName: '제4공학관 T동', label: 'HI_T_3F_ENTER', lat: 37.55016936458419, lng: 126.9250484929671, raw3: 42.5571670532227 },
  { buildingName: '제4공학관 T동', label: 'HI_T_5F_ENTER', lat: 37.55029419534498, lng: 126.9250768192616, raw3: 51.9981307983398 },

  // ── 이천득관 Z2동 ─────────────────────────────────────
  { buildingName: '이천득관 Z2동', label: 'HI_Z2_1F_ENTER', lat: 37.54960999827604, lng: 126.9247395360162, raw3: 95.096321105957 },
  { buildingName: '이천득관 Z2동', label: 'HI_Z2_2F_1_ENTER', lat: 37.54993438785392, lng: 126.9254245587489, raw3: -4.87607574462891 },
  { buildingName: '이천득관 Z2동', label: 'HI_Z2_2F_2_ENTER', lat: 37.55019325184418, lng: 126.9254927779906, raw3: 41.0728454589844 },
  { buildingName: '이천득관 Z2동', label: 'HI_Z2_3F_ENTER', lat: 37.55011124955998, lng: 126.9250150589245, raw3: 54.6867370605469, indoorOnly: true, note: '= HI_Z3_3F_ENTER' },
  { buildingName: '이천득관 Z2동', label: 'HI_Z2_4F_ENTER', lat: 37.55017032850306, lng: 126.9252230041911, raw3: 39.5842132568359, sameAs: 'HI_Z2_2F_2_ENTER' },
  { buildingName: '이천득관 Z2동', label: 'HI_Z2_5F_ENTER', lat: 37.54973153313579, lng: 126.9254138010728, raw3: 70.3878326416016 },

  // ── 인문사회관 A동 ────────────────────────────────────
  { buildingName: '인문사회관 A동', label: 'HI_A_1F_1_ENTER', lat: 37.54961988892178, lng: 126.9254963380535, raw3: 50.7667083740234 },
  { buildingName: '인문사회관 A동', label: 'HI_A_1F_2_ENTER', lat: 37.5499435011869, lng: 126.9259412138713, raw3: 50.324951171875, indoorOnly: true },
  { buildingName: '인문사회관 A동', label: 'HI_A_1F_3_ENTER', lat: 37.5503395352733, lng: 126.925811765618, raw3: 44.5655689481646 },
  { buildingName: '인문사회관 A동', label: 'HI_A_1F_4_ENTER', lat: 37.54953778873229, lng: 126.9251727248596, raw3: 69.155861386098 },
  { buildingName: '인문사회관 A동', label: 'HI_A_2F_ENTER', lat: 37.54996458129784, lng: 126.9259341800008, raw3: 56.9165115356445, sameAs: 'HI_A_1F_2_ENTER', indoorOnly: true },

  // ── 인문사회관 C동 ────────────────────────────────────
  { buildingName: '인문사회관 C동', label: 'HI_C_1F_1_ENTER', lat: 37.54952135964999, lng: 126.9257177879353, raw3: 83.8056945800781 },
  { buildingName: '인문사회관 C동', label: 'HI_C_1F_2_ENTER', lat: 37.54907669968674, lng: 126.9257926383306, raw3: 50.9178466796875 },
  { buildingName: '인문사회관 C동', label: 'HI_C_3F_2_ENTER', lat: 37.54954220287381, lng: 126.9253416691768, raw3: 83.8138580322266, note: 'B동 1층과 연결' },
  { buildingName: '인문사회관 C동', label: 'HI_C_3F_3_ENTER', lat: 37.54956568536339, lng: 126.9257826279032, raw3: 90.0619277954102, note: 'B동 1층과 연결 · 주말 폐문' },
  { buildingName: '인문사회관 C동', label: 'HI_C_3F_4_ENTER', lat: 37.54891253771296, lng: 126.9259872922535, raw3: 57.7639999389648, note: '주말 폐문' },
  { buildingName: '인문사회관 C동', label: 'HI_C_3F_5_ENTER', lat: 37.55000513882096, lng: 126.9257921823298, raw3: 66.8651457369305, note: '주말 폐문' },

  // ── 인문사회관 B동 ────────────────────────────────────
  { buildingName: '인문사회관 B동', label: 'HI_B_1F_1_ENTER', lat: 37.55017423025145, lng: 126.9262018264205, raw3: 66.1426385003969 },
  { buildingName: '인문사회관 B동', label: 'HI_B_1F_2_ENTER', lat: 37.55003937439389, lng: 126.9261599787921, raw3: 62.95 },
  { buildingName: '인문사회관 B동', label: 'HI_B_1F_3_ENTER', lat: 37.54966511594029, lng: 126.9255790705487, raw3: 88.6965637207031 },
]
