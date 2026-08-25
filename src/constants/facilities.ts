import type { Facility } from '../types'

/**
 * 캠퍼스 편의시설 목록.
 *
 * `buildings.ts` 와 같은 규칙을 따른다 — 위치를 확인받기 전에는 목록에 넣지
 * 않는다. 편의시설은 건물 안에 있어 자체 좌표를 확인할 방법이 없으므로,
 * 좌표 대신 `buildingName` 으로 이미 검증된 건물 좌표를 가리킨다.
 * 지도 핀은 그 건물 좌표에 찍힌다.
 *
 * 한 건물에 같은 종류가 여러 층에 있으면 층마다 따로 넣는다. 지도에서는
 * 좌표가 같아 핀이 겹치므로, `utils/facilities.ts` 가 건물 단위로 묶어
 * "홍문관 R동 2F·4F" 처럼 한 핀에 층을 모아 보여준다.
 *
 * `buildingName` 은 `BUILDINGS` 의 `name` 과 정확히 일치해야 한다.
 * 오타로 못 찾은 항목은 조용히 사라지지 않고 개발 중 경고로 드러난다
 * (`utils/facilities.ts` 의 `unresolvedFacilities` 참고).
 *
 * 2026-08-24 캠퍼스 편의시설 전수 조사 데이터로 채웠다(출처: 사용자 제공 표,
 * `location_id`/`building_code`/`floor_id` 등 원본 컬럼은 여기 옮기며 걷어냈다
 * — `id`/`buildingName`/`floor`/`note` 로 충분히 표현된다). 층 표기가
 * 불명확한 항목("L층"·"N층")은 존재만 확인된 것만 `floor` 를 비운 채 남기고
 * (예: R동 L층 증명서 발급), 나머지는 통째로 제외했다.
 * `HI_E_BUILDING_ELEVATOR` 행은 `buildings.ts` 에 대응하는 "E동" 건물이 없어
 * 제외했다 — 어느 건물인지 확인되면 추가한다.
 */
