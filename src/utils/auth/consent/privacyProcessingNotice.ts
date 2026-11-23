/** 로그인 계정별로 회원 식별·로그인 유지에 쓰는 정보. null 이면 둘 다 적는다. */
export function accountInfoFor(provider: 'kakao' | 'apple' | null): string {
  return provider === 'apple'
    ? 'Apple 사용자 식별자와 공유한 경우 이름'
    : provider === 'kakao'
      ? '카카오 회원번호와 닉네임'
      : '카카오 회원번호·닉네임(Apple 로그인은 사용자 식별자, 공유한 경우 이름)'
}
