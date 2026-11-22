import { test } from 'node:test'
import assert from 'node:assert/strict'
import { injectMeta, leadSentence, newsDescription, newsMetaTags } from '../../netlify/edge-functions/news-preview'
import { injectReportMeta, reportDescription, reportWhen } from '../../netlify/edge-functions/report-preview'

const SITE_HTML =
  '<html><head><title>홍익온</title>' +
  '<meta name="description" content="기본 소개"/>' +
  '<meta property="og:title" content="홍익온 — 기본"/>' +
  '<meta property="og:image" content="https://hongikon.com/og-image.png"/>' +
  '<meta name="twitter:card" content="summary_large_image"/>' +
  '</head><body></body></html>'

const NEWS = {
  id: 13545,
  title: '[경영대학] 재입학 관련 학과장 추천서 수령 안내',
  departmentName: '경영학부',
  publishedAt: '2026-11-20T09:00:00',
  content: '안녕하세요. 경영학부 행정실입니다. 재입학과 관련하여 추천서 수령 절차 안내드립니다. ① 재입학 공지 확인 : 학사지원팀에서 업로드',
}

test('공지 미리보기: 사이트 기본 태그를 지우고 공지 태그만 남긴다(기본 태그가 먼저 읽히던 버그)', () => {
  const html = injectMeta(SITE_HTML, NEWS)
  assert.equal(html.match(/property="og:title"/g)?.length, 1)
  assert.equal(html.match(/name="description"/g)?.length, 1)
  assert.match(html, /og:title" content="\[경영대학\] 재입학 관련 학과장 추천서 수령 안내"/)
  assert.doesNotMatch(html, /홍익온 — 기본|기본 소개/)
  assert.match(html, /<title>\[경영대학\] 재입학 관련 학과장 추천서 수령 안내 \| 홍익온<\/title>/)
})

test('공지 미리보기: 제목에 머리표가 없고, 설명은 출처 · 날짜 — 인사말을 건너뛴 첫 문장', () => {
  assert.doesNotMatch(newsMetaTags(NEWS), /\[홍익온/)
  assert.equal(newsDescription(NEWS), '경영학부 · 11월 20일 — 재입학과 관련하여 추천서 수령 절차 안내드립니다.')
})

test('첫 문장: 앞 번호를 빼고, 길면 낱말 사이에서 자르며, 본문이 없으면 null', () => {
  assert.equal(leadSentence('① 수강신청 기간을 꼭 지켜 주세요. 다음 내용'), '수강신청 기간을 꼭 지켜 주세요.')
  const long = leadSentence('가나다 '.repeat(40), 20)!
  assert.ok(long.endsWith('…') && !long.endsWith(' …') && Array.from(long).length <= 21)
  assert.equal(leadSentence('   '), null)
  assert.equal(newsDescription({ id: 1, title: '그림 공지', departmentName: '학생처', publishedAt: '2026-03-02', content: '' }), '학생처 · 3월 2일')
})

const REPORT = {
  id: 41,
  title: '와우베이커리팝업',
  content: '한대요 근데 빵 파는 게 아닌 거 같음',
  placeLabel: '홍문관 지하2층',
  startsAt: '2026-11-16T02:00:00',
  endsAt: '2026-11-22T10:00:00',
}

test('제보 미리보기: 일시는 한국 시간, 여러 날이면 날짜 범위, 하루면 시각 범위', () => {
  assert.equal(reportWhen(REPORT), '11/16(월) ~ 11/22(일)')
  assert.equal(reportWhen({ ...REPORT, startsAt: '2026-11-23T09:00:00', endsAt: '2026-11-23T11:00:00' }), '11/23(월) 18:00~20:00')
  assert.equal(reportDescription(REPORT), '홍익대에서 올라온 제보 · 11/16(월) ~ 11/22(일) · 홍문관 지하2층')
})

test('제보 미리보기: 기본 태그를 바꾸고 작성자 정보는 넣지 않는다', () => {
  const html = injectReportMeta(SITE_HTML, { ...REPORT, authorNickname: '개발자' } as typeof REPORT)
  assert.equal(html.match(/property="og:title"/g)?.length, 1)
  assert.match(html, /og:title" content="와우베이커리팝업"/)
  assert.match(html, /og:url" content="https:\/\/hongikon.com\/r\/41"/)
  assert.doesNotMatch(html, /개발자/)
})
