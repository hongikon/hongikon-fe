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
   */
  entries: readonly { match: readonly (readonly string[])[]; node: string }[]
  nodes: Readonly<Record<string, AskNode>>
  /** 확인한 날(YYYY-MM-DD). */
  checkedAt: string
}

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

const SHINHAN_BRANCH_ID = 'hi-r-1f-office-04'
const SHINHAN_BRANCH_PHONE = { label: '신한은행 홍익대학교 지점', phone: '02-6023-3950' }
const UNDERGRAD_RECORD_PHONE = { label: '신청 중 학적정보 조회 오류(학부·학사지원팀)', phone: '02-320-1089' }
/** 학사지원팀 업무별 전화 중 '휴학,복학,제적,전과,재입학'. */
const LEAVE_PHONE = { label: '학사지원팀 · 휴학·복학', phone: '02-320-1037' }

export const ASK_FLOWS: readonly AskFlow[] = [
  {
    // 학교 홈페이지 휴학 안내(leave-of-absence.do, 2026-10-15 확인)의 내용을 빠짐없이 옮겼다. 링크만 주지 않고 앱 안에서 다 읽히게(10-15 요청).
    id: 'leave-of-absence',
    entries: [
      { match: [['휴학'], ['소급']], node: 'military-retro' },
      { match: [['휴학'], ['군입대', '입대', '군대', '군휴학', '입영']], node: 'military' },
      { match: [['군휴학', '군입대휴학']], node: 'military' },
      { match: [['휴학'], ['질병', '아파', '아픈', '병원', '진단서']], node: 'sick' },
      { match: [['휴학'], ['임신', '출산', '육아']], node: 'parental' },
      { match: [['휴학'], ['창업']], node: 'startup' },
      { match: [['휴학'], ['등록금', '환불', '반환', '이월', '장학금']], node: 'tuition' },
      { match: [['휴학'], ['몇학기', '최대', '횟수', '얼마나', '몇번', '연장', '종류']], node: 'limits' },
      { match: [['휴학'], ['기간', '언제', '일정', '마감', '클래스넷', '일반휴학']], node: 'general' },
      { match: [['휴학']], node: 'start' },
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
        text: '직전 학기까지 다니던 학생은 휴학하는 학기의 등록금을 낼지 말지 고를 수 있어요(장학금 대상자는 내는 걸 권해요).',
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
              '학기 시작(3월 1일·9월 1일)부터 30일까지 수업료의 5/6, 60일까지 2/3, 90일까지 1/2, 그 뒤엔 반환 없음.',
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
      { match: [['학생증'], ['분실', '잃어버', '도난', '없어졌']], node: 'lost' },
      { match: [['모바일학생증', '모바일신분증', '헤이영', '학생증qr', '학생증앱']], node: 'mobile' },
      { match: [['학생증'], ['외국인', '외국국적', '유학생']], node: 'level-foreign' },
      { match: [['학생증'], ['대학원']], node: 'grad' },
      { match: [['학생증'], ['발급', '신청', '재발급', '만들', '다시', '새로', '받으려', '받는', '받아', '수령', '어디']], node: 'level' },
      { match: [['학생증']], node: 'start' },
    ],
    nodes: {
      start: {
        kind: 'question',
        text: '학생증의 어떤 점이 궁금하세요?',
        options: [
          { label: '새로 발급·재발급 받고 싶어요', next: 'level' },
          { label: '잃어버렸어요', next: 'lost' },
          { label: '모바일 학생증을 쓰고 싶어요', next: 'mobile' },
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
        facilityId: SHINHAN_BRANCH_ID,
        links: [STUDENT_CARD_PAGE],
      },
      grad: {
        kind: 'answer',
        text:
          "대학원 신입생은 매 학기 공지된 기간에, 재학생은 신입생 집중 발급 기간 뒤에 신한 쏠(SOL) 앱에서 '학생증 체크카드'를 신청해요. 외국 국적이면 신한은행 홈페이지에서 예약 신청한 뒤 외국인등록증(또는 여권)을 들고 홍문관 1층 신한은행에 가요.\n약 1주 뒤 문자가 오면 일반대학원은 신한은행 홍익대학교 지점(홍문관 1층), 특수대학원은 홍문관 521호 대학원교학팀에서 받아요.",
        phones: [{ label: '신청 중 학적정보 조회 오류(대학원교학팀)', phone: '02-320-1269' }],
        facilityId: SHINHAN_BRANCH_ID,
        links: [STUDENT_CARD_PAGE],
      },
      lost: {
        kind: 'answer',
        text:
          '체크카드(금융) 분실등록은 신한은행 콜센터에서 해요. 밤 9시 이후 교내 건물 출입에 쓰던 학생증이면 와우관 2층 종합통제실에서도 분실등록해요.\n새 학생증은 신한 쏠(SOL) 앱에서 재발급을 신청해요.',
        phones: [{ label: '신한은행 콜센터(분실등록)', phone: '1577-8000' }],
        links: [STUDENT_CARD_PAGE],
      },
      mobile: {
        kind: 'answer',
        text:
          "'헤이영캠퍼스' 앱에서 홍익대학교를 고르고 클래스넷 아이디로 로그인한 뒤 '모바일 학생증 발급하기'를 눌러요(신한은행 계좌 인증 필요). 중앙도서관 출입·대출·열람실에 쓸 수 있어요.",
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
    // 켜기·끄기 번호(1541)는 운영진 확인(10-15). 고장은 부서 안내의 건설관리팀 '냉,난방 및 위생설비 관리' 줄.
    id: 'aircon',
    entries: [
      { match: [['에어컨', '냉방', '난방', '히터', '온풍기', '추워', '더워', '춥다', '덥다'], ['고장', '물새', '물이새', '소리', '냄새', '망가']], node: 'broken' },
      { match: [['에어컨', '냉방', '난방', '히터', '온풍기', '추워', '더워', '춥다', '덥다'], ['켜', '꺼', '끄', '틀어', '가동']], node: 'on-off' },
      { match: [['에어컨', '냉방', '난방', '히터', '온풍기', '추워', '더워', '춥다', '덥다']], node: 'start' },
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
        phones: [{ label: '냉난방 가동(켜기·끄기)', phone: '02-320-1541' }],
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
]
