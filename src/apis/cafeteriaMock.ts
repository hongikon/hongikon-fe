/**
 * 개발 전용 학식 메뉴 목업(`?mock=1`). `cafeteria.ts` 가 `__DEV__` 웹에서만 동적으로 불러온다.
 * 서버 계약(`GET /cafeteria/menus/week`)과 같은 모양으로, 요청한 날짜가 든 주의 월~금을 만든다.
 * 10월 9일(한글날)은 휴무로 둬서 휴무 표시를 확인할 수 있다.
 */
const DAY_MS = 24 * 60 * 60 * 1000

const DORM_MENUS = [
  ['백미밥', '사골파국', '매콤오리훈제볶음', '두부튀김스틱&강정', '깻잎지무침', '배추김치'],
  ['흑미밥', '김치찌개', '돈육간장불고기', '계란말이', '콩나물무침', '깍두기', '요구르트'],
  ['카레라이스', '미소된장국', '치킨가라아게', '양배추샐러드&드레싱', '단무지', '배추김치'],
  ['잡곡밥', '소고기미역국', '고등어구이', '잡채', '시금치나물', '배추김치', '과일'],
  ['볶음밥', '짬뽕국', '탕수육&소스', '짜사이무침', '단무지', '배추김치'],
]

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function weekdays(ymd: string): string[] {
  const base = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
  const dow = new Date(base).getUTCDay()
  const monday = base - ((dow + 6) % 7) * DAY_MS
  return [0, 1, 2, 3, 4].map((i) => new Date(monday + i * DAY_MS).toISOString().slice(0, 10))
}

function rotate<T>(list: readonly T[], by: number): T[] {
  return list.map((_, i) => list[(i + by) % list.length])
}

export async function mockGetCafeteriaWeek(date: string): Promise<unknown> {
  await delay()
  const fetchedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const days = weekdays(date).map((day, index) => {
    const holiday = day.endsWith('-10-09') ? '한글날' : null
    const closed = (meal: string, time: string, price: string) => ({
      meal,
      time,
      price,
      items: holiday ? [holiday] : [],
      closed: true,
    })
    const open = (meal: string, time: string, price: string, items: string[]) =>
      holiday ? closed(meal, time, price) : { meal, time, price, items, closed: false }
    return {
      date: day,
      source: '홍익대학교 홈페이지',
      sourceUrl: 'https://www.hongik.ac.kr/kr/life/seoul-cafeteria.do',
      fetchedAt,
      restaurants: [
        {
          code: 'dorm2',
          facilityId: 'hi-dorm2-b2f-restaurant-01',
          name: '학생식당(제2기숙사)',
          meals: [
            open('아침', '08:00~09:00', '1,000원', ['백미밥', '북엇국', '스크램블에그', '김구이', '배추김치']),
            open('점심A', '11:30~14:00', '5,800원', DORM_MENUS[index % DORM_MENUS.length]),
            open('점심B', '11:30~14:00', '5,800원', rotate(DORM_MENUS, 2)[index % DORM_MENUS.length]),
            // 수요일 저녁은 비워 둬서 "등록된 메뉴가 없어요"를 확인한다.
            index === 2
              ? { meal: '저녁', time: '17:30~18:50', price: '5,800원', items: [], closed: false }
              : open('저녁', '17:30~18:50', '5,800원', rotate(DORM_MENUS, 4)[index % DORM_MENUS.length]),
          ],
        },
        {
          code: 'staff',
          facilityId: 'hi-mh-16f-restaurant',
          name: '교직원식당',
          meals: [
            open('점심', '11:30~14:00', '9,000원', [
              '현미밥',
              '들깨버섯탕',
              '소불고기전골',
              '연어샐러드',
              '감자채볶음',
              '청경채겉절이',
              '포기김치',
              '수정과',
            ]),
            open('저녁', '17:00~18:30', '9,000원', rotate(DORM_MENUS, 1)[index % DORM_MENUS.length]),
          ],
        },
      ],
    }
  })
  return { days }
}
