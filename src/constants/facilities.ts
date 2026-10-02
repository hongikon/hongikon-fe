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
 * 불명확한 항목("L층"·"N층")은 통째로 제외했다.
 * `HI_E_BUILDING_ELEVATOR` 행은 `buildings.ts` 에 대응하는 "E동" 건물이 없어
 * 제외했다(공식 캠퍼스맵상 E동 = 조형관이지만, 엘리베이터 칩은 숨겨져 있어 넣지 않았다).
 *
 * 2026-10-02 학교 공식 홈페이지(시설 안내·행정부서 안내) 기준으로 층·호수 보정 — 학기 초 사람이 다시 확인
 * (출처: hongik.ac.kr 편의시설·공용컴퓨터실·인터넷 증명발급·행정기관·부속기관 안내).
 * 공식 안내와 어긋난 항목은 고치거나 뺐다 — F동 1층 프린터(공식상 프린터 없는 강의용 PC실).
 * R동 L층 증명서 출력기는 공식 안내에 없지만 사용자가 현장 확인(10-02)해 남겼다.
 * '학과사무실'은 학과 소개 페이지가 불러오는 학과 정보(dept_info.php, 비공식 내부 API)
 * 기준이다 — 위치 미기재·대학로캠퍼스 학과(무역학·디자인경영·예술경영·지능로봇공학전공,
 * 공연예술학부·뮤지컬·실용음악·공연예술전공)는 넣지 않았다. 같은 호실을 쓰는 학과는 한 줄로 묶었다.
 * 공식 표기 "홍문관(R동) 로비층"은 같은 신한은행을 다른 공식 페이지가 "홍문관 1층"으로
 * 적고 있어 `floor: 1` 로 본다(신뢰도 중간 — 현장 확인 필요).
 */