export const FACILITIES: readonly Facility[] = [
  // ── 홍문관 R동 ──────────────────────────────────────────
  { id: 'hi-r-16f-restaurant', kind: '식당', buildingName: '홍문관 R동', floor: 16, note: '마루샤브 스카이' },
  { id: 'hi-r-9f-printer', kind: '프린터', buildingName: '홍문관 R동', floor: 9, note: 'PC실' },
  { id: 'hi-r-8f-reading-room', kind: '열람실', buildingName: '홍문관 R동', floor: 8, note: '법학도서관 열람실' },
  { id: 'hi-r-8f-study-room', kind: '스터디룸', buildingName: '홍문관 R동', floor: 8, note: '공동학습실' },
  { id: 'hi-r-7f-printer', kind: '프린터', buildingName: '홍문관 R동', floor: 7, note: '시각디자인과 프린트실' },
  { id: 'hi-r-3f-convenience-store', kind: '편의점', buildingName: '홍문관 R동', floor: 3 },
  { id: 'hi-r-2f-cafe-01', kind: '카페', buildingName: '홍문관 R동', floor: 2, note: '파브리카' },
  { id: 'hi-r-2f-cafe-02', kind: '카페', buildingName: '홍문관 R동', floor: 2, note: '그라찌에' },
  // L층 카페(카페나무)·스터디룸(세미나실)은 정확한 층수를 확인할 수 없어 제외 — 확인되면 추가
  { id: 'hi-r-lf-certificate-kiosk', kind: '증명서 발급', buildingName: '홍문관 R동', note: '증명서 출력기 (L층, 정확한 층수 미확인)' },
  { id: 'hi-r-b2f-cafe', kind: '카페', buildingName: '홍문관 R동', floor: -2, note: '프루츠카페' },
  { id: 'hi-r-building-elevator', kind: '엘리베이터', buildingName: '홍문관 R동', note: '지도상 엘리베이터 표기(정확한 층 미확인)' },

  // ── 제1공학관 K동 ───────────────────────────────────────
  { id: 'hi-k-6f-printer', kind: '프린터', buildingName: '제1공학관 K동', floor: 6, note: '공용PC실' },
  { id: 'hi-k-outdoor-smoking-01', kind: '흡연구역', buildingName: '제1공학관 K동', note: 'K동 앞 대나무숲 야외 흡연구역' },

  // ── 체육관 ──────────────────────────────────────────────
  { id: 'hi-gym-building-elevator', kind: '엘리베이터', buildingName: '체육관' },

  // ── 제3공학관 J동 ───────────────────────────────────────
  { id: 'hi-j-building-elevator', kind: '엘리베이터', buildingName: '제3공학관 J동', note: '지도상 엘리베이터 표기(정확한 층 미확인)' },

  // ── 와우관 L동 ──────────────────────────────────────────
  { id: 'hi-l-4f-cafe', kind: '카페', buildingName: '와우관 L동', floor: 4, note: '카페나무' },
  { id: 'hi-l-building-elevator', kind: '엘리베이터', buildingName: '와우관 L동' },

  // ── 중앙도서관 H동 ──────────────────────────────────────
  { id: 'hi-h-3f-printer', kind: '프린터', buildingName: '중앙도서관 H동', floor: 3, note: '공용PC실' },
  { id: 'hi-h-3f-cafe', kind: '카페', buildingName: '중앙도서관 H동', floor: 3, note: '카페ing' },
  { id: 'hi-h-3f-study-room', kind: '스터디룸', buildingName: '중앙도서관 H동', floor: 3, note: '그룹 스터디룸' },
  { id: 'hi-h-1f-study-room', kind: '스터디룸', buildingName: '중앙도서관 H동', floor: 1, note: '캐럴/미디어룸' },
  { id: 'hi-h-building-elevator', kind: '엘리베이터', buildingName: '중앙도서관 H동' },

  // ── 학생회관 G동 ────────────────────────────────────────
  { id: 'hi-g-6f-reading-room', kind: '열람실', buildingName: '학생회관 G동', floor: 6, note: '일반열람실 3' },
  { id: 'hi-g-5f-reading-room-01', kind: '열람실', buildingName: '학생회관 G동', floor: 5, note: '일반열람실 1' },
  { id: 'hi-g-5f-reading-room-02', kind: '열람실', buildingName: '학생회관 G동', floor: 5, note: '일반열람실 2' },
  { id: 'hi-g-5f-reading-room-03', kind: '열람실', buildingName: '학생회관 G동', floor: 5, note: '노트북 열람실' },
  { id: 'hi-g-1f-printer', kind: '프린터', buildingName: '학생회관 G동', floor: 1, note: '출력센터' },
  { id: 'hi-g-b1f-lounge', kind: '라운지', buildingName: '학생회관 G동', floor: -1 },
  { id: 'hi-g-b1f-study-room', kind: '스터디룸', buildingName: '학생회관 G동', floor: -1, note: '공동학습실' },

  // ── 제2공학관 P동 ───────────────────────────────────────
  // N층 카페/휴게실: 원표에도 "있었음 - 확인필요"로 적혀 있어 제외 — 확인되면 추가
  { id: 'hi-p-building-elevator', kind: '엘리베이터', buildingName: '제2공학관 P동', note: '지도상 엘리베이터 표기(정확한 층 미확인)' },

  // ── 정보통신센터 Q동 ────────────────────────────────────
  { id: 'hi-q-8f-study-room', kind: '스터디룸', buildingName: '정보통신센터 Q동', floor: 8, note: '프레젠테이션룸' },
  { id: 'hi-q-1f-nap-room', kind: '수면실', buildingName: '정보통신센터 Q동', floor: 1, note: '여학생 휴게실' },
  { id: 'hi-q-outdoor-smoking-01', kind: '흡연구역', buildingName: '정보통신센터 Q동', note: "지도 표기 '흡연 구역' · H동 남측·Q동 서측 연결부 인근" },
  { id: 'hi-q-building-elevator', kind: '엘리베이터', buildingName: '정보통신센터 Q동', note: '지도상 엘리베이터 표기(정확한 층 미확인)' },

  // ── 제4강의동 Z4동 ──────────────────────────────────────
  { id: 'hi-z4-building-elevator', kind: '엘리베이터', buildingName: '제4강의동 Z4동' },

  // ── 문헌관 MH동 ─────────────────────────────────────────
  { id: 'hi-mh-16f-restaurant', kind: '식당', buildingName: '문헌관 MH동', floor: 16, note: '교직원식당' },
  { id: 'hi-mh-1f-printer', kind: '프린터', buildingName: '문헌관 MH동', floor: 1 },
  { id: 'hi-mh-1f-certificate-kiosk', kind: '증명서 발급', buildingName: '문헌관 MH동', floor: 1, note: '증명서 출력기' },
  { id: 'hi-mh-outdoor-smoking-01', kind: '흡연구역', buildingName: '문헌관 MH동', note: '문헌관 앞 야외 흡연구역' },
  { id: 'hi-mh-building-elevator', kind: '엘리베이터', buildingName: '문헌관 MH동' },

  // ── 미술학관 F동 ────────────────────────────────────────
  { id: 'hi-f-1f-printer', kind: '프린터', buildingName: '미술학관 F동', floor: 1, note: '공용PC실' },
  { id: 'hi-f-outdoor-smoking-01', kind: '흡연구역', buildingName: '미술학관 F동', note: 'F동 야외 흡연구역' },

  // ── 미술종합강의동 U동 ──────────────────────────────────
  { id: 'hi-u-building-elevator', kind: '엘리베이터', buildingName: '미술종합강의동 U동' },

  // ── 제4공학관 T동 ───────────────────────────────────────
  { id: 'hi-t-4f-reading-room', kind: '열람실', buildingName: '제4공학관 T동', floor: 4 },
  { id: 'hi-t-3f-reading-room', kind: '열람실', buildingName: '제4공학관 T동', floor: 3 },
  { id: 'hi-t-outdoor-smoking-01', kind: '흡연구역', buildingName: '제4공학관 T동', note: 'T동 주차장 야외 흡연구역' },
  { id: 'hi-t-building-elevator', kind: '엘리베이터', buildingName: '제4공학관 T동' },

  // ── 인문사회관 B동 ──────────────────────────────────────
  { id: 'hi-b-1f-printer', kind: '프린터', buildingName: '인문사회관 B동', floor: 1, note: '공용PC실' },
  // 원표는 floor_id가 비어 있으나 location_detail에 "1층"이 명시돼 있어 그대로 반영
  { id: 'hi-b-1f-outdoor-smoking-01', kind: '흡연구역', buildingName: '인문사회관 B동', floor: 1, note: 'B동 1층 흡연구역 (야외)' },
  { id: 'hi-b-building-elevator', kind: '엘리베이터', buildingName: '인문사회관 B동' },

  // ── 인문사회관 A동 ──────────────────────────────────────
  { id: 'hi-a-1f-cafe', kind: '카페', buildingName: '인문사회관 A동', floor: 1, note: '카페드림' },
  { id: 'hi-a-2f-cafe', kind: '카페', buildingName: '인문사회관 A동', floor: 2, note: '카페드림' },
  { id: 'hi-a-building-elevator', kind: '엘리베이터', buildingName: '인문사회관 A동' },

  // ── 이천득관 Z2동 ───────────────────────────────────────
  { id: 'hi-z2-building-elevator', kind: '엘리베이터', buildingName: '이천득관 Z2동' },

  // ── 제2기숙사 ───────────────────────────────────────────
  { id: 'hi-dorm2-b1f-cafe', kind: '카페', buildingName: '제2기숙사', floor: -1, note: '캠퍼' },
  { id: 'hi-dorm2-b1f-convenience-store', kind: '편의점', buildingName: '제2기숙사', floor: -1, note: '이마트24' },
  { id: 'hi-dorm2-b1f-restaurant', kind: '식당', buildingName: '제2기숙사', floor: -1, note: '향차이' },
  { id: 'hi-dorm2-b2f-restaurant-01', kind: '식당', buildingName: '제2기숙사', floor: -2, note: '학생식당' },
  { id: 'hi-dorm2-b2f-restaurant-02', kind: '식당', buildingName: '제2기숙사', floor: -2, note: '맘스터치' },
  { id: 'hi-dorm2-b2f-reading-room', kind: '열람실', buildingName: '제2기숙사', floor: -2, note: '기숙사 열람실' },
  { id: 'hi-dorm2-1f-outdoor-smoking-01', kind: '흡연구역', buildingName: '제2기숙사', floor: 1, note: '기숙사 1층 야외 흡연장' },
  { id: 'hi-dorm2-building-elevator', kind: '엘리베이터', buildingName: '제2기숙사' },

  // ── 인문사회관 C동 ──────────────────────────────────────
  { id: 'hi-c-4f-printer', kind: '프린터', buildingName: '인문사회관 C동', floor: 4, note: '공용PC실' },
  { id: 'hi-c-8f-cafe', kind: '카페', buildingName: '인문사회관 C동', floor: 8, note: '카페나무' },
  { id: 'hi-c-8f-outdoor-smoking-01', kind: '흡연구역', buildingName: '인문사회관 C동', floor: 8, note: 'C8 흡연구역 (야외)' },
  { id: 'hi-c-building-elevator', kind: '엘리베이터', buildingName: '인문사회관 C동' },

  // ── 인문사회관 D동 ──────────────────────────────────────
  { id: 'hi-d-b1f-nap-room', kind: '수면실', buildingName: '인문사회관 D동', floor: -1, note: '남학생 휴게실' },
  { id: 'hi-d-building-elevator', kind: '엘리베이터', buildingName: '인문사회관 D동' },
]
