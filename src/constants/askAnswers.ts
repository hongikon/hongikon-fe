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
const CARD_NOT = ['국제학생증', 'isic']
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
        text: '일반휴학은 일신상의 사유로 하는 휴학이에요. 정해진 신청 기간에 클래스넷으로 신청해요.',
        sections: [
          { title: '신청 방법', items: ["클래스넷 › 학사/학적 › '휴/복학/휴학연장' 메뉴에서 신청해요."] },
          {
            title: '신청 기간',
            items: [
              '매 학기 학교 홈페이지 › 대학 › 대학공지에 올라오는 휴학신청 안내를 확인해요.',
              '1학기 휴학: 매년 1월 말경 공지',
              '2학기 휴학: 매년 7월 말경 공지',
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
        text: '군입대휴학은 입대일 10일 전부터 입대일 전날까지 클래스넷으로 신청해요.',
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
        text: '군입대휴학을 신청하지 않고 학기가 지났다면 서류를 내서 소급 신청해요.',
        sections: [
          {
            title: '먼저 확인하세요',
            items: [
              '입대일이 그 학기 종료일(1학기 6월 14일, 2학기 8월 31일)을 넘지 않았다면 소급 신청이 아니에요. 클래스넷으로 직접 신청하세요.',
            ],
          },
          {
            title: '신청 절차',
            ordered: true,
            items: [
              '군입대휴학 소급신청서와 사유서를 출력해 자필로 작성해요(양식은 학교 휴학 안내 페이지에 있어요).',
              '소급신청서·사유서와 입대를 증명하는 자료(병적증명서 등)를 support@hongik.ac.kr 로 이메일 제출해요.',
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
              '학교(학사지원팀)에서 보낸 교부 완료 문자를 받은 뒤, 문자에 적힌 교부처로 가서 받아요. 신한은행·신한카드 문자나 카톡이 아니에요.',
              '문자를 받고 한 달 안에 안 받으면 일괄 폐기돼요. 폐기된 뒤 다시 원하면 신한은행 홍익대학교 지점에 가서 상담해요.',
              "문자를 받을 수 있게 학교 홈페이지 'MY HONGIK › 개인정보변경'에서 연락처를 최신으로 바꿔 두세요.",
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
          "신한은행 홈페이지 '금융서비스 › 기타금융 › 학생증체크카드 예약서비스'에서 예약 신청한 뒤, 홍문관 로비 신한은행 홍익대학교 지점에 꼭 방문해 예약을 확인해야 해요(외국 국적 학생은 이 방법으로만 신청해요).\n1~2주 뒤 학교(학사지원팀) 문자를 받으면 문자에 적힌 교부처에서 받아요.",
        phones: [SHINHAN_BRANCH_PHONE, UNDERGRAD_RECORD_PHONE],
        links: [STUDENT_CARD_PAGE, FACILITY_PAGE],
      },
      grad: {
        kind: 'answer',
        text:
          "대학원 신입생은 매 학기 공지된 기간에, 재학생은 신입생 집중 발급 기간 뒤에 신한 쏠(SOL) 앱에서 '학생증 체크카드'를 신청해요. 외국 국적이면 신한은행 홈페이지에서 예약 신청한 뒤 외국인등록증(또는 여권)을 들고 홍문관 1층 신한은행에 가요.\n약 1주 뒤 문자가 오면 일반대학원은 신한은행 홍익대학교 지점(홍문관 1층), 특수대학원은 홍문관 521호 대학원교학팀에서 받아요.",
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
]