export const FACILITIES: readonly Facility[] = [
  // ── 홍문관 R동 ──────────────────────────────────────────
  { id: 'hi-r-16f-restaurant', kind: '식당', buildingName: '홍문관 R동', floor: 16, note: '마루샤브(뷔페) · 11:30~21:30' },
  { id: 'hi-r-9f-printer', kind: '프린터', buildingName: '홍문관 R동', floor: 9, note: 'PC실 · 915호 (프린터 쿼터 충전기)' },
  { id: 'hi-r-8f-reading-room', kind: '열람실', buildingName: '홍문관 R동', floor: 8, note: '법학도서관 열람실 · 노트북열람실 06:00~23:00' },
  { id: 'hi-r-8f-study-room', kind: '스터디룸', buildingName: '홍문관 R동', floor: 8, note: '공동학습실' },
  { id: 'hi-r-7f-printer', kind: '프린터', buildingName: '홍문관 R동', floor: 7, note: '시각디자인과 프린트실' },
  { id: 'hi-r-3f-convenience-store', kind: '편의점', buildingName: '홍문관 R동', floor: 3, note: '바이스마트' },
  { id: 'hi-r-2f-cafe-01', kind: '카페', buildingName: '홍문관 R동', floor: 2, note: '파브리카' },
  { id: 'hi-r-2f-cafe-02', kind: '카페', buildingName: '홍문관 R동', floor: 2, note: '그라찌에' },
  { id: 'hi-r-2f-exhibition', kind: '행사·전시', buildingName: '홍문관 R동', floor: 2, note: '현대미술관(HoMA) 2관' },
  // 공식 표기 "로비층"을 1층으로 봄(신뢰도 중간). L층 스터디룸(세미나실)은 여전히 미확인이라 제외.
  // L층 증명서 출력기는 공식 안내(문헌관 MH동 1층만 나옴)에는 없지만 2026-10-02 사용자가 현장에서 확인해 둔다.
  { id: 'hi-r-1f-cafe', kind: '카페', buildingName: '홍문관 R동', floor: 1, note: '카페나무 · 로비층(L)' },
  { id: 'hi-r-1f-certificate-kiosk', kind: '증명서 발급', buildingName: '홍문관 R동', floor: 1, note: '증명서 출력기 · 로비층(L) · 현장 확인됨(10-02 사용자)' },
  { id: 'hi-r-b2f-cafe', kind: '카페', buildingName: '홍문관 R동', floor: -2, note: '푸르타(과일주스전문점)' },
  { id: 'hi-r-b2f-printer', kind: '프린터', buildingName: '홍문관 R동', floor: -2, note: '출력센터(에이제이네트웍스)' },
  { id: 'hi-r-building-elevator', kind: '엘리베이터', buildingName: '홍문관 R동', note: '지도상 엘리베이터 표기(정확한 층 미확인)' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-r-15f-dept-biohealth', kind: '학과사무실', buildingName: '홍문관 R동', floor: 15, note: '바이오헬스융합학부 사무실 · 1506호 · 02-2098-2853' },
  { id: 'hi-r-8f-dept-law', kind: '학과사무실', buildingName: '홍문관 R동', floor: 8, note: '법과대학·법학부 사무실 · 812호 · 02-320-3152' },
  { id: 'hi-r-7f-dept-visual-design', kind: '학과사무실', buildingName: '홍문관 R동', floor: 7, note: '시각디자인전공 사무실 · 709호 · 02-320-1214' },

  // ── 제1공학관 K동 ───────────────────────────────────────
  { id: 'hi-k-6f-printer', kind: '프린터', buildingName: '제1공학관 K동', floor: 6, note: '공대 PC실 · 611호' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-k-4f-dept-materials', kind: '학과사무실', buildingName: '제1공학관 K동', floor: 4, note: '신소재화공시스템공학부·신소재공학전공 사무실 · 412호 · 02-320-1127' },
  { id: 'hi-k-3f-dept-urban', kind: '학과사무실', buildingName: '제1공학관 K동', floor: 3, note: '도시공학과·스마트도시데이터사이언스전공 사무실 · 310호 · 02-320-1107' },
  { id: 'hi-k-2f-dept-engineering', kind: '학과사무실', buildingName: '제1공학관 K동', floor: 2, note: '공과대학 사무실 · 204호 · 02-320-1102' },
  { id: 'hi-k-1f-dept-mechanical', kind: '학과사무실', buildingName: '제1공학관 K동', floor: 1, note: '기계·시스템디자인공학과 사무실 · 102호 · 02-320-1125' },

  // ── 체육관 ──────────────────────────────────────────────
  { id: 'hi-gym-building-elevator', kind: '엘리베이터', buildingName: '체육관' },

  // ── 제3공학관 J동 ───────────────────────────────────────
  { id: 'hi-j-building-elevator', kind: '엘리베이터', buildingName: '제3공학관 J동', note: '지도상 엘리베이터 표기(정확한 층 미확인)' },

  // ── 와우관 L동 ──────────────────────────────────────────
  { id: 'hi-l-4f-cafe', kind: '카페', buildingName: '와우관 L동', floor: 4, note: '카페나무' },
  { id: 'hi-l-building-elevator', kind: '엘리베이터', buildingName: '와우관 L동' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-l-1f-dept-architecture', kind: '학과사무실', buildingName: '와우관 L동', floor: 1, note: '건축도시대학·건축학부·건축공간예술전공 사무실 · 101호 · 02-320-1106' },

  // ── 과학관 I동 ──────────────────────────────────────────
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-i-5f-dept-chemical', kind: '학과사무실', buildingName: '과학관 I동', floor: 5, note: '화학공학전공 사무실 · 501호 · 02-320-1129' },
  { id: 'hi-i-3f-dept-science', kind: '학과사무실', buildingName: '과학관 I동', floor: 3, note: '기초과학과 사무실 · 313호 · 02-320-1134' },

  // ── 중앙도서관 H동 ──────────────────────────────────────
  { id: 'hi-h-3f-printer', kind: '프린터', buildingName: '중앙도서관 H동', floor: 3, note: '공용PC실' },
  { id: 'hi-h-3f-cafe', kind: '카페', buildingName: '중앙도서관 H동', floor: 3, note: '카페ing' },
  { id: 'hi-h-3f-study-room', kind: '스터디룸', buildingName: '중앙도서관 H동', floor: 3, note: '그룹 스터디룸' },
  // 공식 안내는 열람팀 업무 설명에서만 확인(신뢰도 중간)
  { id: 'hi-h-2f-lounge', kind: '라운지', buildingName: '중앙도서관 H동', floor: 2, note: '크리에이티브라운지' },
  { id: 'hi-h-1f-study-room', kind: '스터디룸', buildingName: '중앙도서관 H동', floor: 1, note: '캐럴/미디어룸' },
  { id: 'hi-h-building-elevator', kind: '엘리베이터', buildingName: '중앙도서관 H동' },

  // ── 학생회관 G동 ────────────────────────────────────────
  { id: 'hi-g-6f-reading-room', kind: '열람실', buildingName: '학생회관 G동', floor: 6, note: '일반열람실 3' },
  { id: 'hi-g-5f-reading-room-01', kind: '열람실', buildingName: '학생회관 G동', floor: 5, note: '일반열람실 1' },
  { id: 'hi-g-5f-reading-room-02', kind: '열람실', buildingName: '학생회관 G동', floor: 5, note: '일반열람실 2' },
  { id: 'hi-g-5f-reading-room-03', kind: '열람실', buildingName: '학생회관 G동', floor: 5, note: '노트북 열람실' },
  // 장애학생지원센터는 행정기관 목록엔 1층, 상세 페이지엔 2층 201호 — 상세 페이지를 따름(현장 확인 필요)
  { id: 'hi-g-2f-student-affairs', kind: '학생처', buildingName: '학생회관 G동', floor: 2, note: '학생처 학생지원팀·장학팀·장애학생지원센터 · 201호' },
  { id: 'hi-g-1f-printer', kind: '프린터', buildingName: '학생회관 G동', floor: 1, note: '출력센터(에이제이네트웍스)' },
  { id: 'hi-g-b1f-lounge', kind: '라운지', buildingName: '학생회관 G동', floor: -1 },
  { id: 'hi-g-b1f-study-room', kind: '스터디룸', buildingName: '학생회관 G동', floor: -1, note: '공동학습실' },

  // ── 제2공학관 P동 ───────────────────────────────────────
  // N층 카페/휴게실: 원표에도 "있었음 - 확인필요"로 적혀 있어 제외 — 확인되면 추가
  { id: 'hi-p-building-elevator', kind: '엘리베이터', buildingName: '제2공학관 P동', note: '지도상 엘리베이터 표기(정확한 층 미확인)' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-p-8f-dept-civil', kind: '학과사무실', buildingName: '제2공학관 P동', floor: 8, note: '건설환경공학과 사무실 · 820호 · 02-320-1108' },
  { id: 'hi-p-1f-dept-ee', kind: '학과사무실', buildingName: '제2공학관 P동', floor: 1, note: '전자전기공학부·사물인터넷공학전공 사무실 · 103호 · 02-320-1120' },

  // ── 정보통신센터 Q동 ────────────────────────────────────
  { id: 'hi-q-8f-study-room', kind: '스터디룸', buildingName: '정보통신센터 Q동', floor: 8, note: '프레젠테이션룸' },
  { id: 'hi-q-1f-nap-room', kind: '수면실', buildingName: '정보통신센터 Q동', floor: 1, note: '여학생 휴게실' },
  { id: 'hi-q-building-elevator', kind: '엘리베이터', buildingName: '정보통신센터 Q동', note: '지도상 엘리베이터 표기(정확한 층 미확인)' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-q-2f-dept-free-major', kind: '학과사무실', buildingName: '정보통신센터 Q동', floor: 2, note: '캠퍼스자율전공(서울) 사무실 · 201호 · 02-320-3017' },

  // ── 제4강의동 Z4동 ──────────────────────────────────────
  { id: 'hi-z4-building-elevator', kind: '엘리베이터', buildingName: '제4강의동 Z4동' },

  // ── 문헌관 MH동 ─────────────────────────────────────────
  { id: 'hi-mh-16f-restaurant', kind: '식당', buildingName: '문헌관 MH동', floor: 16, note: '교직원식당' },
  { id: 'hi-mh-1f-printer', kind: '프린터', buildingName: '문헌관 MH동', floor: 1 },
  { id: 'hi-mh-4f-exhibition', kind: '행사·전시', buildingName: '문헌관 MH동', floor: 4, note: '현대미술관(HoMA) 1관' },
  { id: 'hi-mh-3f-museum', kind: '행사·전시', buildingName: '문헌관 MH동', floor: 3, note: '홍익대학교 박물관' },
  { id: 'hi-mh-1f-certificate-kiosk', kind: '증명서 발급', buildingName: '문헌관 MH동', floor: 1, note: '학적증명 무인발급기 · 08:00~21:00' },
  { id: 'hi-mh-building-elevator', kind: '엘리베이터', buildingName: '문헌관 MH동' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-mh-14f-dept-design-engineering', kind: '학과사무실', buildingName: '문헌관 MH동', floor: 14, note: '디자인엔지니어링전공 사무실 · 1405호 · 02-320-3076' },

  // ── 미술학관 F동 ────────────────────────────────────────
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-f-6f-dept-art-studies', kind: '학과사무실', buildingName: '미술학관 F동', floor: 6, note: '예술학과 사무실 · 604-2호 · 02-320-1227' },
  { id: 'hi-f-6f-dept-printmaking', kind: '학과사무실', buildingName: '미술학관 F동', floor: 6, note: '판화과 사무실 · 605호 · 02-320-1208' },
  { id: 'hi-f-2f-dept-sculpture', kind: '학과사무실', buildingName: '미술학관 F동', floor: 2, note: '조소과 사무실 · 201호 · 02-320-1213' },
  { id: 'hi-f-2f-dept-painting', kind: '학과사무실', buildingName: '미술학관 F동', floor: 2, note: '회화과 사무실 · 202호 · 02-320-1206' },
  { id: 'hi-f-2f-dept-fine-arts-college', kind: '학과사무실', buildingName: '미술학관 F동', floor: 2, note: '미술대학·미술대학 자율전공 사무실 · 206호 · 02-320-1202' },

  // ── 조형관 ──────────────────────────────────────────────
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-e-9f-dept-industrial-design', kind: '학과사무실', buildingName: '조형관', floor: 9, note: '산업디자인전공 사무실 · 904호 · 02-320-1215' },
  { id: 'hi-e-4f-dept-metal', kind: '학과사무실', buildingName: '조형관', floor: 4, note: '금속조형디자인과 사무실 · 404-1호 · 02-320-1217' },
  { id: 'hi-e-3f-dept-ceramics', kind: '학과사무실', buildingName: '조형관', floor: 3, note: '도예유리과 사무실 · 301호 · 02-320-1219' },
  { id: 'hi-e-3f-dept-wood', kind: '학과사무실', buildingName: '조형관', floor: 3, note: '목조형가구학과 사무실 · 303호 · 02-320-1223' },

  // ── 미술종합강의동 U동 ──────────────────────────────────
  { id: 'hi-u-building-elevator', kind: '엘리베이터', buildingName: '미술종합강의동 U동' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-u-3f-dept-oriental-painting', kind: '학과사무실', buildingName: '미술종합강의동 U동', floor: 3, note: '동양화과 사무실 · 304호 · 02-320-1205' },

  // ── 제4공학관 T동 ───────────────────────────────────────
  { id: 'hi-t-4f-reading-room', kind: '열람실', buildingName: '제4공학관 T동', floor: 4 },
  { id: 'hi-t-3f-reading-room', kind: '열람실', buildingName: '제4공학관 T동', floor: 3 },
  { id: 'hi-t-building-elevator', kind: '엘리베이터', buildingName: '제4공학관 T동' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-t-9f-dept-industrial', kind: '학과사무실', buildingName: '제4공학관 T동', floor: 9, note: '산업·데이터공학과·데이터사이언스전공 사무실 · 904호 · 02-320-1132' },
  { id: 'hi-t-7f-dept-cs', kind: '학과사무실', buildingName: '제4공학관 T동', floor: 7, note: '컴퓨터공학과 사무실 · 703호 · 02-320-1105' },

  // ── 인문사회관 B동 ──────────────────────────────────────
  { id: 'hi-b-1f-printer', kind: '프린터', buildingName: '인문사회관 B동', floor: 1, note: '경영대학 PC실 · 105호' },
  // 원표는 floor_id가 비어 있으나 location_detail에 "1층"이 명시돼 있어 그대로 반영
  // 좌표: 2026-09-30 사용자 실측(HI_B_1F_흡연장). 원본 (위도, 경도, 고도) 중 앞의 두 값.
  { id: 'hi-b-1f-outdoor-smoking-01', kind: '흡연구역', buildingName: '인문사회관 B동', floor: 1, note: 'B동 1층 흡연구역 (야외)', lat: 37.55062859162865, lng: 126.925791484712 },
  { id: 'hi-b-building-elevator', kind: '엘리베이터', buildingName: '인문사회관 B동' },

  // ── 인문사회관 A동 ──────────────────────────────────────
  { id: 'hi-a-1f-cafe', kind: '카페', buildingName: '인문사회관 A동', floor: 1, note: '카페드림' },
  { id: 'hi-a-2f-cafe', kind: '카페', buildingName: '인문사회관 A동', floor: 2, note: '카페드림' },
  { id: 'hi-a-building-elevator', kind: '엘리베이터', buildingName: '인문사회관 A동' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-a-2f-dept-business', kind: '학과사무실', buildingName: '인문사회관 A동', floor: 2, note: '경영학부·문화예술경영전공 사무실 · 206호 · 02-320-1142' },
  { id: 'hi-a-2f-dept-business-college', kind: '학과사무실', buildingName: '인문사회관 A동', floor: 2, note: '경영대학·경영학전공 사무실 · 208호 · 02-320-1142' },
  { id: 'hi-a-1f-dept-design-arts-mgmt', kind: '학과사무실', buildingName: '인문사회관 A동', floor: 1, note: '디자인·예술경영학부 사무실 · 108호 · 02-320-1168' },

  // ── 이천득관 Z2동 ───────────────────────────────────────
  { id: 'hi-z2-building-elevator', kind: '엘리베이터', buildingName: '이천득관 Z2동' },

  // ── 제2기숙사 ───────────────────────────────────────────
  { id: 'hi-dorm2-b1f-cafe', kind: '카페', buildingName: '제2기숙사', floor: -1, note: '캠퍼' },
  { id: 'hi-dorm2-b1f-convenience-store', kind: '편의점', buildingName: '제2기숙사', floor: -1, note: '이마트24' },
  { id: 'hi-dorm2-b1f-restaurant', kind: '식당', buildingName: '제2기숙사', floor: -1, note: '향차이' },
  { id: 'hi-dorm2-b2f-restaurant-01', kind: '식당', buildingName: '제2기숙사', floor: -2, note: '학생식당' },
  { id: 'hi-dorm2-b2f-restaurant-02', kind: '식당', buildingName: '제2기숙사', floor: -2, note: '맘스터치' },
  { id: 'hi-dorm2-b2f-reading-room', kind: '열람실', buildingName: '제2기숙사', floor: -2, note: '기숙사 열람실' },
  // 좌표: 2026-09-30 사용자 실측(HI_D2_1F_흡연장). 원본 (위도, 경도, 고도) 중 앞의 두 값.
  { id: 'hi-dorm2-1f-outdoor-smoking-01', kind: '흡연구역', buildingName: '제2기숙사', floor: 1, note: '기숙사 1층 야외 흡연장', lat: 37.54929961640159, lng: 126.9250265323808 },
  { id: 'hi-dorm2-building-elevator', kind: '엘리베이터', buildingName: '제2기숙사' },

  // ── 인문사회관 C동 ──────────────────────────────────────
  { id: 'hi-c-4f-printer', kind: '프린터', buildingName: '인문사회관 C동', floor: 4, note: '공용PC실 · 414호 (프린터 쿼터 충전기)' },
  { id: 'hi-c-8f-cafe', kind: '카페', buildingName: '인문사회관 C동', floor: 8, note: '카페나무' },
  { id: 'hi-c-building-elevator', kind: '엘리베이터', buildingName: '인문사회관 C동' },
  // 학과사무실 (학과 소개 페이지 dept_info)
  { id: 'hi-c-6f-dept-english-edu', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 6, note: '영어교육과 사무실 · 627호 · 02-320-1180' },
  { id: 'hi-c-6f-dept-history-edu', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 6, note: '역사교육과 사무실 · 628호 · 02-320-1181' },
  { id: 'hi-c-6f-dept-korean-edu', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 6, note: '국어교육과 사무실 · 629호 · 02-320-1179' },
  { id: 'hi-c-6f-dept-education', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 6, note: '교육학과 사무실 · 630호 · 02-320-1182' },
  { id: 'hi-c-6f-dept-math-edu', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 6, note: '수학교육과 사무실 · 631호 · 02-320-1178' },
  { id: 'hi-c-6f-dept-education-college', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 6, note: '사범대학 사무실 · 633호 · 02-320-1172' },
  { id: 'hi-c-4f-dept-liberal-arts-college', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 4, note: '문과대학 사무실 · 422호 · 02-320-1152' },
  { id: 'hi-c-4f-dept-korean', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 4, note: '국어국문학과 사무실 · 429호 · 02-320-1158' },
  { id: 'hi-c-4f-dept-german', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 4, note: '독어독문학과 사무실 · 430호 · 02-320-1156' },
  { id: 'hi-c-4f-dept-french', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 4, note: '불어불문학과 사무실 · 431호 · 02-320-1157' },
  { id: 'hi-c-4f-dept-english', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 4, note: '영어영문학과 사무실 · 432호 · 02-320-1154' },
  { id: 'hi-c-3f-dept-economics', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 3, note: '경제학부·경제학전공 사무실 · 321호 · 02-320-1165' },
  { id: 'hi-c-1f-dept-general-edu', kind: '학과사무실', buildingName: '인문사회관 C동', floor: 1, note: '교양과 사무실 · 105호 · 02-320-1175' },

  // ── 인문사회관 D동 ──────────────────────────────────────
  { id: 'hi-d-b1f-nap-room', kind: '수면실', buildingName: '인문사회관 D동', floor: -1, note: '남학생 휴게실' },
  { id: 'hi-d-building-elevator', kind: '엘리베이터', buildingName: '인문사회관 D동' },
]
