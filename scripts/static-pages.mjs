// hongikon.com 의 정적 안내 페이지(/terms, /privacy, /support, /account-deletion, /licenses).
// scripts/fix-web-export.mjs 가 `expo export -p web` 뒤에 불러 dist/<slug>/index.html 로 쓴다.
// 스토어 심사·외부 링크(App Store 지원 URL, Google Play 계정 삭제 URL, 크롤러 User-Agent 연락처)용이라
// 앱(자바스크립트)을 띄우지 않고 바로 읽히는 HTML 로 만든다.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const SUPPORT_EMAIL = 'hongikonsupport@gmail.com'
const OPERATOR = '홍익온 운영팀'

export const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FOOTER_LINKS = [
  ['/support/', '고객 지원'],
  ['/terms', '이용약관'],
  ['/privacy', '개인정보 처리방침'],
  ['/account-deletion/', '계정 삭제'],
  ['/licenses/', '오픈소스 라이선스'],
  ['/', '홍익온 열기'],
]

/** 공통 틀. body 는 이미 이스케이프된 HTML 이다. */
export function page(title, body, { description = '' } = {}) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} | 홍익온</title>
${description ? `<meta name="description" content="${escapeHtml(description)}" />\n` : ''}<link rel="icon" type="image/png" href="/favicon.png" />
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #fff; color: #111; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  header img { width: 28px; height: 28px; border-radius: 7px; }
  header span { font-weight: 700; color: #05014A; }
  h1 { font-size: 24px; margin: 16px 0 24px; }
  h2 { font-size: 18px; margin: 32px 0 12px; }
  p, li { line-height: 1.75; font-size: 15px; color: #333; word-break: keep-all; overflow-wrap: anywhere; }
  ol, ul { padding-left: 22px; }
  a { color: #05014A; }
  .body { white-space: pre-wrap; line-height: 1.75; font-size: 15px; color: #333; word-break: keep-all; overflow-wrap: anywhere; }
  .note { font-size: 13px; color: #666; }
  .card { background: #F2F2F2; border-radius: 12px; padding: 14px 16px; margin: 12px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; vertical-align: top; padding: 8px 6px; border-bottom: 1px solid #e5e5e5; word-break: keep-all; overflow-wrap: anywhere; }
  details { border-bottom: 1px solid #e5e5e5; padding: 8px 0; }
  summary { cursor: pointer; font-size: 14px; }
  summary small { color: #666; }
  pre { white-space: pre-wrap; font-size: 12px; line-height: 1.5; color: #444; background: #F7F7F7; padding: 10px; border-radius: 8px; overflow-wrap: anywhere; }
  footer { margin-top: 40px; font-size: 13px; color: #888; line-height: 2; }
</style>
</head>
<body>
<main>
  <header><img src="/favicon.png" alt="" /><span>홍익온</span></header>
  <h1>${escapeHtml(title)}</h1>
${body}
  <footer>${FOOTER_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join(' · ')}</footer>
</main>
</body>
</html>
`
}

/** 이용약관·개인정보 처리방침: 원문(legalText.ts)을 그대로 보여 준다. */
export function legalPage(title, text) {
  return page(title, `  <div class="body">${escapeHtml(text)}</div>`)
}

const mail = (subject) =>
  `<a href="mailto:${SUPPORT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}">${SUPPORT_EMAIL}</a>`

/** /support/ — App Store "지원 URL", 크롤러 User-Agent 의 연락처. */
export function supportPage(unofficialNotice) {
  return page(
    '고객 지원',
    `  <p>홍익온은 홍익대학교 서울캠퍼스 지도, 학교·학과 공지 모아보기, 제휴 혜택, 실시간 제보를 한곳에서 보는 앱이에요.</p>
  <div class="card">
    <p><strong>운영 주체</strong> ${OPERATOR}<br />${escapeHtml(unofficialNotice)}</p>
  </div>

  <h2>문의하기</h2>
  <ul>
    <li>이메일: ${mail('[홍익온] 문의')}</li>
    <li>앱 안에서: 설정 &gt; 문의하기 (로그인하지 않아도 보낼 수 있어요)</li>
  </ul>
  <p>보내 주신 문의는 영업일 기준 2일 안에 답변하는 것을 목표로 해요. 답변을 받으려면 앱 문의에 이메일을 함께 적어 주세요.</p>

  <h2>부적절한 제보 신고·사용자 숨기기</h2>
  <ul>
    <li>지도에서 제보를 누른 뒤 <strong>신고</strong>를 눌러 사유(허위 정보, 스팸·광고, 욕설·혐오, 개인정보 노출, 기타)를 고르면 운영진에게 전달돼요. 신고된 제보는 24시간 안에 확인해 조치하는 것을 원칙으로 해요.</li>
    <li>특정 사용자의 제보를 보고 싶지 않으면 같은 화면에서 <strong>이 사용자 숨기기</strong>를 누르세요. 설정 &gt; 숨긴 사용자에서 다시 볼 수 있어요.</li>
    <li>불쾌하거나 부적절한 게시물을 올리거나 다른 이용자를 괴롭히는 이용자는 이용약관에 따라 게시물 삭제와 이용 정지 조치를 받아요.</li>
  </ul>

  <h2>계정과 개인정보</h2>
  <ul>
    <li>회원 탈퇴와 데이터 삭제: <a href="/account-deletion/">계정 삭제 안내</a></li>
    <li><a href="/privacy">개인정보 처리방침</a> · <a href="/terms">이용약관</a></li>
  </ul>

  <h2>학교 공지 수집(HongikOnBot)</h2>
  <p>홍익온은 학교·학과 홈페이지에 공개된 공지 목록을 한 시간에 한 번 <code>HongikOnBot/1.0</code> 이라는 이름으로 읽어 와 앱에서 원문 링크와 함께 보여 줘요. 요청 사이에 간격을 두어 서버에 부담을 주지 않도록 하고 있어요. 수집을 원하지 않거나 문제가 있으면 ${mail('[HongikOnBot] 문의')}로 알려 주세요. 확인 후 바로 조치할게요.</p>`,
    { description: '홍익온 고객 지원: 문의 방법, 신고·차단, 계정 삭제 안내' },
  )
}

/** /account-deletion/ — Google Play 데이터 보안 양식의 "계정 삭제 URL". 내용은 PRIVACY_TEXT 3항과 맞춘다. */
export function accountDeletionPage() {
  return page(
    '홍익온 계정 삭제 안내',
    `  <div class="card">
    <p><strong>앱 이름</strong> 홍익온 (HONGIK ON)<br /><strong>개발자</strong> ${OPERATOR}<br /><strong>문의</strong> ${mail('[홍익온] 계정 삭제 요청')}</p>
  </div>

  <h2>앱에서 직접 삭제하기</h2>
  <ol>
    <li>홍익온 앱(또는 <a href="/">hongikon.com</a>)에 로그인해요.</li>
    <li>아래 탭에서 <strong>설정</strong>으로 들어가요.</li>
    <li><strong>설정 초기화</strong> 바로 아래 <strong>회원 탈퇴</strong>를 누르고, 확인 창에서 <strong>예, 탈퇴할게요</strong>를 눌러요.</li>
  </ol>
  <p>탈퇴는 바로 처리되고 되돌릴 수 없어요.</p>

  <h2>앱 없이 삭제 요청하기</h2>
  <p>앱을 지웠거나 로그인할 수 없으면 ${mail('[홍익온] 계정 삭제 요청')}로 메일을 보내 주세요. 메일에는 아래 내용을 적어 주세요.</p>
  <ul>
    <li>로그인 방법(카카오 또는 Apple)</li>
    <li>앱 닉네임 또는 카카오·Apple 닉네임</li>
    <li>본인 확인에 도움이 되는 정보(대략의 가입 시기, 올린 제보 제목 등)</li>
  </ul>
  <p>본인임을 확인한 뒤 지체 없이(늦어도 10일 안에) 계정을 삭제하고 결과를 메일로 알려 드려요.</p>

  <h2>삭제되는 정보</h2>
  <p>탈퇴하면 아래 정보를 지체 없이 삭제해요. 이용 정지·신고 이력이 있는 회원은 일부 기록을 1년 동안 따로 보관해요(아래 표).</p>
  <ul>
    <li>회원 정보: 카카오 회원번호·닉네임 또는 Apple 사용자 식별자·이름, 앱 닉네임</li>
    <li>올린 제보와 제보 사진, 남긴 신고</li>
    <li>구독한 게시판, 게시판별·분야별 알림 설정, 알림 키워드, 제보 알림 설정</li>
    <li>푸시 알림 토큰과 로그인 유지용 토큰</li>
  </ul>
  <p>카카오 로그인 회원은 카카오에 연결 끊기를, Apple 로그인 회원은 Apple에 토큰 폐기를 요청해 계정 연결도 해제해요.</p>

  <h2>삭제되지 않거나 일정 기간 남는 정보</h2>
  <table>
    <tr><th>정보</th><th>처리</th></tr>
    <tr><td>이용 정지·신고 이력이 있는 회원의 기록(회원 식별값을 되돌릴 수 없게 변환한 값, 정지 사유·일시, 올린 제보와 사진, 신고 기록)</td><td>정지를 피하려는 재가입 같은 부정 이용을 막기 위해 다른 정보와 분리해 탈퇴일부터 1년 동안 보관한 뒤 삭제해요. 닉네임·이메일은 보관하지 않아요.</td></tr>
    <tr><td>문의·제휴 제보</td><td>작성자와의 연결을 끊고 내용만 남을 수 있어요. 삭제를 원하면 위 이메일로 요청해 주세요.</td></tr>
    <tr><td>서버 접속 기록(IP 주소, 접속 시각 등)</td><td>보안과 장애 대응을 위해 일정 기간 보관한 뒤 자동으로 삭제해요.</td></tr>
    <tr><td>제보 사진</td><td>제보와 함께 삭제해요. 그 밖의 경우에도 올린 날부터 30일이 지나면 자동으로 삭제돼요.</td></tr>
    <tr><td>법령에 따라 보관해야 하는 정보</td><td>해당 법령이 정한 기간 동안 보관해요.</td></tr>
    <tr><td>기기에만 저장된 정보(북마크, 숨긴 사용자 목록, 둘러보기 설정)</td><td>운영팀에 전송되지 않아 서버에 없어요. 앱을 지우면 함께 지워져요.</td></tr>
  </table>
  <p class="note">자세한 내용은 <a href="/privacy">개인정보 처리방침</a> 3항(보유 및 이용 기간)을 확인해 주세요.</p>`,
    { description: '홍익온(개발자: 홍익온 운영팀) 계정과 데이터 삭제 방법' },
  )
}

/** 라이선스 파일(LICENSE, LICENCE.md, COPYING 등)을 패키지 폴더에서 찾는다. */
function readLicenseFile(dir) {
  if (!dir || !existsSync(dir)) return null
  const name = readdirSync(dir).find((file) => /^(licen[sc]e|copying)(\.(md|txt|markdown))?$/i.test(file))
  return name ? readFileSync(join(dir, name), 'utf8').trim() : null
}

/**
 * `pnpm licenses list --prod --json` 으로 앱에 들어가는 패키지(dependencies, 전이 포함)의 라이선스를 모은다.
 * 개발 도구(devDependencies)는 앱에 들어가지 않아 뺀다.
 */
export function collectLicenses() {
  const raw = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const byLicense = JSON.parse(raw)
  const packages = []
  for (const [license, list] of Object.entries(byLicense)) {
    for (const pkg of list) {
      packages.push({
        name: pkg.name,
        versions: pkg.versions ?? [],
        license: pkg.license ?? license,
        author: pkg.author ?? '',
        homepage: pkg.homepage ?? '',
        text: readLicenseFile(pkg.paths?.[0]),
      })
    }
  }
  packages.sort((a, b) => a.name.localeCompare(b.name))
  return packages
}

/** /licenses/ — 앱에 포함된 오픈소스와 글꼴의 라이선스. */
export function licensesPage(packages, fonts) {
  const item = ({ name, versions, license, author, homepage, text }) => {
    const meta = [versions.join(', '), license].filter(Boolean).join(' · ')
    const link = /^https?:\/\//.test(homepage) ? `<p class="note"><a href="${escapeHtml(homepage)}" rel="noopener">${escapeHtml(homepage)}</a></p>` : ''
    const by = author ? `<p class="note">${escapeHtml(author)}</p>` : ''
    const body = text ? `<pre>${escapeHtml(text)}</pre>` : `<p class="note">라이선스: ${escapeHtml(license)}</p>`
    return `  <details><summary>${escapeHtml(name)} <small>${escapeHtml(meta)}</small></summary>${by}${link}${body}</details>`
  }
  return page(
    '오픈소스 라이선스',
    `  <p>홍익온 앱과 웹에는 아래 오픈소스 소프트웨어와 글꼴이 포함돼 있어요. 각 항목을 누르면 라이선스 전문을 볼 수 있어요.</p>
  <h2>글꼴</h2>
${fonts.map(item).join('\n')}
  <h2>소프트웨어 (${packages.length}개)</h2>
${packages.map(item).join('\n')}
  <p class="note">이 목록은 앱을 빌드할 때 패키지 정보에서 자동으로 만들어요.</p>`,
    { description: '홍익온에 포함된 오픈소스 소프트웨어와 글꼴의 라이선스' },
  )
}
