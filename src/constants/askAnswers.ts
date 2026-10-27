/**
 * '물어보기' 안내 흐름. 고객센터 챗봇처럼 필요한 것만 버튼으로 되물어(내국인/외국 국적, 휴학 종류 …) 상황에 맞는 답에 닿게 한다.
 * 부서 안내(`adminOffices`)보다 먼저 쓴다 — 부서 안내에는 실제 절차·가야 할 곳이 빠져 있다
 * (학생증은 학사지원팀 업무로 적혀 있지만 신청은 신한 쏠 앱, 교부는 문자로 안내된 곳에서 한다).
 * 운영진이 확인했거나 학교 안내 페이지에 적힌 것만 옮기고, 출처와 확인한 날을 남긴다 — 추측으로 채우지 않는다.
 * 절차 안내는 앱 안 화면이 아니라 그 내용을 담은 학교 홈페이지로 보낸다(10-15 요청).
 */

/** 버튼으로 되묻는 단계. 고른 버튼 글자가 사용자 말풍선으로 남는다. */
export interface AskQuestionNode {
  kind: 'question'
  text: string
  options: readonly { label: string; next: string }[]
}

export interface AskLink {
  label: string
  url: string
}

/**
 * 답 안의 한 덩어리(신청 절차·제출서류·표 …). 학교 페이지 내용을 링크로 넘기지 않고 앱 안에서 다 읽히게 옮긴다(10-15 요청).
 * ordered 면 번호 목록(절차), 아니면 점 목록. table 이 있으면 items 보다 먼저 그린다.
 */
export interface AskSection {
  title: string
  items?: readonly string[]
  ordered?: boolean
  table?: { head: readonly string[]; rows: readonly (readonly string[])[] }
}

/** 끝 답. 요약 한두 문장 + 덩어리별 자세한 안내 + 전화·학교 원문 링크(·필요하면 지도 위치). */
export interface AskAnswerNode {
  kind: 'answer'
  /** 맨 위 요약. */
  text: string
  sections?: readonly AskSection[]
  /** 이어서 물어볼 만한 것(같은 흐름의 다른 단계). 답 아래 버튼으로 단다. */
  followUps?: readonly { label: string; next: string }[]
  phones?: readonly { label: string; phone: string }[]
  /** 학교 홈페이지 원문(출처). 내용은 위에 다 옮기고, 원문은 확인용으로 맨 아래에 둔다. 없으면 운영진이 직접 확인한 답. */
  links?: readonly AskLink[]
  /** 실제로 찾아가야 하는 곳이 있을 때만(지도 데이터 시설 id). '위치 보기'로 지도에서 연다. */
  facilityId?: string
}

export type AskNode = AskQuestionNode | AskAnswerNode

export interface AskFlow {
  id: string
  /**
   * 질문에서 흐름으로 들어가는 길. 위에서부터 처음 맞는 것을 쓴다 — 질문이 이미 상황을 말해 주면('학생증 잃어버렸어요',
   * '군입대 휴학') 되묻지 않고 그 답으로 바로 간다.
   * match: 묶음마다 하나 이상의 낱말이 질문에 있어야 한다(묶음끼리 AND, 묶음 안 OR). 질문은 공백·문장부호를 지우고 비교한다.
   * not: 이 낱말이 하나라도 있으면 이 길로 오지 않는다('학생증 재발급'이 증명서 발급으로 새지 않게).
   */
  entries: readonly { match: readonly (readonly string[])[]; node: string; not?: readonly string[] }[]
  nodes: Readonly<Record<string, AskNode>>
  /** 확인한 날(YYYY-MM-DD). */
  checkedAt: string
}

/** 학생증 낱말이 있어도 국제학생증(ISIC) 흐름이 맡는 질문. */
const CARD_NOT = ['국제학생증', 'isic', '학생증명']  // '재학생 증명서'·'휴학생 증명서'는 공백을 지우면 '학생증명'이 생긴다(10-25)
const STUDENT_CARD_PAGE: AskLink = {
  label: '학교 홈페이지 · 학생증발급',
  url: 'https://www.hongik.ac.kr/kr/life/seoul-student-card-issuance.do',
}
const LEAVE_PAGE: AskLink = { label: '학교 홈페이지 · 휴학 안내', url: 'https://www.hongik.ac.kr/kr/education/leave-of-absence.do' }
const UNDERGRAD_NOTICE: AskLink = { label: '학교 홈페이지 · 대학공지', url: 'https://www.hongik.ac.kr/kr/education/notice-undergrad.do' }
const CONSTRUCTION_TEAM_PAGE: AskLink = {
  label: '학교 홈페이지 · 건설관리팀',
  url: 'https://www.hongik.ac.kr/kr/introduction/administrative.do?mode=view&articleNo=28109&dept=A43100',
}

/** 신한은행 홍익대학교 지점 전화·위치(홍문관 R동 로비층)는 학교 홈페이지 편의시설 안내. 지도 시설 id 는 부서 안내에 없어 달지 않는다. */
/** 냉난방 기기 낱말과, 덥다·춥다는 말. */
const AIRCON_WORDS = ['에어컨', '냉방', '난방', '히터', '온풍기', '냉난방기'] as const
const HOT_COLD_WORDS = ['춥', '덥', '추워', '더워', '추움', '더움', '추운', '더운', '쌀쌀', '찜통', '사우나', '얼어죽', '쪄죽'] as const
const AIRCON_NOT = ['기숙사', '생활관']
const SHINHAN_BRANCH_PHONE = { label: '신한은행 홍익대학교 지점(홍문관 로비층)', phone: '02-6023-3950' }
const FACILITY_PAGE: AskLink = { label: '학교 홈페이지 · 편의시설(신한은행)', url: 'https://www.hongik.ac.kr/kr/life/facility.do' }
const UNDERGRAD_RECORD_PHONE = { label: '신청 중 학적정보 조회 오류(학부·학사지원팀)', phone: '02-320-1089' }
/** 학사지원팀 업무별 전화 중 '휴학,복학,제적,전과,재입학'. */
const LEAVE_PHONE = { label: '학사지원팀 · 휴학·복학', phone: '02-320-1037' }
/** 휴학 낱말이 있어도 다른 흐름(복학·증명서·제적·국가장학·기숙사·학생증)이 맡는 질문. */
const LEAVE_NOT = ['복학', '증명', '제적', '미복학', '국가장학', '국장', '기숙사', '학생증', '휴학생']

/** 정보전산원(정보통신센터 Q동). 무선랜 문의 전화는 학교 Hongik WIFI 안내, 메일 전화는 부서 안내 '서버관리, 이메일' 줄. */
const IT_CENTER_ID = 'hi-q-10f-office-01'
const WIFI_PHONE = { label: '정보전산원 · 무선랜(Q동 906호)', phone: '02-320-1405' }
const WIFI_PAGE: AskLink = { label: '학교 홈페이지 · Hongik WIFI', url: 'https://www.hongik.ac.kr/kr/life/hongik-wifi.do' }
/** 와이파이는 기기별로 따라 하는 설정 설명서가 학교 소개 페이지보다 쓸모 있어 앞에 둔다(10-16 운영진). */
const WIFI_GUIDE: AskLink = { label: '무선랜 안내 · 기기별 설정 설명서', url: 'https://wifi.hongik.ac.kr/hongik_wifi/' }
/** 질문의 문장부호는 지우고 비교하므로 'Wi-Fi'·'Hongik_wifi' 도 'wifi' 로 걸린다. */
const WIFI_WORDS = ['와이파이', '와파', 'wifi', '무선랜', '무선인터넷', '인터넷'] as const
/** '인터넷증명발급'·'인터넷강의'처럼 인터넷이 들어간 다른 일. */
const WIFI_NOT = ['증명', '인터넷강의', '인강', '사이버', '수강', '등록금', '고지서']
const MAIL_PHONE = { label: '정보전산원 · 서버·이메일', phone: '02-320-3467' }
const MAIL_WORDS = ['메일', '이메일', 'gmail', '지메일', '쥐메일', 'office365', '오피스365', '아웃룩', 'outlook'] as const
/** 메일 낱말이 들어가도 다른 일('증명서 이메일 발급', '휴학 소급 서류 메일 제출')인 질문. */
const MAIL_NOT = ['증명', '제출', '휴학', '장학', '성적', '학생증', '매트랩', 'matlab']

/** 건강진료센터(학생회관 G동 1층) — 학교 홈페이지 부속기관 안내. 총무팀 — 부서 안내 담당정보 표. */
const HEALTH_CENTER_ID = 'hi-g-1f-office-02'
const HEALTH_PHONE = { label: '건강진료센터(학생회관 G동 1층)', phone: '02-320-1375' }
const HEALTH_PAGE: AskLink = {
  label: '학교 홈페이지 · 건강진료센터',
  url: 'https://www.hongik.ac.kr/kr/introduction/subsidiary.do?mode=view&articleNo=78386&dept=AC1210',
}
const INJURY_WORDS = ['다쳤', '다치', '부상', '상처', '넘어졌', '넘어져', '삐었', '삐끗', '접질', '골절', '화상', '베였', '찢어졌', '피나', '피가나', '까졌'] as const
/** '화상강의'·'국민건강보험'처럼 낱말만 겹치는 다른 일. */
const INJURY_NOT = ['화상강의', '화상회의', '화상수업', '국민건강보험', '건강보험료', '유학생보험', '자동차보험', '고용보험', '커피']
const GENERAL_AFFAIRS_ID = 'hi-mh-1f-office-02'
const GENERAL_AFFAIRS_PAGE: AskLink = {
  label: '학교 홈페이지 · 총무팀',
  url: 'https://www.hongik.ac.kr/kr/introduction/administrative.do?mode=view&articleNo=28067&dept=A41100',
}

