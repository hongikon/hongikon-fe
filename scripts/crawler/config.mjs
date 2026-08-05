// 크롤링 대상 게시판과 기본 설정.
//
// 게시판 항목의 키:
//   boardKey             생성되는 id 의 접두사 (예: ce-154811)
//   listUrl              목록 URL
//   tableSummary         게시판 <table summary="..."> 값. 페이지의 다른 링크를 배제하는 데 쓴다
//   source               표시용 출처명
//   sourceId             앱의 구독 단위 id
//   maxItems             이 게시판에서 가져올 최대 건수
//   parser               쓰는 CMS. parsers.mjs 의 이름. 없으면 'hongik'(.do 게시판)
//   excludeTitlePattern  제목이 이 패턴에 걸리면 제외한다
//   preferWriterAsSource 상세의 작성 부서를 source 로 쓸지 여부
//
// crawl.mjs 는 sourceIdByCategory(분류 라벨 → sourceId 매핑)도 지원한다.
// 지금은 대학공지를 분류별 URL 로 나눠 받아서 쓰는 곳이 없다.

const UNIVERSITY_NOTICE_URL = 'https://www.hongik.ac.kr/kr/education/notice-undergrad.do'
const UNIVERSITY_TABLE = '교육-대학공지'

/**
 * 대학공지 분류 하나에서 가져올 건수.
 * 앱 목록이 스크롤에 따라 이어 붙는 구조라, 넘겨보는 만큼은 쌓여 있어야 한다.
 */
const UNIVERSITY_MAX_ITEMS = 100

/**
 * 대학공지 게시판의 분류 탭.
 *
 * srCategoryId 를 붙이면 그 분류만 받아온다. 예전에는 '전체' 목록을 훑고 행에 붙은
 * 분류 라벨로 갈랐는데, 그러면 글이 많은 분류가 목록을 다 차지해서
 * 학생상담·교수학습지원 같은 분류는 한두 건밖에 못 건졌다.
 *
 * '세종캠퍼스'(id 25)는 아예 요청하지 않는다.
 * '대학혁신지원사업'(id 536) 안에는 '대학교육혁신사업단' 이라는 옛 라벨의 글이 섞여 있는데
 * 같은 영역이라 한 구독 단위로 받는다.
 */
const UNIVERSITY_CATEGORIES = [
  { sourceId: '학사', categoryId: 23 },
  { sourceId: '장학', categoryId: 24 },
  { sourceId: '교수학습지원', categoryId: 534 },
  { sourceId: '학생상담', categoryId: 535 },
  { sourceId: '대학혁신지원사업', categoryId: 536 },
  { sourceId: '학생활동', categoryId: 537 },
]

/**
 * 분류는 세종캠퍼스가 아닌데 실제로는 세종 공지인 글을 걸러낸다.
 * 400건 기준 11건이 이렇게 잘못 분류돼 있었다 (예: "[세종캠퍼스] 재입학 추가 접수 안내").
 *
 * '세종'만으로 거르면 안 된다. 서울 학생 대상인 "학점교류 안내 (세종대학교)",
 * "[세종연구원] 세종이도인재장학금", "HUSS in 세종(세종시 탐방)" 까지 날아간다.
 */
const SEJONG_TITLE = /세종캠퍼스/

/**
 * 학과 게시판.
 *
 * sourceId 는 앱 TREE_DATA(src/constants/news.ts)의 학과 id 와 반드시 같아야 한다.
 * 그래야 구독·학과별 목록에 붙는다. 한 학과가 게시판을 여러 개 두는 경우
 * (취업/인턴, 자료실 등) sourceId 를 같게 해서 한 구독 단위로 묶는다.
 *
 * 신소재공학전공·화학공학전공은 TREE_DATA 에서 '신소재화공시스템공학부' 아래
 * 전공 단위로 나뉘어 있어 각각 따로 구독된다.
 */
