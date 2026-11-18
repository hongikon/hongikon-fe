/** 영문자를 한국어로 읽을 때 받침이 있는(ㄹ 제외) 글자: 에프·에이치·엠·엔·에스·엑스. */
const LATIN_WITH_BATCHIM = new Set(['F', 'H', 'M', 'N', 'S', 'X'])
/** 숫자를 읽을 때 받침이 있는(ㄹ 제외) 숫자: 영(0)·삼(3)·육(6). 일(1)·칠(7)·팔(8)은 ㄹ 받침이라 '로'. */
const DIGITS_WITH_BATCHIM = new Set(['0', '3', '6'])

/** 이름 끝 글자가 받침으로 읽히는지(ㄹ 받침은 '로'를 쓰므로 false). 끝의 괄호·공백 같은 기호는 건너뛴다. */
function needsEuro(name: string): boolean {
  for (let i = name.length - 1; i >= 0; i--) {
    const ch = name[i]
    const code = ch.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const batchim = (code - 0xac00) % 28
      return batchim !== 0 && batchim !== 8
    }
    if (/[A-Za-z]/.test(ch)) return LATIN_WITH_BATCHIM.has(ch.toUpperCase())
    if (/[0-9]/.test(ch)) return DIGITS_WITH_BATCHIM.has(ch)
  }
  return false
}

/** 이름 뒤에 방향 조사를 붙인다: 받침이 있으면(ㄹ 제외) "으로", 없거나 ㄹ 받침이면 "로". 예) 홍문관 R동 → 홍문관 R동으로, 체육관 → 체육관으로, 운동장 → 운동장으로, 과학관 → 과학관으로 */
export function withRo(name: string): string {
  return `${name}${needsEuro(name) ? '으로' : '로'}`
}