export const ASK_FLOWS: readonly AskFlow[] = [
  {
    // 학교 홈페이지 휴학 안내(leave-of-absence.do, 2026-10-15 확인)의 내용을 빠짐없이 옮겼다. 링크만 주지 않고 앱 안에서 다 읽히게(10-15 요청).
    id: 'leave-of-absence',
    entries: [
      // '휴학증명서'는 증명서, '휴학 후 복학'은 복학, '휴학하면 국가장학금'은 국가장학 흐름으로 보낸다.
      { match: [['휴학', '군휴학', '군입대휴학'], ['소급']], node: 'military-retro', not: LEAVE_NOT },
      { match: [['휴학', '군휴'], ['군', '입대', '입영'], ['놓쳤', '못했', '안했', '안하고', '깜빡', '지났', '지나서']], node: 'military-retro', not: LEAVE_NOT },
      { match: [['휴학'], ['군입대', '입대', '군대', '군휴학', '입영', '군복무', '군인']], node: 'military', not: LEAVE_NOT },
      { match: [['군휴학', '군입대휴학', '군휴']], node: 'military', not: LEAVE_NOT },
      { match: [['휴학'], ['질병', '아파', '아픈', '병원', '진단서', '소견서', '수술', '입원', '치료', '우울', '병가', '건강']], node: 'sick', not: LEAVE_NOT },
      { match: [['휴학'], ['임신', '출산', '육아', '아기', '아이를', '자녀']], node: 'parental', not: LEAVE_NOT },
      { match: [['휴학'], ['창업', '사업자']], node: 'startup', not: LEAVE_NOT },
      { match: [['휴학'], ['등록금', '환불', '반환', '환급', '이월', '장학금', '학비', '납부', '돈', '내야', '내나']], node: 'tuition', not: ['증명', '국가장학', '국장', '분할납부', '분납', '기숙사', '학생증'] },
      { match: [['휴학'], ['몇학기', '최대', '횟수', '얼마나', '몇번', '연장', '종류', '한도', '제한', '연속', '최장', '더할', '더하']], node: 'limits', not: LEAVE_NOT },
      { match: [['휴학'], ['기간', '언제', '일정', '마감', '클래스넷', '일반휴학', '신입생', '새내기', '1학년', '승인', '반려', '결과']], node: 'general', not: LEAVE_NOT },
      { match: [['휴학']], node: 'start', not: LEAVE_NOT },
    ],
    nodes: {
      start: {
        kind: 'question',
        text: '어떤 휴학을 하려고 하세요? 종류마다 신청 방법이 달라요.',
        options: [
          { label: '일반휴학', next: 'general' },
          { label: '군입대휴학', next: 'military' },
          { label: '질병휴학', next: 'sick' },
          { label: '임신·출산·육아휴학', next: 'parental' },
          { label: '창업(준비)휴학', next: 'startup' },
          { label: '휴학 종류와 몇 학기까지 쉴 수 있는지', next: 'limits' },
          { label: '휴학하면 등록금은 어떻게 되나요?', next: 'tuition' },
        ],
      },
      general: {
        kind: 'answer',
        // 첫 문장은 '언제 신청하나'에 바로 답한다 — '휴학 신청 기간'에 정의('일신상의 사유')부터 말하던 것을 고침(10-25 제보).
        // 기간: 학교 휴학 안내(1월 말·7월 말 공지) + 학사지원팀 공지 '일반휴학기간과 등록금 납부기간은 늘 동일'(news 1021)·수강신청 Q&A '2월 혹은 8월 중 일반휴학'.
        // 10-25: 최신 공지(2026-2 휴·복학 안내 7.13, 추가 휴학 안내 2052)에 맞춰 공지 시기·위치와 추가 휴학 기간을 더했다.
        text: '일반휴학은 1학기는 2월, 2학기는 8월 등록금 납부 기간에 클래스넷 › 학사/학적 › 휴/복학/휴학연장 신청에서 해요. 날짜는 1월·7월 중순~말 학교 홈페이지 교육 › 대학 › 대학공지 › 학사에 올라와요(2026-2학기는 7월 13일). 놓쳤으면 추가 휴학 기간(2026-2학기는 9.11~9.16)에 신청해요.',
        sections: [
          { title: '신청 방법', items: ["클래스넷 › 학사/학적 › '휴/복학/휴학연장' 메뉴에서 신청해요."] },
          {
            title: '신청 기간',
            items: [
              '매 학기 학교 홈페이지 › 대학 › 대학공지에 올라오는 휴학신청 안내를 확인해요.',
              '1학기 휴학: 매년 1월 중순~말 공지',
              '2학기 휴학: 매년 7월 중순~말 공지(2026-2학기는 7월 13일)',
            ],
          },
          {
            title: '꼭 확인하세요',
            items: [
              '도서 미반납, 휴학 가능 횟수 초과 같은 결격사유가 있으면 승인되지 않을 수 있어요. 신청한 뒤 승인 여부를 꼭 확인하세요.',
              '신입생은 입학 후 1년간(1학년 1·2학기) 일반휴학을 신청할 수 없어요. 군입대휴학·질병휴학은 증빙서류를 내면 할 수 있어요.',
              '일반휴학과 질병휴학은 합쳐서 재학 중 최대 6학기, 한 번에 최대 2학기까지예요.',
            ],
          },
        ],
        followUps: [
          { label: '몇 학기까지 쉴 수 있나요?', next: 'limits' },
          { label: '휴학하면 등록금은요?', next: 'tuition' },
        ],
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE, UNDERGRAD_NOTICE],
      },
      military: {
        kind: 'answer',
        text: '군입대휴학은 입영일 10일 전부터 입영일까지 클래스넷으로 신청해요.',
        sections: [
          {
            title: '신청 방법',
            ordered: true,
            items: [
              "클래스넷 › 학사/학적 › '군입대휴학 신청' 메뉴에서 신청해요.",
              '입영일이 적힌 증빙서류(입영통지서, 입영 사실확인서, 병적증명서 등) 중 1부를 올려요.',
              "신청이 반려될 수 있으니 클래스넷 › 학사/학적 › '학적변동조회'에서 승인 여부를 확인해요.",
            ],
          },
          {
            title: '입대 뒤에',
            items: [
              '입대 후 귀가 조처되면 그날부터 5일 안에 학사지원팀에 알려야 해요.',
              '의가사 제대·병역처분 변경 등으로 일찍 전역하면 제대일부터 만 1년 안에 복학해야 해요.',
            ],
          },
          {
            title: '기말고사 전에 입대하면 성적은?',
            items: [
              '성적을 인정받고 싶으면: 클래스넷 군입대휴학 신청 화면에서 성적 대체원서·성적 대체카드를 내려받아, 입영통지서를 들고 과목 교수님께 중간고사·출석 등으로 성적을 대체해 달라고 요청해요.',
              '성적을 인정받지 않으면: 클래스넷에서 군입대휴학만 신청하면 돼요. 그 학기 수강신청 내역이 모두 지워지고, 복학 학기에 등록금이 부과되지 않아요.',
            ],
          },
        ],
        followUps: [{ label: '입대 시기를 놓쳤어요(소급 신청)', next: 'military-retro' }],
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      'military-retro': {
        kind: 'answer',
        // 10-25: 공지 2093(2026-2 휴·복학 안내) — 클래스넷 신청은 입영일 10일 전~입영일까지, 입대일 이후는 소급신청서를 이메일로(서울 support@, 세종 sejongclass@). 근거 없던 '학기 종료일(2학기 8월 31일)' 기준을 뺐다.
        text: '입영일까지 군입대휴학을 신청하지 못했다면 서류를 이메일로 내서 소급 신청해요.',
        sections: [
          {
            title: '먼저 확인하세요',
            items: [
              '클래스넷 군입대휴학 신청은 입영일 10일 전부터 입영일까지만 돼요. 입대일이 지났으면 소급 신청으로 내요(2026-2학기 휴·복학 신청 안내 기준).',
            ],
          },
          {
            title: '신청 절차',
            ordered: true,
            items: [
              '군입대휴학 소급신청서와 사유서를 출력해 자필로 작성해요(양식은 학교 휴학 안내 페이지에 있어요).',
              '소급신청서·사유서와 입대를 증명하는 자료(입영통지서·병적증명서 등)를 support@hongik.ac.kr(세종캠퍼스는 sejongclass@hongik.ac.kr)로 이메일 제출해요.',
            ],
          },
        ],
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE, { label: 'support@hongik.ac.kr 로 메일 쓰기', url: 'mailto:support@hongik.ac.kr' }],
      },
      sick: {
        kind: 'answer',
        text: '질병휴학은 서류를 들고 학사지원팀에 직접 방문해 신청해요.',
        sections: [
          {
            title: '신청 절차',
            ordered: true,
            items: [
              '질병휴학원서를 작성하고 증빙자료를 챙겨요.',
              '건강진료센터에 가서 교의와 면담하고 소견서를 받아요.',
              '장학팀에서 도장을 받아요.',
              '중앙도서관 대출실에서 도장을 받아요.',
              '학사지원팀에 휴학원서를 내요.',
            ],
          },
          {
            title: '제출서류',
            items: [
              '질병휴학원서(교내 양식, 학생 본인과 학부모 도장)',
              '상급종합병원 진단서(4주 이상 입원 또는 통원치료가 필요하다는 내용)',
              '교의 소견서(원서와 진단서를 들고 건강진료센터에서 면담 후 받음)',
              '돌려받을 등록금이 있으면: 학생·학부모 신분증 사본, 가족관계증명서, 학부모 통장 사본',
            ],
          },
          {
            title: '등록금 반환(대학 등록금에 관한 규칙)',
            table: {
              head: ['원서 최종 제출일', '1학기', '2학기', '반환'],
              rows: [
                ['학기 시작 전', '3.1 전', '9.1 전', '전액'],
                ['시작~30일', '3.1~3.30', '9.1~9.30', '수업료 5/6'],
                ['31~60일', '3.31~4.29', '10.1~10.30', '수업료 2/3'],
                ['61~90일', '4.30~5.29', '10.31~11.29', '수업료 1/2'],
                ['90일 지난 뒤', '5.30~', '11.30~', '반환 없음'],
              ],
            },
            items: ['신입생은 학기 시작일(3월 1일, 9월 1일) 이후에만 질병휴학을 받고, 등록금 전액 반환은 안 돼요.'],
          },
        ],
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      parental: {
        kind: 'answer',
        text: '임신·출산·육아휴학은 임신, 출산, 만 8세 이하 자녀 양육 때문에 하는 휴학이에요. 서류를 들고 학사지원팀에 방문 신청해요.',
        sections: [
          {
            title: '신청 절차',
            ordered: true,
            items: [
              '임신·출산·육아휴학원서를 작성하고 증빙자료를 챙겨요.',
              '장학팀에서 도장을 받아요.',
              '중앙도서관 대출실에서 도장을 받아요.',
              '학사지원팀에 휴학원서를 내요.',
            ],
          },
          {
            title: '제출서류',
            items: [
              '임신·출산·육아휴학원서(교내 양식, 학생 본인과 학부모 도장)',
              '진단서 또는 가족관계증명서',
              '돌려받을 등록금이 있으면: 학생·학부모 신분증 사본, 가족관계증명서, 학부모 통장 사본',
            ],
          },
          { title: '기간', items: ['재학 중 최대 4학기, 일반·질병휴학과 따로 쳐요.'] },
        ],
        followUps: [{ label: '휴학하면 등록금은요?', next: 'tuition' }],
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      startup: {
        kind: 'answer',
        text: '창업(준비)휴학은 일반휴학 신청 기간에 서류를 들고 학사지원팀에 방문 신청해요.',
        sections: [
          {
            title: '신청 절차',
            ordered: true,
            items: [
              '창업(준비)휴학원서를 작성하고 증빙자료를 챙겨요.',
              '장학팀에서 도장을 받아요.',
              '중앙도서관 대출실에서 도장을 받아요.',
              '창업교육센터에서 도장을 받아요.',
              '학사지원팀에 휴학원서를 내요.',
              '창업교육 학사제도 운영위원회가 심의해요(현장점검을 할 수 있어요).',
            ],
          },
          {
            title: '제출서류',
            items: [
              '창업준비휴학: 휴학원서, 창업계획서, 창업 준비 중임을 증명하는 서류 등',
              '창업휴학: 휴학원서, 사업자등록증 또는 법인 등기부 등본, 창업실적보고서, 기타 창업 증명 서류',
            ],
          },
          {
            title: '승인 조건',
            items: [
              '전공(복수·부전공 포함)과 관련된 분야만 돼요. 운영위원회가 승인하면 분야와 상관없이 되고, 다음 중 하나를 채워야 해요.',
              '창업 대체학점 9학점 이상',
              '창업 대체학점 3학점 이상 + 중소기업청 창업지원 사업 선정',
              '신청 6개월 전부터 창업을 준비한 점이 객관적으로 소명되는 경우',
              '신청 6개월 전에 사업자등록이나 법인 설립을 마친 경우',
            ],
          },
          { title: '기간', items: ['창업준비휴학 최대 2학기, 창업휴학 최대 2학기(일반·질병휴학과 따로 쳐요).'] },
        ],
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      limits: {
        kind: 'answer',
        text: '휴학은 한 번에 최대 2학기까지 신청할 수 있고, 복학할 때 부득이하면 이어서 다시 신청할 수 있어요.',
        sections: [
          {
            title: '종류별 최대 기간(재학 중)',
            table: {
              head: ['종류', '사유', '최대'],
              rows: [
                ['일반휴학', '일신상의 사유', '질병과 합쳐 6학기'],
                ['질병휴학', '질병', '일반과 합쳐 6학기'],
                ['군입대휴학', '입대', '6학기'],
                ['임신·출산·육아', '임신, 출산, 만 8세 이하 자녀 양육', '4학기'],
                ['창업준비휴학', '창업 준비', '2학기'],
                ['창업휴학', '창업', '2학기'],
              ],
            },
            items: ['군입대·창업·임신·출산·육아휴학은 일반·질병휴학 6학기와 따로 인정돼요.'],
          },
        ],
        followUps: [
          { label: '일반휴학 신청 방법', next: 'general' },
          { label: '군입대휴학 신청 방법', next: 'military' },
        ],
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      tuition: {
        kind: 'answer',
        text: '직전 학기까지 다니던 학생은 일반·군입대·창업휴학을 할 때 휴학하는 학기의 등록금을 낼지 말지 고를 수 있어요(장학금 대상자는 내는 걸 권해요). 질병·임신·출산·육아휴학은 낸 등록금을 규칙에 따라 돌려받아요.',
        sections: [
          {
            title: '일반·군입대·창업(준비)휴학',
            items: [
              "등록금을 돌려받지는 않아요. '낸 등록금을 복학 학기로 이월'하거나 '안 내고 복학 학기에 납부' 중 하나예요.",
              '휴학 학기에 등록금을 냈으면 복학 학기로 이월돼, 복학 학기에 등록금이 나오지 않아요.',
              '수업일수의 절반이 지난 뒤 일반휴학하면 복학 학기에 등록금을 전액 다시 내야 해요.',
              '납부일·등록 학기는 바뀌지 않으니, 연말정산이나 부모님 직장의 등록금 지원은 실제 납부일 기준으로 받아요.',
              '일반휴학 없이 학기 중 군입대휴학을 하면서 성적대체를 신청했거나 입영일이 종강 뒤면, 그 학기 성적이 인정되고 등록금도 그 학기 것으로 처리돼 복학 학기에 등록금이 나와요.',
            ],
          },
          {
            title: '질병·임신·출산·육아휴학',
            items: [
              "낸 등록금은 '대학 등록금에 관한 규칙'에 따라 돌려받고, 복학 학기에 전액 다시 내요.",
              // 학교 휴학 안내의 질병휴학 '등록금 환급 기준' 표(10-15 재확인). 처음엔 '학기 시작 전 전액' 줄을 빠뜨렸었다.
              '돌려받는 금액은 휴학원서를 최종 제출한 날 기준이에요. 학기 시작(3월 1일·9월 1일) 전이면 전액, 시작부터 30일까지 수업료의 5/6, 60일까지 2/3, 90일까지 1/2, 그 뒤엔 반환 없음.',
              '신입생은 학기 시작일 이후에만 질병휴학을 받고, 등록금 전액 반환은 안 돼요.',
            ],
          },
          {
            title: '자주 묻는 질문',
            items: [
              '휴학 때 등록금을 냈는데 미복학·자퇴로 제적되면? → 돌려받을 수 있어요. 학생·학부모 신분증 사본, 가족관계증명서, 학부모 통장 사본을 들고 학사지원팀에 환급 신청해요.',
              '휴학 때 냈는데 복학할 때 등록금이 오르면? → 복학 학기에 등록금이 나오지 않으니 상관없어요.',
              '성적우수 장학금 등으로 등록금이 감면됐는데 휴학하고 싶으면? → 휴학할 때 등록금을 꼭 내야 장학금을 인정받아요.',
              '등록금을 먼저 내야 휴학 신청을 할 수 있나요? → 순서는 상관없어요. 휴학으로 바뀐 뒤에도 등록금을 낼 수 있어요.',
            ],
          },
        ],
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
    },
    checkedAt: '2026-10-15',
  },
  {
    // 학교 홈페이지 학생증발급 안내(2026-10-15 확인)에서 옮겼다.
    id: 'student-card',
    entries: [
      // '국제학생증(ISIC)'은 따로 있는 국제학생증 흐름으로 보낸다.
      { match: [['학생증', '학생카드'], ['분실', '잃어버', '잃어벼', '도난', '없어졌', '없어짐', '잃었', '잊어버', '분실신고']], node: 'lost', not: CARD_NOT },
      { match: [['모바일학생증', '모바일신분증', '헤이영', '학생증qr', '학생증앱', '홍익대신분증']], node: 'mobile', not: [...CARD_NOT, '스터디룸', '세미나실', '예약'] },
      { match: [['학생증', '신분증'], ['모바일', 'qr', '큐알', '헤이영']], node: 'mobile', not: CARD_NOT },
      { match: [['학생증'], ['사진']], node: 'photo', not: CARD_NOT },
      { match: [['학생증'], ['출입등록', '사용등록', '종합통제실', '밤에', '야간', '21시', '9시이후', '출입']], node: 'access', not: [...CARD_NOT, '분실', '잃어버', '도서관'] },
      { match: [['카드'], ['출입등록', '사용등록', '종합통제실']], node: 'access', not: CARD_NOT },
      { match: [['건물출입', '야간출입']], node: 'access', not: [...CARD_NOT, '기숙사', '생활관', '긱사'] },
      { match: [['학생증'], ['외국인', '외국국적', '유학생', 'foreign']], node: 'level-foreign', not: CARD_NOT },
      { match: [['학생증'], ['대학원']], node: 'grad', not: CARD_NOT },
      { match: [['학생증'], ['발급', '신청', '재발급', '만들', '다시', '새로', '받으려', '받는', '받아', '수령', '어디', '언제', '안나와', '문자', '교부', '체크카드', '쏠', 'sol', '며칠', '얼마나']], node: 'level', not: [...CARD_NOT, '분실', '잃어버', '도난', '모바일', '헤이영'] },
      { match: [['학생증']], node: 'start', not: CARD_NOT },
    ],
    nodes: {
      start: {
        kind: 'question',
        text: '학생증의 어떤 점이 궁금하세요?',
        options: [
          { label: '새로 발급·재발급 받고 싶어요', next: 'level' },
          { label: '잃어버렸어요', next: 'lost' },
          { label: '모바일 학생증을 쓰고 싶어요', next: 'mobile' },
          { label: '밤에 건물 출입할 때 쓰고 싶어요', next: 'access' },
          { label: '학생증 사진을 바꾸고 싶어요', next: 'photo' },
        ],
      },
      level: {
        kind: 'question',
        text: '학부생인가요, 대학원생인가요?',
        options: [
          { label: '학부생이에요', next: 'nationality' },
          { label: '대학원생이에요', next: 'grad' },
        ],
      },
      'level-foreign': {
        kind: 'question',
        text: '학부생인가요, 대학원생인가요?',
        options: [
          { label: '학부생이에요', next: 'apply-foreign' },
          { label: '대학원생이에요', next: 'grad' },
        ],
      },
      nationality: {
        kind: 'question',
        text: '내국인인가요, 외국 국적인가요? 신청 방법이 달라요.',
        options: [
          { label: '내국인이에요', next: 'apply-sol' },
          { label: '외국 국적이에요', next: 'apply-foreign' },
          { label: '쏠(SOL) 앱으로 신청이 안 돼요', next: 'apply-foreign' },
        ],
      },
      'apply-sol': {
        kind: 'answer',
        text: '학부 학생증(신규·재발급)은 신한 쏠(SOL) 앱에서 학생증 체크카드로 신청해요. 언제든 신청할 수 있고 수수료는 없어요.',
        sections: [
          {
            title: '신청 방법',
            ordered: true,
            items: [
              '본인 명의 스마트폰에 신한 쏠(SOL) 앱을 설치해요.',
              "로그인 화면 아래 '상품 › 카드 › 체크카드 › 학생증 체크카드 신청'으로 들어가 신청해요.",
              '학적정보 조회 오류가 나면 학사지원팀(02-320-1089)에 전화해요.',
            ],
          },
          {
            title: '발급과 수령',
            items: [
              '신청 후 1~2주 걸려요. 학기 초에는 신입·편입생 신청이 몰려 늦어질 수 있어요.',
              // 10-25: 공지 2060(2026학년도 학생증 신청안내) — 교부처가 신한은행 홍익대학교지점(홍문관 1층)으로 일원화, 은행이 보내는 방문수령 문자, 신한은행 고객정보 최신화.
              '신한은행 홍익대학교지점(홍문관 1층)에 가서 신청하면 당일 발급도 돼요(오전 방문 권장).',
              '학생증이 은행에 도착하면 신한은행에서 방문수령 안내 문자가 와요. 신분증을 들고 신한은행 홍익대학교지점(홍문관 1층)에서 받아요(2026학년도 학생증 신청안내 기준).',
              '문자를 받고 한 달 안에 안 받으면 일괄 폐기돼요. 폐기된 뒤 다시 원하면 신한은행 홍익대학교 지점에 가서 상담해요.',
              '문자를 받을 수 있게 신한은행에 등록된 고객정보(연락처)를 최신으로 바꿔 두세요.',
            ],
          },
          {
            title: '받은 뒤',
            items: ['밤 9시 이후 서울캠퍼스 건물에 드나들어야 하면 와우관 2층 종합통제실에 가서 카드 사용등록을 해요.'],
          },
        ],
        phones: [UNDERGRAD_RECORD_PHONE],
        links: [STUDENT_CARD_PAGE],
      },
      'apply-foreign': {
        kind: 'answer',
        text:
          "신한은행 홈페이지 '금융서비스 › 기타금융 › 학생증체크카드 예약서비스'에서 예약 신청한 뒤, 홍문관 로비 신한은행 홍익대학교 지점에 꼭 방문해 예약을 확인해야 해요(외국 국적 학생은 이 방법으로만 신청해요).\n1~2주 뒤 신한은행에서 방문수령 안내 문자가 오면 신분증을 들고 신한은행 홍익대학교지점(홍문관 1층)에서 받아요. 문자를 받고 한 달 안에 안 받으면 폐기돼요(2026학년도 학생증 신청안내 기준).",
        phones: [SHINHAN_BRANCH_PHONE, UNDERGRAD_RECORD_PHONE],
        links: [STUDENT_CARD_PAGE, FACILITY_PAGE],
      },
      grad: {
        kind: 'answer',
        text:
          // 10-25: 공지 2058(2026학년도 학생증 신청안내_대학원) — 상시 신청(2학기 신입생은 9.1부터), 1~2주 소요, 교부처 신한은행 홍익대학교지점으로 일원화.
          "대학원생도 언제든 신한 쏠(SOL) 앱에서 '학생증 체크카드'를 신청할 수 있어요(2학기 신입생은 9월 1일부터). 외국 국적이면 신한은행 홈페이지에서 예약 신청한 뒤 외국인등록증(또는 여권)을 들고 홍문관 1층 신한은행에 가요.\n1~2주 뒤 신한은행 방문수령 문자가 오면 일반·특수대학원 모두 신분증을 들고 신한은행 홍익대학교지점(홍문관 1층)에서 받아요(2026학년도 대학원 학생증 신청안내 기준).",
        phones: [{ label: '신청 중 학적정보 조회 오류(대학원교학팀)', phone: '02-320-1269' }],
        links: [STUDENT_CARD_PAGE],
      },
      lost: {
        kind: 'answer',
        text:
          '체크카드(금융) 분실등록은 신한은행 콜센터에서 해요. 밤 9시 이후 교내 건물 출입에 쓰던 학생증이면 와우관 2층 종합통제실에서도 분실등록해요.\n새 학생증은 신한 쏠(SOL) 앱에서 재발급을 신청해요.',
        followUps: [{ label: '새로 발급받고 싶어요', next: 'level' }],
        phones: [{ label: '신한은행 콜센터(분실등록)', phone: '1577-8000' }],
        links: [STUDENT_CARD_PAGE],
      },
      access: {
        kind: 'answer',
        text: '밤 9시(21시) 이후 서울캠퍼스 건물에 드나들어야 하면 학생증을 받은 뒤 와우관 2층 종합통제실에 가서 카드 사용등록을 해요. 잃어버렸을 때 분실등록도 여기서 해요.',
        followUps: [{ label: '학생증을 잃어버렸어요', next: 'lost' }],
        links: [STUDENT_CARD_PAGE],
      },
      photo: {
        kind: 'answer',
        text: "모바일 학생증에 사진이 없거나 바꾸고 싶으면, 사진 파일과 신분증을 들고 소속 학과 사무실에 가서 변경 신청해요. 파일 이름은 '학번.jpg'로 하고, 파일이 너무 크면 바꾸지 못할 수 있어요.",
        followUps: [{ label: '모바일 학생증 쓰는 법', next: 'mobile' }],
        links: [STUDENT_CARD_PAGE],
      },
      mobile: {
        kind: 'answer',
        text:
          "'헤이영캠퍼스' 앱에서 홍익대학교를 고르고 클래스넷 아이디·비밀번호로 로그인한 뒤 '모바일 학생증 발급하기'를 눌러요(신한은행 계좌 인증 필요). 중앙도서관 출입·도서대출·자리배정·열람실 출입에 쓸 수 있어요.\n'모바일 신분증' QR은 만든 뒤 30초 안에 리더기에 대야 하고, 시간이 지나면 새로 만들어져요.",
        phones: [
          { label: '헤이영캠퍼스 콜센터(9~18시)', phone: '1599-8035' },
          { label: 'QR 오류가 계속되면 도서관 대출실', phone: '02-320-1305' },
        ],
        links: [STUDENT_CARD_PAGE],
      },
    },
    checkedAt: '2026-10-15',
  },
  {
    // 켜기·끄기 번호(1541)는 운영진 확인(10-15) — 건설관리팀 페이지 대표 전화 목록에 있는 번호. 고장은 부서 안내의 건설관리팀 '냉,난방 및 위생설비 관리' 줄.
    id: 'aircon',
    entries: [
      // 기숙사 냉난방은 기숙사 흐름으로 보낸다. '덥다·춥다'만 말하면 켜고 끄는 요청 번호로 바로 간다.
      { match: [AIRCON_WORDS, ['고장', '물새', '물이새', '물떨어', '물이떨어', '소리', '소음', '냄새', '망가', '안나와', '안나옴', '바람이안', '작동안', '안켜', '안꺼', '안돼', '안되', '안됨', '리모컨']], node: 'broken', not: AIRCON_NOT },
      { match: [AIRCON_WORDS, ['켜', '꺼', '끄', '틀어', '틀어줘', '가동', '온도', '조절', '세게', '약하게', '너무세', '세서', '약해', '올려', '내려']], node: 'on-off', not: AIRCON_NOT },
      { match: [HOT_COLD_WORDS], node: 'on-off', not: AIRCON_NOT },
      { match: [AIRCON_WORDS], node: 'start', not: AIRCON_NOT },
    ],
    nodes: {
      start: {
        kind: 'question',
        text: '어떤 상황인가요?',
        options: [
          { label: '켜거나 끄고 싶어요', next: 'on-off' },
          { label: '고장 난 것 같아요', next: 'broken' },
        ],
      },
      'on-off': {
        kind: 'answer',
        text: '강의실·건물 에어컨(냉난방)을 켜고 끄는 건 아래 번호로 전화해 요청해요. 건물과 강의실 호수를 말하면 돼요.',
        followUps: [{ label: '고장 난 것 같아요', next: 'broken' }],
        phones: [{ label: '건설관리팀 · 냉난방 켜기·끄기 요청', phone: '02-320-1541' }],
        links: [CONSTRUCTION_TEAM_PAGE],
      },
      broken: {
        kind: 'answer',
        text: '냉난방 설비 관리는 건설관리팀이 맡아요. 고장 난 건물·강의실 호수와 증상을 알려 주세요.',
        phones: [{ label: '건설관리팀 · 냉,난방 및 위생설비 관리', phone: '02-320-1544' }],
        links: [CONSTRUCTION_TEAM_PAGE],
      },
    },
    checkedAt: '2026-10-15',
  },
  {
    // 학교 홈페이지 Hongik WIFI·Eduroam 안내와 무선랜 안내 사이트(wifi.hongik.ac.kr)의 기기별 설정 설명서(PDF)에서 옮겼다(2026-10-15).
    id: 'wifi',
    entries: [
      { match: [['eduroam', '에듀롬', '에듀로암']], node: 'eduroam' },
      { match: [WIFI_WORDS, ['다른학교', '타학교', '타대', '다른대학', '해외대학', '연구소']], node: 'eduroam', not: WIFI_NOT },
      { match: [WIFI_WORDS, ['안돼', '안되', '안됨', '안돼요', '끊겨', '끊김', '끊어', '느려', '느림', '오류', '실패', '안잡', '안떠', '안터', '연결안', '접속안', '먹통']], node: 'trouble', not: WIFI_NOT },
      { match: [WIFI_WORDS, ['비번', '비밀번호', '패스워드', '암호', '아이디', '계정', '로그인']], node: 'account', not: WIFI_NOT },
      { match: [WIFI_WORDS, ['아이폰', '아이패드', 'ios', 'iphone', 'ipad']], node: 'ios', not: WIFI_NOT },
      { match: [WIFI_WORDS, ['안드로이드', '갤럭시', 'android', '삼성폰']], node: 'android', not: WIFI_NOT },
      { match: [WIFI_WORDS, ['윈도우', 'windows', '노트북', '랩탑']], node: 'windows', not: WIFI_NOT },
      { match: [WIFI_WORDS, ['맥북', 'macbook', 'macos', '맥os', '아이맥']], node: 'mac', not: WIFI_NOT },
      { match: [WIFI_WORDS], node: 'start', not: WIFI_NOT },
    ],
    nodes: {
      start: {
        kind: 'question',
        text: "학교 와이파이는 'Hongik_wifi'예요. 아이디는 학번, 비밀번호는 학교 홈페이지 비밀번호예요. 어떤 기기로 연결하세요?",
        options: [
          { label: '아이폰·아이패드', next: 'ios' },
          { label: '안드로이드폰(갤럭시 등)', next: 'android' },
          { label: '윈도우 노트북', next: 'windows' },
          { label: '맥북', next: 'mac' },
          { label: '아이디·비밀번호가 뭔가요?', next: 'account' },
          { label: '연결이 안 돼요', next: 'trouble' },
          { label: '다른 학교에서 쓰고 싶어요(eduroam)', next: 'eduroam' },
        ],
      },
      ios: {
        kind: 'answer',
        text: "설정 › Wi-Fi에서 'Hongik_wifi'를 골라 학번과 학교 홈페이지 비밀번호를 넣어요.",
        sections: [
          {
            title: '연결 순서',
            ordered: true,
            items: [
              "설정 › Wi-Fi › 'Hongik_wifi'를 눌러요.",
              '사용자 이름에 학번(알파벳은 대문자), 암호에 학교 홈페이지 비밀번호를 넣고 [연결]을 눌러요.',
              '인증서 화면이 나오면 [신뢰]를 눌러요.',
            ],
          },
        ],
        followUps: [{ label: '그래도 연결이 안 돼요', next: 'trouble' }],
        phones: [WIFI_PHONE],
        links: [WIFI_GUIDE, WIFI_PAGE],
      },
      android: {
        kind: 'answer',
        text: "'Hongik_wifi'를 골라 EAP 방식은 PEAP, CA 인증서는 '인증 안 함'으로 두고 학번과 학교 홈페이지 비밀번호를 넣어요.",
        sections: [
          {
            title: '연결 순서(최근 안드로이드폰)',
            ordered: true,
            items: ["Wi-Fi를 켜고 'Hongik_wifi'를 눌러요.", 'EAP 방식: PEAP(기본값)', "CA 인증서: '인증 안 함'", 'ID: 학번 / 비밀번호: 학교 홈페이지 비밀번호 › [연결]'],
          },
          {
            title: '위처럼 안 되면(설정 설명서 방식)',
            items: [
              'EAP 방식을 TTLS로, 2단계 인증을 PAP로 바꿔 다시 연결해 봐요.',
              "CA 인증서에 '인증 안 함'이 없으면 무선랜 안내 사이트에서 CA 인증서(hongik.p12)를 받아 설치하고(추출 암호 hongik, Wi-Fi 인증서, 이름 hongik), CA 인증서 hongik·도메인 airfrontv7.aircuve.com 으로 연결해요.",
            ],
          },
        ],
        followUps: [{ label: '그래도 연결이 안 돼요', next: 'trouble' }],
        phones: [WIFI_PHONE],
        links: [WIFI_GUIDE, WIFI_PAGE],
      },
      windows: {
        kind: 'answer',
        text: "'Hongik_wifi'를 골라 [연결]을 누르고 사용자 이름에 학번, 암호에 학교 홈페이지 비밀번호를 넣어요(Windows 10 이상).",
        sections: [
          {
            title: '연결이 자꾸 끊기면',
            items: [
              'Intel 8260·8265 무선랜카드 일부는 드라이버 문제가 있어요. 제조사 최신 드라이버로 업데이트하면 돼요.',
              'Windows 8 이하는 무선랜 안내 사이트에서 접속 프로그램을 받아 설치해야 해요.',
            ],
          },
        ],
        followUps: [{ label: '그래도 연결이 안 돼요', next: 'trouble' }],
        phones: [WIFI_PHONE],
        links: [WIFI_GUIDE, WIFI_PAGE],
      },
      mac: {
        kind: 'answer',
        text: "Wi-Fi 신호 중 'Hongik_wifi'를 골라 계정 이름에 학번, 암호에 학교 홈페이지 비밀번호(대소문자 구분)를 넣고 연결해요. '인증서 확인' 창이 나오면 확인하고 연결을 마쳐요.",
        sections: [
          {
            title: '예전 맥의 데이터를 옮긴 뒤 연결이 안 되면',
            items: ['기존 맥의 Keychain(키체인)에 있던 Hongik_wifi 인증서가 새 맥으로 따라와 충돌하는 경우예요. 아래처럼 지우고 다시 연결해요.'],
          },
          {
            title: '해결 방법(학교 Mac OS 인증서문제 해결방법)',
            ordered: true,
            items: [
              "런치패드 › 기타 › 'Keychain Access(키체인 접근)'를 열어요.",
              "login 탭에서 'AirFRONT CA ROOT', 'AirFRONT CA SERVER' 인증서 두 개를 골라 삭제해요(암호 입력 필요).",
              "네트워크 설정 › 고급(Advanced) › Wi-Fi 탭에서 'Hongik_wifi' 프로파일을 [–]로 지우고 확인을 눌러요.",
              "다시 'Hongik_wifi'에 연결하면 새 인증서가 저장돼 접속돼요.",
            ],
          },
        ],
        followUps: [{ label: '그래도 연결이 안 돼요', next: 'trouble' }],
        phones: [WIFI_PHONE],
        links: [WIFI_GUIDE, WIFI_PAGE],
      },
      trouble: {
        kind: 'answer',
        text: '설정대로 했는데도 안 되면 정보전산원(정보통신센터 Q동 906호)에 문의해요.',
        sections: [
          {
            title: '먼저 확인해 보세요',
            items: [
              "'Hongik_wifi' 신호에 연결하는지 확인해요.",
              '아이디는 학번(알파벳은 대문자), 비밀번호는 학교 홈페이지 비밀번호예요. 대소문자를 구분해요.',
              '보안 인증(IEEE 802.1x) 방식이라 일반 와이파이와 설정이 달라요. 기기별 설정대로 했는지 확인해요.',
              'Windows 노트북에서 자꾸 끊기면 Intel 8260·8265 무선랜카드 드라이버 문제일 수 있어요. 제조사 최신 드라이버로 업데이트해요.',
            ],
          },
        ],
        followUps: [
          { label: '아이폰 설정 방법', next: 'ios' },
          { label: '안드로이드 설정 방법', next: 'android' },
          { label: '맥북 설정 방법', next: 'mac' },
        ],
        phones: [WIFI_PHONE],
        links: [WIFI_GUIDE, WIFI_PAGE],
        facilityId: IT_CENTER_ID,
      },
      account: {
        kind: 'answer',
        text: "'Hongik_wifi' 아이디는 학번(알파벳은 대문자), 비밀번호는 학교 홈페이지 비밀번호예요.",
        sections: [
          {
            title: '알아 두세요',
            items: [
              '비밀번호는 대소문자를 구분해요.',
              "다른 학교에서 쓰는 eduroam은 아이디 뒤에 '@hongik.ac.kr'을 붙여요(학번@hongik.ac.kr).",
            ],
          },
        ],
        followUps: [
          { label: '아이폰 설정 방법', next: 'ios' },
          { label: '안드로이드 설정 방법', next: 'android' },
          { label: '그래도 연결이 안 돼요', next: 'trouble' },
        ],
        phones: [WIFI_PHONE],
        links: [WIFI_GUIDE, WIFI_PAGE],
      },
      eduroam: {
        kind: 'answer',
        text: "eduroam은 가입한 국내외 대학·연구기관에서 함께 쓰는 와이파이예요. 'eduroam' 신호에 학번@hongik.ac.kr 과 학교 홈페이지 비밀번호로 연결해요. 우리 학교는 서울·세종캠퍼스에서 돼요.",
        phones: [WIFI_PHONE],
        links: [
          { label: '학교 홈페이지 · Eduroam WIFI', url: 'https://www.hongik.ac.kr/kr/life/eduroam-wifi.do' },
          { label: '국내 eduroam 가입 기관', url: 'https://www.eduroam.kr/INT/Serviceuni.aspx' },
        ],
      },
    },
    checkedAt: '2026-10-15',
  },
  {
    // 정보전산원 Email/Google 게시판, 학교 홈페이지 Office365 안내·MATLAB 안내(학생 메일 두 가지 명시)에서 옮겼다(2026-10-15).
    id: 'school-mail',
    entries: [
      { match: [MAIL_WORDS, ['해외', '외국', '출국', '교환학생', '차단', '막혔', '막혀', '2차인증', '2단계인증', 'otp', 'pin', '아이피']], node: 'abroad', not: MAIL_NOT },
      { match: [MAIL_WORDS, ['안와', '안옵', '안들어', '못받', '수신', '안보내', '안보내져', '발송', '반송', '안가', '전송안', '용량', '비활성', 'deliveryfailure', '단체메일']], node: 'not-working', not: [...MAIL_NOT, 'office365', '오피스365', '아웃룩', 'outlook'] },
      { match: [MAIL_WORDS, ['비밀번호', '비번', '패스워드', '재설정', '잊어', '까먹', '모르겠', '아이디찾']], node: 'password', not: MAIL_NOT },
      { match: [['office365', '오피스365', 'mail.hongik', '아웃룩', 'outlook', '오피스메일']], node: 'office365', not: MAIL_NOT },
      { match: [['office365', '오피스365', '아웃룩', 'outlook'], ['로그인', '접속', '가입', '계정', '만들', '용량', '졸업']], node: 'office365', not: MAIL_NOT },
      { match: [['gmail', '지메일', '쥐메일', 'g.hongik', '구글메일', '구글계정', '구글그룹', '구글드라이브']], node: 'gmail', not: MAIL_NOT },
      { match: [['학교', '홍익', '학생'], ['메일주소', '이메일주소', '메일계정', '메일만들', '메일가입']], node: 'start', not: [...MAIL_NOT, 'gmail', '지메일', '쥐메일', 'office365', '오피스365', '아웃룩', 'outlook', '구글'] },
      { match: [MAIL_WORDS], node: 'start', not: MAIL_NOT },
    ],
    nodes: {
      start: {
        kind: 'question',
        text: '학생 학교 메일은 두 가지예요. 학교 Gmail(아이디@g.hongik.ac.kr)과 학생용 Office365(아이디@mail.hongik.ac.kr)이고, 따로 가입해요. 무엇이 궁금하세요?',
        options: [
          { label: '학교 Gmail(@g.hongik.ac.kr)', next: 'gmail' },
          { label: 'Office365 메일(@mail.hongik.ac.kr)', next: 'office365' },
          { label: '메일이 안 오거나 안 보내져요', next: 'not-working' },
          { label: '해외에서 로그인이 막혀요', next: 'abroad' },
          { label: '비밀번호를 잊었어요', next: 'password' },
        ],
      },
      gmail: {
        kind: 'answer',
        text: '학교 Gmail은 gmail.hongik.ac.kr 에서 가입하고, 학교 통합로그인 아이디와 비밀번호로 로그인해요. 주소는 아이디@g.hongik.ac.kr 이에요.',
        sections: [
          {
            title: '꼭 알아 두세요',
            items: [
              '오래 로그인하지 않으면 계정이 비활성화돼 메일을 못 받을 수 있어요. 가끔 gmail.hongik.ac.kr 로 로그인하세요.',
              "학교 단체 메일만 안 오면 구글 그룹스 › 내 그룹에서 '이메일 수신 안함'을 '모든 이메일'로 바꿔요.",
              '해외에서는 접속이 막혀요. 출국 전에 국내에서 2차 인증(PIN 또는 OTP)을 설정해 두세요.',
              'Office365(@mail.hongik.ac.kr)와는 별개 서비스예요.',
            ],
          },
        ],
        followUps: [{ label: 'Office365 메일은요?', next: 'office365' }],
        phones: [MAIL_PHONE],
        links: [
          { label: '학교 Gmail 로그인 · gmail.hongik.ac.kr', url: 'https://gmail.hongik.ac.kr' },
          { label: '정보전산원 · Email / Google 안내', url: 'https://it.hongik.ac.kr/it/board/0102.do' },
        ],
        facilityId: IT_CENTER_ID,
      },
      office365: {
        kind: 'answer',
        text: '학생용 Office365는 재학생(학부·대학원)이 가입 페이지에서 계정을 만들면 바로 써요. 계정은 아이디@mail.hongik.ac.kr 이에요.',
        sections: [
          {
            title: '알아 두세요',
            items: [
              '처음 접속할 때 비밀번호 재설정용 이메일과 휴대폰 번호를 꼭 추가해요.',
              '설치형 Office는 재학 중에만 PC 5대·스마트폰 5대까지 설치할 수 있어요.',
              '졸업 후에는 이메일만, 졸업 후 5년까지 쓸 수 있어요.',
              '2024년 7월 1일부터 개인 용량이 2GB로 제한되고, 넘으면 계정에 접속할 수 없어요. 미리 파일을 정리해 두세요.',
              '설치형 Office, 이메일(Exchange 온라인), OneDrive 저장 공간을 쓸 수 있어요.',
            ],
          },
        ],
        followUps: [{ label: '비밀번호를 잊었어요', next: 'password' }],
        phones: [MAIL_PHONE],
        links: [
          { label: 'Office365 가입하기', url: 'https://api.hongik.ac.kr/office365/' },
          { label: '학교 홈페이지 · 학생용 Office365', url: 'https://www.hongik.ac.kr/kr/life/office365-info.do' },
        ],
        facilityId: IT_CENTER_ID,
      },
      password: {
        kind: 'answer',
        text: '학교 Gmail은 학교 통합로그인 아이디·비밀번호를 써요. 잊었으면 gmail.hongik.ac.kr 로그인 화면 안내대로 통합로그인(SSO) 메뉴에서 찾아요. Office365는 portal.office.com 에서 가입 때 등록한 이메일·휴대폰 인증으로 재설정해요.',
        sections: [
          {
            title: 'Office365 비밀번호 재설정 순서',
            ordered: true,
            items: [
              'portal.office.com 에 접속해 비밀번호 재설정 화면으로 들어가요.',
              '계정 유형을 고르고, Office365 아이디와 보안문자를 넣어요.',
              '가입 때 등록한 이메일로 온 인증코드를 넣어요.',
              '가입 때 등록한 휴대폰 번호를 넣고, 문자로 온 인증코드를 넣어요.',
              '인증이 끝나면 새 비밀번호를 넣어요.',
            ],
          },
        ],
        phones: [MAIL_PHONE],
        links: [
          { label: '학교 Gmail 로그인 · gmail.hongik.ac.kr', url: 'https://gmail.hongik.ac.kr' },
          { label: '학교 홈페이지 · Office365 비밀번호 재설정', url: 'https://www.hongik.ac.kr/kr/life/office365-findpw.do' },
        ],
      },
      'not-working': {
        kind: 'answer',
        text: '학교 Gmail이 안 오거나 안 보내질 때 정보전산원이 안내하는 방법이에요.',
        sections: [
          {
            title: '못 받을 때',
            items: [
              "단체 메일만 안 오면: 구글 그룹스 › 내 그룹에서 '이메일 수신 안함'을 '모든 이메일'로 바꿔요.",
              '모든 메일이 안 오면: 오래 안 써서 계정이 비활성화된 거예요. gmail.hongik.ac.kr 로 로그인해요.',
            ],
          },
          {
            title: '안 보내질 때',
            items: [
              '받는 사람 주소 오타를 확인해요.',
              '받는 사람 계정이 비활성화됐거나 용량이 찼을 수 있어요.',
              '내 메일·드라이브 용량이 찼으면 저장 공간을 비워요.',
              '그래도 안 되면 itmanager@hongik.ac.kr 로 문의해요.',
            ],
          },
        ],
        phones: [MAIL_PHONE],
        links: [{ label: '학교 홈페이지 · 학교 메일 사용 관련 주요 문의', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=142289' }],
      },
      abroad: {
        kind: 'answer',
        text: '학교 Gmail은 해외에서 접속하면 차단돼요. 국내에서 gmail.hongik.ac.kr 에 로그인해 2차 인증(PIN 또는 OTP)을 설정해 두면 해외에서도 써요. 이미 막혔으면 차단 화면을 스크린샷으로 찍어 itmanager@hongik.ac.kr 로 보내요(업무시간에 풀어 줘요).',
        phones: [MAIL_PHONE],
        links: [{ label: '정보전산원 · 해외에서 학교 메일 사용 방법', url: 'https://it.hongik.ac.kr/it/board/0102.do?mode=view&articleNo=134136' }],
      },
    },
    checkedAt: '2026-10-15',
  },
  {
    // 건강진료센터: 학교 홈페이지 부속기관 안내. 보험 청구: 총무팀 업무별 전화(부서 안내 담당정보 표). 청구 서류 안내는 학교에 없어 지어내지 않는다.
    id: 'injury',
    entries: [
      // 보험은 다친 일과 함께 물을 때만('국민건강보험'·'유학생 보험'은 이 흐름이 아니다).
      { match: [['보험', '보상', '치료비', '병원비', '진료비'], ['다쳤', '다치', '부상', '사고', '학교', '교내', '청구', '치료', '넘어', '수업중', '실습중']], node: 'insurance', not: INJURY_NOT },
      { match: [['배상책임', '학교경영자', '상해보험', '학교보험']], node: 'insurance', not: INJURY_NOT },
      { match: [['응급', '119', '쓰러', '구급차', '의식', '피가많', '피가안멈', '숨을']], node: 'emergency', not: [...INJURY_NOT, '응급처치교육', '심폐소생술'] },
      { match: [INJURY_WORDS], node: 'start', not: INJURY_NOT },
      { match: [['건강진료', '보건실', '보건소', '양호실', '의무실', '목발', '구급약', '상비약', '진통제', '두통약', '소화제', '반창고', '파스', '안정실', '혈압', '혈당', '금연', '예방접종', '심폐소생술']], node: 'clinic', not: INJURY_NOT },
      { match: [['아파', '아픈', '아프', '감기', '몸살', '두통', '복통', '열나', '열이나', '어지러', '토할', '체했']], node: 'clinic', not: [...INJURY_NOT, '휴학', '결석', '출석', '공결', '병결', '시험', '수업빠', '수업못', '빠짐', '빠졌', '빠져', '빠지'] },
    ],
    nodes: {
      start: {
        kind: 'question',
        text: '많이 다쳤으면 먼저 119에 연락하세요. 어떤 도움이 필요하세요?',
        options: [
          { label: '학교에서 치료를 받고 싶어요', next: 'clinic' },
          { label: '학교 보험으로 치료비를 받고 싶어요', next: 'insurance' },
          { label: '많이 다쳤어요(응급)', next: 'emergency' },
        ],
      },
      clinic: {
        kind: 'answer',
        text: '학생회관(G동) 1층 건강진료센터에서 내과 진료·투약과 일반적인 외상 치료, 일차 응급처치를 받을 수 있어요. 09:00~17:30(동절기 09:00~17:00)에 열어요. 교의(가정의학전문의)와 간호사가 있어요.',
        sections: [
          {
            title: '진료',
            items: ['내과 진료와 투약', '일반적인 외상 치료, 일차 응급처치', '구급 의약품 지급', '해외봉사활동 때 약품과 예방접종', '안정실 이용, 목발 대여'],
          },
          {
            title: '상담',
            items: ['금연·금주 상담, 대사증후군 상담', '건강 상담(혈압, 혈당 등)', '질병 관련 휴학 상담', '예방접종 상담(해외여행 때 필요한 A형간염, 파상풍 등)', '생리공결제 이용 상담(생리통 관리, 산부인과 진료 상담)'],
          },
          {
            title: '검사',
            items: ['CBC 검사(백혈구, 적혈구, 혈색소, 혈소판)', '혈당 검사(식전·식후 혈당, 당화혈색소)', '혈압 측정, 체지방 측정', '9종 혈액 검사(고지혈증, 지방간, 고혈당, 신장 기능)'],
          },
          { title: '교육', items: ['보건학 강좌(주당 2시간씩 3강좌)', '전염병 관리 교육, 심폐소생술 교육'] },
        ],
        followUps: [{ label: '학교 보험으로 치료비를 받고 싶어요', next: 'insurance' }],
        phones: [HEALTH_PHONE],
        links: [HEALTH_PAGE],
        facilityId: HEALTH_CENTER_ID,
      },
      insurance: {
        kind: 'answer',
        text: '학교경영자배상책임보험 청구는 총무팀이 맡아요. 다친 경위를 말하고, 보상 대상인지와 낼 서류를 총무팀에 먼저 확인하세요. 병원 진단서와 진료비 영수증은 버리지 말고 모아 두세요.',
        followUps: [{ label: '학교에서 치료를 받고 싶어요', next: 'clinic' }],
        phones: [{ label: '총무팀 · 학교경영자배상책임보험 청구', phone: '02-320-3127' }],
        links: [GENERAL_AFFAIRS_PAGE],
        facilityId: GENERAL_AFFAIRS_ID,
      },
      emergency: {
        kind: 'answer',
        text: '생명이 위급하거나 크게 다쳤으면 바로 119에 전화하세요. 가벼운 상처는 학생회관(G동) 1층 건강진료센터에서 응급처치를 받을 수 있어요.',
        phones: [{ label: '119 구급', phone: '119' }, HEALTH_PHONE],
        followUps: [{ label: '학교 보험으로 치료비를 받고 싶어요', next: 'insurance' }],
        links: [HEALTH_PAGE],
        facilityId: HEALTH_CENTER_ID,
      },
    },
    checkedAt: '2026-10-15',
  },
  {
    // 운영진이 알려 준 T동(제4공학관) 강의실 대여 창구(2026-10-16). 교양교육원 전화는 부서 안내 담당정보 '영어 교과목, R·Q·T·Z1·Z2·K동 강의실 예약'.
    // 멀티미디어실 위치는 지도 시설(T동 6층 컴퓨터공학과 라운지, T604). 교양교육원 위치는 자료마다 달라 적지 않는다.
    id: 't-classroom-booking',
    entries: [
      // 일반 강의실 예약 흐름(askPages classroom-booking, '강의실예약'+'강의실')보다 점수가 높게 T동을 붙인 말로 묶는다.
      {
        match: [
          ['t동강의실', '제4공학관강의실', '4공학관강의실', '티동강의실', 't0101', 't0011', 't501'],
          ['강의실'],
          ['예약', '대여', '빌리', '빌려', '사용신청', '잡'],
        ],
        node: 'start',
        not: ['열람실', '스터디', '공동학습', '프레젠테이션'],
      },
    ],
    nodes: {
      start: {
        kind: 'answer',
        text: 'T동(제4공학관) 강의실은 호실에 따라 대여를 받는 곳이 달라요. T0101·T0011·T501은 교양교육원 소속이라 교양교육원에서, 나머지 T동 강의실은 T동 멀티미디어실(T604)에서 대여 접수를 받아요.',
        sections: [
          {
            title: '어디서 빌리나요',
            items: [
              'T0101·T0011·T501: 교양교육원에서 대여를 받아요.',
              '그 밖의 T동 강의실: T동 6층 멀티미디어실(T604)에서 대여 접수를 받아요.',
            ],
          },
        ],
        phones: [{ label: '교양교육원 · R·Q·T·Z1·Z2·K동 강의실 예약', phone: '02-320-3297' }],
        facilityId: 'hi-t-6f-lounge',
      },
    },
    checkedAt: '2026-10-16',
  },
  {
    // 제60대 총학생회 '태양' 카드뉴스 「아트앤디자인밸리 알아보기」(2026학년도 1학기 학교학생대표자협의회 관재팀 안건, 운영진 전달 2026-10-21).
    // 건물이 앱 지도에 없어 지도 위치(facilityId)는 달지 않는다. 카드뉴스 안 표기가 서로 다른 곳:
    //  - 비비엔느오: 지도 '파브리아노', 목록 '파브라이노' → 브랜드명(Fabriano) 표기 '파브리아노'.
    //  - 지상 1층 110호: 지도 '봄코커뮤니케이션', 목록 '붐코커뮤니케이션' → 목록 표기.
    //  - 스튜디오 벨벳언더그라운드 호실이 한국문화예술센터와 같은 'B201-2호, B207호'로 적혀 있다 → 그대로 옮긴다.
    //  - L층 호실 번호는 B1xx(지하 1층 번호)다.
    // 주차장 층(지하 3~5층)은 학교 주차안내(parking 흐름)가 맡는다.
    id: 'art-design-valley',
    entries: [
      // 창업 안내(askPages startup)도 '아트앤디자인밸리'로 들어오지만 같은 점수면 이 흐름(앞 흐름)이 이긴다.
      {
        match: [['아트앤디자인밸리', '아트엔디자인밸리', '아트앤디자인', '아트엔디자인', '디자인밸리', '아트밸리', 'artdesignvalley']],
        node: 'start',
      },
      {
        match: [['아트앤디자인밸리', '아트엔디자인밸리', '아트앤디자인', '아트엔디자인', '디자인밸리', '아트밸리'], ['입주', '업체', '가게', '매장', '상점', '호실', '층별', '뭐있', '뭐가있']],
        node: 'tenants',
      },
      {
        match: [
          [
            '슬런치팩토리', '슬런치', '비비엔느오', '파브리아노', '파브라이노', '한세실업', '숨코리아', '엘리트전자', '남양연구소',
            '한국문화예술센터', '벨벳언더그라운드', '현대코퍼레이션', '한국디자인사이언스', '피엔피디건축', '씨오지', '쏘노리',
            '라쿤코트', '무소속컴퍼니', '아토건축도시', '아키폴리', '붐코커뮤니케이션', '봄코커뮤니케이션', '쉐어잇',
          ],
        ],
        node: 'tenants',
      },
    ],
    nodes: {
      start: {
        kind: 'answer',
        text: '아트앤디자인밸리는 체육관(M동)과 제2기숙사 사이에 있는 산학협력 건물이에요. 대운동장이나 제4공학관(T동) 통로로 들어갈 수 있어요.',
        sections: [
          {
            title: '어떤 건물인가요',
            items: [
              "'홍대벽화거리'로 불리던 학교 담벼락을 허물고 새로 지은 건물이에요. 길고 아늑한 골목길 같은 서쪽 부지 지형에서 '밸리(Valley)'라는 이름이 붙었어요.",
              '규모: 길이 250m, 지하 4층~지상 2층, 연면적 약 17,221㎡(5,200평)이에요.',
              '경사를 살린 개방형 구조라 학교 밖 거리와 바로 이어져요.',
            ],
          },
          {
            title: '무엇을 하는 곳인가요',
            items: [
              '청년 창업 지원: 미술·디자인·공예·패션 분야 공방, 창업 작업실, 디자인실, 연구실, 부티크(점포)가 있어요. 입주 업체 관계자·창업 작가가 창업전담교원으로 실무를 지도해요.',
              '전시·문화예술 교류: 학생과 청년 작가의 작품을 보여 주는 전시장·팝업스토어로 쓰여요(예: 2024 Cool Case Club 팝업전시회, 2026 bac. 아트페어).',
              '산학협력: 입주 기업은 학교 인력·설비를 활용하고, 학생은 실제 산학협력 프로젝트를 경험할 수 있어요.',
            ],
          },
          {
            title: '가는 길',
            items: [
              '체육관(M동)과 제2기숙사 사이, 학교 서쪽 담장을 따라 길게 있어요.',
              '대운동장 쪽이나 제4공학관(T동) 통로로 들어가요.',
            ],
          },
        ],
        followUps: [{ label: '입주 업체 보기', next: 'tenants' }],
        links: [
          { label: '학교 홈페이지 · 창업교육센터(아트앤디자인밸리 소개)', url: 'https://www.hongik.ac.kr/kr/life/seoul-entrepreneurship-education-center.do' },
        ],
      },
      tenants: {
        kind: 'answer',
        text: '아트앤디자인밸리에는 산학협력시설(교수 연구실 포함)과 음식점(슬런치팩토리), 상점(비비엔느오), 예술공간(한국문화예술센터)이 입주해 있어요. 앞으로 서점·전시공간 등이 더 들어올 예정이에요.',
        sections: [
          {
            title: '층별 입주 업체',
            table: {
              head: ['층', '업체', '호실', '구분'],
              rows: [
                ['지상 2층', '현대기아자동차 남양연구소', '201호', '산학협력'],
                ['지상 2층', '비비엔느오(파브리아노)', '202호', '상점'],
                ['지상 1층', '현대기아자동차 남양연구소', '101호', '산학협력'],
                ['지상 1층', '비비엔느오(파브리아노)', '104호', '상점'],
                ['지상 1층', '한세실업', '105~107호', '산학협력'],
                ['지상 1층', '붐코커뮤니케이션', '110호', '산학협력'],
                ['지상 1층', '현대코퍼레이션(주)', '111호', '산학협력'],
                ['지상 1층', '쏘노리', '113호', '산학협력'],
                ['L층', '현대기아자동차 남양연구소', 'B101호', '산학협력'],
                ['L층', '비비엔느오(파브리아노)', 'B107호', '상점'],
                ['L층', '한세실업', 'B108~B112호', '산학협력'],
                ['L층', '숨코리아', 'B113·B114호', '산학협력'],
                ['L층', '아키폴리건축사사무소', 'B115호', '산학협력'],
                ['L층', '슬런치팩토리', 'B116~B119호', '음식점'],
                ['L층', '엘리트전자', 'B121·B122호', '산학협력'],
                ['L층', 'WDG. 쉐어잇', '-', '산학협력'],
                ['지하 2층', '한국문화예술센터', 'B201-2·B207호', '예술공간'],
                ['지하 2층', '스튜디오 벨벳언더그라운드', 'B201-2·B207호', '산학협력'],
                ['지하 2층', '현대코퍼레이션(주)', 'B203호', '산학협력'],
                ['지하 2층', '한국디자인사이언스연구소', 'B205·B206호', '산학협력'],
                ['지하 2층', '피엔피디건축사사무소', 'B208호', '산학협력'],
                ['지하 2층', '씨오지', 'B210호', '산학협력'],
                ['지하 3층', '미몽', 'B302호', '산학협력'],
                ['지하 3층', '라쿤코트', 'B303호', '산학협력'],
                ['지하 3층', '무소속컴퍼니', 'B304호', '산학협력'],
                ['지하 3층', '공공공간', 'B305·B306호', '산학협력'],
                ['지하 3층', '아토건축도시', 'B307호', '산학협력'],
                ['지하 3층', '숨코리아', 'B309호', '산학협력'],
              ],
            },
          },
          {
            title: '교수 연구실',
            items: ['지하 2층 B204·B211호, 지상 1층 108·109·114·115호예요.'],
          },
        ],
        followUps: [{ label: '아트앤디자인밸리는 어떤 곳?', next: 'start' }],
      },
    },
    checkedAt: '2026-10-21',
  },
  {
    // 운영진 확인(10-25): 학과(과) 학생회비는 학과마다 따로 정하니 소속 학과에 문의하게 한다. 총학생회 안내에는 과 학생회비 내용이 없어
    // 챗봇이 총학생회 소개('학생 자치기구')로 답하던 것을 막는다.
    id: 'dept-council-fee',
    entries: [
      { match: [['과학생회비', '학과학생회비', '과비', '학부학생회비', '전공학생회비', '과회비', '학과회비', '과학생회회비', '학과학생회회비']], node: 'start' },
      // 한 글자 '과'·'학부'는 '결과'·'과정'·'학부생'에 걸려 총학생회비 질문을 끌어왔다(10-25). '과 학생회비'는 공백이 지워져 위 줄로 온다.
      { match: [['학생회비'], ['학과', '우리과', '과마다', '과에서', '학부마다', '전공마다']], node: 'start', not: ['총학'] },
    ],
    nodes: {
      start: {
        kind: 'answer',
        text: '학과(과) 학생회비는 학과마다 따로 정해요. 금액·납부 방법·환불은 소속 학과(과 학생회나 학과 사무실)에 문의해 주세요.',
      },
    },
    checkedAt: '2026-10-25',
  },
  {
    // 교내장학금 페이지(school-scholarship.do)·장학금지급규정(scholarship-regulations.do, 2026-10-15 확인)에서 옮겼다.
    // 운영진 요청(10-25): 장학 안내가 너무 길다 — 학생 대부분이 해당하는 교내 주요 장학금만 표로 보이고 나머지는 학교 페이지로 넘긴다.
    id: 'scholarship-main',
    entries: [
      {
        match: [['장학금종류', '장학금뭐', '장학금어떤', '장학금알려', '장학금정보', '어떤장학금', '무슨장학금', '장학금은뭐', '교내장학금', '교내장학', '성적장학',
          '장학금규정', '장학규정', '장학금지급규정', '홍익인간장학', '자주장학', '창조장학', '협동장학', '정진장학', '한마음장학', '면학장학', '공로장학']],
        node: 'start',
        not: ['국가장학', '국장', '근로', '대출', '신청', '봉사', '입금', '들어와', '조회', '결과'],
      },
    ],
    nodes: {
      start: {
        kind: 'answer',
        // 10-25: 공지 2184(2026-2 교내장학금 신청 안내) — 1차 미신청자 추가 신청 없음, 외국인은 학과사무실 별도 신청, 복학예정자·10학점 미만 학기초과자 제외.
        text: '학생 대부분이 받는 교내장학금은 성적우수 5종(홍익인간·자주·창조·협동·정진)과 가계지원 2종(한마음·면학)이에요. 따로 신청하지 않고, 매 학기 한국장학재단 국가장학금 1차 신청만 하면 심사 대상이 돼요. 1차 기간을 놓치면 추가 신청은 없고, 외국인 학생은 같은 기간에 학과사무실에 따로 신청해요. 복학예정자와 10학점 미만 학기초과자는 7종 대상이 아니에요(2026-2학기 교내장학금 신청 안내 기준).',
        sections: [
          {
            title: '주요 교내장학금',
            table: {
              head: ['장학금', '금액', '조건(직전 학기)'],
              rows: [
                ['홍익인간', '수업료 전액', '성적 4.0 이상'],
                ['자주', '수업료 80% 수준', '성적 3.5 이상'],
                ['창조', '수업료 60% 수준', '성적 3.5 이상'],
                ['협동', '수업료 40% 수준', '성적 3.3 이상'],
                ['정진', '90만원', '성적 3.0 이상'],
                ['한마음', '수업료 50% 수준', '5분위 이하, 소득분위 70%·성적 30%로 선발'],
                ['면학', '120만원', '8분위 이하, 소득분위 70%·성적 30%로 선발'],
                ['공로', '수업료 전액 또는 일부', '학생회·동아리·졸업준비위원회·언론사·기숙사 간부, 성적 2.0 이상'],
              ],
            },
          },
          {
            title: '꼭 확인할 점',
            items: [
              '국가장학금 1차 신청을 안 하면 7종 심사에서 빠져요. 1학기 장학금은 11~12월경, 2학기 장학금은 5~6월경에 신청해요.',
              '7종 모두 직전 학기 15학점 이상 이수가 기본이에요. 홍익인간·자주·창조·협동은 직전 학기 사회봉사 10시간 이상도 필요해요(4학년·5년제 5학년 제외).',
            ],
          },
          {
            title: '더 알아두기',
            items: [
              '성적 기준을 넘어도 학과 안에서 경쟁으로 뽑아요. 학과마다 기준이 달라 학과 사무실에 확인해요.',
              '입학성적우수·국제교류·봉사·신용카드수수료 장학금 등 다른 장학금은 학교 홈페이지 교내장학금 페이지에서 확인해요.',
            ],
          },
        ],
        phones: [{ label: '장학팀 · 외부·교내장학금', phone: '02-320-3210' }],
        links: [
          { label: '학교 홈페이지 · 교내장학금', url: 'https://www.hongik.ac.kr/kr/education/school-scholarship.do' },
          { label: '학교 홈페이지 · 장학금지급규정', url: 'https://www.hongik.ac.kr/kr/education/scholarship-regulations.do' },
        ],
        facilityId: 'hi-g-2f-office-03',
      },
    },
    checkedAt: '2026-10-25',
  },
  {
    // 학교 공지 '2026학년도 2학기 재학생 등록 및 등록금 납부 안내'(2026-08-05)·'학기초과자 및 미등록자 최종 등록 안내'(2026-09-28)에서 옮겼다.
    // 등록금 고지서의 학생회비는 선택납부금이다. '학생회비 납부'를 총학생회 소개로 답하던 것을 막는다(10-25 운영진 제보).
    id: 'student-fee-pay',
    entries: [
      { match: [['학생회비', '학생회회비', '선택납부금', '선택납부']], node: 'start' },
    ],
    nodes: {
      start: {
        kind: 'answer',
        text: '학생회비는 등록금 고지서에 선택납부금으로 함께 나와요. 내려면 수업료와 학생회비를 더한 금액을 등록금 가상계좌로 한 번에 이체하면 돼요.',
        sections: [
          {
            title: '내는 방법',
            ordered: true,
            items: [
              '클래스넷 > 등록(고지서/납부확인서)에서 고지서를 열어 학생회비 금액과 가상계좌 번호를 확인해요.',
              '수업료에 학생회비(졸업준비금도 낼 거면 함께)를 더한 금액을 가상계좌로 이체해요. 계좌번호와 금액이 정확히 맞아야 입금돼요.',
            ],
          },
          {
            title: '수업료만 내고 학생회비를 못 냈다면',
            items: [
              '등록금을 낸 당일에는 같은 가상계좌로 학생회비를 추가로 입금할 수 있어요.',
              '그 뒤에는 학기 중 따로 받는 수납 일정에 내거나, 서울캠퍼스는 문헌관 8층 재무팀, 세종캠퍼스는 A동 2층 총무관리팀에 가서 현금으로 내요(2026-2학기 등록 안내 기준).',
            ],
          },
          {
            title: '참고',
            items: [
              '장학금으로 낼 돈이 0원이어도 학생회비 같은 선택납부금을 가상계좌로 넣으면 자동으로 등록돼요.',
              '학과(과) 학생회비는 학과마다 따로 걷기도 해요. 금액과 방법은 소속 학과(과 학생회나 학과 사무실)에 물어봐 주세요.',
            ],
          },
        ],
        phones: [{ label: '재무팀 · 등록금', phone: '02-320-3139' }],
        links: [
          { label: '학교 공지: 2026학년도 2학기 재학생 등록 및 등록금 납부 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154856&noCat=500' },
        ],
        facilityId: 'hi-mh-8f-office-01',
      },
    },
    checkedAt: '2026-10-25',
  },
  {
    // 운영진 확인(10-25): 다른 대학에 편입하려면 홍익대(모교)에서 자퇴해야 한다. 자퇴 절차·서류·등록금 반환 기준은 학교 홈페이지 자퇴 안내
    // (dropping-out-of-school.do, 2026-10-15 확인)에서 옮겼다. 홍익대로 들어오는 편입학은 이 흐름이 아니다.
    id: 'transfer-out',
    entries: [
      { match: [['편입'], ['자퇴', '그만두', '다른학교', '다른대학', '타대', '타학교', '나가', '합격했', '붙었', '모교']], node: 'start', not: ['홍대로', '홍익대로', '홍익으로', '편입생', '편입학전형'] },
    ],
    nodes: {
      start: {
        kind: 'answer',
        text: '다른 대학에 편입하려면 홍익대에서 자퇴해야 해요. 자퇴 절차는 일반 자퇴와 같고, 자퇴원서를 최종 제출한 날에 따라 등록금 반환 금액이 달라져요.',
        sections: [
          {
            title: '자퇴 절차',
            ordered: true,
            items: [
              '자퇴원서를 써요(학생과 보호자 도장).',
              '소속 학과 → 단과대학 행정실 → 장학팀 → 중앙도서관 대출실 순으로 확인 도장을 받아요.',
              '학사지원팀에 자퇴원서를 내요.',
            ],
          },
          {
            title: '등록금 반환(자퇴원서 최종 제출일 기준)',
            table: {
              head: ['제출일', '1학기', '2학기', '반환'],
              rows: [
                ['학기 시작 전', '~2.28', '~8.31', '전액'],
                ['시작 후 30일까지', '3.1~3.30', '9.1~9.30', '수업료의 5/6'],
                ['30일~60일', '3.31~4.29', '10.1~10.30', '수업료의 2/3'],
                ['60일~90일', '4.30~5.29', '10.31~11.29', '수업료의 1/2'],
                ['90일 지난 뒤', '5.30~', '11.30~', '반환 안 함'],
              ],
            },
            items: [
              '환불받을 등록금이 있으면 학생·보호자 신분증 사본, 가족관계증명서, 보호자 통장 사본을 함께 내요.',
              '신입생은 학기 시작일(3월 1일·9월 1일) 이후에만 자퇴를 받고, 전액 반환은 안 돼요.',
            ],
          },
        ],
        phones: [LEAVE_PHONE],
        links: [{ label: '학교 홈페이지 · 자퇴', url: 'https://www.hongik.ac.kr/kr/education/dropping-out-of-school.do' }],
      },
    },
    checkedAt: '2026-10-25',
  },
  // 학교 Q&A·안내 공지(학사)에서 옮긴 기준·예외·놓쳤을 때 결과(10-25). 낱말 찾기 길은 두지 않는다 — 서버 LLM 이 고르거나 search_guides 로 찾는다.
  // 주제마다 초안 작성 → 공지 원문 대조 검수를 거쳤다. 학기 날짜는 학기를 밝혀 적었으니 새 학기 공지가 나오면 바꾼다.
  {
    // 근거: 학교 공지 2076·2078(2026-07-22, 학사). 1948(자율전공)은 2076의 2025-2학기판 재게시라 2076으로 대체, 1574(법학부)는 학과 안내라 학교 기준으로 쓰지 않음.
    id: 'faq-registration',
    entries: [],
    nodes: {
      'credit-rules': {
        kind: 'answer',
        text: '학점 이월은 최대 2학점, 직전 학기 성적 3.5 이상이면 최대 3학점 추가 신청, 최소는 학기당 12학점이에요. 이월은 학사경고를 받았거나 8학기(5년제 10학기) 이상 이수했으면 안 돼요. 본인 최대 학점은 클래스넷 개인별 수강가능학점에서 확인해요.',
        sections: [
          {
            title: '최대 학점이 늘어나는 경우',
            items: [
              '직전 학기 성적이 3.5 이상이면 최대 3학점을 더 신청할 수 있어요.',
              '학점 이월은 최대 2학점이에요. 직전 학기가 학사경고(성적경고)면 이월이 안 돼요. F가 2과목 이상이면 학사경고예요.',
              '4년제 8학기, 5년제 10학기 이상 이수했으면 학점 이월 대상이 아니에요(단, 학기재수강은 제외).',
              '본인 최대 학점은 클래스넷 › 수강신청 › 수강신청 안내 › 개인별 수강가능학점 조회에서 봐요.',
            ],
          },
          {
            title: '12학점을 못 채우면?',
            items: [
              '12학점을 안 채워도 수강신청에는 문제없어요.',
              '다만 학년별 학점을 못 채우면 학년별 수료증명서가 안 나와요. 1학년 2학기 등록·33학점, 2학년 4학기·66학점, 3학년 6학기·99학점, 4학년 8학기·132학점, 5학년 10학기·162학점 이상이에요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 수강신청 안내①', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154444&noCat=500' },
          { label: '학교 공지: 2026-2학기 수강신청 Q&A③', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154447&noCat=500' },
        ],
      },
      'cart-and-apply': {
        kind: 'answer',
        text: '담아두기(사전담기)는 본인 최대 수강제한학점까지만 돼요. 담은 학점과 상관없이 과목별 수강신청은 되지만, 이미 신청한 학점과 더해 수강제한학점 이상이 되면 오류가 날 수 있어요.',
        sections: [
          {
            title: '담아두기·신청할 때',
            items: [
              '이미 신청한 학점과 담은 과목 학점을 더해 수강제한학점 안인지 꼭 계산하고 신청해요.',
              '“담은 과목 삭제하기”로 지워도 신청이 철회되지 않아요. 철회는 “수강신청 철회하기”에서만 돼요.',
              '과목이 붉은색이면 신청인원이 제한인원을 넘은 거예요. 꼭 들어야 하면 개강 후 교수님께 수강신청정정허가원을 내요.',
              '제한인원보다 1~2명 많은 건 같은 순간(마이크로초 단위)에 신청한 학생이 모두 들어간 경우예요. 특혜가 아니에요.',
            ],
          },
          {
            title: '과목이 안 보이거나 담기지 않으면',
            items: [
              '내 학과가 들을 수 있는 과목인지 주관학과 사무실에 묻거나 비고란(예: 타과생 수강불가)을 확인해요.',
              '시간표에 수업시간이 비어 있는 과목은 조회만 되고 담기·신청은 안 돼요. 주관학과 사무실에 물어봐요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 수강신청 Q&A③', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154447&noCat=500' },
        ],
      },
      'correction-rules': {
        kind: 'answer',
        text: '수강정정에서 같은 학수번호 다른 분반, 시간 겹치는 과목, 수강제한학점을 넘는 인원초과 과목도 정정 신청은 돼요. 교수님 승인을 확인한 뒤 기존 과목을 꼭 철회해야 반영돼요.',
        sections: [
          {
            title: '정정 순서',
            ordered: true,
            items: [
              '인원이 남은 과목은 정정기간에 수강신청시스템에서 바로 신청해요. 마감된 과목은 클래스넷 › 수강신청 › 인원초과 과목 수강정정 신청에서 사유를 쓰고 신청해요.',
              '정정 허용은 교수님 재량이에요. 받아 줄지는 교수님께 직접 물어봐요.',
              '교수님 승인을 확인한 뒤에 기존 분반, 시간 겹치는 과목, 넘치는 학점만큼의 과목을 철회해요. 그래야 학과가 정정 처리해요.',
            ],
          },
          {
            title: '철회를 안 하거나 먼저 하면',
            items: [
              '시간이 겹친 채로 두면 겹친 과목 모두 수강할 수 없고 알림 없이 지워져요.',
              '학점이 넘친 채로 두면 정정이 제대로 반영되지 않아요.',
              '철회한 과목은 다시 되살릴 수 없어요. 승인 확인 전에 먼저 철회하지 마세요.',
              '정정이 끝나도 클래스룸에는 다음 날 새벽에 연동돼 약 1일 걸려요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 수강신청 Q&A③', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154447&noCat=500' },
        ],
      },
      'missed-registration': {
        kind: 'answer',
        text: '수강신청을 놓치면 학사지원팀이 따로 해결해 주지 않아요. 개강 후 정정기간에 직접 정정해야 하고, 등록금을 내고 수강신청을 안 하면 그 학기는 성적경고 처리돼요.',
        sections: [
          {
            title: '놓쳤을 때 결과',
            items: [
              '수강신청은 모두 같은 시간, 같은 시스템으로 해서 개인 예외가 없어요. 개강 후 정정기간에 직접 정정해요.',
              '등록금을 낸 학생이 수강신청을 하지 않으면 그 학기 성적경고예요.',
              '철회한 뒤에는 수강정정을 할 수 없어요. 신중히 철회해요.',
              '폐강은 학생에게 따로 알리지 않아요. 학교 홈페이지 학생공지·클래스넷 공지에 올라오는 폐강 공고를 직접 확인해요(2026-2학기는 9.10 오후 공고). 폐강됐으면 폐강과목 정정일에 수강신청시스템 › 폐강과목 수강정정에서 다른 과목으로 바꿔요.',
            ],
          },
          {
            title: '정정기간 결석은 공결이에요?',
            items: [
              '개강 후 정정기간에 신청해서 결석 처리된 경우만 일괄 공결돼요.',
              '수강신청 기간에 이미 신청해 놓고 정정기간에 결석했거나, 정정으로 신청한 뒤 수업에 나올 수 있었던 경우는 공결이 아니에요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 수강신청 Q&A③', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154447&noCat=500' },
          { label: '학교 공지: 2026-2학기 수강신청 안내①', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154444&noCat=500' },
        ],
      },
      'excess-semester-registration': {
        kind: 'answer',
        text: '학기초과자 수강신청은 4학년 수강신청일이나 전학년 수강신청일에 해요. 직전 학기까지 취득학점이 졸업학점에 못 미쳤는데 아예 신청 안 하면 미등록 제적이라 최소 1학점은 신청해야 해요.',
        sections: [
          {
            title: '수강신청을 아예 안 하면',
            items: [
              '직전 학기까지 취득학점이 졸업학점보다 적으면 미등록 제적돼요.',
              '졸업학점 이상이면 신청을 안 해도 학교가 직권으로 0원 등록해 재학생으로 남아요.',
              '졸업학점은 4년제 132학점(B6부터)·140학점(B5까지), 5년제 162학점(B6부터)·170학점(B5까지)이에요.',
            ],
          },
          {
            title: '재수강도 돼요?',
            items: [
              '학기초과자는 재수강 신청도 할 수 있어요.',
              '학사학위취득유예(졸업유예)생은 신규 교과목만 들을 수 있고 재수강은 안 돼요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 수강신청 안내①', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154444&noCat=500' },
          { label: '학교 공지: 2026-2학기 수강신청 Q&A③', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154447&noCat=500' },
        ],
      },
      'change-drop-dates': {
        kind: 'answer',
        text: '2026-2학기 기준 수강정정은 9.1부터 인원 마감 과목 9.6 24시, 미만 과목 9.7 23:59까지였고, 수강철회는 9.8 17시까지, 추가 철회는 9.21~9.22였어요.',
        sections: [
          {
            title: '2026-2학기 기준 정정·철회 일정',
            table: {
              head: ['구분', '기간'],
              rows: [
                ['정정(제한인원 마감 과목)', '9.1(화) 09:00 ~ 9.6(일) 24:00'],
                ['정정(제한인원 미만 과목)', '9.1(화) 09:00 ~ 9.7(월) 23:59'],
                ['수강 철회', '~ 9.8(화) 17:00 (시작은 공지①에 9.8 00:00, Q&A③에 9.7 17:00)'],
                ['폐강 공고 · 폐강과목 정정', '9.10(목) 오후 공고 ~ 9.11(금) 17:00'],
                ['추가 수강 철회', '9.21(월) 09:00 ~ 9.22(화) 17:00'],
              ],
            },
          },
          {
            title: '알아 둘 점',
            items: [
              '철회는 수강신청시스템 › 정규학기 수강신청 › 수강신청 화면 바로가기 › 수강신청 철회하기에서 해요. 추가 철회도 같은 방법이에요.',
              '철회한 뒤에는 정정이 안 돼요. 신중히 철회해요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 수강신청 안내①', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154444&noCat=500' },
          { label: '학교 공지: 2026-2학기 수강신청 Q&A③', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154447&noCat=500' },
        ],
      },
    },
    checkedAt: '2026-10-25',
  },
  {
    // 근거: 학교 공지(학사) 2093·2091(2026-07-13), 2068(2026-08-04), 2052(2026-08-31) / 학과 게시판 옮겨 실은 글 1901(자율전공, 2026-01-16, 2026-1학기 학사 Q&A)
    id: 'faq-leave',
    entries: [],
    nodes: {
      'leave-schedule': {
        kind: 'answer',
        text: '휴학·복학 신청 기간은 매 학기 학교 홈페이지 교육 › 대학 › 대학공지 › 학사에 공지로 나와요. 2026-2학기는 복학 7.21~8.3, 휴학(연장) 8.24~8.30이었어요.',
        sections: [
          {
            title: '2026-2학기 기준 일정',
            table: {
              head: ['구분', '기간', '비고'],
              rows: [
                ['복학 신청', '7.21~8.3', '기숙사 신청하려면 7.30까지 복학 신청'],
                ['최종 복학 신청', '8.6~8.12', '이 뒤로는 복학 신청 불가'],
                ['휴학(연장) 신청', '8.24~8.30', '등록금 납부 기간과 같아요'],
                ['추가 휴학·휴학 연장', '9.11~9.16', '이 뒤로는 휴학 신청 불가'],
              ],
            },
          },
          {
            title: '공지는 어디에 올라와요?',
            items: [
              '학교 홈페이지 교육 › 대학 › 대학공지 › 학사(뉴스센터 › 공지사항에도 같이)에 올라와요. 2026-2학기는 7월 13일 첫 안내, 8월 4일 최종 안내, 8월 31일 추가 휴학 안내가 올라왔어요.',
              '공지에서는 클래스넷 › 학사/학적 › 학적변동안내 및 조회 메뉴의 안내사항도 같이 확인하라고 해요.',
              '신청은 클래스넷 › 학사/학적 › 휴/복학/휴학연장 신청에서 하고, 결과는 학적변동조회에서 꼭 확인해요.',
              '휴학은 서울캠퍼스는 중앙도서관과 학사지원팀, 세종캠퍼스는 문정도서관과 교무입시팀 승인을 모두 받아야 해요. 복학·휴학 연장은 학사지원팀(세종은 교무입시팀) 승인을 받아요.',
              '2026-2학기 안내 기준으로 처리는 신청 기간 끝난 다음 날 12시까지 돼요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 복학·휴학 신청 안내①', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154086&noCat=500' },
          { label: '학교 공지: 2026-2학기 최종 복학 및 휴학(연장) 신청', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154786&noCat=500' },
          { label: '학교 공지: 2026-2학기 추가 휴학 및 휴학 연장', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=155976&noCat=500' },
        ],
      },
      'leave-tuition-scholarship': {
        kind: 'answer',
        text: '휴학 신청과 등록금 납부는 순서 상관없어요. 휴학 학기에 낸 등록금은 복학 학기로 이월돼 고지서에 0원으로 나와요. 학비 감면 장학생은 내고 휴학해야 장학금이 살아요.',
        sections: [
          {
            title: '등록금, 내야 해요?',
            items: [
              '휴학생 납부는 선택이에요. 직전 학기를 이수했으면 휴학하는 학기에도 낼 수 있어요.',
              '학비 감면 장학생(홍익인간·자주·창조·협동·정진·한마음·면학)이 안 내고 휴학하면 그 장학금은 없어지고, 복학할 때 감면 없는 전액을 내요.',
              '전액장학금 대상은 등록기간에 클래스넷 › 등록 › 등록금 고지서 › "전액장학금 수혜자 0원 등록"을 눌러야 해요. 안 누르면 미등록제적될 수 있어요. 휴학하려면 휴학 신청을 따로 해요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 복학·휴학 자주 묻는 Q&A', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154110&noCat=500' },
          { label: '학교 공지: 2026-2학기 최종 복학 및 휴학(연장) 신청', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154786&noCat=500' },
        ],
      },
      'leave-freshman-military': {
        kind: 'answer',
        text: '신입생은 입학 후 1년(1학년 1·2학기) 일반휴학이 안 돼요. 군휴학·질병휴학만 증빙서류로 할 수 있고, 학기 중 입대는 입영일 10일 전~입영일에 군입대휴학을 신청해요.',
        sections: [
          {
            title: '학기 중에 입대하면',
            items: [
              '권장: 일반휴학을 먼저 신청하고, 입영일 10일 전~입영일에 군입대휴학을 신청하면 군휴학으로 바뀌어요.',
              '1학년은 일반휴학이 안 되니 다니다가 바로 군입대휴학을 신청해요. 이때 등록금을 안 냈으면 미등록제적될 수 있고, 수강신청 내역은 모두 지워져요.',
              '등록금을 내고 다니다가 군입대휴학하면 낸 등록금은 복학 학기로 이월돼요.',
              '클래스넷 › 학사/학적 › 군입대휴학 신청에서 하고, 입대일이 적힌 증빙(입영통지서, 군입영사실확인서, 병적증명서 등)을 올려야 해요.',
            ],
          },
          {
            title: '휴학 안 하고 입대했다면',
            items: [
              '재학생으로 남아 등록금 이연 불가, 성적경고 같은 불이익을 받을 수 있어요.',
              '인터넷 신청이 안 돼요. 군입대휴학 소급신청서·사유서를 자필로 쓰고 병적증명서 같은 증빙과 함께 이메일로 내요(서울 support@hongik.ac.kr, 세종 sejongclass@hongik.ac.kr).',
            ],
          },
          {
            title: '신입생이 3월 1일 전에 입대하면(2026-1학기 안내 기준)',
            ordered: true,
            items: [
              '학기 시작 전 입영은 군휴학을 직접 신청할 수 없어요. 먼저 등록기간 안에 등록금을 내요. 안 내면 합격이 취소돼요.',
              '학번을 확인하고, 군휴학 소급신청서와 입영통지서 등 증빙을 3월 중에 이메일로 내요. 1~2월에 내면 처리되지 않아요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 복학·휴학 자주 묻는 Q&A', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154110&noCat=500' },
          { label: '학교 공지: 2026-2학기 추가 휴학 및 휴학 연장', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=155976&noCat=500' },
          { label: '자율전공 게시판: 2026-1학기 복학·휴학 자주 묻는 QnA', url: 'https://fm.hongik.ac.kr/fm/0401.do?mode=view&articleNo=147537&article.offset=0&articleLimit=50' },
        ],
      },
      'leave-extend-missed': {
        kind: 'answer',
        text: '휴학이 끝나도 저절로 복학이나 휴학 연장이 되지 않아요. 기간 안에 둘 중 하나를 신청하지 않으면 미복학제적될 수 있어요.',
        sections: [
          {
            title: '더 쉬고 싶으면',
            items: [
              '복학 신청 기간이나 휴학 신청 기간에 클래스넷에서 "휴학 연장 신청"을 해요.',
              '2026-2학기 기준 마지막 기회는 추가 휴학·휴학 연장 기간(9.11~9.16)이었고, 그 뒤엔 휴학 신청이 안 됐어요.',
            ],
          },
          {
            title: '놓치면 이렇게 돼요',
            items: [
              '복학·연장 둘 다 안 하면 학칙에 따라 미복학제적될 수 있어요.',
              '졸업 예정 학기에 휴학하면 그 시기에 졸업할 수 없어요. 졸업은 재학 상태에서만 돼요(예: 2026-2학기 휴학자는 2027년 2월 졸업 불가).',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 추가 휴학 및 휴학 연장', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=155976&noCat=500' },
          { label: '학교 공지: 2026-2학기 최종 복학 및 휴학(연장) 신청', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154786&noCat=500' },
        ],
      },
      'leave-cancel-change': {
        kind: 'answer',
        text: '휴학이나 복학을 신청한 뒤 바꾸려면 학적변동취소원을 이메일로 내야 해요. 인터넷으로는 취소가 안 되고 시간이 걸려요.',
        sections: [
          {
            title: '복학 신청 → 휴학으로 바꾸기',
            ordered: true,
            items: [
              '학적변동취소원을 써서 이메일로 내요(서울 support@hongik.ac.kr, 세종 sejongclass@hongik.ac.kr).',
              '휴학 신청 기간 안에 클래스넷에서 직접 휴학을 신청해요. 저절로 휴학 신청되지 않아요. 2026-2학기는 마지막 휴학 신청 기간(9.11~9.16)이 지나면 휴학 신청이 안 됐어요.',
            ],
          },
          {
            title: '휴학 신청 → 복학으로 바꾸기',
            ordered: true,
            items: [
              '학적변동취소원과 복학원서를 써서 이메일로 내요.',
              '수강정정 기간 안에 직접 수강신청해요.',
              '등록금을 안 냈으면 추가 등록기간(2026-2학기 기준 9.11~9.16)에 꼭 내요. 안 내면 미등록제적돼요. 휴학 전에 냈으면 이월돼요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 복학·휴학 자주 묻는 Q&A', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154110&noCat=500' },
        ],
      },
      'return-after-military': {
        kind: 'answer',
        text: '학기 시작일(3월 1일·9월 1일) 뒤에 전역해도 잔여휴가로 개강일부터 출석할 수 있으면 복학할 수 있어요. 증빙서류를 기한 안에 안 내면 복학이 취소돼요.',
        sections: [
          {
            title: '개강 뒤 전역자 복학',
            items: [
              '개강일부터 전역일 전까지 모든 평일을 잔여휴가로 채워야 해요. 병휴가는 못 써요(예: 9월 10일 전역이면 평일 7일). 잔여휴가가 모자라면 복학 승인이 안 돼요.',
              '2026-1학기 안내에는 사회복무요원은 평일과 주말을 모두 포함해 잔여휴가가 있어야 한다고 나와 있었어요.',
              '복학 신청 때 전역 예정일을 넣고, 전역 예정 증명서와 휴가 일수 잔여 증명서를 내요. 2026-2학기는 8월 20일 16시까지, 서울캠퍼스는 구글 서베이, 세종캠퍼스는 이메일이었어요.',
              '기한 안에 증빙을 안 내거나 잔여휴가가 모자라 수업 결손이 확인되면 복학이 취소될 수 있어요.',
              '개강일 당일(2026-2학기는 9월 1일)까지 전역하면 복학 신청 때 전역일만 넣으면 되고 증빙은 필요 없어요.',
            ],
          },
          {
            title: '복학하고 나서 할 일',
            items: [
              '군 전역 학생은 복학 신청 뒤 학생예비군 전입신고를 해요. 안 하면 지역예비군으로 편성돼 추가 훈련을 받을 수 있어요.',
              '학기재수강은 복학 신청 기간과 같은 때 신청하는데, 복학 승인이 난 뒤에 할 수 있어요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 복학·휴학 신청 안내①', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154086&noCat=500' },
          { label: '학교 공지: 2026-2학기 복학·휴학 자주 묻는 Q&A', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154110&noCat=500' },
        ],
      },
    },
    checkedAt: '2026-10-25',
  },
  // 근거: 학교 공지 2089(2026-07-14)·2069(2026-08-03)·1900(2026-01-16, 자율전공 게시판 전재)·2050(2026-09-01)
  {
    id: 'faq-retake',
    entries: [],
    nodes: {
      'semester-retake-range': {
        kind: 'answer',
        text: '학기재수강은 지우려는 학기부터 가장 최근 학기까지 연이어 모두 신청해야 해요. 중간의 특정 학기 1개만 골라 지울 수는 없어요.',
        sections: [
          {
            title: '이럴 땐 돼요? 안 돼요?',
            items: [
              '2-2학기까지 다녔는데 1-2학기만 지우고 싶어요: 안 돼요. 1-2부터 2-2학기까지 모두 신청해야 해요.',
              '2-1학기까지 다녔는데 1-2, 2-1학기를 다 지우고 싶어요: 두 학기 모두 돼요.',
              '3-2학기까지 다녔는데 2학년부터 다시 하고 싶어요: 돼요. 다만 학기를 맞춰 신청해야 해요. 2-1학기부터 지우려면 1학기 신청 기간(1~2월)에, 2-2학기부터 지우려면 2학기 신청 기간(7~8월)에 신청해요.',
              '시기가 안 맞으면 한 학기 휴학하고 복학할 때 신청해요. 예를 들어 2학기 기간에 2-1학기부터 지우고 싶다면 2학기에 휴학하고 다음 해 1학기 복학 신청 후 학기재수강을 신청해요.',
              '계절학기와 군 이러닝으로 학점을 딴 학기는 학기재수강 대상이 아니고, 삭제되지도 않아요.',
            ],
          },
        ],
        links: [{ label: '학교 공지: 2026-2학기 학기재수강 신청 안내', url: 'https://www.hongik.ac.kr/kr/education/notice-undergrad.do?mode=view&articleNo=154147&article.offset=50&articleLimit=50&srCategoryId=23&noCat=23' }],
      },
      'semester-retake-apply': {
        kind: 'answer',
        text: '학기재수강 신청은 재학생·복학 예정자가 클래스넷에서 해요. 2026-2학기 기준 7.21~8.3, 추가 신청 8.6~8.12였어요.',
        sections: [
          {
            title: '신청 방법',
            ordered: true,
            items: [
              'MY HONGIK → 클래스넷 → 학사/학적 → 학기재수강 신청에서 신청해요.',
              '복학 예정자는 복학 신청이 승인된 뒤에 신청할 수 있어요. 직전 한 학기만 지우는 복학 예정자는 복학 신청할 때(학사/학적 → 휴/복학/휴학연장 신청 → 복학 신청) “학기재수강”을 선택하면 돼요.',
              '승인은 일괄 처리돼요. 2026-2학기 기준 8.4 오전, 추가 신청분은 8.13 오전에 승인됐어요.',
            ],
          },
          {
            title: '신청 시기와 예외',
            items: [
              '2026-1학기 기준 신청 기간은 1.21~2.3이었어요. 1학기 신청은 1~2월, 2학기 신청은 7~8월에 있어요.',
              '학사학위취득유예자는 학기재수강을 신청할 수 없어요.',
            ],
          },
        ],
        links: [
          { label: '학교 공지: 2026-2학기 학기재수강 추가 신청 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154771&noCat=500' },
          { label: '학교 공지: 2026-2학기 학기재수강 신청 안내', url: 'https://www.hongik.ac.kr/kr/education/notice-undergrad.do?mode=view&articleNo=154147&article.offset=50&articleLimit=50&srCategoryId=23&noCat=23' },
        ],
      },
      'semester-retake-after': {
        kind: 'answer',
        text: '학기재수강한 학기 성적은 모두 지워지고 어떤 이유로도 되돌릴 수 없어요. 지운 학기를 빼고 8학기(5년제 10학기)를 채워야 해요.',
        sections: [
          {
            title: '신청 전에 꼭 알아 둘 것',
            items: [
              '성적경고를 받은 학기를 지워도 성적경고 기록은 그대로 남아요.',
              '신청한 학기에 휴학·제적 같은 학적 변동이 생기면 학기재수강 신청이 직권 취소돼요.',
              '지운 학기도 재학연한에 들어가요. 재학연한 안에 졸업 요건을 모두 갖춰야 해요. 재학연한은 신입생 16학기(5년제 20학기), 편입생 8학기(5년제 12학기)이고 휴학 기간은 빼요.',
              '지운 학기를 빼고 수업연한을 채워야 해서 등록금을 더 낼 수 있어요.',
            ],
          },
        ],
        links: [{ label: '학교 공지: 2026-2학기 학기재수강 신청 안내', url: 'https://www.hongik.ac.kr/kr/education/notice-undergrad.do?mode=view&articleNo=154147&article.offset=50&articleLimit=50&srCategoryId=23&noCat=23' }],
      },
      'credit-withdraw-eligible': {
        kind: 'answer',
        text: '학점포기는 4학기 이상 이수한 재학생만 할 수 있고, C+ 이하 최초 수강 과목이 동일·대체과목 없이 폐지된 경우 등에만 돼요.',
        sections: [
          {
            title: '포기할 수 있는 과목',
            items: [
              'C+ 이하로 처음 들은 과목 중 동일·대체과목 없이 폐지된 과목이에요. 동일·대체과목은 클래스넷 → 수업정보 → 동일교과목 검색에서 확인해요.',
              '2020학년도 1학기에 들은 C+ 이하 과목은 모두 신청할 수 있어요.',
              '학과진입·전과로 소속이 바뀌어 수강이 막힌 과목은 폐지되지 않았어도 돼요. 이 경우 공지에 붙은 학점포기 신청서를 써서, 신청 기간 안에 본인이 과목 주관학과에 가서 담당조교·학과장 확인 날인을 받은 뒤 평일 9~17시(점심 12~13시 제외)에 학사지원팀(세종캠퍼스는 교무입시팀)에 직접 내요.',
            ],
          },
          {
            title: '안 되는 경우',
            items: [
              '휴학생, 학사학위취득유예자, 4학기를 아직 못 채운 학생은 안 돼요. 4학기를 채운 뒤에 신청하면 돼요.',
              '그 과목을 재수강 신청했거나, 사이버 강좌이거나, P로 딴 과목은 포기할 수 없어요.',
            ],
          },
        ],
        links: [{ label: '학교 공지: 2026-2학기 학점포기 신청 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=156088&noCat=500' }],
      },
      'credit-withdraw-after': {
        kind: 'answer',
        text: '학점포기는 승인되면 취소·번복이 안 되고 그 과목 학점이 완전히 지워져요. 성적증명서에는 W로 표기돼요. 2026-2학기 기준 신청 기간은 9.10 09시~9.16 17시였고, 기한을 꼭 지켜야 해요.',
        sections: [
          {
            title: '신청과 취소',
            ordered: true,
            items: [
              'MY HONGIK → 클래스넷 → 성적/졸업정보 → 학점포기 신청에서 가능 과목을 보고 “신청”을 눌러요.',
              '승인 전이면 신청 기간 안에 학점포기 신청내역에서 취소할 수 있어요.',
              '승인되면 전체성적 조회에서 바뀐 취득 학점과 증명평점을 확인해요.',
            ],
          },
          {
            title: '포기하면 어떻게 돼요?',
            items: [
              '졸업학점이 모자라게 돼도 되돌릴 수 없어요. 신청 전에 졸업요건을 꼭 확인해요.',
              '필수과목을 포기하면 다시 이수하거나 경과조치에 따른 대체과목을 들어야 졸업할 수 있어요.',
            ],
          },
        ],
        links: [{ label: '학교 공지: 2026-2학기 학점포기 신청 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=156088&noCat=500' }],
      },
    },
    checkedAt: '2026-10-25',
  },
  {
    // 근거: 학교 공지 2115(2026-06-19)·2103(2026-07-07)·2121(2026-05-28), 바이오헬스융합학부 공지 70(2026-10-23)·86(2026-04-20)
    id: 'faq-seasonal',
    entries: [],
    nodes: {
      'cancelled-course': {
        kind: 'answer',
        text: '계절학기 폐강과목은 과목당 1번, 폐강된 과목 수·학점 이하로만 다른 과목으로 정정할 수 있어요. 정정하지 않으면 그 과목 수강료는 전액 환불돼요.',
        sections: [
          {
            title: '정정 기준',
            items: [
              '2026 하계 계절학기 기준 폐강과목 정정은 6.19(금) 15시~6.23(화) 16시에 수강신청 시스템에서 했어요.',
              '정정은 폐강된 과목당 1번만 돼요. 한 번 정정한 뒤 다시 바꿀 수 없어요.',
              '제한인원에 여유가 있는 과목으로만 바꿀 수 있어요.',
              '폐강된 과목 수와 학점을 넘을 수 없어요. 예를 들어 2과목 5학점이 폐강되면 2과목 5학점 이하로만 정정돼요(3학점 2과목은 안 돼요).',
              '폐강이 아닌 다른 이유로는 정정할 수 없고, 폐강 결정을 되돌려 달라는 것도 어려워요.',
            ],
          },
          {
            title: '정정 안 하면',
            items: [
              '기간 안에 정정하지 않으면 폐강과목 수강료는 전액 환불돼요. 정정 마감 시각이 지나면 환불이 확정돼요.',
              '클래스넷 › 개인정보 변경에 본인 명의 계좌를 정확히 넣어야 해요. 안 넣거나 잘못 넣으면 환불을 못 받아요.',
              '등록된 본인 명의 계좌로 2주 안에 환불돼요.',
            ],
          },
        ],
        links: [{ label: '학교 공지: 2026 하계 계절학기 폐강과목 및 수강철회/환불신청 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=153273&noCat=500' }],
      },
      'drop-refund': {
        kind: 'answer',
        text: '계절학기 수강철회는 철회기간에 하면 전액 환불이고, 개강 뒤에는 환불신청한 날에 따라 수강료의 5/6, 2/3, 1/2만 돌려받아요. 그 뒤에는 환불신청이 안 돼요.',
        sections: [
          {
            title: '철회기간 안에(전액 환불)',
            items: [
              '2026 하계 계절학기 기준 철회기간은 6.19(금) 15시~6.23(화) 16시였어요.',
              '클래스넷 › 수강신청 › 계절학기 수강신청 › 수강신청 화면 바로가기에서 과목을 철회해요.',
              '2과목 중 1과목만 철회해도 돼요. 철회한 과목 수강료가 개강 후 2주 안에 본인 명의 계좌로 환불돼요.',
            ],
          },
          {
            title: '개강 뒤 환불신청(2026 하계 계절학기 기준, 개강 6.24)',
            table: {
              head: ['환불신청 날짜', '환불 금액'],
              rows: [
                ['6.24(수) 9시~6.25(목) 24시', '수강료의 5/6'],
                ['6.26(금) 9시~6.28(일) 24시', '수강료의 2/3'],
                ['6.29(월) 9시~6.30(화) 24시', '수강료의 1/2'],
                ['6.30(화) 24시 이후', '환불신청 안 됨'],
              ],
            },
            items: [
              '개강일부터는 클래스넷 › 수강신청 › 계절학기 환불신청 메뉴에서 본인이 직접 신청해야 해요.',
              '부분 환불은 환불신청 마감일 뒤 2주 안에 본인 명의 계좌로 들어와요.',
            ],
          },
        ],
        links: [{ label: '학교 공지: 2026 하계 계절학기 폐강과목 및 수강철회/환불신청 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=153273&noCat=500' }],
      },
      grades: {
        kind: 'answer',
        text: '계절학기 성적은 성적조회 기간에 클래스넷 › 성적정보 › 금학기 성적조회에서 봐요. 성적 문의는 이 기간 안에 담당 교수님께 해야 해요.',
        sections: [
          {
            title: '2026 하계 계절학기 기준',
            items: [
              '성적조회는 7.17(금) 10시~7.20(월) 15시였어요.',
              '계절학기 성적이 들어간 성적증명서는 7.21(화) 10시부터 발급됐어요.',
            ],
          },
          {
            title: '알아둘 점',
            items: [
              '성적에 궁금한 점이 있으면 성적조회 기간 안에 과목 담당 교수님께 연락해야 해요.',
              '바이오헬스 과목은 바이오헬스 혁신융합대학의 성적 정정 안내를 따로 확인해요.',
              '바이오헬스 과목 성적은 금학기 성적조회에서 공란으로 보이고, 확정 뒤 클래스넷 전체성적조회에서 볼 수 있어요(2026 하계는 7.21 10시부터).',
            ],
          },
        ],
        links: [{ label: '학교 공지: 2026학년도 하계계절학기 성적조회 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=153900&noCat=500' }],
      },
      'biohealth-seasonal': {
        kind: 'answer',
        text: '바이오헬스융합학부(바이오헬스 혁신융합대학) 계절학기는 2026 동계 기준 수강신청이 11.3~11.5, 학사일정이 12.22~2027.1.9예요. 철회기간이 따로 없고, 클래스넷이 아닌 통합플랫폼에서 신청해요.',
        sections: [
          {
            title: '2026 동계 계절학기 일정',
            items: [
              '수강신청: 2026.11.3(화) 10시~11.5(목) 17시, 원바이오 통합플랫폼(portal.biocoss.ac.kr)에서 해요.',
              '수강료: 홍익대 1차 수강료 납부기간인 12.14(월) 9시~12.16(수) 16시에 클래스넷 › 고지서/납입증명서 출력 › 계절학기 수업료 고지서로 내요.',
              '학사일정: 2026.12.22(화)~2027.1.9(토)예요. 홍익대 계절학기 일정과 달라요.',
            ],
          },
          {
            title: '바이오헬스융합학부 계절학기 기준',
            items: [
              '홍익대 재학생만 신청할 수 있어요. 휴학생은 가입·신청이 안 돼요.',
              '홍익대 학적 연동을 위해 정보제공동의를 꼭 해야 해요.',
              '신청기간 밖에서는 신청·정정·철회가 안 되고, 정해진 납부기간 외 추가 납부도 안 돼요.',
              '1차 납부기간에 안 내면 신청 내역이 자동 삭제돼 철회로 처리돼요. 신청한 과목 전체를 내야 하고 일부만 낼 수 없어요. 환불은 홍익대 계절학기 환불 규정을 따라요.',
              '바이오헬스융합학부 계절학기 수업료는 학부 공지 기준 학점당 8만원이고, 최대 6학점까지 들을 수 있어요.',
              '고지서에 신청한 과목명이 정확히 적혀 있는지 꼭 확인해요.',
            ],
          },
        ],
        links: [
          { label: '바이오헬스융합학부 공지: 2026학년도 동계 계절학기 학사일정 및 수강신청 안내', url: 'https://biohealth.hongik.ac.kr/22/?q=YToyOntzOjQ6InBhZ2UiO2k6MTtzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=175238384&t=board' },
          { label: '바이오헬스융합학부 공지: 2026학년도 하계 계절학기 학사일정 및 수강신청 안내', url: 'https://biohealth.hongik.ac.kr/22/?q=YToyOntzOjQ6InBhZ2UiO2k6MTtzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170939006&t=board' },
        ],
      },
      'exchange-student': {
        kind: 'answer',
        text: '2026 하계 계절학기 공지 기준, 다른 대학에서 홍익대로 학점교류를 온 학생은 학번조회 후 클래스넷에 로그인하고, 최대 6학점까지 1학년·전체 학년 수강신청일에 신청해요.',
        sections: [
          {
            title: '학번 받고 클래스넷 쓰기',
            ordered: true,
            items: [
              '학교 공지의 교류 학생 학번조회로 학번을 확인해요. 전에 홍익대 학점교류를 한 적이 있으면 그때 받은 학번을 그대로 써요.',
              '홈페이지 › MY HONGIK › 통합로그인(ID는 학번, 초기 비밀번호는 주민등록번호 앞자리)으로 들어가 초기 비밀번호를 꼭 바꿔요.',
              '개인정보 변경에서 계좌번호와 연락처를 넣고 저장해요.',
            ],
          },
          {
            title: '수강신청 제한',
            items: [
              '교류 학생은 1학년 수강신청일과 전체 학년 수강신청일에 신청해요.',
              '최대 6학점까지예요. 넘겨서 신청하면 성적이 인정되지 않을 수 있으니 소속 학교에 물어봐요.',
              '수강제한과목 확인 메뉴에 나오는 과목, 바이오헬스융합학부(공유대학) 과목, 시간표 비고에 "타과생 수강 금지"·"OO반 외 수강 금지"·"OO과 전용 분반"이 적힌 과목은 신청할 수 없어요(신청하면 학과에서 철회해요).',
            ],
          },
        ],
        links: [{ label: '학교 공지: 2026학년도 하계계절학기 학점교류 학생 학번조회 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=152242&noCat=500' }],
      },
    },
    checkedAt: '2026-10-25',
  },
  {
    // 근거: 학교 공지(학사) 2042(2026-09-28)·2049(2026-09-01)·2066(2026-08-05)·2071(2026-07-28)
    id: 'faq-enrollment',
    entries: [],
    nodes: {
      'missed-registration': {
        kind: 'answer',
        text: '등록금을 정규 등록기간에 못 냈어도 재학 상태는 그대로고, 추가 등록기간에 같은 금액(연체료 없음)으로 내면 돼요. 2026-2학기 기준 마지막은 9.28~9.29 최종 등록이었어요.',
        sections: [
          {
            title: '2026-2학기 기준 등록 순서',
            table: {
              head: ['구분', '기간', '대상'],
              rows: [
                ['정규 등록', '8.24~8.30', '재학생'],
                ['추가 등록', '9.11~9.16', '정규 기간 미납자, 1차 분납 미납자(분납 취소자), 전액장학금으로 0원인데 등록 안 한 학생'],
                ['최종 등록', '9.28~9.29', '학기초과자, 그때까지 못 낸 학생'],
              ],
            },
          },
          {
            title: '놓쳤을 때',
            items: [
              '추가·최종 등록 때 고지서가 새로 나와요. 그 기간에 고지서를 다시 출력해서 내요.',
              '등록금을 아직 못 냈어도 수강신청과 수업 참여는 그대로 할 수 있어요.',
              '장학금으로 낼 돈이 0원이어도 등록을 안 하면 장학금이 취소되거나 미등록 제적될 수 있어요.',
            ],
          },
          {
            title: '날짜는 어디서 봐요?',
            items: [
              '학교 홈페이지 교육 › 대학 › 대학공지 › 학사(뉴스센터 › 공지사항에도 같이)에 올라와요. 2026-2학기에는 “재학생 등록 및 등록금 납부 안내”(8.5), “재학생 추가등록 및 분납 등록금 납부 안내”(9.1), “학기초과자 및 미등록자 최종 등록 안내”(9.28) 순서로 올라왔어요.',
            ],
          },
        ],
        phones: [],
        links: [
          { label: '학교 공지: 2026-2학기 재학생 등록 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154856&noCat=500' },
          { label: '학교 공지: 2026-2학기 추가등록·분납 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=156090&noCat=500' },
          { label: '학교 공지: 2026-2학기 최종 등록 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=157570&noCat=500' },
        ],
      },
      'virtual-account-error': {
        kind: 'answer',
        text: '등록금 가상계좌는 1회만 입금되고, 고지서의 계좌번호와 실납입액이 정확히 맞아야 들어가요. 나눠 보낼 수 없으니 이체 한도를 미리 늘리거나 분할납부를 신청해요.',
        sections: [
          {
            title: '입금이 안 될 때',
            items: [
              '고지서의 계좌번호와 실납입액(수업료 또는 수업료+선택납부금)을 다시 확인해요.',
              '카카오뱅크·케이뱅크 같은 일부 모바일 뱅킹은 신한은행 가상계좌로 이체가 안 될 수 있어요. PC 인터넷뱅킹이나 다른 은행 뱅킹으로 보내요.',
              'CMA·오픈뱅킹 같은 일부 계좌는 송금이 안 될 수 있어요. 가상계좌 입금은 07:00~23:00에만 돼요.',
              '신한은행은 공과금 › 대학등록금 › 납부하기에서 학교(59329 홍익대학부)를 고르고 학번을 넣어 낼 수도 있어요.',
              '은행 창구는 신한은행 지점에서 09:00~16:00에 내요. 분할납부 신청자와 외국인 유학생은 창구에서 못 내요.',
            ],
          },
          {
            title: '학생회비·졸업준비금을 빠뜨렸을 때',
            items: [
              '등록금 이체가 정상으로 된 경우, 낸 당일에만 같은 가상계좌로 추가 입금할 수 있어요.',
              '그 뒤에는 학기 중 별도 수납 일정에 내거나, 서울은 문헌관 8층 재무팀, 세종은 A동 2층 총무관리팀에 가서 현금으로 내요.',
            ],
          },
          {
            title: '알아두면 좋은 것',
            items: [
              '학생 본인이 아닌 다른 사람 이름으로도 입금할 수 있어요.',
              '등록금을 낸 뒤에는 고지서를 다시 뽑을 수 없어요. 필요하면 미리 저장하고, 낸 뒤에는 등록금 납부확인서를 써요.',
            ],
          },
        ],
        phones: [],
        links: [
          { label: '학교 공지: 2026-2학기 재학생 등록 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154856&noCat=500' },
          { label: '학교 공지: 2026-2학기 최종 등록 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=157570&noCat=500' },
        ],
      },
      'installment-missed': {
        kind: 'answer',
        text: '분할납부 1차를 안 내면 분납이 자동 취소돼 추가 등록기간에 한 번에 내야 해요. 2~4차를 안 내면 따로 알림 없이 미등록 제적되니 조심해요.',
        sections: [
          {
            title: '2026-2학기 기준 분납 일정',
            table: {
              head: ['차수', '기간'],
              rows: [
                ['1차', '8.24~8.30'],
                ['2차', '9.11~9.16'],
                ['3차(3·4회납)', '10.28~10.30'],
                ['4차(4회납)', '11.25~11.27'],
              ],
            },
          },
          {
            title: '신청을 놓쳤거나 취소됐을 때',
            items: [
              '3월 초·9월 초 분할납부 추가신청 기간에 다시 신청할 수 있어요(2026-2학기 기준 9.4~9.8). 이때는 최대 3회까지만 나눠요.',
              '추가신청을 할 거면 2월·8월 정규 등록기간에 안 내도 불이익은 없어요. 3월·9월부터 내면 돼요.',
              '분납을 그만두고 한 번에 내고 싶으면 1차를 내지 않고 기다려요. 자동으로 일시납으로 바뀌고 추가 등록기간에 내면 돼요.',
            ],
          },
          {
            title: '날짜는 어디서 봐요?',
            items: [
              '분납 납부 기간은 학교 홈페이지 교육 › 대학 › 대학공지 › 학사 공지로만 알려요. 따로 연락이 오지 않아요.',
              '학사지원팀이 학기마다 “등록금 분할납부 신청안내(학부)”를 올리고(2026-2학기는 7.28), 추가신청은 3월 초·9월 초에 공지해요.',
            ],
          },
        ],
        phones: [],
        links: [
          { label: '학교 공지: 2026-2학기 분할납부 신청안내(학부)', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154659&noCat=500' },
          { label: '학교 공지: 2026-2학기 추가등록·분납 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=156090&noCat=500' },
        ],
      },
      'installment-rules': {
        kind: 'answer',
        text: '분할납부는 2~4회 중 골라 나눠 내고 이자·수수료는 없어요. 대신 그 학기엔 한국장학재단 학자금 대출이 안 되고(생활비 50만 원 한도는 가능), 신청기간 뒤엔 횟수를 못 바꿔요.',
        sections: [
          {
            title: '신청할 수 있나요?',
            items: [
              '재학생과 복학 예정자(학적이 “복학 대기”인 학생)가 신청해요.',
              '그 학기 신입생·편입생·재입학생·학기초과자와 휴학생은 못 해요. 전액장학금을 받으면 신청이 직권 취소돼요.',
            ],
          },
          {
            title: '금액과 장학금',
            items: [
              '장학금을 뺀 실납입액을 횟수로 나누고, 학생회비 같은 선택납부금을 더해요.',
              '학기 중 개인 계좌로 받는 장학금(봉사장학금 제외)은 등록금을 다 낼 때까지 지급이 보류될 수 있어요.',
              '분납 중에는 재학증명서를 직접 가서 받아요. 서울은 문헌관 1층 학사지원팀, 세종은 가온관(A203) 교무입시팀이에요.',
            ],
          },
          {
            title: '분납 중 취소·휴학',
            items: [
              '신청기간이 지나 취소하려면 학사지원팀(세종 교무입시팀)에 직접 가서 취소원을 내고, 승인 뒤 재무팀에 현금으로 한 번에 내요.',
              '분납 중 군입대휴학을 하면 취소원을 내고 남은 금액을 현금으로 다 내거나 등록을 취소(낸 돈 반환)해요. 장학생은 남은 금액을 다 내야 장학금이 유지되고, 다 낸 등록금은 복학 학기로 넘어가요.',
              '분납 중 자퇴하거나 일반 휴학을 해도 학사지원팀(세종 교무입시팀)에 가서 분할납부 취소원을 내야 해요. 낸 등록금은 대학등록금에 관한 규칙에 따라 처리돼요.',
            ],
          },
        ],
        phones: [],
        links: [
          { label: '학교 공지: 2026-2학기 분할납부 신청안내(학부)', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154659&noCat=500' },
          { label: '학교 공지: 2026-2학기 재학생 등록 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154856&noCat=500' },
        ],
      },
      'credit-registration': {
        kind: 'answer',
        text: '수강 학점만큼 등록금을 내는 학점등록(1~3학점 1/6)은 학기초과자(8학기, 5년제 10학기 초과)만 돼요. 정규 학기 재학생은 학점이 적어도 등록금 전액을 내요.',
        sections: [
          {
            title: '학기초과자 학점등록 금액',
            table: {
              head: ['수강 학점', '등록금'],
              rows: [
                ['1~3학점', '1/6'],
                ['4~6학점', '1/3'],
                ['7~9학점', '1/2'],
                ['10학점 이상', '전액'],
              ],
            },
          },
          {
            title: '학기초과자가 꼭 알 것',
            items: [
              '등록은 학기초과자 등록기간에 해요. 2026-2학기 기준 9.28~9.29였어요.',
              '이때 고지서가 새로 나와요. 낸 뒤에는 고지서를 다시 뽑을 수 없으니 필요하면 미리 저장해요.',
            ],
          },
        ],
        phones: [],
        links: [
          { label: '학교 공지: 2026-2학기 재학생 등록 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=154856&noCat=500' },
          { label: '학교 공지: 2026-2학기 최종 등록 안내', url: 'https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=157570&noCat=500' },
        ],
      },
    },
    checkedAt: '2026-10-25',
  },
]
