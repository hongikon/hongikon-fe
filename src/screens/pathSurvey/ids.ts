/** 지점 id 를 짧게: 'mabc12-n7' → 'n7'. 다른 모양은 그대로. React 없이 쓰려고 ui.tsx 에서 뗐다(ui.tsx 는 다시 내보낸다). */
export const shortId = (id: string) => {
  const i = id.lastIndexOf('-')
  return i > 0 ? id.slice(i + 1) : id
}