const RAW_DEPARTMENT_BOARDS = [
  {
    boardKey: 'ce',
    sourceId: '컴퓨터공학과',
    source: '컴퓨터공학과',
    listUrl: 'https://wwwce.hongik.ac.kr/wwwce/0401.do',
    tableSummary: '학과 공지사항',
  },
  {
    boardKey: 'ce-job',
    sourceId: '컴퓨터공학과',
    source: '컴퓨터공학과 취업·인턴',
    listUrl: 'https://wwwce.hongik.ac.kr/wwwce/0402.do',
    tableSummary: '취업인턴',
  },
  {
    boardKey: 'ee',
    sourceId: '전자전기공학부',
    source: '전자전기공학부',
    listUrl: 'https://ee.hongik.ac.kr/ee/0501.do',
    tableSummary: '학부 게시판',
  },
  {
    boardKey: 'mse',
    sourceId: '신소재공학전공',
    source: '신소재공학전공',
    listUrl: 'https://mse.hongik.ac.kr/mse/0501.do',
    tableSummary: '학과게시판',
  },
  {
    boardKey: 'chem',
    sourceId: '화학공학전공',
    source: '화학공학전공',
    listUrl: 'https://chemeng.hongik.ac.kr/chemeng/sub/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'chem-job',
    sourceId: '화학공학전공',
    source: '화학공학전공 인턴·취업',
    listUrl: 'https://chemeng.hongik.ac.kr/chemeng/sub/0402.do',
    tableSummary: '인턴 / 취업',
  },
  {
    boardKey: 'ie',
    sourceId: '산업데이터공학과',
    source: '산업·데이터공학과',
    listUrl: 'https://ie.hongik.ac.kr/ie/0401.do',
    tableSummary: '학과 공지사항',
  },
  {
    boardKey: 'ie-job',
    sourceId: '산업데이터공학과',
    source: '산업·데이터공학과 채용',
    listUrl: 'https://ie.hongik.ac.kr/ie/0402.do',
    tableSummary: '채용 공지사항',
  },
  {
    boardKey: 'me',
    sourceId: '기계시스템디자인공학과',
    source: '기계·시스템디자인공학과',
    listUrl: 'https://me.hongik.ac.kr/me/0701.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'me-doc',
    sourceId: '기계시스템디자인공학과',
    source: '기계·시스템디자인공학과 자료실',
    listUrl: 'https://me.hongik.ac.kr/me/0702.do',
    tableSummary: '자료실',
  },
  {
    boardKey: 'civil',
    sourceId: '건설환경공학과',
    source: '건설환경공학과',
    listUrl: 'https://civil.hongik.ac.kr/civil/0401.do',
    tableSummary: '학과공지',
  },
  {
    boardKey: 'civil-gen',
    sourceId: '건설환경공학과',
    source: '건설환경공학과 일반공지',
    listUrl: 'https://civil.hongik.ac.kr/civil/0402.do',
    tableSummary: '일반공지',
  },

  // 건축도시대학 — 건축학부는 학교 본부와 다른 PHP CMS 를 쓴다.
  // 건축학전공(5년제)과 실내건축학전공이 한 게시판을 같이 쓴다.
  {
    boardKey: 'arch',
    sourceId: '건축학부',
    source: '건축학부',
    listUrl: 'https://arch.hongik.ac.kr/kor/news/notice.php',
    parser: 'arch',
  },
  {
    boardKey: 'arch-ev',
    sourceId: '건축학부',
    source: '건축학부 행사',
    listUrl: 'https://arch.hongik.ac.kr/kor/news/event.php',
    parser: 'arch',
  },
  // 도시공학과. 앱 TREE_DATA 의 노드 이름은 '도시학과'라 sourceId 는 그쪽에 맞춘다.
  // Imweb 사이트라 상세는 받지 않는다(미리보기가 빈다).
  {
    boardKey: 'urban',
    sourceId: '도시학과',
    source: '도시공학과',
    listUrl: 'https://urban.hongik.ac.kr/114',
    parser: 'imweb',
  },

  // 경제학부
  {
    boardKey: 'econ',
    sourceId: '경제학부',
    source: '경제학부',
    listUrl: 'https://economics.hongik.ac.kr/economics/0401.do',
    tableSummary: '공지사항',
  },

  // 경영대학
  {
    boardKey: 'biz',
    sourceId: '경영학부',
    source: '경영학부',
    listUrl: 'https://bizadmin.hongik.ac.kr/bizadmin/0401.do',
    tableSummary: '공지사항',
  },

  // 문과대학
  {
    boardKey: 'eng',
    sourceId: '영어영문학과',
    source: '영어영문학과',
    listUrl: 'https://english.hongik.ac.kr/english/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'ger',
    sourceId: '독어독문학과',
    source: '독어독문학과',
    listUrl: 'https://german.hongik.ac.kr/german/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'fra',
    sourceId: '불어불문학과',
    source: '불어불문학과',
    listUrl: 'https://france.hongik.ac.kr/france/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'kor',
    sourceId: '국어국문학과',
    source: '국어국문학과',
    listUrl: 'https://hkorean.hongik.ac.kr/hkorean/0401.do',
    tableSummary: '공지사항',
  },

  // 법과대학
  {
    boardKey: 'law',
    sourceId: '법학부',
    source: '법학부',
    listUrl: 'https://law.hongik.ac.kr/law/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'law-job',
    sourceId: '법학부',
    source: '법학부 취업정보',
    listUrl: 'https://law.hongik.ac.kr/law/0403.do',
    tableSummary: '취업정보',
  },

  // 사범대학
  {
    boardKey: 'edu',
    sourceId: '교육학과',
    source: '교육학과',
    listUrl: 'https://edu.hongik.ac.kr/edu/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'koredu',
    sourceId: '국어교육과',
    source: '국어교육과',
    listUrl: 'https://koredu.hongik.ac.kr/koredu/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'mathedu',
    sourceId: '수학교육과',
    source: '수학교육과',
    listUrl: 'https://math.hongik.ac.kr/math/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'engedu',
    sourceId: '영어교육과',
    source: '영어교육과',
    listUrl: 'https://engedu.hongik.ac.kr/engedu/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'hisedu',
    sourceId: '역사교육과',
    source: '역사교육과',
    listUrl: 'https://hisedu.hongik.ac.kr/hisedu/0401.do',
    tableSummary: '공지사항',
  },

  // 미술대학
  {
    boardKey: 'orip',
    sourceId: '동양화과',
    source: '동양화과',
    listUrl: 'https://orip.hongik.ac.kr/orip/0401.do',
    tableSummary: '공지사항',
  },
  {
    // 받은 목록에는 회화과도 printmk 로 적혀 있었지만 그건 판화과(printmaking) 주소다.
    // 회화과는 painting.hongik.ac.kr 에 따로 있다.
    boardKey: 'painting',
    sourceId: '회화과',
    source: '회화과',
    listUrl: 'https://painting.hongik.ac.kr/painting/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'printmk',
    sourceId: '판화과',
    source: '판화과',
    listUrl: 'https://printmk.hongik.ac.kr/printmk/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'scu',
    sourceId: '조소과',
    source: '조소과',
    listUrl: 'https://scu.hongik.ac.kr/scu/0401.do',
    tableSummary: '공지사항',
  },
  // 시각디자인전공(sidi.hongik.ac.kr/news)은 자바스크립트로 그리는 사이트라
  // 지금 방식으로는 목록을 읽을 수 없어 뺐다.
  {
    boardKey: 'id',
    sourceId: '디자인학부',
    source: '산업디자인전공',
    listUrl: 'https://id.hongik.ac.kr/id/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'metalart',
    sourceId: '금속조형디자인과',
    source: '금속조형디자인과',
    listUrl: 'https://metalart.hongik.ac.kr/metalart/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'cer',
    sourceId: '도예유리과',
    source: '도예유리과',
    listUrl: 'https://cer.hongik.ac.kr/cer/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'waf',
    sourceId: '목조형가구학과',
    source: '목조형가구학과',
    listUrl: 'https://waf.hongik.ac.kr/waf/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'textile',
    sourceId: '섬유미술패션디자인과',
    source: '섬유미술패션디자인과',
    listUrl: 'https://textile.hongik.ac.kr/textile/0401.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'art',
    sourceId: '예술학과',
    source: '예술학과',
    listUrl: 'https://art.hongik.ac.kr/art/0401.do',
    tableSummary: '공지사항',
  },

  // 공연예술학부 — 전공별로 게시판이 따로 있다.
  {
    boardKey: 'musical',
    sourceId: '뮤지컬전공',
    source: '뮤지컬전공',
    listUrl: 'https://musical.hongik.ac.kr/musical/0501.do',
    tableSummary: '공지사항',
  },
  {
    boardKey: 'music',
    sourceId: '실용음악전공',
    source: '실용음악전공',
    listUrl: 'https://music.hongik.ac.kr/music/0501.do',
    tableSummary: '공지사항',
  },

  // 디자인예술경영학부 — 전공이 둘이지만 게시판은 학부 하나뿐이라
  // TREE_DATA 에 학부 공지용 노드를 따로 두고 거기에 붙인다.
  {
    boardKey: 'iim',
    sourceId: '디자인예술경영학부',
    source: '디자인예술경영학부',
    listUrl: 'https://iim.hongik.ac.kr/iim/0401.do',
    tableSummary: '공지사항',
  },
]

