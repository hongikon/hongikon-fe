/**
 * 공유 링크 `https://hongikon.com/r/{id}`(제보 시트의 "공유"). Netlify 의 SPA 대체 규칙이 index.html 을 돌려주고,
 * 여기서 지도에 "그 제보 띄우기" 요청을 남긴 뒤 주소를 `/` 로 바꾼다(새로고침해도 다시 열리지 않게).
 * 지도 탭이 포커스될 때 요청을 꺼내 제보 레이어를 켜고 시트를 연다. 끝났거나 내려간 제보면 안내만 띄운다.
 */
export function sharedReportIdFromPath(pathname: string): number | null {
  const m = /^\/r\/(\d{1,12})\/?$/.exec(pathname)
  if (!m) return null
  const id = Number(m[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
