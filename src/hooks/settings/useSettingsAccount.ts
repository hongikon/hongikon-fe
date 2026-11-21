import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getMyMemberCode,
  getMyProfile,
  isMemberCodeApiKnownMissing,
  isNicknameApiKnownMissing,
  type MyProfile,
} from '../../apis/users'
import { getMyReportCount, isMyReportsApiKnownMissing, type MyReportCount } from '../../apis/myReports'
import { useApiResource } from '../query/useApiResource'
import { getUserIdFromToken } from '../../lib/jwt'
import { resolveMemberNumber, visibleProfile } from '../../utils/settings/account'

interface Options {
  isGuest: boolean
  accessToken: string | null
}

/**
 * 설정 > 계정 묶음에 보일 값: 프로필(닉네임·정지 여부), 회원 번호, 내 제보 개수(승인 대기 배지).
 */
export function useSettingsAccount({ isGuest, accessToken }: Options) {
  // 회원 번호. 서버가 주는 공개 번호(K7Q2M9XA4D)를 보여 주고, 서버 배포 전에는 예전처럼 토큰 sub(= userId)를 #123 으로 보여 준다.
  // 누르는 동작 없이 보여 주기만 한다. 토큰이 이상하면 줄을 숨긴다.
  const memberId = useMemo(() => getUserIdFromToken(accessToken), [accessToken])

  // 앱 닉네임. 백엔드에 API 가 아직 없으면(배포 전) 줄을 숨긴다.
  // 토큰은 ref 로 읽는다. deps 에 넣으면 401 → 재발급으로 토큰이 바뀔 때마다 다시 불러, 배포 전 서버(없는 경로에 401)에서
  // 재발급이 꼬리를 문다. 재발급 뒤 재요청은 client 가 알아서 한다.
  const accessTokenRef = useRef(accessToken)
  accessTokenRef.current = accessToken
  // 다시 부르는 기준은 토큰 안의 회원 번호 — 로그인한 채로 계정이 바뀌면(토큰 교체) 바로 다시 부른다(10-08).
  // 토큰 재발급(같은 회원)으로는 바뀌지 않아 재발급마다 다시 부르지 않는다.
  const profileResource = useApiResource<MyProfile>(
    (signal) => getMyProfile(accessTokenRef.current as string, signal),
    [isGuest, memberId],
    { enabled: !isGuest && !!accessToken && !isNicknameApiKnownMissing(), refetchOnForeground: false },
  )
  // 저장 직후 응답을 바로 보여 주고, 다음 조회 결과가 오면 그걸 따른다.
  const [savedProfile, setSavedProfile] = useState<MyProfile | null>(null)
  useEffect(() => setSavedProfile(null), [profileResource.data])
  const profile = visibleProfile(savedProfile ?? profileResource.data, memberId)
  const nicknameApiMissing = !profile && isNicknameApiKnownMissing()
  // 계정 정보를 받아 왔을 때만(구서버라 닉네임 API 가 없으면 예전처럼) 닉네임·내 제보 내역을 보인다.
  // 토큰이 만료됐거나 서버에 닿지 않아 못 받아 오면 두 줄을 숨긴다('불러오지 못함' 줄을 남기지 않는다).
  const accountLoaded = profile != null || nicknameApiMissing

  // 공개 회원 번호. 닉네임과 같은 이유로 토큰은 ref 로 읽고, API 가 없으면(배포 전) 다시 부르지 않는다.
  // 받은 번호가 어느 회원 것인지 함께 둔다 — 계정이 바뀐 직후 이전 회원 번호가 보이지 않게(10-08).
  const memberCodeResource = useApiResource<{ ownerId: number | null; code: string | null }>(
    (signal) => {
      const ownerId = memberId
      return getMyMemberCode(accessTokenRef.current as string, signal).then((code) => ({ ownerId, code }))
    },
    [isGuest, memberId],
    { enabled: !isGuest && !!accessToken && !isMemberCodeApiKnownMissing(), refetchOnForeground: false },
  )
  const memberNumber = resolveMemberNumber({
    memberId,
    codeData: memberCodeResource.data,
    profileMemberCode: profile?.memberCode,
    codeApiMissing: isMemberCodeApiKnownMissing(),
  })

  // 내 제보 내역. 개수(승인 대기 배지)를 먼저 받아, 서버에 API 가 없으면(배포 전 404/405/재발급 뒤 401) 줄을 숨긴다.
  const myReportCountResource = useApiResource<MyReportCount>(
    (signal) => getMyReportCount(accessTokenRef.current as string, signal),
    [isGuest],
    { enabled: !isGuest && !!accessToken && !isMyReportsApiKnownMissing() },
  )
  const myReportsApiMissing = isMyReportsApiKnownMissing()
  const myReportPending = myReportCountResource.data?.pending ?? 0

  return {
    memberId,
    profile,
    setSavedProfile,
    nicknameApiMissing,
    accountLoaded,
    memberNumber,
    memberCodeLoading: memberCodeResource.loading,
    myReportsApiMissing,
    myReportPending,
    refreshMyReportCount: myReportCountResource.retry,
  }
}