/** 학과 게시판 하나에서 가져올 최대 건수. 게시판에 글이 적으면 그만큼만 들어온다. */
const DEPARTMENT_MAX_ITEMS = 100

const DEPARTMENT_BOARDS = RAW_DEPARTMENT_BOARDS.map((board) => ({
  ...board,
  maxItems: DEPARTMENT_MAX_ITEMS,
}))

/**
 * 대학공지는 분류마다 따로 받는다.
 *
 * boardKey 는 여섯 개 모두 'univ' 로 같다. articleNo 가 학교 CMS 전체에서 유일해서
 * id 가 겹치지 않고, 나중에 분류를 옮겨도 같은 글이면 같은 id 로 남는다.
 */
const UNIVERSITY_BOARDS = UNIVERSITY_CATEGORIES.map(({ sourceId, categoryId }) => ({
  boardKey: 'univ',
  sourceId,
  // 상세를 안 받았을 때의 표시명 겸 진행 로그 이름. 여섯 개가 구분돼야 한다.
  source: `대학공지 ${sourceId}`,
  listUrl: `${UNIVERSITY_NOTICE_URL}?srCategoryId=${categoryId}`,
  tableSummary: UNIVERSITY_TABLE,
  maxItems: UNIVERSITY_MAX_ITEMS,
  // 분류가 세종캠퍼스가 아닌데 제목에 [세종캠퍼스]가 붙은 글이 섞여 있다.
  excludeTitlePattern: SEJONG_TITLE,
  // 상세에 '학사지원팀' 같은 담당 부서가 있어 그걸 출처로 쓰는 편이 정확하다.
  preferWriterAsSource: true,
}))

export const BOARDS = [...DEPARTMENT_BOARDS, ...UNIVERSITY_BOARDS]

/** 한 번의 목록 요청으로 가져올 게시글 수. 사이트가 200 까지 허용하는 것을 확인했다. */
export const PAGE_SIZE = 50

/** 기본으로 훑을 목록 페이지 수. --pages 로 덮어쓸 수 있다. */
export const DEFAULT_PAGES = 2

/** 연속 요청 사이 대기(ms). 학교 서버에 부담을 주지 않기 위한 최소한의 예의. */
export const REQUEST_DELAY_MS = 400

/** 요청 실패 시 재시도 횟수와 타임아웃. */
export const MAX_RETRIES = 3
export const REQUEST_TIMEOUT_MS = 15_000

/** 상세 본문에서 잘라 쓸 미리보기 길이. */
export const PREVIEW_LENGTH = 160

export const USER_AGENT = 'HongikAlimi-NewsBot/1.0 (student project)'
