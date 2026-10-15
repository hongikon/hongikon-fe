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

/** 끝 답. 전화·학교 홈페이지 링크(·필요하면 지도 위치)를 붙인다. */
export interface AskAnswerNode {
  kind: 'answer'
  text: string
  phones?: readonly { label: string; phone: string }[]
  /** 학교 홈페이지 안내. 첫 링크가 이 답의 출처다. 없으면 운영진이 직접 확인한 답. */
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

/** 휴학 흐름의 방문 신청(질병·임신출산육아·창업)에 공통으로 붙는 말. */
const VISIT_NOTE = '원서 양식은 아래 학교 안내 페이지에서 내려받아요.'

export const ASK_FLOWS: readonly AskFlow[] = [
  {
    // 학교 홈페이지 휴학 안내(2026-10-15 확인)에서 옮겼다.
    id: 'leave-of-absence',
    entries: [
      { match: [['휴학'], ['군입대', '입대', '군대', '군휴학', '입영']], node: 'military' },
      { match: [['군휴학', '군입대휴학']], node: 'military' },
      { match: [['휴학'], ['질병', '아파', '아픈', '병원', '진단서']], node: 'sick' },
      { match: [['휴학'], ['임신', '출산', '육아']], node: 'parental' },
      { match: [['휴학'], ['창업']], node: 'startup' },
      { match: [['휴학'], ['등록금', '환불', '반환', '이월']], node: 'tuition' },
      { match: [['휴학'], ['몇학기', '최대', '횟수', '얼마나', '몇번', '연장']], node: 'limits' },
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
          { label: '몇 학기까지 쉴 수 있나요?', next: 'limits' },
          { label: '휴학하면 등록금은요?', next: 'tuition' },
        ],
      },
      general: {
        kind: 'answer',
        text:
          "일반휴학은 정해진 신청 기간에 클래스넷 › 학사/학적 › '휴/복학/휴학연장'에서 신청해요.\n신청 기간은 매 학기 학교 홈페이지 대학공지로 안내돼요 — 1학기 휴학은 매년 1월 말경, 2학기 휴학은 7월 말경에 공지가 올라와요.\n도서 미반납·휴학 가능 횟수 초과 같은 결격사유가 있으면 승인되지 않을 수 있으니 신청 뒤 승인 여부를 꼭 확인하세요. 신입생은 입학 후 1년간 일반휴학을 할 수 없어요(군입대·질병휴학은 가능).",
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE, UNDERGRAD_NOTICE],
      },
      military: {
        kind: 'answer',
        text:
          "입대일 10일 전부터 입대 전날까지 클래스넷 › 학사/학적 › '군입대휴학 신청'에서 신청해요. 입영통지서·입영 사실확인서·병적증명서 중 하나를 올려야 해요.\n반려될 수 있으니 '학적변동조회'에서 승인 여부를 확인하세요. 입대 뒤 귀가 조치되면 5일 안에 학사지원팀에 알려야 해요.",
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      sick: {
        kind: 'answer',
        text:
          `질병휴학은 직접 방문해 신청해요. ① 질병휴학원서(본인·학부모 도장)와 상급종합병원 진단서(4주 이상 입원·통원 치료 내용) 준비 → ② 건강진료센터에서 면담 후 교의 소견서 받기 → ③ 장학팀 도장 → ④ 중앙도서관 대출실 도장 → ⑤ 학사지원팀에 제출.\n${VISIT_NOTE}`,
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      parental: {
        kind: 'answer',
        text:
          `임신·출산·육아휴학은 직접 방문해 신청해요. ① 휴학원서(본인·학부모 도장)와 진단서 또는 가족관계증명서 준비 → ② 장학팀 도장 → ③ 중앙도서관 대출실 도장 → ④ 학사지원팀에 제출. 만 8세 이하 자녀 양육도 해당돼요.\n${VISIT_NOTE}`,
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      startup: {
        kind: 'answer',
        text:
          `창업(준비)휴학은 일반휴학 신청 기간에 방문 신청해요. ① 휴학원서와 증빙(창업계획서, 사업자등록증 등) 준비 → ② 장학팀 도장 → ③ 중앙도서관 대출실 도장 → ④ 창업교육센터 도장 → ⑤ 학사지원팀에 제출 → ⑥ 운영위원회 심의.\n${VISIT_NOTE}`,
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      limits: {
        kind: 'answer',
        text:
          '일반휴학과 질병휴학은 합쳐서 재학 중 최대 6학기예요. 군입대(최대 6학기)·임신·출산·육아(4학기)·창업준비(2학기)·창업(2학기) 휴학은 따로 쳐요.\n한 번에 최대 2학기까지 신청할 수 있고, 복학할 때 부득이하면 이어서 다시 신청할 수 있어요.',
        phones: [LEAVE_PHONE],
        links: [LEAVE_PAGE],
      },
      tuition: {
        kind: 'answer',
        text:
          "일반·군입대·창업휴학은 등록금을 돌려받지 않고, 낸 등록금은 복학하는 학기로 넘어가요(안 냈으면 복학할 때 내요). 수업일수 절반이 지난 뒤 일반휴학하면 복학 학기에 등록금을 다시 다 내야 해요.\n질병·임신·출산·육아휴학은 '대학 등록금에 관한 규칙'에 따라 일부를 돌려받고 복학 학기에 다시 내요. 장학금으로 감면받았다면 휴학할 때 등록금을 내야 장학금이 인정돼요.",
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
        text:
          "본인 명의 휴대폰에 신한 쏠(SOL) 앱을 깔고, 로그인 화면 아래 '상품 › 카드 › 체크카드 › 학생증 체크카드 신청'에서 신청해요. 수수료는 없어요.\n1~2주 뒤 학교(학사지원팀)에서 보낸 문자를 받으면, 문자에 적힌 교부처에 가서 받아요. 한 달 안에 안 받으면 폐기되니 서둘러 주세요.",
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
